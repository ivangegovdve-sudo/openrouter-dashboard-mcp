import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import {
  providerListResponseSchema,
  publicModelsResponseSchema,
} from "../dashboard/schemas/openrouter.js";
import {
  READ_ONLY_TOOL_ANNOTATIONS,
  safeDashboardError,
  safeDashboardErrorSchema,
  sourceEvidence,
  sourceEvidenceSchema,
  toolResult,
} from "./shared.js";

const MODELS_ENDPOINT = "/api/public/v2/models";
const PROVIDERS_ENDPOINT_TEMPLATE = "/api/public/v2/models/{id}/providers";

/**
 * Upstream caps `/models` at 100 rows per page, and orders by weekly rank. Reading
 * one page and calling the result "cheapest" would mean "cheapest among the 100
 * most popular", which is a different and misleading claim — so this pages through
 * the catalogue instead, up to a bound that is reported when it is reached.
 */
export const MODEL_ECONOMICS_PAGE_SIZE = 100;
export const MODEL_ECONOMICS_MAX_PAGES = 6;
export const MODEL_ECONOMICS_LIMIT =
  MODEL_ECONOMICS_PAGE_SIZE * MODEL_ECONOMICS_MAX_PAGES;

/**
 * How many models may be enriched with per-endpoint discount data in one call.
 *
 * Discounts are an endpoint fact, so each enriched model costs one extra upstream
 * request. The bound exists so a routing query cannot turn into 200 round trips;
 * whatever it leaves out is reported rather than implied to carry no discount.
 */
export const DISCOUNT_ENRICHMENT_LIMIT = 12;

/**
 * Shift an exact decimal string left by `places` digits without going through a
 * float. Prices arrive as strings precisely so that 0.00000000000000000000 does
 * not become 0 and 1.5e-7 does not become 1.4999999999999998e-7; converting to a
 * number to compute a per-million price would throw that away at the last step.
 */
export function shiftDecimalString(value: string, places: number): string | null {
  const match = /^(-?)(\d+)(?:\.(\d*))?$/.exec(value);
  if (match === null) return null;
  const [, sign = "", whole = "0", fraction = ""] = match;
  const digits = `${whole}${fraction}`;
  const pointFromRight = fraction.length - places;
  let result: string;
  if (pointFromRight <= 0) {
    result = `${digits}${"0".repeat(-pointFromRight)}`;
  } else {
    const cut = digits.length - pointFromRight;
    const left = cut <= 0 ? "0" : digits.slice(0, cut);
    const right = `${"0".repeat(Math.max(0, -cut))}${digits.slice(Math.max(0, cut))}`;
    result = `${left}.${right}`;
  }
  const normalized = result
    .replace(/^(\d+)(\.\d*?)0+$/, "$1$2")
    .replace(/\.$/, "")
    .replace(/^0+(\d)/, "$1");
  return `${sign}${normalized}`;
}

function usdPerMillionTokens(value: string | null): string | null {
  if (value === null) return null;
  return shiftDecimalString(value, 6);
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const entries = value.filter((entry): entry is string => typeof entry === "string");
  return entries.length === value.length ? entries : null;
}

function architectureModalities(architecture: Record<string, unknown>): {
  inputModalities: string[] | null;
  outputModalities: string[] | null;
} {
  return {
    inputModalities: stringArray(architecture["input_modalities"]),
    outputModalities: stringArray(architecture["output_modalities"]),
  };
}

export const discountCoverageSchema = z.enum([
  /** Endpoint observations were read and a non-zero published discount was found. */
  "discounted",
  /**
   * Endpoint observations were read and every endpoint published either no
   * discount field or a zero one. This is a positive observation of "full price",
   * and is the only value here that licenses that conclusion.
   */
  "no_discount",
  /** Not enriched because the per-call enrichment bound was reached. Unknown. */
  "not_checked",
  /**
   * No endpoint observation exists for this model. Upstream collects provider
   * endpoints under a daily request budget, so most of the catalogue is simply
   * unobserved at any moment. Unknown — emphatically not "full price".
   */
  "unavailable",
]);

export const retirementRiskSchema = z.enum([
  /** Listed, no deprecation or expiry published. Safe to pin today. */
  "none",
  /** An expiry date is published but is not yet within the alert horizon. */
  "dated",
  /** Deprecated, or expiring within 90 days. Do not pin; route with a fallback. */
  "imminent",
]);

const RETIREMENT_ALERT_DAYS = 90;

export function retirementRisk(
  lifecycleState: string,
  expirationDate: string | null,
  asOfIso: string,
): z.infer<typeof retirementRiskSchema> {
  if (lifecycleState === "deprecated" || lifecycleState === "retired") {
    return "imminent";
  }
  if (expirationDate === null) return "none";
  const expiresAtMs = Date.parse(`${expirationDate}T00:00:00Z`);
  const asOfMs = Date.parse(asOfIso);
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(asOfMs)) return "dated";
  const days = (expiresAtMs - asOfMs) / 86_400_000;
  return days <= RETIREMENT_ALERT_DAYS ? "imminent" : "dated";
}

const modelDiscountSchema = z
  .object({
    /** Ratio off list price in [0, 1]; 0.9 means 90% off. Exact string, not a float. */
    ratio: z.string(),
    /** The same number as a percentage, because that is how an operator reads it. */
    percentOff: z.string(),
    /** Named so the number is checkable against that provider's own page. */
    providerName: z.string(),
    observedAt: z.string(),
    /**
     * OpenRouter publishes a discount ratio and no end date. This is null because
     * nothing upstream says when the cut stops — never because it is permanent.
     */
    expiresAt: z.null(),
    expiryPublished: z.literal(false),
  })
  .strict();

const economicsModelSchema = z
  .object({
    id: z.string(),
    canonicalSlug: z.string(),
    name: z.string(),
    /**
     * Upstream marks every model description `untrusted-source`. It is vendor
     * marketing copy that reaches a router's context, so it is carried with its
     * trust label attached and must never be read as an instruction.
     */
    contentTrust: z.literal("untrusted-source"),
    contextLength: z.string().nullable(),
    inputModalities: z.array(z.string()).nullable(),
    outputModalities: z.array(z.string()).nullable(),
    /**
     * True only when the model emits text. A zero-priced music or video model is
     * genuinely free and genuinely useless as a chat model; the cheapest free
     * model is a music generator unless this is checked first.
     */
    emitsText: z.boolean().nullable(),
    pricing: z
      .object({
        promptUsdPerToken: z.string().nullable(),
        completionUsdPerToken: z.string().nullable(),
        promptUsdPerMillionTokens: z.string().nullable(),
        completionUsdPerMillionTokens: z.string().nullable(),
      })
      .strict(),
    /**
     * `concrete_free` is a real zero-priced model. `free_router` is OpenRouter's
     * rate-limited free routing tier — usable for a probe, not for a workload.
     * `paid_or_unknown` includes providers that publish no price at all, which is
     * unknown and must not be treated as free.
     */
    freeKind: z.enum(["concrete_free", "free_router", "paid_or_unknown"]),
    /** True only for `concrete_free`. A rate-limited free tier is not this. */
    genuinelyFree: z.boolean(),
    lifecycleState: z.string(),
    expirationDate: z.string().nullable(),
    retirementRisk: retirementRiskSchema,
    weeklyRank: z.number().int().positive().nullable(),
    supportedParameters: z.array(z.string()),
    /** Whether the model accepts tool calls at all — a hard gate for agent work. */
    supportsTools: z.boolean(),
    supportsReasoning: z.boolean(),
    bestDiscount: modelDiscountSchema.nullable(),
    discountCoverage: discountCoverageSchema,
  })
  .strict();

export const modelEconomicsInputSchema = z
  .object({
    /**
     * Restrict the answer to these exact model ids. This is the "audit my pins"
     * query: hand it the slugs a config hardcodes and it reports what each one
     * now costs, whether it is discounted, and whether it is about to retire.
     * Ids that are not in the catalogue are reported in `missingIds` rather than
     * silently dropped, because a pin that has vanished is the whole point.
     */
    ids: z.array(z.string().min(1)).min(1).max(50).optional(),
    /**
     * Keep only models that emit this modality. Defaults to `text` because a
     * router asking about cost is asking about a chat model.
     */
    outputModality: z.string().min(1).max(32).default("text"),
    /** Keep only models whose context window is at least this many tokens. */
    minContextLength: z.number().int().positive().optional(),
    /** Keep only genuinely free models. Excludes the rate-limited free router. */
    genuinelyFreeOnly: z.boolean().default(false),
    /** Drop models that are deprecated or expiring inside the alert horizon. */
    excludeRetirementRisk: z.boolean().default(false),
    /** Keep only models that accept tool calls. */
    requireTools: z.boolean().default(false),
    /**
     * How many models to enrich with per-endpoint discount data, cheapest first.
     * Zero skips the enrichment entirely and returns `not_checked`.
     */
    discountEnrichment: z
      .number()
      .int()
      .min(0)
      .max(DISCOUNT_ENRICHMENT_LIMIT)
      .default(5),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

const modelEconomicsSuccessSchema = z
  .object({
    status: z.enum(["ok", "partial"]),
    summary: z.string(),
    models: z.array(economicsModelSchema),
    /**
     * Requested ids that the catalogue does not contain. A pinned slug landing
     * here is the 404 a config is about to hit, observed before it happens.
     */
    missingIds: z.array(z.string()),
    discounts: z
      .object({
        /** False only when every attempted lookup failed. */
        sourceAvailable: z.boolean(),
        modelsEnriched: z.number().int().min(0),
        modelsDiscounted: z.number().int().min(0),
        /**
         * Models whose endpoints upstream has not observed. Counted separately
         * from `modelsEnriched` so partial coverage never reads as full coverage.
         */
        modelsUnobserved: z.number().int().min(0),
        /**
         * States plainly that unchecked models are unchecked. Discount coverage
         * is partial by construction upstream, so silence here would read as
         * "nothing is discounted", which is a different and false claim.
         */
        note: z.string(),
      })
      .strict(),
    evidence: z.array(sourceEvidenceSchema),
    warnings: z.array(z.string()),
    cap: z
      .object({
        catalogueLimit: z.literal(MODEL_ECONOMICS_LIMIT),
        catalogueTruncated: z.boolean(),
        returnedLimit: z.number().int().positive(),
        matchedBeforeLimit: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

const modelEconomicsErrorSchema = z
  .object({
    status: z.literal("error"),
    summary: z.string(),
    error: safeDashboardErrorSchema,
  })
  .strict();

export const modelEconomicsOutputSchema = z.discriminatedUnion("status", [
  modelEconomicsSuccessSchema,
  modelEconomicsErrorSchema,
]);

export type ModelEconomicsInput = z.input<typeof modelEconomicsInputSchema>;
export type ModelEconomicsOutput = z.infer<typeof modelEconomicsOutputSchema>;

export type ModelEconomicsDependencies = {
  client: DashboardClient;
  /** Injected so retirement risk is deterministic under test. */
  now?: () => Date;
};

function comparablePrice(value: string | null): number {
  if (value === null) return Number.POSITIVE_INFINITY;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export async function runModelEconomics(
  rawInput: ModelEconomicsInput,
  { client, now = () => new Date() }: ModelEconomicsDependencies,
): Promise<ModelEconomicsOutput> {
  const input = modelEconomicsInputSchema.parse(rawInput);
  const asOfIso = now().toISOString();

  const pages: Array<z.infer<typeof publicModelsResponseSchema>> = [];
  let cursor: string | null = null;
  try {
    for (let page = 0; page < MODEL_ECONOMICS_MAX_PAGES; page += 1) {
      const query = new URLSearchParams({
        limit: String(MODEL_ECONOMICS_PAGE_SIZE),
      });
      if (cursor !== null) query.set("cursor", cursor);
      const response: z.infer<typeof publicModelsResponseSchema> =
        await client.get(MODELS_ENDPOINT, query, publicModelsResponseSchema);
      pages.push(response);
      cursor = response.cursor;
      if (cursor === null) break;
    }
  } catch (error) {
    const safeError = safeDashboardError(error);
    return { status: "error", summary: safeError.message, error: safeError };
  }

  const catalogue = {
    data: pages.flatMap((page) => page.data),
    cursor,
    stale: pages.some((page) => page.stale),
  };

  const warnings: string[] = [];
  const candidates = catalogue.data
    .map((model) => {
      const architecture = model.architecture as Record<string, unknown>;
      const { inputModalities, outputModalities } =
        architectureModalities(architecture);
      const promptPrice = model.pricing["prompt"] ?? null;
      const completionPrice = model.pricing["completion"] ?? null;
      const supportedParameters = model.supportedParameters;
      return {
        id: model.id,
        canonicalSlug: model.canonicalSlug,
        name: model.name,
        contentTrust: model.contentTrust,
        contextLength: model.contextLength,
        inputModalities,
        outputModalities,
        emitsText:
          outputModalities === null ? null : outputModalities.includes("text"),
        pricing: {
          promptUsdPerToken: promptPrice,
          completionUsdPerToken: completionPrice,
          promptUsdPerMillionTokens: usdPerMillionTokens(promptPrice),
          completionUsdPerMillionTokens: usdPerMillionTokens(completionPrice),
        },
        freeKind: model.freeKind,
        genuinelyFree: model.freeKind === "concrete_free",
        lifecycleState: model.lifecycleState,
        expirationDate: model.expirationDate,
        retirementRisk: retirementRisk(
          model.lifecycleState,
          model.expirationDate,
          asOfIso,
        ),
        weeklyRank: model.weeklyRank,
        supportedParameters,
        supportsTools: supportedParameters.includes("tools"),
        supportsReasoning:
          supportedParameters.includes("reasoning") ||
          supportedParameters.includes("include_reasoning"),
        bestDiscount: null as z.infer<typeof modelDiscountSchema> | null,
        discountCoverage: "not_checked" as z.infer<typeof discountCoverageSchema>,
      };
    })
    .filter((model) => {
      if (input.ids !== undefined) {
        return (
          input.ids.includes(model.id) || input.ids.includes(model.canonicalSlug)
        );
      }
      if (model.outputModalities !== null) {
        if (!model.outputModalities.includes(input.outputModality)) return false;
      }
      if (input.minContextLength !== undefined) {
        if (model.contextLength === null) return false;
        if (Number(model.contextLength) < input.minContextLength) return false;
      }
      if (input.genuinelyFreeOnly && !model.genuinelyFree) return false;
      if (input.excludeRetirementRisk && model.retirementRisk === "imminent") {
        return false;
      }
      if (input.requireTools && !model.supportsTools) return false;
      return true;
    });

  candidates.sort((left, right) => {
    const byPrompt =
      comparablePrice(left.pricing.promptUsdPerToken) -
      comparablePrice(right.pricing.promptUsdPerToken);
    if (byPrompt !== 0) return byPrompt;
    const byCompletion =
      comparablePrice(left.pricing.completionUsdPerToken) -
      comparablePrice(right.pricing.completionUsdPerToken);
    if (byCompletion !== 0) return byCompletion;
    return left.id.localeCompare(right.id);
  });

  const matchedBeforeLimit = candidates.length;
  const models = candidates.slice(0, input.limit);

  const found = new Set(
    candidates.flatMap((model) => [model.id, model.canonicalSlug]),
  );
  const missingIds = (input.ids ?? []).filter((id) => !found.has(id));
  if (missingIds.length > 0) {
    warnings.push(
      `${missingIds.length} requested model id${missingIds.length === 1 ? " is" : "s are"} not in the catalogue and will 404 if called: ${missingIds.join(", ")}.`,
    );
  }

  const evidence = pages.map((page) => sourceEvidence(MODELS_ENDPOINT, page));
  let modelsEnriched = 0;
  let modelsDiscounted = 0;
  let modelsUnobserved = 0;

  const enrichmentTargets = models.slice(0, input.discountEnrichment);
  for (const model of enrichmentTargets) {
    const endpoint = PROVIDERS_ENDPOINT_TEMPLATE.replace("{id}", model.id);
    try {
      const providers = await client.get(
        `/api/public/v2/models/${encodeURIComponent(model.id)}/providers`,
        new URLSearchParams(),
        providerListResponseSchema,
      );
      modelsEnriched += 1;
      evidence.push(sourceEvidence(endpoint, providers));
      let best: z.infer<typeof modelDiscountSchema> | null = null;
      for (const row of providers.data) {
        if (row.discount === null) continue;
        const ratio = Number(row.discount);
        if (!Number.isFinite(ratio) || ratio <= 0) continue;
        if (best !== null && Number(best.ratio) >= ratio) continue;
        const percentOff = shiftDecimalString(row.discount, 2);
        best = {
          ratio: row.discount,
          percentOff: percentOff ?? row.discount,
          providerName: row.provider,
          observedAt: row.fetchedAt,
          expiresAt: null,
          expiryPublished: false,
        };
      }
      model.bestDiscount = best;
      model.discountCoverage = best === null ? "no_discount" : "discounted";
      if (best !== null) modelsDiscounted += 1;
    } catch {
      modelsUnobserved += 1;
      model.discountCoverage = "unavailable";
    }
  }

  const sourceAvailable =
    enrichmentTargets.length === 0 || modelsEnriched > 0;
  if (modelsUnobserved > 0) {
    warnings.push(
      `${modelsUnobserved} model${modelsUnobserved === 1 ? " has" : "s have"} no upstream endpoint observation, so their discount state is unknown rather than absent. Upstream observes provider endpoints under a daily request budget, so most of the catalogue is unobserved at any moment.`,
    );
  }
  const uncheckedCount = models.length - enrichmentTargets.length;
  if (uncheckedCount > 0) {
    warnings.push(
      `${uncheckedCount} returned model${uncheckedCount === 1 ? " was" : "s were"} not checked for discounts; raise discountEnrichment to cover more.`,
    );
  }
  if (catalogue.stale) {
    warnings.push("The upstream model catalogue is marked stale.");
  }
  if (matchedBeforeLimit > models.length) {
    warnings.push(
      `${matchedBeforeLimit - models.length} further matching models were omitted by the requested limit.`,
    );
  }

  const catalogueTruncated = catalogue.cursor !== null;
  if (catalogueTruncated) {
    warnings.push(
      `The catalogue did not fit in ${MODEL_ECONOMICS_LIMIT} scanned models, so cheaper models may exist beyond that bound.`,
    );
  }

  const discountNote = !sourceAvailable
    ? "No endpoint observation could be read for any attempted model, so no discount conclusion is available. Absence of a discount here is not evidence there is none."
    : `${modelsEnriched} of ${models.length} returned models had observed endpoints and were checked; ${modelsUnobserved} were unobserved upstream and ${uncheckedCount} were not attempted. Only models marked no_discount are known to be at full price.`;

  const status =
    !sourceAvailable || warnings.length > 0 ? ("partial" as const) : ("ok" as const);

  return {
    status,
    summary: `${models.length} of ${matchedBeforeLimit} matching models returned, cheapest first; ${modelsDiscounted} carry a published discount.`,
    models,
    missingIds,
    discounts: {
      sourceAvailable,
      modelsEnriched,
      modelsDiscounted,
      modelsUnobserved,
      note: discountNote,
    },
    evidence,
    warnings,
    cap: {
      catalogueLimit: MODEL_ECONOMICS_LIMIT,
      catalogueTruncated,
      returnedLimit: input.limit,
      matchedBeforeLimit,
    },
  };
}

export function registerModelEconomics(
  server: McpServer,
  dependencies: ModelEconomicsDependencies,
): void {
  server.registerTool(
    "dashboard_model_economics",
    {
      title: "Dashboard model economics",
      description:
        "Compare live models on the facts a router decides with: input and output price per token and per million tokens, published provider discounts, context length, output modality, tool and reasoning support, retirement risk, and whether a model is genuinely free or only rate-limited free. Returns cheapest first. Unchecked and unavailable discount data are reported as such and never as an absent discount.",
      inputSchema: modelEconomicsInputSchema,
      outputSchema: modelEconomicsOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runModelEconomics(input, dependencies)),
  );
}

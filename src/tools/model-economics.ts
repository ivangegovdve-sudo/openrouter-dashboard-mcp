import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import { liveModelsResponseSchema } from "../dashboard/schemas/live-models.js";
import {
  providerListResponseSchema,
  publicModelsResponseSchema,
} from "../dashboard/schemas/openrouter.js";
import {
  PROVIDER_IDS,
  PROVIDER_REGISTRY,
  providerIdSchema,
  unpricedReason,
  type ProviderId,
} from "../providers/registry.js";
import {
  READ_ONLY_TOOL_ANNOTATIONS,
  safeDashboardError,
  safeDashboardErrorSchema,
  sourceEvidence,
  sourceEvidenceSchema,
  toolResult,
} from "./shared.js";

/**
 * The cross-provider catalogue. This is the source that makes the tool an Open
 * Dashboard rather than an OpenRouter dashboard: it carries OpenRouter, Groq and
 * Cerebras in one normalized shape.
 */
const LIVE_MODELS_ENDPOINT = "/api/public/v2/live-models";
/** OpenRouter-only. Contributes lifecycle, deprecation and rank, which the other two do not publish. */
const MODELS_ENDPOINT = "/api/public/v2/models";
const PROVIDERS_ENDPOINT_TEMPLATE = "/api/public/v2/models/{id}/providers";

const LIVE_PAGE_SIZE = 500;
const LIVE_MAX_PAGES = 4;
export const MODEL_ECONOMICS_LIMIT = LIVE_PAGE_SIZE * LIVE_MAX_PAGES;

/** Upstream caps the OpenRouter catalogue at 100 rows per page. */
const OPENROUTER_PAGE_SIZE = 100;
const OPENROUTER_MAX_PAGES = 6;
/** Provider-endpoint listings are short, but they do paginate. */
const PROVIDER_MAX_PAGES = 5;

/**
 * How many models may be enriched with per-endpoint discount data in one call.
 * Each costs one extra upstream request, so the bound stops a routing query
 * becoming hundreds of round trips. What it leaves out is reported, never implied
 * to carry no discount.
 */
export const DISCOUNT_ENRICHMENT_LIMIT = 12;

/**
 * Shift an exact decimal string left by `places` digits without going through a
 * float. Prices arrive as strings precisely so that 0.00000000000000000000 does
 * not become 0 and 0.000000088606 does not pick up float noise; converting to a
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

export const discountCoverageSchema = z.enum([
  /** Endpoint observations were read and a non-zero published discount was found. */
  "discounted",
  /**
   * Endpoint observations were read and every endpoint published nothing or zero.
   * The only value here that means full price.
   */
  "no_discount",
  /** The provider publishes no discounts at all, so there is nothing to look up. */
  "not_published_by_provider",
  /** Not enriched because the per-call enrichment bound was reached. Unknown. */
  "not_checked",
  /**
   * No endpoint observation exists for this model. Upstream observes provider
   * endpoints under a daily request budget, so most of the catalogue is unobserved
   * at any moment. Unknown — emphatically not "full price".
   */
  "unavailable",
]);

export const retirementRiskSchema = z.enum([
  /**
   * The provider positively states there is no announced expiration. This is the
   * only value that means "safe to pin", and it is only ever reached from an
   * explicit `no_announced_expiration`, never from an unrecognised or absent one.
   */
  "none",
  /** An expiry date is published and is beyond the alert horizon. */
  "dated",
  /**
   * Deprecated, expiring within 90 days, past its expiry, or already gone from
   * the catalogue. Do not pin; route with a fallback.
   */
  "imminent",
  /**
   * The provider publishes no lifecycle signal at all, so retirement cannot be
   * foreseen — only observed after the fact when the model stops being listed.
   * True of Groq and Cerebras. Unknown, not safe.
   */
  "not_published_by_provider",
  /**
   * The provider publishes lifecycle for its catalogue but says nothing usable
   * for this model — an explicit `expiration_unknown`, or a state this build does
   * not recognise. Unknown, and deliberately not "none": an unreadable lifecycle
   * is the case where a falsely reassuring answer does the most damage.
   */
  "unknown",
]);

const RETIREMENT_ALERT_DAYS = 90;

export function retirementRisk(
  provider: ProviderId,
  lifecycleState: string | null,
  expirationDate: string | null,
  availability: "available" | "disappeared",
  asOfIso: string,
): z.infer<typeof retirementRiskSchema> {
  // A model that has already vanished is the strongest possible signal, and it is
  // the only retirement signal Groq and Cerebras ever give.
  if (availability === "disappeared") return "imminent";
  if (PROVIDER_REGISTRY[provider].publishes.lifecycle === "never") {
    return "not_published_by_provider";
  }
  // Switch exhaustively over the upstream lifecycle enum. An unrecognised value
  // falls to "unknown", never to "none" -- this function previously tested for
  // "deprecated" and "retired", which the upstream schema never emits, so every
  // genuinely retiring model reported "none".
  switch (lifecycleState) {
    case "removed_or_unavailable":
    case "absent_from_catalog":
    case "past_expiration_still_listed":
      // Already gone, or already past the date it was meant to go.
      return "imminent";
    case "scheduled_deprecation": {
      // An announced deprecation is never "none". Undated counts as imminent:
      // a retirement you cannot date is one you cannot plan around.
      if (expirationDate === null) return "imminent";
      const expiresAtMs = Date.parse(`${expirationDate}T00:00:00Z`);
      const asOfMs = Date.parse(asOfIso);
      if (!Number.isFinite(expiresAtMs) || !Number.isFinite(asOfMs)) {
        return "imminent";
      }
      const days = (expiresAtMs - asOfMs) / 86_400_000;
      return days <= RETIREMENT_ALERT_DAYS ? "imminent" : "dated";
    }
    case "no_announced_expiration": {
      // The only route to "none" -- and only when no date contradicts it.
      if (expirationDate === null) return "none";
      const expiresAtMs = Date.parse(`${expirationDate}T00:00:00Z`);
      const asOfMs = Date.parse(asOfIso);
      if (!Number.isFinite(expiresAtMs) || !Number.isFinite(asOfMs)) {
        return "unknown";
      }
      const days = (expiresAtMs - asOfMs) / 86_400_000;
      return days <= RETIREMENT_ALERT_DAYS ? "imminent" : "dated";
    }
    case "expiration_unknown":
    default:
      return "unknown";
  }
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
     * No provider in this registry publishes an end date for a discount. Null
     * because nothing upstream says when the cut stops — never because it is
     * permanent.
     */
    expiresAt: z.null(),
    expiryPublished: z.literal(false),
  })
  .strict();

const economicsModelSchema = z
  .object({
    provider: providerIdSchema,
    id: z.string(),
    displayName: z.string().nullable(),
    ownedBy: z.string().nullable(),
    contextLength: z.string().nullable(),
    outputModalities: z.array(z.string()).nullable(),
    /**
     * True only when the model is known to emit text. Null means the provider
     * publishes no modality at all, which is not the same as "not text". A
     * zero-priced music model is genuinely free and genuinely useless as a chat
     * model, so capability starts by knowing what comes out.
     */
    emitsText: z.boolean().nullable(),
    reasoningEfforts: z.array(z.string()).nullable(),
    pricing: z
      .object({
        promptUsdPerToken: z.string().nullable(),
        completionUsdPerToken: z.string().nullable(),
        promptUsdPerMillionTokens: z.string().nullable(),
        completionUsdPerMillionTokens: z.string().nullable(),
      })
      .strict(),
    /**
     * Whether this row can take part in a cost ranking at all. False for every
     * model whose provider publishes no price — reported rather than dropped, so
     * "cheapest across everything" never quietly means "cheapest among the rows
     * that happened to carry a number".
     */
    priceComparable: z.boolean(),
    /** Stated as a fact about the provider, not as a missing value. */
    unrankableReason: z.string().nullable(),
    /**
     * `concrete_free` is a real zero-priced model. `free_router` is a rate-limited
     * free routing tier — usable for a probe, not for a workload. `paid_or_unknown`
     * includes every provider that publishes no price, which is unknown and must
     * never be treated as free.
     */
    freeKind: z.enum(["concrete_free", "free_router", "paid_or_unknown"]),
    /** True only for `concrete_free`. A rate-limited free tier is not this. */
    genuinelyFree: z.boolean(),
    /** Measured serving speed where upstream holds an observation. */
    performance: z
      .object({
        throughputTps: z.string().nullable(),
        latencyMsP50: z.string().nullable(),
        fastestProvider: z.string().nullable(),
        observedAt: z.string(),
      })
      .strict()
      .nullable(),
    availability: z.enum(["available", "disappeared"]),
    lastConfirmedAt: z.string(),
    absenceStreak: z.string(),
    lifecycleState: z.string().nullable(),
    expirationDate: z.string().nullable(),
    retirementRisk: retirementRiskSchema,
    weeklyRank: z.number().int().positive().nullable(),
    /** Null where the provider publishes no parameter list, which is unknown. */
    supportsTools: z.boolean().nullable(),
    bestDiscount: modelDiscountSchema.nullable(),
    discountCoverage: discountCoverageSchema,
    /** What this provider withheld for this row, named by upstream. */
    missingFields: z.array(z.string()),
  })
  .strict();

const providerReportSchema = z
  .object({
    provider: providerIdSchema,
    displayName: z.string(),
    modelsInCatalogue: z.number().int().min(0),
    modelsMatched: z.number().int().min(0),
    modelsPriceComparable: z.number().int().min(0),
    /** Most recent confirmation across this provider's rows. */
    lastConfirmedAt: z.string().nullable(),
    spendVisibility: z.enum(["api", "no_billing_api"]),
    publishes: z.record(z.string(), z.string()),
    comparabilityNote: z.string(),
  })
  .strict();

export const modelEconomicsInputSchema = z
  .object({
    /**
     * Restrict to these providers. Omitted means all of them, which is the point
     * of the tool — a single-provider answer is what OpenRouter's own MCP already
     * gives.
     */
    providers: z.array(providerIdSchema).min(1).optional(),
    /**
     * Restrict to these exact model ids. The "audit my pins" query: hand it the
     * slugs a config hardcodes and it reports what each now costs, whether it is
     * discounted, and whether it is about to retire. Ids not in any catalogue come
     * back in `missingIds` rather than being silently dropped, because a pin that
     * has vanished is the whole point.
     */
    ids: z.array(z.string().min(1)).min(1).max(50).optional(),
    /** Keep only models known to emit this modality. */
    outputModality: z.string().min(1).max(32).default("text"),
    /**
     * Keep rows whose provider publishes no modality at all. Default true, because
     * excluding Cerebras entirely by default would quietly make this a two-provider
     * tool. Set false when the caller needs a hard capability guarantee.
     */
    includeUnknownCapability: z.boolean().default(true),
    minContextLength: z.number().int().positive().optional(),
    /** Keep only genuinely free models. Excludes the rate-limited free router. */
    genuinelyFreeOnly: z.boolean().default(false),
    /**
     * Drop models that are deprecated, expiring soon, already disappeared, or
     * whose lifecycle is unreadable. Does NOT drop `not_published_by_provider`:
     * that is a whole-provider property the caller can already see, and dropping
     * it would silently exclude Groq and Cerebras entirely.
     */
    excludeRetirementRisk: z.boolean().default(false),
    /** Keep only models known to accept tool calls. Excludes unknowns. */
    requireTools: z.boolean().default(false),
    /** Drop models upstream last saw as disappeared. */
    availableOnly: z.boolean().default(true),
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
    checkedAt: z.string(),
    models: z.array(economicsModelSchema),
    /**
     * Requested ids absent from every provider catalogue. A pinned slug landing
     * here is the 404 a config is about to hit, observed before it happens.
     */
    missingIds: z.array(z.string()),
    /** One entry per provider that took part, with what it does and does not publish. */
    providers: z.array(providerReportSchema),
    comparability: z
      .object({
        /** Matched models that could be ranked on price. */
        priceComparable: z.number().int().min(0),
        /** Matched models excluded from the ranking because no price is published. */
        priceUnknown: z.number().int().min(0),
        /**
         * Says plainly how much of the answer the ranking actually covers, so
         * "cheapest" is never read as "cheapest of everything" when it is not.
         */
        note: z.string(),
      })
      .strict(),
    discounts: z
      .object({
        sourceAvailable: z.boolean(),
        modelsEnriched: z.number().int().min(0),
        modelsDiscounted: z.number().int().min(0),
        modelsUnobserved: z.number().int().min(0),
        /**
         * Observed, but the endpoint listing was cut short before its end, so a
         * discount may sit on a page never read. Counted apart from
         * `modelsUnobserved` so the buckets do not overlap.
         */
        modelsTruncated: z.number().int().min(0),
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

type OpenRouterExtra = {
  lifecycleState: string;
  expirationDate: string | null;
  supportedParameters: string[];
  weeklyRank: number | null;
};

export async function runModelEconomics(
  rawInput: ModelEconomicsInput,
  { client, now = () => new Date() }: ModelEconomicsDependencies,
): Promise<ModelEconomicsOutput> {
  const input = modelEconomicsInputSchema.parse(rawInput);
  const asOfIso = now().toISOString();
  const warnings: string[] = [];
  const evidence: z.infer<typeof sourceEvidenceSchema>[] = [];

  // 1. The cross-provider catalogue, paged. Sorting is done here rather than
  //    upstream because upstream cannot page and rank at the same time, and a
  //    cross-provider ranking needs every row before it can order them.
  const livePages: Array<z.infer<typeof liveModelsResponseSchema>> = [];
  let liveCursor: string | null = null;
  try {
    for (let page = 0; page < LIVE_MAX_PAGES; page += 1) {
      const query = new URLSearchParams({ limit: String(LIVE_PAGE_SIZE) });
      if (liveCursor !== null) query.set("cursor", liveCursor);
      const response: z.infer<typeof liveModelsResponseSchema> = await client.get(
        LIVE_MODELS_ENDPOINT,
        query,
        liveModelsResponseSchema,
      );
      livePages.push(response);
      evidence.push(sourceEvidence(LIVE_MODELS_ENDPOINT, response));
      liveCursor = response.cursor;
      if (liveCursor === null) break;
    }
  } catch (error) {
    const safeError = safeDashboardError(error);
    return { status: "error", summary: safeError.message, error: safeError };
  }

  const liveRows = livePages.flatMap((page) => page.data);

  // 2. OpenRouter-only enrichment. Groq and Cerebras publish no lifecycle, rank or
  //    parameter list, so there is nothing equivalent to fetch for them — that is a
  //    fact recorded in the provider registry, not an omission here.
  const openRouterExtras = new Map<string, OpenRouterExtra>();
  const wantsOpenRouter =
    input.providers === undefined || input.providers.includes("openrouter");
  if (wantsOpenRouter) {
    let cursor: string | null = null;
    try {
      for (let page = 0; page < OPENROUTER_MAX_PAGES; page += 1) {
        const query = new URLSearchParams({
          limit: String(OPENROUTER_PAGE_SIZE),
        });
        if (cursor !== null) query.set("cursor", cursor);
        const response: z.infer<typeof publicModelsResponseSchema> =
          await client.get(MODELS_ENDPOINT, query, publicModelsResponseSchema);
        evidence.push(sourceEvidence(MODELS_ENDPOINT, response));
        for (const model of response.data) {
          openRouterExtras.set(model.id, {
            lifecycleState: model.lifecycleState,
            expirationDate: model.expirationDate,
            supportedParameters: model.supportedParameters,
            weeklyRank: model.weeklyRank,
          });
        }
        cursor = response.cursor;
        if (cursor === null) break;
      }
    } catch {
      warnings.push(
        "The OpenRouter catalogue could not be read, so lifecycle, deprecation and rank are unknown for OpenRouter models in this answer. Cross-provider pricing is unaffected.",
      );
    }
  }

  // 3. Normalize every provider into one comparable row.
  const candidates = liveRows.map((row) => {
    const extra = openRouterExtras.get(row.id);
    const descriptor = PROVIDER_REGISTRY[row.provider];
    const promptPrice = row.pricing.promptUsdPerToken;
    const completionPrice = row.pricing.completionUsdPerToken;
    // Both halves are required. A prompt-priced, completion-unpriced model has an
    // unknown total cost and must not be able to rank as cheapest on half a price.
    const priceComparable = promptPrice !== null && completionPrice !== null;
    const supportsTools =
      row.provider === "openrouter" && extra !== undefined
        ? extra.supportedParameters.includes("tools")
        : null;
    return {
      provider: row.provider,
      id: row.id,
      displayName: row.displayName,
      ownedBy: row.ownedBy,
      contextLength: row.contextLength,
      outputModalities: row.outputModalities,
      emitsText:
        row.outputModalities === null ? null : row.outputModalities.includes("text"),
      reasoningEfforts: row.reasoningEfforts,
      pricing: {
        promptUsdPerToken: promptPrice,
        completionUsdPerToken: completionPrice,
        promptUsdPerMillionTokens: usdPerMillionTokens(promptPrice),
        completionUsdPerMillionTokens: usdPerMillionTokens(completionPrice),
      },
      priceComparable,
      unrankableReason: priceComparable
        ? null
        : promptPrice !== null || completionPrice !== null
          ? // Half a price is not a price. Saying the provider "publishes none"
            // here would be false -- it published one of the two.
            `${PROVIDER_REGISTRY[row.provider].displayName} published only the ${promptPrice !== null ? "prompt" : "completion"} price for this model, so its total cost is unknown — not free, and not comparable.`
          : unpricedReason(row.provider),
      freeKind: row.freeKind,
      genuinelyFree: row.freeKind === "concrete_free",
      performance: row.performance,
      availability: row.availability,
      lastConfirmedAt: row.lastConfirmedAt,
      absenceStreak: row.absenceStreak,
      lifecycleState: extra?.lifecycleState ?? null,
      expirationDate: extra?.expirationDate ?? null,
      retirementRisk: retirementRisk(
        row.provider,
        extra?.lifecycleState ?? null,
        extra?.expirationDate ?? null,
        row.availability,
        asOfIso,
      ),
      weeklyRank: extra?.weeklyRank ?? null,
      supportsTools,
      bestDiscount: null as z.infer<typeof modelDiscountSchema> | null,
      discountCoverage:
        descriptor.publishes.discounts === "never"
          ? ("not_published_by_provider" as z.infer<typeof discountCoverageSchema>)
          : ("not_checked" as z.infer<typeof discountCoverageSchema>),
      missingFields: row.missingFields,
    };
  });

  const matched = candidates.filter((model) => {
    if (input.providers !== undefined && !input.providers.includes(model.provider)) {
      return false;
    }
    if (input.ids !== undefined) return input.ids.includes(model.id);
    if (input.availableOnly && model.availability !== "available") return false;
    if (model.outputModalities === null) {
      if (!input.includeUnknownCapability) return false;
    } else if (!model.outputModalities.includes(input.outputModality)) {
      return false;
    }
    if (input.minContextLength !== undefined) {
      if (model.contextLength === null) {
        if (!input.includeUnknownCapability) return false;
      } else if (Number(model.contextLength) < input.minContextLength) {
        return false;
      }
    }
    if (input.genuinelyFreeOnly && !model.genuinelyFree) return false;
    if (
      input.excludeRetirementRisk &&
      (model.retirementRisk === "imminent" || model.retirementRisk === "unknown")
    ) {
      return false;
    }
    if (input.requireTools && model.supportsTools !== true) return false;
    return true;
  });

  // Priced rows rank first, cheapest first. Unpriced rows keep their place in the
  // answer rather than vanishing from it, ordered after everything rankable.
  matched.sort((left, right) => {
    if (left.priceComparable !== right.priceComparable) {
      return left.priceComparable ? -1 : 1;
    }
    const byPrompt =
      comparablePrice(left.pricing.promptUsdPerToken) -
      comparablePrice(right.pricing.promptUsdPerToken);
    if (byPrompt !== 0) return byPrompt;
    const byCompletion =
      comparablePrice(left.pricing.completionUsdPerToken) -
      comparablePrice(right.pricing.completionUsdPerToken);
    if (byCompletion !== 0) return byCompletion;
    if (left.provider !== right.provider) {
      return left.provider.localeCompare(right.provider);
    }
    return left.id.localeCompare(right.id);
  });

  const matchedBeforeLimit = matched.length;
  const models = matched.slice(0, input.limit);

  // `ids` deliberately reports each pin exactly as it is -- a pin that is
  // retiring or unpriced is the answer, not something to filter away. But
  // silently ignoring filters the caller explicitly set would be a lie about
  // what the result means, so say it.
  if (input.ids !== undefined) {
    const ignored = [
      input.excludeRetirementRisk ? "excludeRetirementRisk" : null,
      input.requireTools ? "requireTools" : null,
      input.genuinelyFreeOnly ? "genuinelyFreeOnly" : null,
      input.minContextLength !== undefined ? "minContextLength" : null,
      input.includeUnknownCapability === false ? "includeUnknownCapability" : null,
      // These two have defaults, and the defaults are bypassed too.
      "outputModality",
      input.availableOnly ? "availableOnly" : null,
    ].filter((name): name is string => name !== null);
    if (ignored.length > 0) {
      warnings.push(
        `An explicit id list reports each model as it is, so ${ignored.join(", ")} ${ignored.length === 1 ? "was" : "were"} not applied. Drop \`ids\` to filter instead of audit.`,
      );
    }
  }

  const knownIds = new Set(candidates.map((model) => model.id));
  const missingIds = (input.ids ?? []).filter((id) => !knownIds.has(id));
  if (missingIds.length > 0) {
    warnings.push(
      `${missingIds.length} requested model id${missingIds.length === 1 ? " is" : "s are"} in no provider catalogue and will fail if called: ${missingIds.join(", ")}.`,
    );
  }

  // 4. Discounts, for the providers that publish any.
  let modelsEnriched = 0;
  let modelsDiscounted = 0;
  let modelsUnobserved = 0;
  // Observed, but the endpoint listing was cut short. Distinct from unobserved:
  // counting it as both would make the buckets overlap and the warning lie.
  let modelsTruncated = 0;
  const enrichable = models.filter(
    (model) => PROVIDER_REGISTRY[model.provider].publishes.discounts !== "never",
  );
  const enrichmentTargets = enrichable.slice(0, input.discountEnrichment);
  for (const model of enrichmentTargets) {
    const endpoint = PROVIDERS_ENDPOINT_TEMPLATE.replace("{id}", model.id);
    try {
      // Page the endpoint list. Reading only the first page and concluding
      // "no_discount" would be wrong whenever the discounted provider happens to
      // sort onto page two.
      const rows: Array<z.infer<typeof providerListResponseSchema>["data"][number]> = [];
      let providerCursor: string | null = null;
      let firstPage: z.infer<typeof providerListResponseSchema> | null = null;
      const seenCursors = new Set<string>();
      for (let page = 0; page < PROVIDER_MAX_PAGES; page += 1) {
        const query = new URLSearchParams();
        if (providerCursor !== null) query.set("cursor", providerCursor);
        const response: z.infer<typeof providerListResponseSchema> =
          await client.get(
            `/api/public/v2/models/${encodeURIComponent(model.id)}/providers`,
            query,
            providerListResponseSchema,
          );
        firstPage ??= response;
        rows.push(...response.data);
        providerCursor = response.cursor;
        if (providerCursor === null) break;
        // A cursor that repeats would loop forever. Stop -- but the listing was
        // not read to the end, and the cursor is deliberately left non-null so
        // that fact survives below.
        if (seenCursors.has(providerCursor)) break;
        seenCursors.add(providerCursor);
      }
      // Leaving the loop still holding a cursor means the endpoint list was
      // truncated, so a discount may sit on a page that was never read. That is
      // unknown coverage, not a positive observation of full price.
      const endpointsTruncated = providerCursor !== null;
      modelsEnriched += 1;
      if (firstPage !== null) evidence.push(sourceEvidence(endpoint, firstPage));
      let best: z.infer<typeof modelDiscountSchema> | null = null;
      for (const row of rows) {
        if (row.discount === null) continue;
        const ratio = Number(row.discount);
        if (!Number.isFinite(ratio) || ratio <= 0) continue;
        if (best !== null && Number(best.ratio) >= ratio) continue;
        best = {
          ratio: row.discount,
          percentOff: shiftDecimalString(row.discount, 2) ?? row.discount,
          providerName: row.provider,
          observedAt: row.fetchedAt,
          expiresAt: null,
          expiryPublished: false,
        };
      }
      model.bestDiscount = best;
      model.discountCoverage =
        best !== null
          ? "discounted"
          : endpointsTruncated
            ? "unavailable"
            : "no_discount";
      if (best !== null) modelsDiscounted += 1;
      if (best === null && endpointsTruncated) modelsTruncated += 1;
    } catch {
      modelsUnobserved += 1;
      model.discountCoverage = "unavailable";
    }
  }

  const sourceAvailable = enrichmentTargets.length === 0 || modelsEnriched > 0;
  if (modelsTruncated > 0) {
    warnings.push(
      `${modelsTruncated} model${modelsTruncated === 1 ? "'s" : "s'"} endpoint listing was cut short before its end, so a discount may sit on a page that was never read. Those rows report unavailable rather than no_discount.`,
    );
  }
  if (modelsUnobserved > 0) {
    warnings.push(
      `${modelsUnobserved} model${modelsUnobserved === 1 ? " has" : "s have"} no upstream endpoint observation, so their discount state is unknown rather than absent. Upstream observes provider endpoints under a daily request budget, so most of the catalogue is unobserved at any moment.`,
    );
  }
  const uncheckedCount = enrichable.length - enrichmentTargets.length;
  if (uncheckedCount > 0) {
    warnings.push(
      `${uncheckedCount} returned model${uncheckedCount === 1 ? " was" : "s were"} not checked for discounts; raise discountEnrichment to cover more.`,
    );
  }

  // 5. Per-provider reporting, so a null is read as a provider fact.
  const activeProviders = (
    input.providers ?? PROVIDER_IDS
  ).filter((provider) => PROVIDER_IDS.includes(provider));
  const providerReports = activeProviders.map((provider) => {
    const inCatalogue = candidates.filter((model) => model.provider === provider);
    const matchedForProvider = matched.filter(
      (model) => model.provider === provider,
    );
    const confirmations = inCatalogue
      .map((model) => model.lastConfirmedAt)
      .sort();
    const descriptor = PROVIDER_REGISTRY[provider];
    return {
      provider,
      displayName: descriptor.displayName,
      modelsInCatalogue: inCatalogue.length,
      modelsMatched: matchedForProvider.length,
      modelsPriceComparable: matchedForProvider.filter(
        (model) => model.priceComparable,
      ).length,
      lastConfirmedAt: confirmations.at(-1) ?? null,
      spendVisibility: descriptor.spendVisibility,
      publishes: Object.fromEntries(
        Object.entries(descriptor.publishes).map(([key, value]) => [key, value]),
      ),
      comparabilityNote: descriptor.comparabilityNote,
    };
  });

  for (const report of providerReports) {
    if (report.modelsInCatalogue === 0) {
      warnings.push(
        `${report.displayName} contributed no models to this answer; its catalogue is empty upstream.`,
      );
    }
  }

  // A provider whose catalogue was last confirmed days ago sitting silently
  // beside one confirmed hours ago is the failure this tool exists to prevent:
  // the answer looks uniformly current when part of it is not. Upstream does not
  // publish collector health for every provider, so age is derived here from the
  // freshest row each provider contributed, and stated rather than left in a
  // field for the caller to notice.
  const asOfMs = Date.parse(asOfIso);
  const ages = providerReports
    .filter((report) => report.lastConfirmedAt !== null)
    .map((report) => ({
      report,
      ageHours:
        (asOfMs - Date.parse(report.lastConfirmedAt as string)) / 3_600_000,
    }))
    .filter((entry) => Number.isFinite(entry.ageHours));
  const freshest = Math.min(...ages.map((entry) => entry.ageHours));
  for (const { report, ageHours } of ages) {
    const days = Math.floor(ageHours / 24);
    // Absolute staleness, and staleness relative to the freshest provider in the
    // same answer. The second matters even when neither is old in absolute terms.
    if (days >= 2) {
      warnings.push(
        `${report.displayName} data was last confirmed ${days} day${days === 1 ? "" : "s"} ago (${report.lastConfirmedAt}); its models and prices may have changed since. Treat as last known, not current.`,
      );
    } else if (Number.isFinite(freshest) && ageHours - freshest >= 24) {
      warnings.push(
        `${report.displayName} data is ${Math.floor(ageHours - freshest)} hours older than the freshest provider in this answer (${report.lastConfirmedAt}), so the comparison is not like-for-like in time.`,
      );
    }
  }

  const priceComparable = matched.filter((model) => model.priceComparable).length;
  const priceUnknown = matchedBeforeLimit - priceComparable;
  if (priceUnknown > 0) {
    warnings.push(
      `${priceUnknown} matching model${priceUnknown === 1 ? "" : "s"} could not be ranked because a published price is missing; each returned row carries an unrankableReason saying whether the provider published none at all or only one half. They are listed after the ranked rows, not dropped.`,
    );
  }

  const catalogueTruncated = liveCursor !== null;
  if (catalogueTruncated) {
    warnings.push(
      `The cross-provider catalogue did not fit in ${MODEL_ECONOMICS_LIMIT} scanned models, so cheaper models may exist beyond that bound.`,
    );
  }
  if (matchedBeforeLimit > models.length) {
    warnings.push(
      `${matchedBeforeLimit - models.length} further matching models were omitted by the requested limit.`,
    );
  }

  const discountNote = !sourceAvailable
    ? "No endpoint observation could be read for any attempted model, so no discount conclusion is available. Absence of a discount here is not evidence there is none."
    : `${modelsEnriched} of ${enrichable.length} discount-capable returned models were checked; ${modelsUnobserved} had no upstream observation, ${modelsTruncated} were observed but their endpoint listing was cut short, and ${uncheckedCount} were not attempted. Only models marked no_discount are known to be at full price. No provider publishes a discount expiry.`;

  const comparabilityNote =
    priceUnknown === 0
      ? "Every matching model published a price, so the ranking covers the whole answer."
      : `${priceComparable} of ${matchedBeforeLimit} matching models published a price and could be ranked. The other ${priceUnknown} are cost-unknown, not free, and appear after the ranked rows.`;

  const providerNames = providerReports
    .map((report) => `${report.displayName} ${report.modelsMatched}`)
    .join(", ");

  return {
    status: warnings.length > 0 ? "partial" : "ok",
    summary: `${models.length} of ${matchedBeforeLimit} matching models across ${providerReports.length} providers (${providerNames}), cheapest priced first; ${modelsDiscounted} carry a published discount.`,
    checkedAt: asOfIso,
    models,
    missingIds,
    providers: providerReports,
    comparability: {
      priceComparable,
      priceUnknown,
      note: comparabilityNote,
    },
    discounts: {
      sourceAvailable,
      modelsEnriched,
      modelsDiscounted,
      modelsUnobserved,
      modelsTruncated,
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
      title: "Open Dashboard model economics",
      description:
        "Compare live models across OpenRouter, Groq and Cerebras on the facts a router decides with: input and output price per token and per million tokens, published discounts, context length, output modality, tool and reasoning support, measured throughput and latency, availability, and retirement risk. Cheapest priced first. Models whose provider publishes no price are reported as cost-unknown and listed after the ranked rows rather than dropped, and every null is explained as a fact about the provider that withheld it.",
      inputSchema: modelEconomicsInputSchema,
      outputSchema: modelEconomicsOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runModelEconomics(input, dependencies)),
  );
}

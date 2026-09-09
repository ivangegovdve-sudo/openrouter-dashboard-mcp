import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import {
  exactIntegerStringSchema,
  publicProvenanceSchema,
} from "../dashboard/schemas/common.js";
import {
  isConcreteFreeLiveModel,
  liveModelSchema,
  liveModelsResponseSchema,
} from "../dashboard/schemas/live-models.js";
import {
  freeFrontierResponseSchema,
  freeModelsResponseSchema,
  manifestSchema,
  publicFreeFrontierSchema,
  publicModelSchema,
} from "../dashboard/schemas/openrouter.js";
import { RESOLVE_MODEL_CAPABILITY_MESSAGE } from "./resolve-model.js";
import { pricePoint } from "../catalogue/price-set.js";
import { pricePointSchema, type PriceUnit } from "../contract.js";
import { dashboardBaseUrl } from "../config.js";
import {
  READ_ONLY_TOOL_ANNOTATIONS,
  safeDashboardError,
  safeDashboardErrorSchema,
  sourceEvidence,
  sourceEvidenceSchema,
  toolResult,
} from "./shared.js";

const MANIFEST_ENDPOINT = "/api/public/v2/manifest";
const LIVE_MODELS_ENDPOINT = "/api/public/v2/live-models";
const FREE_MODELS_ENDPOINT = "/api/public/v2/free-models";
const FREE_FRONTIERS_ENDPOINT = "/api/public/v2/free-frontiers";

export const FREE_MODELS_CAPABILITY_MESSAGE =
  RESOLVE_MODEL_CAPABILITY_MESSAGE;
export const FREE_MODELS_DEFAULT_LIMIT = 50;
export const FREE_MODELS_MAX_LIMIT = 200;
export const FREE_MODELS_FRONTIER_LIMIT = 200;

export const freeModelsInputSchema = z
  .object({
    outputModality: z.string().min(1).max(80).default("text"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(FREE_MODELS_MAX_LIMIT)
      .default(FREE_MODELS_DEFAULT_LIMIT),
  })
  .strict();

const freeCatalogueModelSchema = publicModelSchema.pick({
  id: true,
  canonicalSlug: true,
  name: true,
  contentTrust: true,
  contextLength: true,
  architecture: true,
  supportedParameters: true,
  expirationDate: true,
  lifecycleState: true,
  freeKind: true,
  weeklyRank: true,
  rankMethod: true,
}).extend({
  pricePoints: z.array(pricePointSchema),
}).strict();

const listCapSchema = z
  .object({
    requestedLimit: z.number().int().min(1).max(FREE_MODELS_MAX_LIMIT),
    examinedCount: z.number().int().nonnegative(),
    returnedCount: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
    capped: z.boolean(),
  })
  .strict();

const liveCandidatesCapSchema = listCapSchema
  .extend({
    excludedUnavailableCount: z.number().int().nonnegative(),
    excludedNotFreeCount: z.number().int().nonnegative(),
    excludedUnknownPriceCount: z.number().int().nonnegative(),
    excludedModalityCount: z.number().int().nonnegative(),
  })
  .strict();

const frontierCapSchema = z
  .object({
    requestedInputLimit: z
      .number()
      .int()
      .min(1)
      .max(FREE_MODELS_FRONTIER_LIMIT),
    frontierCount: z.number().int().nonnegative(),
    memberCount: z.number().int().nonnegative(),
    excludedCount: z.number().int().nonnegative(),
    nextCursor: z.string().nullable(),
    capped: z.boolean(),
  })
  .strict();

const requestedFrontierDimensionsSchema = z
  .object({
    x: z.enum(["benchmarkQuality", "contextLength"]),
    y: z.enum(["medianThroughput", "weeklyPopularityRank"]),
  })
  .strict();

const availableFrontierSchema = z
  .object({
    status: z.literal("available"),
    endpoint: z.literal(FREE_FRONTIERS_ENDPOINT),
    requestedDimensions: requestedFrontierDimensionsSchema,
    data: z.array(publicFreeFrontierSchema),
    evidence: sourceEvidenceSchema,
    stale: z.boolean(),
    warnings: z.array(z.string()),
    cap: frontierCapSchema,
  })
  .strict();

const unavailableFrontierSchema = z
  .object({
    status: z.literal("unavailable"),
    endpoint: z.literal(FREE_FRONTIERS_ENDPOINT),
    requestedDimensions: requestedFrontierDimensionsSchema,
    error: safeDashboardErrorSchema,
    warnings: z.array(z.string()),
    cap: z
      .object({
        requestedInputLimit: z.literal(FREE_MODELS_FRONTIER_LIMIT),
      })
      .strict(),
  })
  .strict();

const frontierSectionSchema = z.discriminatedUnion("status", [
  availableFrontierSchema,
  unavailableFrontierSchema,
]);

const freeModelsSuccessBase = {
  schemaVersion: z.literal("2.0"),
  summary: z.string(),
  query: z
    .object({
      outputModality: z.string().min(1).max(80),
      outputModalityDefaulted: z.boolean(),
      limit: z.number().int().min(1).max(FREE_MODELS_MAX_LIMIT),
    })
    .strict(),
  liveCandidates: z
    .object({
      endpoint: z.literal(LIVE_MODELS_ENDPOINT),
      data: z.array(liveModelSchema).max(FREE_MODELS_MAX_LIMIT),
      evidence: sourceEvidenceSchema,
      stale: z.boolean(),
      warnings: z.array(z.string()),
      cap: liveCandidatesCapSchema,
    })
    .strict(),
  openRouterCatalogue: z
    .object({
      endpoint: z.literal(FREE_MODELS_ENDPOINT),
      data: z.array(freeCatalogueModelSchema).max(FREE_MODELS_MAX_LIMIT),
      router: freeCatalogueModelSchema.nullable(),
      concreteFreeCount: exactIntegerStringSchema,
      evidence: sourceEvidenceSchema,
      stale: z.boolean(),
      warnings: z.array(z.string()),
      cap: listCapSchema,
    })
    .strict(),
  frontiers: z
    .object({
      qualityThroughput: frontierSectionSchema,
      contextPopularity: frontierSectionSchema,
    })
    .strict(),
  stale: z.boolean(),
  evidence: z.array(sourceEvidenceSchema),
  provenance: z.array(publicProvenanceSchema),
  warnings: z.array(z.string()),
};

const freeModelsOkSchema = z
  .object({ status: z.literal("ok"), ...freeModelsSuccessBase })
  .strict();
const freeModelsPartialSchema = z
  .object({ status: z.literal("partial"), ...freeModelsSuccessBase })
  .strict();
const freeModelsUnavailableSchema = z
  .object({
    status: z.literal("unavailable"),
    summary: z.literal(FREE_MODELS_CAPABILITY_MESSAGE),
    message: z.literal(FREE_MODELS_CAPABILITY_MESSAGE),
    missingCapability: z.literal(LIVE_MODELS_ENDPOINT),
    evidence: z.array(sourceEvidenceSchema),
    provenance: z.array(publicProvenanceSchema),
    warnings: z.array(z.string()),
  })
  .strict();
const freeModelsErrorSchema = z
  .object({
    status: z.literal("error"),
    summary: z.string(),
    error: safeDashboardErrorSchema,
  })
  .strict();

export const freeModelsOutputSchema = z.discriminatedUnion("status", [
  freeModelsOkSchema,
  freeModelsPartialSchema,
  freeModelsUnavailableSchema,
  freeModelsErrorSchema,
]);

export type FreeModelsInput = z.input<typeof freeModelsInputSchema>;
export type FreeModelsOutput = z.infer<typeof freeModelsOutputSchema>;
export type FreeModelsDependencies = { client: DashboardClient; allowedProviders?: string[] };

type CatalogueModel = z.infer<typeof publicModelSchema>;
type Provenance = z.infer<typeof publicProvenanceSchema>;
type FrontierResponse = z.infer<typeof freeFrontierResponseSchema>;

/**
 * `dropped` is NOT optional bookkeeping. This used to `catch { return []; }`, so a price
 * the schema rejected disappeared with no warning, no state change and no record, while
 * the tool still answered `status: "ok"` -- silent price loss presented as a complete
 * answer. A caller cannot distinguish "this model has no such price" from "we could not
 * read it", which collapses two of the three states this package exists to keep apart.
 * Every dropped point is now named to the caller.
 */
function cataloguePricePoints(model: CatalogueModel, observedAt: string, dropped: string[]) {
  const sourceUrl = new URL(FREE_MODELS_ENDPOINT, dashboardBaseUrl()).href;
  const units: Record<string, PriceUnit> = {
    prompt: "token_in",
    completion: "token_out",
    input: "token_in",
    output: "token_out",
    input_cache_read: "token_cached",
    cache_read: "token_cached",
    input_cache_write: "token_cache_create",
    cache_creation: "token_cache_create",
    image: "image",
    megapixel: "megapixel",
    video_second: "video_second",
    video: "video",
    request: "request",
  };
  return Object.entries(model.pricing).flatMap(([name, amount]) => {
    const unit = units[name];
    if (unit === undefined || amount === null) return [];
    try {
      return [pricePoint({ id: `openrouter:${model.id}:${unit}`, amount, unit, condition: null, sourceUrl, readAt: observedAt, provenance: "published" })];
    } catch {
      dropped.push(`${model.id} (${unit})`);
      return [];
    }
  });
}

function catalogueModel(model: CatalogueModel, observedAt: string, dropped: string[]) {
  return {
    id: model.id,
    canonicalSlug: model.canonicalSlug,
    name: model.name,
    contentTrust: model.contentTrust,
    contextLength: model.contextLength,
    architecture: model.architecture,
    pricePoints: cataloguePricePoints(model, observedAt, dropped),
    supportedParameters: model.supportedParameters,
    expirationDate: model.expirationDate,
    lifecycleState: model.lifecycleState,
    freeKind: model.freeKind,
    weeklyRank: model.weeklyRank,
    rankMethod: model.rankMethod,
  };
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function uniqueProvenance(values: readonly Provenance[]): Provenance[] {
  const seen = new Set<string>();
  return values.filter((entry) => {
    const key = `${entry.sourceId}\u0000${entry.runId}\u0000${entry.fetchedAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pageWarnings(endpoint: string, stale: boolean, cursor: string | null) {
  return [
    ...(stale ? [`Data from ${endpoint} is stale.`] : []),
    ...(cursor === null
      ? []
      : [`${endpoint} has more rows; only the first bounded page was fetched.`]),
  ];
}

function frontierSection(
  response: FrontierResponse,
  requestedDimensions: z.infer<typeof requestedFrontierDimensionsSchema>,
): z.infer<typeof availableFrontierSchema> {
  const warnings = pageWarnings(
    FREE_FRONTIERS_ENDPOINT,
    response.stale,
    response.cursor,
  );
  return {
    status: "available",
    endpoint: FREE_FRONTIERS_ENDPOINT,
    requestedDimensions,
    data: response.data,
    evidence: sourceEvidence(FREE_FRONTIERS_ENDPOINT, response),
    stale: response.stale,
    warnings,
    cap: {
      requestedInputLimit: FREE_MODELS_FRONTIER_LIMIT,
      frontierCount: response.data.length,
      memberCount: response.data.reduce(
        (count, frontier) => count + frontier.members.length,
        0,
      ),
      excludedCount: response.data.reduce(
        (count, frontier) => count + frontier.excluded.length,
        0,
      ),
      nextCursor: response.cursor,
      capped: response.cursor !== null,
    },
  };
}

function unavailableFrontier(
  error: unknown,
  requestedDimensions: z.infer<typeof requestedFrontierDimensionsSchema>,
): z.infer<typeof unavailableFrontierSchema> {
  const safeError = safeDashboardError(error);
  return {
    status: "unavailable",
    endpoint: FREE_FRONTIERS_ENDPOINT,
    requestedDimensions,
    error: safeError,
    warnings: [
      `The ${requestedDimensions.x}/${requestedDimensions.y} free frontier is unavailable: ${safeError.message}`,
    ],
    cap: { requestedInputLimit: FREE_MODELS_FRONTIER_LIMIT },
  };
}

async function runFreeModelsUnsafe(
  rawInput: FreeModelsInput,
  { client, allowedProviders }: FreeModelsDependencies,
): Promise<FreeModelsOutput> {
  const outputModalityDefaulted = rawInput.outputModality === undefined;
  const input = freeModelsInputSchema.parse(rawInput);
  const observedAt = new Date().toISOString();
  const manifest = await client.get(
    MANIFEST_ENDPOINT,
    new URLSearchParams(),
    manifestSchema,
  );
  if (!manifest.routes.includes(LIVE_MODELS_ENDPOINT)) {
    return {
      status: "unavailable",
      summary: FREE_MODELS_CAPABILITY_MESSAGE,
      message: FREE_MODELS_CAPABILITY_MESSAGE,
      missingCapability: LIVE_MODELS_ENDPOINT,
      evidence: [sourceEvidence(MANIFEST_ENDPOINT, manifest)],
      provenance: [...manifest.provenance],
      warnings: [],
    };
  }

  const liveQuery = new URLSearchParams({
    availability: "available",
    free: "true",
    outputModality: input.outputModality,
    limit: String(input.limit),
  });
  const catalogueQuery = new URLSearchParams({
    modality: input.outputModality,
    limit: String(input.limit),
  });
  const qualityThroughputQuery = new URLSearchParams({
    x: "benchmarkQuality",
    y: "medianThroughput",
    limit: String(FREE_MODELS_FRONTIER_LIMIT),
  });
  const contextPopularityQuery = new URLSearchParams({
    x: "contextLength",
    y: "weeklyPopularityRank",
    limit: String(FREE_MODELS_FRONTIER_LIMIT),
  });

  const [liveResult, catalogueResult, qualityThroughputResult, contextPopularityResult] =
    await Promise.allSettled([
      client.get(LIVE_MODELS_ENDPOINT, liveQuery, liveModelsResponseSchema),
      client.get(FREE_MODELS_ENDPOINT, catalogueQuery, freeModelsResponseSchema),
      client.get(
        FREE_FRONTIERS_ENDPOINT,
        qualityThroughputQuery,
        freeFrontierResponseSchema,
      ),
      client.get(
        FREE_FRONTIERS_ENDPOINT,
        contextPopularityQuery,
        freeFrontierResponseSchema,
      ),
    ]);
  if (liveResult.status === "rejected") throw liveResult.reason;
  if (catalogueResult.status === "rejected") throw catalogueResult.reason;
  const live = liveResult.value;
  const catalogue = catalogueResult.value;

  const liveWarnings = pageWarnings(
    LIVE_MODELS_ENDPOINT,
    live.stale,
    live.cursor,
  );
  const liveCandidates: Array<z.infer<typeof liveModelSchema>> = [];
  let excludedUnavailableCount = 0;
  let excludedNotFreeCount = 0;
  let excludedUnknownPriceCount = 0;
  let excludedModalityCount = 0;
  const visibleLive = allowedProviders === undefined
    ? live.data
    : live.data.filter((model) => allowedProviders.includes(model.provider));
  for (const model of visibleLive) {
    if (model.availability !== "available") {
      excludedUnavailableCount += 1;
      continue;
    }
    if (model.isFree !== true) {
      excludedNotFreeCount += 1;
      continue;
    }
    const hasTokenPrice = (unit: "token_in" | "token_out") =>
      model.pricePoints.some((point) => point.unit === unit && point.condition === null);
    if (!hasTokenPrice("token_in") || !hasTokenPrice("token_out")) {
      excludedUnknownPriceCount += 1;
      continue;
    }
    if (!isConcreteFreeLiveModel(model)) {
      excludedNotFreeCount += 1;
      continue;
    }
    if (!model.outputModalities?.includes(input.outputModality)) {
      excludedModalityCount += 1;
      continue;
    }
    liveCandidates.push(model);
  }
  const droppedCataloguePrices: string[] = [];
  const catalogueOmitsOpenRouter = allowedProviders !== undefined && !allowedProviders.includes("openrouter");
  const catalogueWarnings = pageWarnings(
    FREE_MODELS_ENDPOINT,
    catalogue.stale,
    catalogue.cursor,
  );
  const qualityThroughputDimensions = {
    x: "benchmarkQuality",
    y: "medianThroughput",
  } as const;
  const contextPopularityDimensions = {
    x: "contextLength",
    y: "weeklyPopularityRank",
  } as const;
  const qualityThroughputSection =
    qualityThroughputResult.status === "fulfilled"
      ? frontierSection(
          qualityThroughputResult.value,
          qualityThroughputDimensions,
        )
      : unavailableFrontier(
          qualityThroughputResult.reason,
          qualityThroughputDimensions,
        );
  const contextPopularitySection =
    contextPopularityResult.status === "fulfilled"
      ? frontierSection(
          contextPopularityResult.value,
          contextPopularityDimensions,
        )
      : unavailableFrontier(
          contextPopularityResult.reason,
          contextPopularityDimensions,
        );
  const evidence = [
    sourceEvidence(MANIFEST_ENDPOINT, manifest),
    sourceEvidence(LIVE_MODELS_ENDPOINT, live),
    sourceEvidence(FREE_MODELS_ENDPOINT, catalogue),
    ...(qualityThroughputSection.status === "available"
      ? [qualityThroughputSection.evidence]
      : []),
    ...(contextPopularitySection.status === "available"
      ? [contextPopularitySection.evidence]
      : []),
  ];
  const warnings = uniqueStrings([
    ...liveWarnings,
    ...catalogueWarnings,
    ...qualityThroughputSection.warnings,
    ...contextPopularitySection.warnings,
  ]);

  const frontierUnavailableCount = [
    qualityThroughputSection,
    contextPopularitySection,
  ].filter((section) => section.status === "unavailable").length;
  const status = frontierUnavailableCount === 0 ? "ok" : "partial";
  const candidateSummary = outputModalityDefaulted
    ? `Found ${liveCandidates.length} live free candidate${liveCandidates.length === 1 ? "" : "s"}; output modality defaulted to text.`
    : `Found ${liveCandidates.length} live free ${input.outputModality}-output candidate${liveCandidates.length === 1 ? "" : "s"}.`;

  // Projected BEFORE the return literal, not inside it: the drop warning below can only
  // be honest once the mapping has actually run. Relying on object-property evaluation
  // order to make that true is the kind of coupling that breaks silently on a reorder.
  const catalogueData = catalogueOmitsOpenRouter
    ? []
    : catalogue.data.map((model) => catalogueModel(model, observedAt, droppedCataloguePrices));
  const catalogueRouter = catalogueOmitsOpenRouter || catalogue.router === null
    ? null
    : catalogueModel(catalogue.router, observedAt, droppedCataloguePrices);
  if (droppedCataloguePrices.length > 0) {
    catalogueWarnings.push(
      `${droppedCataloguePrices.length} published price${droppedCataloguePrices.length === 1 ? "" : "s"} could not be represented and ${droppedCataloguePrices.length === 1 ? "is" : "are"} omitted from pricePoints: ${uniqueStrings(droppedCataloguePrices).join(", ")}. Those models are missing a price the source does publish; absence here is unread, not unpriced.`,
    );
  }

  return {
    status,
    schemaVersion: "2.0",
    summary:
      frontierUnavailableCount === 0
        ? candidateSummary
        : `${candidateSummary} ${frontierUnavailableCount} of 2 frontier views is unavailable.`,
    query: {
      outputModality: input.outputModality,
      outputModalityDefaulted,
      limit: input.limit,
    },
    liveCandidates: {
      endpoint: LIVE_MODELS_ENDPOINT,
      data: liveCandidates,
      evidence: sourceEvidence(LIVE_MODELS_ENDPOINT, live),
      stale: live.stale,
      warnings: liveWarnings,
      cap: {
        requestedLimit: input.limit,
        examinedCount: visibleLive.length,
        returnedCount: liveCandidates.length,
        nextCursor: live.cursor,
        capped: live.cursor !== null,
        excludedUnavailableCount,
        excludedNotFreeCount,
        excludedUnknownPriceCount,
        excludedModalityCount,
      },
    },
    openRouterCatalogue: {
      endpoint: FREE_MODELS_ENDPOINT,
      data: catalogueData,
      router: catalogueRouter,
      concreteFreeCount: allowedProviders !== undefined && !allowedProviders.includes("openrouter") ? "0" : catalogue.concreteFreeCount,
      evidence: sourceEvidence(FREE_MODELS_ENDPOINT, catalogue),
      stale: catalogue.stale,
      warnings: catalogueWarnings,
      cap: {
        requestedLimit: input.limit,
        examinedCount: allowedProviders !== undefined && !allowedProviders.includes("openrouter") ? 0 : catalogue.data.length,
        returnedCount: allowedProviders !== undefined && !allowedProviders.includes("openrouter") ? 0 : catalogue.data.length,
        nextCursor: catalogue.cursor,
        capped: catalogue.cursor !== null,
      },
    },
    frontiers: {
      qualityThroughput: qualityThroughputSection,
      contextPopularity: contextPopularitySection,
    },
    stale:
      live.stale ||
      catalogue.stale ||
      (qualityThroughputSection.status === "available" &&
        qualityThroughputSection.stale) ||
      (contextPopularitySection.status === "available" &&
        contextPopularitySection.stale),
    evidence,
    provenance: uniqueProvenance([
      ...manifest.provenance,
      ...live.provenance,
      ...catalogue.provenance,
      ...(qualityThroughputResult.status === "fulfilled"
        ? qualityThroughputResult.value.provenance
        : []),
      ...(contextPopularityResult.status === "fulfilled"
        ? contextPopularityResult.value.provenance
        : []),
    ]),
    warnings,
  };
}

export async function runFreeModels(
  rawInput: FreeModelsInput,
  dependencies: FreeModelsDependencies,
): Promise<FreeModelsOutput> {
  try {
    return await runFreeModelsUnsafe(rawInput, dependencies);
  } catch (error) {
    const safeError = safeDashboardError(error);
    return {
      status: "error",
      summary: safeError.message,
      error: safeError,
    };
  }
}

export function registerFreeModels(
  server: McpServer,
  dependencies: FreeModelsDependencies,
): void {
  server.registerTool(
    "dashboard_free_models",
    {
      title: "Dashboard usable free models",
      description:
        "Find free models that are currently listed across providers and emit the requested modality (text by default). Freeness comes only from the dashboard's full price classification, so unknown prices and zero-token-price models with other charges are never treated as free.",
      inputSchema: freeModelsInputSchema,
      outputSchema: freeModelsOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runFreeModels(input, dependencies)),
  );
}

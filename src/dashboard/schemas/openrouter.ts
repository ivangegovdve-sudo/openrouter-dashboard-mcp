import { z } from "zod";

import {
  exactDecimalStringSchema,
  exactIntegerStringSchema,
  publicCollectionSchema,
  publicProvenanceSchema,
  publicSingletonSchema,
  publicWindowSchema,
  schemaVersionV2,
} from "./common.js";

const OPENROUTER_APP_CATEGORIES = [
  "coding",
  "creative",
  "productivity",
  "entertainment",
] as const;
const OPENROUTER_APP_SUBCATEGORIES = [
  "cli-agent",
  "ide-extension",
  "cloud-agent",
  "programming-app",
  "native-app-builder",
  "creative-writing",
  "video-gen",
  "image-gen",
  "audio-gen",
  "roleplay",
  "game",
  "writing-assistant",
  "general-chat",
  "personal-agent",
  "legal",
] as const;

export const lifecycleStateSchema = z.enum([
  "expiration_unknown",
  "no_announced_expiration",
  "scheduled_deprecation",
  "past_expiration_still_listed",
  "absent_from_catalog",
  "removed_or_unavailable",
]);

const forbiddenRecursiveKeys = new Set([
  "sender",
  "subject",
  "snippet",
  "body",
  "threadid",
  "threadids",
  "labels",
  "extractedfacts",
  "rawpayload",
  "embedding",
  "embeddings",
  "accesscode",
  "credentials",
  "authorization",
  "apikey",
  "accesstoken",
  "secret",
  "password",
  "cookie",
]);

function normalizePublicJsonKey(key: string): string {
  return key.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

function validatePublicJson(
  value: unknown,
  context: z.RefinementCtx,
  path: PropertyKey[] = [],
  depth = 0,
): void {
  if (depth > 10) {
    context.addIssue({
      code: "custom",
      message: "Public JSON exceeds maximum depth",
      path,
    });
    return;
  }
  if (typeof value === "string" && value.length > 16_384) {
    context.addIssue({
      code: "custom",
      message: "Public JSON string exceeds maximum length",
      path,
    });
  }
  if (Array.isArray(value)) {
    if (value.length > 256) {
      context.addIssue({
        code: "custom",
        message: "Public JSON array exceeds maximum length",
        path,
      });
    }
    value.forEach((entry, index) =>
      validatePublicJson(entry, context, [...path, index], depth + 1),
    );
    return;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > 256) {
      context.addIssue({
        code: "custom",
        message: "Public JSON object exceeds maximum size",
        path,
      });
    }
    for (const [key, child] of entries) {
      if (forbiddenRecursiveKeys.has(normalizePublicJsonKey(key))) {
        context.addIssue({
          code: "custom",
          message: "Forbidden public field",
          path: [...path, key],
        });
      }
      validatePublicJson(child, context, [...path, key], depth + 1);
    }
  }
}

const publicArchitectureSchema = z
  .record(z.string(), z.unknown())
  .superRefine((value, context) => {
    if (JSON.stringify(value).length > 65_536) {
      context.addIssue({
        code: "custom",
        message: "Public JSON exceeds maximum bytes",
      });
    }
    validatePublicJson(value, context);
  });

export const publicModelSchema = z
  .object({
    id: z.string(),
    canonicalSlug: z.string(),
    name: z.string(),
    description: z.string().max(16_384).nullable(),
    contentTrust: z.literal("untrusted-source"),
    createdUnix: exactIntegerStringSchema,
    contextLength: exactIntegerStringSchema.nullable(),
    architecture: publicArchitectureSchema,
    pricing: z.record(z.string(), exactDecimalStringSchema.nullable()),
    supportedParameters: z.array(z.string()),
    expirationDate: z.string().date().nullable(),
    lifecycleState: lifecycleStateSchema,
    freeKind: z.enum([
      "concrete_free",
      "free_router",
      "paid_or_unknown",
    ]),
    weeklyRank: z.number().int().positive().nullable(),
    rankMethod: z.literal("response_order").nullable(),
  })
  .strict();

export const publicModelsResponseSchema =
  publicCollectionSchema(publicModelSchema);
export const publicModelDetailResponseSchema =
  publicSingletonSchema(publicModelSchema);
export const publicFreeModelsResponseSchema = publicCollectionSchema(
  publicModelSchema,
)
  .extend({
    router: publicModelSchema.nullable(),
    concreteFreeCount: exactIntegerStringSchema,
  })
  .strict();

export const publicDeprecationSchema = z
  .object({
    modelId: z.string(),
    state: lifecycleStateSchema,
    expirationDate: z.string().date().nullable(),
    firstObservedAt: z.string().datetime({ offset: true }),
    lastObservedAt: z.string().datetime({ offset: true }),
    evidenceRunId: z.string().uuid(),
  })
  .strict();
export const publicDeprecationsResponseSchema = publicCollectionSchema(
  publicDeprecationSchema,
);

export const publicSourceStatusSchema = z
  .object({
    sourceId: z.string(),
    /**
     * `supported` covers the Groq and Cerebras catalogues: plain
     * OpenAI-compatible listings with no published freshness contract, unlike the
     * `stable` OpenRouter sources. Both appear on /source-status.
     */
    sourceTier: z.enum(["stable", "supported"]),
    cadenceSeconds: z.number().int().positive(),
    staleAfterSeconds: z.number().int().positive(),
    publishedRunId: z.string().uuid().nullable(),
    publishedAt: z.string().datetime({ offset: true }).nullable(),
    nextScheduledAt: z.string().datetime({ offset: true }).nullable(),
    stale: z.boolean(),
    transformVersion: z.string(),
    citationUrl: z.string().url().nullable(),
    lastAttemptRunId: z.string().uuid().nullable(),
    lastAttemptStatus: z.enum(["running", "published", "failed"]).nullable(),
    lastAttemptStartedAt: z.string().datetime({ offset: true }).nullable(),
    lastAttemptFinishedAt: z.string().datetime({ offset: true }).nullable(),
    lastAttemptErrorCode: z.string().nullable(),
    lastAttemptAcquisitionComplete: z.boolean().nullable(),
    lastAttemptPopulationCompleteness: z
      .enum([
        "full",
        "requested_slice",
        "top_n_plus_other",
        "partial_or_unknown",
      ])
      .nullable(),
  })
  .strict();
export const publicSourceStatusResponseSchema = publicCollectionSchema(
  publicSourceStatusSchema,
);

export const publicManifestResponseSchema = z
  .object({
    schemaVersion: schemaVersionV2,
    publishedAt: z.string().datetime({ offset: true }).nullable(),
    routes: z.array(z.string().startsWith("/api/public/v2/")),
    sources: z.array(publicSourceStatusSchema),
    provenance: z.array(publicProvenanceSchema),
    window: publicWindowSchema,
  })
  .strict();

export const publicAppSchema = z
  .object({
    appId: exactIntegerStringSchema,
    appName: z.string(),
    rank: z.number().int().positive(),
    totalTokens: exactIntegerStringSchema,
    totalRequests: exactIntegerStringSchema,
  })
  .strict();

export const publicAppRequestSliceSchema = z
  .object({
    period: z.literal("30d"),
    sort: z.enum(["popular", "trending"]),
    category: z.enum(OPENROUTER_APP_CATEGORIES).nullable(),
    subcategory: z.enum(OPENROUTER_APP_SUBCATEGORIES).nullable(),
    limit: z.number().int().min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.category !== null && value.subcategory !== null) {
      context.addIssue({
        code: "custom",
        message: "Combined app slices are not collected",
        path: ["subcategory"],
      });
    }
  });

export const publicAppsResponseSchema = publicCollectionSchema(publicAppSchema)
  .extend({ requestSlice: publicAppRequestSliceSchema })
  .strict()
  .superRefine((value, context) => {
    const { start, end, timezone, inclusive } = value.window;
    const startTime =
      start === null ? Number.NaN : Date.parse(`${start}T00:00:00Z`);
    const endTime = end === null ? Number.NaN : Date.parse(`${end}T00:00:00Z`);
    const inclusiveDays =
      Number.isFinite(startTime) && Number.isFinite(endTime)
        ? (endTime - startTime) / 86_400_000 + 1
        : Number.NaN;
    if (timezone !== "UTC" || inclusive !== true || inclusiveDays !== 30) {
      context.addIssue({
        code: "custom",
        message: "Apps 30d response requires an exact inclusive 30-day UTC window",
        path: ["window"],
      });
    }
    if (value.data.length > value.requestSlice.limit) {
      context.addIssue({
        code: "custom",
        message: "Apps response exceeds its declared request slice limit",
        path: ["data"],
      });
    }
  });

export const publicAppDetailRequestSliceSchema = z
  .object({
    period: z.literal("30d"),
    sort: z.enum(["popular", "trending"]),
    category: z.enum(OPENROUTER_APP_CATEGORIES).nullable(),
    subcategory: z.enum(OPENROUTER_APP_SUBCATEGORIES).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.category !== null && value.subcategory !== null) {
      context.addIssue({
        code: "custom",
        message: "Combined app slices are not collected",
        path: ["subcategory"],
      });
    }
  });
export const publicAppDetailResponseSchema = publicSingletonSchema(
  publicAppSchema,
)
  .extend({ requestSlice: publicAppDetailRequestSliceSchema })
  .strict();

const publicTaskModelSchema = z
  .object({
    id: z.string(),
    sourcePosition: z.number().int().positive(),
    usageShare: exactDecimalStringSchema,
    tokenShare: exactDecimalStringSchema,
  })
  .strict();
export const publicTaskSchema = z
  .object({
    tag: z.string(),
    displayName: z.string(),
    macroCategory: z.string(),
    usageShare: exactDecimalStringSchema,
    tokenShare: exactDecimalStringSchema,
    categoryUsageShare: exactDecimalStringSchema,
    categoryTokenShare: exactDecimalStringSchema,
    sampled: z.literal(true),
    absoluteVolumeAvailable: z.literal(false),
    otherExcluded: z.literal(true),
    topModelsComplete: z.literal(false),
    models: z.array(publicTaskModelSchema),
  })
  .strict();
export const publicTasksResponseSchema = publicCollectionSchema(publicTaskSchema);

const benchmarkBase = {
  modelPermaslug: z.string(),
  displayName: z.string(),
  matchStatus: z.enum(["matched", "unmatched"]),
  pricing: z
    .object({
      prompt: exactDecimalStringSchema.nullable(),
      completion: exactDecimalStringSchema.nullable(),
    })
    .strict(),
  citation: z.string(),
  sourceUrl: z.string().url().nullable(),
};
const artificialBenchmarkSchema = z
  .object({
    source: z.literal("artificial-analysis"),
    ...benchmarkBase,
    intelligenceIndex: z.number().nullable(),
    codingIndex: z.number().nullable(),
    agenticIndex: z.number().nullable(),
  })
  .strict();
const designBenchmarkSchema = z
  .object({
    source: z.literal("design-arena"),
    ...benchmarkBase,
    arena: z.string(),
    category: z.string(),
    elo: z.number(),
    winRate: z.number().min(0).max(100),
    avgGenerationTimeMs: z.number().nonnegative().nullable(),
    tournamentStats: z
      .object({
        firstPlace: z.number().int().nullable(),
        secondPlace: z.number().int().nullable(),
        thirdPlace: z.number().int().nullable(),
        fourthPlace: z.number().int().nullable(),
        total: z.number().int().nullable(),
      })
      .strict(),
  })
  .strict();
export const publicBenchmarkSchema = z.discriminatedUnion("source", [
  artificialBenchmarkSchema,
  designBenchmarkSchema,
]);
export const publicBenchmarksResponseSchema = publicCollectionSchema(
  publicBenchmarkSchema,
);

const observedPeriodSchema = z
  .object({
    start: z.string().date(),
    end: z.string().date(),
    unit: z.literal("day"),
    inclusive: z.literal(true),
  })
  .strict();
const appModelCompletenessSchema = z
  .object({
    acquisitionComplete: z.boolean(),
    populationCompleteness: z.literal("partial_or_unknown"),
    missingFields: z.array(z.string()),
  })
  .strict();
const appModelMatchMethodSchema = z.enum([
  "source_model_id",
  "canonical_slug",
  "ambiguous_model",
  "unmapped_model",
]);

export const publicAppModelCellSchema = z.discriminatedUnion("state", [
  z
    .object({
      state: z.literal("observed"),
      appId: exactIntegerStringSchema,
      modelId: z.string().min(1),
      totalTokens: exactIntegerStringSchema,
      rankWithinPeriod: z.number().int().positive(),
      period: observedPeriodSchema,
      metricSemantics: z.literal("observed_daily_total_tokens"),
      evidenceUrl: z.string().url(),
    })
    .strict(),
  z
    .object({
      state: z.literal("unknown"),
      appId: exactIntegerStringSchema,
      modelId: z.string().min(1),
      reason: z.enum(["not_observed", "unmapped_alias", "not_published"]),
    })
    .strict(),
]);

export const publicAppModelMatrixResponseSchema = z.discriminatedUnion(
  "status",
  [
    z
      .object({
        schemaVersion: schemaVersionV2,
        status: z.literal("available"),
        watermark: z.string().min(1),
        lastSuccessAt: z.string().datetime({ offset: true }),
        stale: z.boolean(),
        staleAfterSeconds: z.literal(172800),
        completeness: appModelCompletenessSchema,
        resolvedPeriod: observedPeriodSchema,
        apps: z
          .array(
            z
              .object({
                appId: exactIntegerStringSchema,
                appName: z.string().min(1),
              })
              .strict(),
          )
          .max(10),
        models: z
          .array(
            z
              .object({
                modelId: z.string().min(1),
                modelName: z.string().min(1),
              })
              .strict(),
          )
          .max(10),
        appIds: z.array(exactIntegerStringSchema).max(10),
        modelIds: z.array(z.string()).max(10),
        cells: z.array(publicAppModelCellSchema).max(100),
        missingAliases: z.array(exactIntegerStringSchema).max(10),
        unmappedModels: z
          .array(
            z
              .object({
                appId: exactIntegerStringSchema,
                sourcePermaslug: z.string().min(1),
                totalTokens: exactIntegerStringSchema,
                rankWithinPeriod: z.number().int().positive(),
                reason: z.enum(["ambiguous_model", "unmapped_model"]),
              })
              .strict(),
          )
          .max(100),
        coverage: z
          .object({
            observedCells: z.number().int().nonnegative(),
            possibleCells: z.number().int().nonnegative(),
            unmappedObservations: z.number().int().nonnegative(),
            populationCompleteness: z.literal("partial_or_unknown"),
          })
          .strict(),
        provenance: z.array(publicProvenanceSchema),
      })
      .strict(),
    z
      .object({
        schemaVersion: schemaVersionV2,
        status: z.literal("unavailable"),
        reason: z.enum([
          "collection_disabled",
          "not_published",
          "no_observed_period",
          "no_common_period",
          "period_mismatch",
        ]),
        lastSuccessAt: z.string().datetime().nullable(),
        stale: z.boolean(),
        staleAfterSeconds: z.literal(172800),
        completeness: appModelCompletenessSchema,
        provenance: z.array(publicProvenanceSchema),
        appIds: z.array(exactIntegerStringSchema).max(10),
        modelIds: z.array(z.string()).max(10),
        cells: z.tuple([]),
      })
      .strict(),
  ],
);

export const publicAppModelsResponseSchema = z.discriminatedUnion("status", [
  z
    .object({
      schemaVersion: schemaVersionV2,
      status: z.literal("available"),
      watermark: z.string().min(1),
      lastSuccessAt: z.string().datetime({ offset: true }),
      stale: z.boolean(),
      staleAfterSeconds: z.literal(172800),
      completeness: appModelCompletenessSchema,
      appId: exactIntegerStringSchema,
      appName: z.string().min(1),
      resolvedPeriod: observedPeriodSchema,
      data: z
        .array(
          z
            .object({
              modelId: z.string().min(1),
              sourcePermaslug: z.string().min(1),
              resolvedModelId: z.string().min(1).nullable(),
              matchMethod: appModelMatchMethodSchema,
              rank: z.number().int().positive(),
              rankMethod: z.literal("locally_calculated"),
              totalTokens: exactIntegerStringSchema,
              metricSemantics: z.literal("observed_daily_total_tokens"),
              evidenceUrl: z.string().url(),
              period: observedPeriodSchema,
            })
            .strict(),
        )
        .max(100),
      cursor: z.null(),
      coverage: z
        .object({
          observedModels: z.number().int().nonnegative(),
          mappedModels: z.number().int().nonnegative(),
          unmappedModels: z.number().int().nonnegative(),
          populationCompleteness: z.literal("partial_or_unknown"),
        })
        .strict(),
      provenance: z.array(publicProvenanceSchema),
    })
    .strict(),
  z
    .object({
      schemaVersion: schemaVersionV2,
      status: z.literal("unavailable"),
      reason: z.enum([
        "collection_disabled",
        "unmapped_alias",
        "not_published",
        "no_observed_period",
        "period_mismatch",
      ]),
      lastSuccessAt: z.string().datetime().nullable(),
      stale: z.boolean(),
      staleAfterSeconds: z.literal(172800),
      completeness: appModelCompletenessSchema,
      provenance: z.array(publicProvenanceSchema),
      appId: exactIntegerStringSchema,
      data: z.tuple([]),
      cursor: z.null(),
    })
    .strict(),
]);

export const publicProviderSchema = z
  .object({
    modelId: z.string(),
    provider: z.string(),
    endpoint: z.string(),
    quantization: z.string().nullable(),
    contextLength: exactIntegerStringSchema.nullable(),
    promptPrice: exactDecimalStringSchema.nullable(),
    completionPrice: exactDecimalStringSchema.nullable(),
    discount: exactDecimalStringSchema.nullable(),
    uptime: exactDecimalStringSchema.nullable(),
    latency: exactDecimalStringSchema.nullable(),
    throughput: exactDecimalStringSchema.nullable(),
    status: z.string().nullable(),
    sourceUrl: z.string().url(),
    fetchedAt: z.string().datetime({ offset: true }),
  })
  .strict();
export const providerListResponseSchema = publicCollectionSchema(
  publicProviderSchema,
);

const freeFrontierXSchema = z.enum(["benchmarkQuality", "contextLength"]);
const freeFrontierYSchema = z.enum([
  "medianThroughput",
  "weeklyPopularityRank",
]);
export const publicFreeFrontierSchema = z
  .object({
    ruleVersion: z.literal("openrouter-free-pareto-v1"),
    dimensions: z
      .object({
        x: freeFrontierXSchema,
        y: freeFrontierYSchema,
        xDirection: z.enum(["min", "max"]),
        yDirection: z.enum(["min", "max"]),
      })
      .strict(),
    members: z.array(
      z
        .object({
          modelId: z.string(),
          x: exactDecimalStringSchema,
          y: exactDecimalStringSchema,
        })
        .strict(),
    ),
    excluded: z.array(
      z.object({ modelId: z.string(), reason: z.string() }).strict(),
    ),
  })
  .strict();
export const freeFrontierResponseSchema = publicCollectionSchema(
  publicFreeFrontierSchema,
);

export const manifestSchema = publicManifestResponseSchema;
export const modelsResponseSchema = publicModelsResponseSchema;
export const modelDetailResponseSchema = publicModelDetailResponseSchema;
export const freeModelsResponseSchema = publicFreeModelsResponseSchema;
export const deprecationsResponseSchema = publicDeprecationsResponseSchema;
export const sourceStatusResponseSchema = publicSourceStatusResponseSchema;
export const appsResponseSchema = publicAppsResponseSchema;
export const appDetailResponseSchema = publicAppDetailResponseSchema;
export const tasksResponseSchema = publicTasksResponseSchema;
export const benchmarksResponseSchema = publicBenchmarksResponseSchema;
export const appModelMatrixResponseSchema =
  publicAppModelMatrixResponseSchema;
export const appModelsResponseSchema = publicAppModelsResponseSchema;

export const priceTransitionSchema = z.enum([
  /** Was free, is still listed under the same id, and now costs money. */
  "became_paid",
  "became_free",
  "price_increased",
  "price_decreased",
  /** One half of the price rose while the other fell. Real, but not a direction. */
  "price_changed",
  /** The provider stopped publishing a price. Unknown, not free. */
  "price_withdrawn",
  "price_published",
]);

export const publicPriceChangeSchema = z
  .object({
    modelId: z.string(),
    transition: priceTransitionSchema,
    basePromptPrice: exactDecimalStringSchema.nullable(),
    baseCompletionPrice: exactDecimalStringSchema.nullable(),
    headPromptPrice: exactDecimalStringSchema.nullable(),
    headCompletionPrice: exactDecimalStringSchema.nullable(),
    wasFree: z.boolean(),
    isFree: z.boolean(),
  })
  .strict();

export const priceChangeResponseSchema = publicCollectionSchema(
  publicPriceChangeSchema,
)
  .extend({
    comparison: z
      .object({ baseRunId: z.string().uuid(), headRunId: z.string().uuid() })
      .strict(),
  })
  .strict();

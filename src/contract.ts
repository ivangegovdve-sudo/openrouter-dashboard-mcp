import { z } from "zod";

import { PACKAGE_VERSION } from "./version.js";

const canonicalDecimalSchema = z.string().regex(/^(0|[1-9]\d*)(?:\.\d+)?$/);

export const priceUnitSchema = z.enum([
  "token_in",
  "token_out",
  "token_cached",
  "token_cache_create",
  "image",
  "megapixel",
  "video_second",
  "video",
  "credit_image",
  "credit_video",
  "credit_audio",
  "request",
  "gpu_hour",
]);
export type PriceUnit = z.infer<typeof priceUnitSchema>;

/** Provenance of the numeric observation associated with a published price. */
export const measurementOriginSchema = z.enum([
  "catalogue",
  "live_provider_read",
  "unknown",
]);
export type MeasurementOrigin = z.infer<typeof measurementOriginSchema>;

const latencyWindowConditionSchema = z
  .object({
    kind: z.literal("latency_window"),
    name: z.enum(["ASAP", "Balanced", "Flex"]),
  })
  .strict();

const timeBandConditionSchema = z
  .object({
    kind: z.literal("time_band"),
    name: z.enum(["peak", "off_peak"]),
    timezone: z.string().min(1),
    hours: z.array(z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/)),
  })
  .strict();

const tierConditionSchema = z
  .object({
    kind: z.literal("tier"),
    name: z.string().min(1),
    threshold: canonicalDecimalSchema,
  })
  .strict();

const rateClassConditionSchema = z
  .object({
    kind: z.literal("rate_class"),
    name: z.enum(["list", "as_low_as"]),
  })
  .strict();

/**
 * WHOSE price this is. Added in 1.0 because an authenticated fal price -- what THIS
 * account is charged -- was emitted with `condition: null`, which positively asserts that
 * no condition applies. The scope survived only in the provider's requestParameters, so a
 * consumer reading a single price point could not tell an account-specific rate from a
 * public list rate, and comparePriceSets (which keys on the condition) would treat the
 * two as directly comparable.
 *
 * `rateClass` is folded in rather than left to the separate rate_class condition because
 * a price point carries exactly one condition: an account-scoped "as low as" GPU rate is
 * both things at once, and splitting them would drop one.
 */
const priceScopeConditionSchema = z
  .object({
    kind: z.literal("price_scope"),
    name: z.enum(["authenticated_account", "public_list"]),
    rateClass: z.enum(["list", "as_low_as"]).optional(),
  })
  .strict();

const generationConditionSchema = z.object({
  kind: z.literal("generation"),
  durationSeconds: canonicalDecimalSchema.nullable(),
  approximate: z.boolean(),
}).strict();

export const priceConditionSchema = z.union([
  latencyWindowConditionSchema,
  timeBandConditionSchema,
  tierConditionSchema,
  rateClassConditionSchema,
  priceScopeConditionSchema,
  generationConditionSchema,
]);
export type PriceCondition = z.infer<typeof priceConditionSchema> | null;

export const pricePointSchema = z
  .object({
    id: z.string().min(1),
    /** The published/native quote. This is never a settled charge. */
    amount: canonicalDecimalSchema,
    /** The published/native amount. This field never carries a settled charge. */
    unit: priceUnitSchema,
    /** A separately observed charge in the same unit, or null when unread. */
    observed: canonicalDecimalSchema.nullable(),
    measurement_origin: measurementOriginSchema,
    condition: priceConditionSchema.nullable(),
    source: z
      .object({
        url: z.string().url(),
        readAt: z.string().datetime({ offset: true }),
      })
      .strict(),
    provenance: z.enum([
      "published",
      "derived",
      "parsed_from_prose",
      "unknown",
    ]),
    derivedFrom: z.string().url().optional(),
    sourceText: z.string().min(1).optional(),
  })
  .strict();
export type PricePoint = z.infer<typeof pricePointSchema>;

export const normalizedFigureSchema = z
  .object({
    value: canonicalDecimalSchema,
    unit: z.string().min(1),
    assumption: z.string().min(1),
    derived_from: z.string().min(1),
  })
  .strict();
export type NormalizedFigure = z.infer<typeof normalizedFigureSchema>;

export const deprecationNoticeSchema = z
  .object({
    field: z.string().min(1),
    removed_in: z.union([z.string().regex(/^\d+\.\d+\.\d+$/), z.literal("unknown")]),
    replaced_by: z.string().min(1).nullable(),
    reason: z.string().min(1).nullable(),
    since: z.string().date(),
    state: z.enum(["published", "not_published", "unknown"]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.replaced_by === null && value.reason === null) {
      context.addIssue({
        code: "custom",
        message: "A deprecation without a replacement must explain why",
        path: ["reason"],
      });
    }
  });
export type DeprecationNotice = z.infer<typeof deprecationNoticeSchema>;

export const contractEnvelopeSchema = z
  .object({
    schema_version: z.literal("1.0"),
    package_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    deprecations: z.array(deprecationNoticeSchema),
  })
  .strict();
export type ContractEnvelope = z.infer<typeof contractEnvelopeSchema>;

export {
  costProvenanceSchema,
  costStateSchema,
  generationCostCollectionSchema,
  generationCostObservationSchema,
  measurementSourceSchema,
} from "./generation-cost.js";
export type {
  CostProvenance,
  CostState,
  GenerationCostCollection,
  GenerationCostObservation,
  MeasurementSource,
} from "./generation-cost.js";
export {
  appendGenerationCostObservation,
  buildMeasuredCostLedger,
  DEFAULT_MEASURED_COST_TTL_SECONDS,
  latestMeasuredGenerationCost,
  measuredCostLedgerSchema,
  publicMeasuredCostEntrySchema,
  publicMeasuredCostsResponseSchema,
  recordGenerationCostOutcome,
} from "./measured-cost-ledger.js";
export type {
  GenerationCostOutcome,
  MeasuredCostLedger,
  MeasuredCostState,
  PublicMeasuredCostEntry,
} from "./measured-cost-ledger.js";

const DEPRECATIONS: DeprecationNotice[] = [
  { field: "catalogueModel.pricing", removed_in: "1.0.0", replaced_by: "pricePoints", reason: null, since: "2026-09-08", state: "published" },
  { field: "catalogueModel.pricing.prices", removed_in: "1.0.0", replaced_by: "pricePoints", reason: null, since: "2026-09-08", state: "published" },
  { field: "liveModel.pricing", removed_in: "1.0.0", replaced_by: "pricePoints", reason: null, since: "2026-09-08", state: "published" },
  { field: "liveModel.pricingWindow", removed_in: "1.0.0", replaced_by: "pricePoints[].condition", reason: null, since: "2026-09-08", state: "published" },
  { field: "modelEconomicsModel.pricing", removed_in: "1.0.0", replaced_by: "pricePoints", reason: null, since: "2026-09-08", state: "published" },
  { field: "freeModels.liveCandidates[].pricing", removed_in: "1.0.0", replaced_by: "pricePoints", reason: null, since: "2026-09-08", state: "published" },
  { field: "modelStatus.model.pricing", removed_in: "1.0.0", replaced_by: "pricePoints", reason: null, since: "2026-09-08", state: "published" },
  // THIS ONE WAS MISSING AND THE TOOL PROMISED IT WOULD NOT BE. dashboard_contract says
  // it returns "every field or tool announced for removal", and 1.0 removed the per-row
  // claimAssessment -- the vendor-discount contradiction verdict, whose statuses included
  // outside_range_for_this_model -- without a notice. A removal mechanism that omits a
  // removal is worse than none, because it invites consumers to trust the list.
  // No replacement exists: the top-level vendorClaim.globalAssessment still reports
  // whether the claim is established platform-wide, but the per-model verdict is gone, so
  // the notice carries a reason rather than a replaced_by.
  { field: "priceComparison.rows[].claimAssessment", removed_in: "1.0.0", replaced_by: null,
    reason: "Per-model assessment of a vendor discount claim is not published in 1.0. vendorClaim.globalAssessment still reports whether the claim is established across the platform, but no per-model verdict replaces this field.",
    since: "2026-09-08", state: "published" },
];

export function contractEnvelope(): ContractEnvelope {
  return contractEnvelopeSchema.parse({
    schema_version: "1.0",
    package_version: PACKAGE_VERSION,
    deprecations: DEPRECATIONS,
  });
}

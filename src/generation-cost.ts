import { z } from "zod";

import {
  exactDecimalStringSchema,
  exactIntegerStringSchema,
  publicCollectionSchema,
} from "./dashboard/schemas/common.js";

export const costStateSchema = z.enum([
  "MEASURED",
  "PUBLISHED_ESTIMATE",
  "DERIVED",
  "BLOCKED",
  "UNKNOWN",
  "LAG",
]);
export type CostState = z.infer<typeof costStateSchema>;

export const costProvenanceSchema = z.enum([
  "MEASURED",
  "PUBLISHED",
  "DERIVED",
  "BLOCKED",
  "UNKNOWN",
]);
export type CostProvenance = z.infer<typeof costProvenanceSchema>;

const workloadSchema = z
  .object({
    name: z.string().min(1),
    inputTokens: exactIntegerStringSchema.nullable(),
    outputTokens: exactIntegerStringSchema.nullable(),
    maxOutputTokens: exactIntegerStringSchema.nullable(),
  })
  .strict();

const tokenCountsSchema = z
  .object({
    input: exactIntegerStringSchema,
    output: exactIntegerStringSchema,
    total: exactIntegerStringSchema,
  })
  .strict();

const latencySchema = z
  .object({
    ttftMs: exactDecimalStringSchema.nullable(),
    roundTripMs: exactDecimalStringSchema.nullable(),
    sustainedThroughputTps: exactDecimalStringSchema.nullable(),
    workload: workloadSchema,
    vantagePoint: z.string().min(1),
    tokenBudget: workloadSchema.pick({ inputTokens: true, outputTokens: true }),
    n: exactIntegerStringSchema,
    percentileMethod: z.enum([
      "single_observation",
      "median",
      "median_and_range_of_remaining_three",
      "published",
      "unknown",
    ]),
    observedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const generationCostObservationSchema = z
  .object({
    id: z.string().min(1),
    provider: z.string().min(1),
    upstreamProvider: z.string().min(1),
    model: z.string().min(1),
    observedAt: z.string().datetime({ offset: true }),
    provenanceDate: z.string().datetime({ offset: true }),
    workload: workloadSchema,
    vantagePoint: z.string().min(1),
    tokenCounts: tokenCountsSchema,
    costUsd: exactDecimalStringSchema.nullable(),
    costState: costStateSchema,
    provenance: costProvenanceSchema,
    balanceDeltaUsd: exactDecimalStringSchema.nullable(),
    authoritativeField: z.string().min(1).nullable(),
    sourceUrl: z.string().url().nullable(),
    latency: latencySchema,
    note: z.string().min(1),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.costState === "MEASURED") {
      if (value.provenance !== "MEASURED") context.addIssue({ code: "custom", path: ["provenance"], message: "Measured cost must carry MEASURED provenance" });
      if (value.costUsd === null || value.authoritativeField === null) context.addIssue({ code: "custom", path: ["costUsd"], message: "Measured cost requires an authoritative numeric field" });
    }
    if (value.costState === "LAG") {
      if (value.costUsd !== null || value.provenance !== "UNKNOWN") context.addIssue({ code: "custom", path: ["costState"], message: "A lagging balance cannot be presented as a cost" });
      if (value.balanceDeltaUsd !== "0") context.addIssue({ code: "custom", path: ["balanceDeltaUsd"], message: "LAG records must retain the observed zero balance delta" });
    }
    if (value.costState === "BLOCKED" && value.costUsd !== null) context.addIssue({ code: "custom", path: ["costUsd"], message: "Blocked cost has no numeric per-generation cost" });
    if (value.costState === "DERIVED" && value.provenance !== "DERIVED") context.addIssue({ code: "custom", path: ["provenance"], message: "Derived cost must carry DERIVED provenance" });
  });

export type GenerationCostObservation = z.infer<typeof generationCostObservationSchema>;
export const generationCostCollectionSchema = publicCollectionSchema(generationCostObservationSchema);
export type GenerationCostCollection = z.infer<typeof generationCostCollectionSchema>;

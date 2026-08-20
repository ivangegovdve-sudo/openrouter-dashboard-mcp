import { z } from "zod";

export const schemaVersionV2 = z.literal("2.0");
export const exactIntegerStringSchema = z.string().regex(/^(0|[1-9]\d*)$/);
export const exactDecimalStringSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)(\.\d+)?$/);
export const sourceTierSchema = z.enum([
  "stable",
  "supported",
  "best_effort",
]);
export const populationCompletenessSchema = z.enum([
  "full",
  "requested_slice",
  "top_n_plus_other",
  "partial_or_unknown",
]);
export const rankMethodSchema = z.enum([
  "source_published",
  "response_order",
  "locally_calculated",
]);
export const publicWindowSchema = z
  .object({
    start: z.string().date().nullable(),
    end: z.string().date().nullable(),
    timezone: z.enum(["UTC", "unknown"]),
    inclusive: z.boolean().nullable(),
    basis: z.enum(["source_meta", "query", "derived", "observed", "unknown"]),
  })
  .strict();
export const publicProvenanceSchema = z
  .object({
    sourceId: z.string().min(1),
    sourceTier: sourceTierSchema,
    runId: z.string().uuid(),
    fetchedAt: z.string().datetime({ offset: true }),
    sourceAsOf: z.string().datetime({ offset: true }).nullable(),
    transformVersion: z.string().min(1),
    citation: z.string().nullable(),
  })
  .strict();
export const publicCompletenessSchema = z
  .object({
    acquisitionComplete: z.boolean(),
    populationCompleteness: populationCompletenessSchema,
    missingFields: z.array(z.string()),
  })
  .strict();
export const publicRankMetadataSchema = z
  .object({
    metric: z.string(),
    unit: z.string(),
    direction: z.enum(["asc", "desc"]),
    rankMethod: rankMethodSchema,
    baseline: z.string().nullable(),
    eligiblePopulation: exactIntegerStringSchema.nullable(),
    ruleVersion: z.string(),
    taxonomyVersion: z.string().nullable(),
  })
  .strict();

export function publicCollectionSchema<T extends z.ZodType>(itemSchema: T) {
  return z
    .object({
      schemaVersion: schemaVersionV2,
      data: z.array(itemSchema),
      cursor: z.string().nullable(),
      window: publicWindowSchema,
      completeness: publicCompletenessSchema,
      stale: z.boolean(),
      rank: publicRankMetadataSchema.nullable(),
      provenance: z.array(publicProvenanceSchema),
    })
    .strict();
}

export function publicSingletonSchema<T extends z.ZodType>(itemSchema: T) {
  return z
    .object({
      schemaVersion: schemaVersionV2,
      data: itemSchema,
      window: publicWindowSchema,
      completeness: publicCompletenessSchema,
      stale: z.boolean(),
      provenance: z.array(publicProvenanceSchema),
    })
    .strict();
}

export const publicErrorSchema = z
  .object({
    schemaVersion: schemaVersionV2,
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        correlationId: z.string().uuid(),
        retryable: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const windowSchema = publicWindowSchema;
export const provenanceSchema = publicProvenanceSchema;
export const completenessSchema = publicCompletenessSchema;
export const rankMetadataSchema = publicRankMetadataSchema;
export const collectionSchema = publicCollectionSchema;
export const singletonSchema = publicSingletonSchema;

export type PublicReadResult<T> = {
  schemaVersion: "2.0";
  data: T[];
  cursor: string | null;
  window: z.infer<typeof publicWindowSchema>;
  completeness: z.infer<typeof publicCompletenessSchema>;
  stale: boolean;
  rank: z.infer<typeof publicRankMetadataSchema> | null;
  provenance: Array<z.infer<typeof publicProvenanceSchema>>;
};

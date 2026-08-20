import { z } from "zod";

import {
  publicCompletenessSchema,
  publicProvenanceSchema,
  publicWindowSchema,
  schemaVersionV2,
} from "./common.js";

const exactDecimal = z.string().regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);

export const publicOverviewHistoryRowSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    scope: z.string().nullable(),
    rank: z.number().int().positive().nullable(),
    value: exactDecimal.nullable(),
    remainder: exactDecimal.nullable(),
    stars: z.string().regex(/^\d+$/).nullable(),
    forks: z.string().regex(/^\d+$/).nullable(),
  })
  .strict();

export const publicOverviewHistoryBucketSchema = z
  .object({
    date: z.string().date(),
    complete: z.boolean(),
    rows: z.array(publicOverviewHistoryRowSchema),
  })
  .strict();

export const publicOverviewHistoryDataSchema = z
  .object({
    modelUsage: z.array(publicOverviewHistoryBucketSchema).max(365),
    appRanks: z.array(publicOverviewHistoryBucketSchema).max(365),
    githubRanks: z.array(publicOverviewHistoryBucketSchema).max(365),
  })
  .strict();

const availableOverviewHistorySchema = z
  .object({
    schemaVersion: schemaVersionV2,
    status: z.literal("available"),
    data: publicOverviewHistoryDataSchema,
    window: publicWindowSchema,
    completeness: publicCompletenessSchema,
    stale: z.boolean(),
    rank: z.null(),
    provenance: z.array(publicProvenanceSchema),
  })
  .strict();

const unavailableOverviewHistorySchema = z
  .object({
    schemaVersion: schemaVersionV2,
    status: z.literal("unavailable"),
    reason: z.literal("insufficient_history"),
    lastSuccessAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();

export const publicOverviewHistoryResponseSchema = z.discriminatedUnion(
  "status",
  [availableOverviewHistorySchema, unavailableOverviewHistorySchema],
);

export const publicEntityHistoryRowSchema = z
  .object({
    observedDate: z.string().date(),
    complete: z.boolean(),
    entityId: z.string().min(1),
    label: z.string().min(1),
    scope: z.string().nullable(),
    rank: z.number().int().positive().nullable(),
    value: exactDecimal.nullable(),
    remainder: exactDecimal.nullable(),
    stars: z.string().regex(/^\d+$/).nullable(),
    forks: z.string().regex(/^\d+$/).nullable(),
  })
  .strict();

export const publicEntityHistoryResponseSchema = z
  .object({
    schemaVersion: schemaVersionV2,
    entityId: z.string().min(1),
    factKind: z.enum(["usage", "rank", "tokens"]),
    data: z.array(publicEntityHistoryRowSchema).max(366),
    cursor: z.string().nullable(),
    window: publicWindowSchema,
    completeness: publicCompletenessSchema,
    stale: z.boolean(),
    provenance: z.array(publicProvenanceSchema),
  })
  .strict();

export const overviewHistoryResponseSchema =
  publicOverviewHistoryResponseSchema;
export const entityHistoryResponseSchema = publicEntityHistoryResponseSchema;

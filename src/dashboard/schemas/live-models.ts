import { z } from "zod";

import {
  exactDecimalStringSchema,
  exactIntegerStringSchema,
  publicCollectionSchema,
} from "./common.js";

export const providerIdSchema = z.enum(["openrouter", "groq", "cerebras"]);
export const availabilitySchema = z.enum(["available", "disappeared"]);
export const freeKindSchema = z.enum([
  "concrete_free",
  "free_router",
  "paid_or_unknown",
]);

export const liveModelSchema = z
  .object({
    provider: providerIdSchema,
    id: z.string().min(1),
    displayName: z.string().nullable(),
    ownedBy: z.string().nullable(),
    contextLength: exactIntegerStringSchema.nullable(),
    pricing: z
      .object({
        promptUsdPerToken: exactDecimalStringSchema.nullable(),
        completionUsdPerToken: exactDecimalStringSchema.nullable(),
      })
      .strict(),
    isFree: z.boolean().nullable(),
    freeKind: freeKindSchema,
    providerActive: z.boolean().nullable(),
    reasoningEfforts: z.array(z.string()).nullable(),
    outputModalities: z.array(z.string()).nullable(),
    performance: z
      .object({
        throughputTps: exactDecimalStringSchema.nullable(),
        latencyMsP50: exactDecimalStringSchema.nullable(),
        fastestProvider: z.string().nullable(),
        observedAt: z.string().datetime({ offset: true }),
      })
      .strict()
      .nullable(),
    availability: availabilitySchema,
    firstSeenAt: z.string().datetime({ offset: true }),
    lastSeenAt: z.string().datetime({ offset: true }),
    lastConfirmedAt: z.string().datetime({ offset: true }),
    disappearedAt: z.string().datetime({ offset: true }).nullable(),
    absenceStreak: exactIntegerStringSchema,
    missingFields: z.array(z.string()),
  })
  .strict();

export const liveModelsResponseSchema = publicCollectionSchema(liveModelSchema);

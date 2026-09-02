import { z } from "zod";

import {
  exactDecimalStringSchema,
  exactIntegerStringSchema,
  publicCollectionSchema,
} from "./common.js";

export const providerIdSchema = z.enum(["openrouter", "groq", "cerebras", "sail"]);
export const availabilitySchema = z.enum(["available", "disappeared"]);
export const freeKindSchema = z.enum([
  "concrete_free",
  "free_router",
  "paid_or_unknown",
]);

export function isSemanticZeroDecimal(value: string | null): boolean {
  return value !== null && /^0(?:\.0+)?$/.test(value);
}

type FreenessMetadata = {
  pricing: {
    promptUsdPerToken: string | null;
    completionUsdPerToken: string | null;
  };
  isFree: boolean | null;
  freeKind: z.infer<typeof freeKindSchema>;
};

export function hasConsistentLiveModelFreeness(
  value: FreenessMetadata,
): boolean {
  const pricesComplete =
    value.pricing.promptUsdPerToken !== null &&
    value.pricing.completionUsdPerToken !== null;
  if (value.freeKind === "concrete_free") {
    return (
      value.isFree === true &&
      isSemanticZeroDecimal(value.pricing.promptUsdPerToken) &&
      isSemanticZeroDecimal(value.pricing.completionUsdPerToken)
    );
  }
  return value.isFree === (pricesComplete ? false : null);
}

export function isConcreteFreeLiveModel(value: FreenessMetadata): boolean {
  return (
    hasConsistentLiveModelFreeness(value) &&
    value.freeKind === "concrete_free"
  );
}

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
  .strict()
  .superRefine((value, context) => {
    if (!hasConsistentLiveModelFreeness(value)) {
      context.addIssue({
        code: "custom",
        message: "Live-model freeness metadata is inconsistent",
        path: ["isFree"],
      });
    }
  });

export const liveModelsResponseSchema = publicCollectionSchema(liveModelSchema);

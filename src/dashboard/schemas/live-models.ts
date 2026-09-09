import { z } from "zod";

import {
  exactDecimalStringSchema,
  exactIntegerStringSchema,
  publicCollectionSchema,
} from "./common.js";
import { pricePointSchema } from "../../contract.js";

/**
 * DELIBERATELY NOT AN ENUM.
 *
 * This was `z.enum(["openrouter","groq","cerebras","sail"])`. On 2026-09-08 the
 * dashboard began serving five more providers and every live-model response
 * failed validation -- 197 issues from one new fact -- in the PUBLISHED
 * package, for everyone who had it installed.
 *
 * A read-only client must not reject a response because the server learned
 * something. An unrecognised provider is passed through and described by
 * `describeProvider`, which says plainly that this build does not know it.
 * Validation still rejects a missing or empty provider, which would be a real
 * defect rather than a newer server.
 */
export const providerIdSchema = z.string().min(1);
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
  pricePoints: Array<{ unit: string; amount: string; condition: unknown }>;
  isFree: boolean | null;
  freeKind: z.infer<typeof freeKindSchema>;
};

function tokenAmount(
  value: FreenessMetadata,
  unit: "token_in" | "token_out",
): string | null {
  return value.pricePoints.find(
    (point) => point.unit === unit && point.condition === null,
  )?.amount ?? null;
}

export function hasConsistentLiveModelFreeness(
  value: FreenessMetadata,
): boolean {
  const input = tokenAmount(value, "token_in");
  const output = tokenAmount(value, "token_out");
  const pricesComplete = input !== null && output !== null;
  if (value.freeKind === "concrete_free") {
    return (
      value.isFree === true &&
      isSemanticZeroDecimal(input) &&
      isSemanticZeroDecimal(output)
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

const liveModelObjectSchema = z
  .object({
    provider: providerIdSchema,
    id: z.string().min(1),
    displayName: z.string().nullable(),
    ownedBy: z.string().nullable(),
    contextLength: exactIntegerStringSchema.nullable(),
    pricePoints: z.array(pricePointSchema),
    pricingState: z.enum(["published", "not_published", "unknown"]),
    pricingNote: z.string().optional(),
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

/** Accepts old dashboard input only at the untrusted source boundary, then
 * projects it immediately to the 1.0 shape. The old field is never emitted. */
export const liveModelSchema = z.preprocess((raw) => {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const value = raw as Record<string, unknown>;
  if (!Object.hasOwn(value, "pricing")) return raw;
  const pricing = value.pricing;
  if (pricing === null || typeof pricing !== "object" || Array.isArray(pricing)) return raw;
  const source = { url: "https://dashboard.test/api/public/v2/live-models", readAt: typeof value.lastConfirmedAt === "string" ? value.lastConfirmedAt : "2026-01-01T00:00:00.000Z" };
  const window = typeof value.pricingWindow === "string" ? value.pricingWindow.toLowerCase() : "";
  const condition = window.includes("asap") ? { kind: "latency_window", name: "ASAP" } : window.includes("balanced") ? { kind: "latency_window", name: "Balanced" } : window.includes("flex") ? { kind: "latency_window", name: "Flex" } : null;
  const pricePoints = Object.entries(pricing as Record<string, unknown>).flatMap(([name, amount]) => {
    if (typeof amount !== "string") return [];
    const unit = name === "promptUsdPerToken" ? "token_in" : name === "completionUsdPerToken" ? "token_out" : null;
    return unit === null ? [] : [{ id: `${String(value.provider)}:${String(value.id)}:${unit}`, amount, unit, condition, source, provenance: "published" }];
  });
  const { pricing: _pricing, pricingWindow: _pricingWindow, ...rest } = value;
  return { ...rest, pricePoints, pricingState: pricePoints.length > 0 ? "published" : "unknown" };
}, liveModelObjectSchema);

export const liveModelsResponseSchema = publicCollectionSchema(liveModelSchema);

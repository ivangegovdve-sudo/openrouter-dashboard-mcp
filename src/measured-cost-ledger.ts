import { z } from "zod";

import {
  exactDecimalStringSchema,
  publicCollectionSchema,
} from "./dashboard/schemas/common.js";
import {
  generationCostObservationSchema,
  type GenerationCostObservation,
  type Workload,
} from "./generation-cost.js";

/**
 * The measured-cost ledger is an append-only evidence stream.  A catalogue
 * price never enters this module: callers must provide the provider's
 * authoritative per-generation field, or the result is explicitly UNKNOWN or
 * LAG.  A zero charge is valid when the provider actually reports zero; a zero
 * balance delta is never treated as that charge.
 */
export const MEASURED_COST_LEDGER_SCHEMA_VERSION = "1.0" as const;
export const DEFAULT_MEASURED_COST_TTL_SECONDS = 24 * 60 * 60;

export const measuredCostLedgerSchema = z
  .object({
    schemaVersion: z.literal(MEASURED_COST_LEDGER_SCHEMA_VERSION),
    generatedAt: z.string().datetime({ offset: true }),
    freshnessTtlSeconds: z.number().int().positive(),
    observations: z.array(generationCostObservationSchema),
  })
  .strict();

export type MeasuredCostLedger = z.infer<typeof measuredCostLedgerSchema>;

/** Public publication contract. It intentionally omits token counts, volume,
 * balances, request identifiers, and vantage-point details. */
export const publicMeasuredCostEntrySchema = z
  .object({
    slug: z.string().min(1),
    routedProvider: z.string().min(1),
    measuredCostUsd: exactDecimalStringSchema,
    observedAt: z.string().datetime({ offset: true }),
    method: z.string().min(1),
    provenance: z.literal("MEASURED"),
    freshnessTtlSeconds: z.number().int().positive(),
    expiresAt: z.string().datetime({ offset: true }),
    sourceUrl: z.string().url(),
  })
  .strict();
export const publicMeasuredCostsResponseSchema = publicCollectionSchema(
  publicMeasuredCostEntrySchema,
);
export type PublicMeasuredCostEntry = z.infer<
  typeof publicMeasuredCostEntrySchema
>;

export type MeasuredCostState = "known" | "unknown" | "expired";

export type GenerationCostOutcome = {
  id: string;
  provider: string;
  upstreamProvider: string;
  model: string;
  observedAt: string;
  provenanceDate?: string;
  workload: Workload;
  vantagePoint: string;
  tokenCounts: { input: string; output: string; total: string };
  /** The provider's authoritative per-generation charge. Catalogue prices are not accepted here. */
  costUsd: string | null;
  /** A zero balance delta is evidence of billing lag, not a free generation. */
  balanceDeltaUsd?: string | null;
  authoritativeField: string | null;
  sourceUrl: string | null;
  httpStatus?: number | null;
  errorBucket?: GenerationCostObservation["errorBucket"];
  latency: GenerationCostObservation["latency"];
  note: string;
};

function outcomeToObservation(input: GenerationCostOutcome): GenerationCostObservation {
  const balanceDeltaUsd = input.balanceDeltaUsd ?? null;
  const measured = input.costUsd !== null && input.authoritativeField !== null;
  const lagging = !measured && balanceDeltaUsd === "0";
  const costState = measured ? "MEASURED" : lagging ? "LAG" : "UNKNOWN";
  const provenance = measured ? "MEASURED" : "UNKNOWN";
  return generationCostObservationSchema.parse({
    id: input.id,
    provider: input.provider,
    upstreamProvider: input.upstreamProvider,
    model: input.model,
    observedAt: input.observedAt,
    provenanceDate: input.provenanceDate ?? input.observedAt,
    workload: input.workload,
    vantagePoint: input.vantagePoint,
    tokenCounts: input.tokenCounts,
    costUsd: measured ? input.costUsd : null,
    costState,
    provenance,
    httpStatus: input.httpStatus ?? null,
    errorBucket: input.errorBucket ?? null,
    balanceDeltaUsd,
    authoritativeField: measured ? input.authoritativeField : null,
    sourceUrl: input.sourceUrl,
    latency: input.latency,
    note: input.note,
  });
}

/** Convert one real provider result into a validated ledger observation. */
export function recordGenerationCostOutcome(input: GenerationCostOutcome): GenerationCostObservation {
  return outcomeToObservation(input);
}

/**
 * Append one real observation, replacing an observation with the same id.
 * Repeated generations therefore refresh the latest measured row while the
 * previous rows remain available for drift analysis.
 */
export function appendGenerationCostObservation(
  existing: readonly GenerationCostObservation[],
  outcome: GenerationCostOutcome | GenerationCostObservation,
): GenerationCostObservation[] {
  const next = "costState" in outcome
    ? generationCostObservationSchema.parse(outcome)
    : outcomeToObservation(outcome);
  return [...existing.filter((item) => item.id !== next.id), next]
    .sort((left, right) => Date.parse(left.observedAt) - Date.parse(right.observedAt));
}

export function buildMeasuredCostLedger(
  observations: readonly GenerationCostObservation[],
  options: { now: string; freshnessTtlSeconds?: number },
): MeasuredCostLedger {
  return measuredCostLedgerSchema.parse({
    schemaVersion: MEASURED_COST_LEDGER_SCHEMA_VERSION,
    generatedAt: options.now,
    freshnessTtlSeconds: options.freshnessTtlSeconds ?? DEFAULT_MEASURED_COST_TTL_SECONDS,
    observations: observations.map((item) => generationCostObservationSchema.parse(item)),
  });
}

function isFresh(observedAt: string, now: string, ttlSeconds: number): boolean {
  const observed = Date.parse(observedAt);
  const current = Date.parse(now);
  return Number.isFinite(observed) && Number.isFinite(current)
    && observed + ttlSeconds * 1_000 >= current;
}

/** Return the newest measured charge, with EXPIRED kept explicit. */
export function latestMeasuredGenerationCost(
  observations: readonly GenerationCostObservation[],
  options: { now: string; freshnessTtlSeconds?: number },
): { state: MeasuredCostState; value: string | null; observation: GenerationCostObservation | null } {
  const measured = observations
    .filter((item) => item.costState === "MEASURED" && item.costUsd !== null)
    .sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt));
  const latest = measured[0] ?? null;
  if (latest === null) return { state: "unknown", value: null, observation: null };
  const ttl = options.freshnessTtlSeconds ?? DEFAULT_MEASURED_COST_TTL_SECONDS;
  if (!isFresh(latest.observedAt, options.now, ttl)) return { state: "expired", value: null, observation: latest };
  return { state: "known", value: latest.costUsd, observation: latest };
}

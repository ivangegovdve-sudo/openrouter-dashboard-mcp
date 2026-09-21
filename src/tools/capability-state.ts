import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import { liveModelSchema, liveModelsResponseSchema } from "../dashboard/schemas/live-models.js";
import { manifestSchema } from "../dashboard/schemas/openrouter.js";
import { pricePointSchema } from "../contract.js";
import {
  generationCostCollectionSchema,
  generationCostObservationSchema,
} from "../generation-cost.js";
import {
  publicMeasuredCostsResponseSchema,
  type PublicMeasuredCostEntry,
} from "../measured-cost-ledger.js";
import { measurementManifestSchema, WEEKLY_MEASUREMENT_MANIFEST } from "../measurement-manifest.js";
import { PROVIDER_IDS } from "../providers/registry.js";
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
const GENERATION_COSTS_ENDPOINT = "/api/public/v2/generation-costs";
export const MEASURED_COSTS_ENDPOINT = "/api/public/v2/measured-costs";
export const FUNCTIONALITY_LEDGER_ENDPOINT = "/api/public/v2/functionality-ledger";
export const MODEL_LINEAGE_ENDPOINT = "/api/public/v2/model-lineage";
export const MODEL_CAPABILITY_ENDPOINT = "/api/public/v2/model-capabilities";

export const CAPABILITY_STATE_PAGE_SIZE = 500;
// A default state read follows the live-model cursor until it is exhausted.
// A page limit would turn a first-page sample into a catalogue-wide claim.
export const CAPABILITY_STATE_PAGE_LIMIT: number | null = null;
export const CAPABILITY_STATE_DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Measured charges drift faster than catalogue/functionality evidence. */
export const GENERATION_COST_DEFAULT_TTL_SECONDS = 24 * 60 * 60;
export const CAPABILITY_STATE_MAX_ROWS = 2_000;
export const FUNCTIONALITY_LATENCY_BOUND_MS = "60000";

const observationStateSchema = z.enum(["known", "unknown", "expired"]);
const decimalStringSchema = z.string().regex(/^(0|[1-9]\d*)(?:\.\d+)?$/);
const dateTimeSchema = z.string().datetime({ offset: true });
const errorBucketSchema = z.enum([
  "rate_limit",
  "authentication",
  "not_found",
  "dead_model",
  "server_error",
  "timeout",
  "transport",
]);

type ObservationState = z.infer<typeof observationStateSchema>;
type ErrorBucket = z.infer<typeof errorBucketSchema>;

type Observation<T> = {
  state: ObservationState;
  value: T | null;
  observed_at: string | null;
  checked_at: string;
  expires_at: string | null;
  age_seconds: number | null;
  source: string | null;
  reason: string | null;
};

function observationSchema<T extends z.ZodTypeAny>(value: T) {
  return z
    .object({
      state: observationStateSchema,
      value: value.nullable(),
      observed_at: dateTimeSchema.nullable(),
      checked_at: dateTimeSchema,
      expires_at: dateTimeSchema.nullable(),
      age_seconds: z.number().int().nonnegative().nullable(),
      source: z.string().nullable(),
      reason: z.string().nullable(),
    })
    .strict();
}

const boolObservationSchema = observationSchema(z.boolean());
const stringObservationSchema = observationSchema(z.string());
const modalitiesObservationSchema = observationSchema(z.array(z.string()));
const priceObservationSchema = observationSchema(z.array(pricePointSchema));
const costObservationSchema = observationSchema(z.array(generationCostObservationSchema));
const timestampObservationSchema = observationSchema(dateTimeSchema);

const semanticQualitySchema = observationSchema(z.enum(["pass", "fail"])).extend({
  judge_hook: z.literal("reserved_for_external_semantic_judge"),
});

const functionalitySchema = z
  .object({
    resolves: boolObservationSchema,
    structured_output_ok: boolObservationSchema,
    p50_latency: observationSchema(decimalStringSchema),
    p95_latency: observationSchema(decimalStringSchema),
    latency_bound_ms: observationSchema(decimalStringSchema),
    last_functionally_tested: timestampObservationSchema,
    semantic_quality: semanticQualitySchema,
  })
  .strict();

const selectionSchema = z
  .object({
    state: z.enum(["eligible", "ineligible", "unknown"]),
    reason: z.string(),
    missing_fields: z.array(z.string()),
    failed_gates: z.array(z.string()),
  })
  .strict();

const reachabilitySchema = z
  .object({
    // This is deliberately a three-state field. A dead or stale probe is not
    // a fourth positive state; it is UNKNOWN with bucketed evidence.
    state: z.enum(["live", "rate_limited", "unknown"]),
    freshness_state: observationStateSchema,
    http_status: z.number().int().min(100).max(599).nullable(),
    error_bucket: errorBucketSchema.nullable(),
    observed_at: dateTimeSchema.nullable(),
    checked_at: dateTimeSchema,
    expires_at: dateTimeSchema.nullable(),
    age_seconds: z.number().int().nonnegative().nullable(),
    source: z.string().nullable(),
    reason: z.string().nullable(),
  })
  .strict();

export const functionalityLedgerEntrySchema = z
  .object({
    slug: z.string().min(1),
    catalogue_provider: z.string().min(1),
    resolves: boolObservationSchema,
    structured_output_ok: boolObservationSchema,
    p50_latency: observationSchema(decimalStringSchema),
    p95_latency: observationSchema(decimalStringSchema),
    latency_bound_ms: observationSchema(decimalStringSchema),
    last_functionally_tested: timestampObservationSchema,
    semantic_quality: semanticQualitySchema,
    probe_http_status: z.number().int().min(100).max(599).nullable(),
    probe_error_bucket: errorBucketSchema.nullable(),
    note: z.string().min(1),
  })
  .strict();

export const functionalityLedgerSchema = z
  .object({
    schema_version: z.literal("1.0"),
    generated_at: dateTimeSchema,
    source: z.string().nullable(),
    entries: z.array(functionalityLedgerEntrySchema),
  })
  .strict();

export const modelLineageLedgerEntrySchema = z
  .object({
    slug: z.string().min(1),
    catalogue_provider: z.string().min(1),
    model_family: stringObservationSchema,
    base_weights_lineage: stringObservationSchema,
    note: z.string().min(1),
  })
  .strict();

export const modelLineageLedgerSchema = z
  .object({
    schema_version: z.literal("1.0"),
    generated_at: dateTimeSchema,
    source: z.string().nullable(),
    entries: z.array(modelLineageLedgerEntrySchema),
  })
  .strict();

export const modelCapabilityLedgerEntrySchema = z
  .object({
    slug: z.string().min(1),
    catalogue_provider: z.string().min(1),
    supports_tool_calling: boolObservationSchema,
    input_modalities: modalitiesObservationSchema,
    note: z.string().min(1),
  })
  .strict();

export const modelCapabilityLedgerSchema = z
  .object({
    schema_version: z.literal("1.0"),
    generated_at: dateTimeSchema,
    source: z.string().nullable(),
    entries: z.array(modelCapabilityLedgerEntrySchema),
  })
  .strict();

export const capabilityRowSchema = z
  .object({
    // key is a stable disambiguator; slug remains the provider-facing model id.
    key: z.string().min(3),
    slug: z.string().min(1),
    catalogue_provider: z.string().min(1),
    display_name: z.string().nullable(),
    billing_class: observationSchema(z.enum(["paid", "free"])),
    supports_tool_calling: boolObservationSchema,
    context_window: observationSchema(z.string().regex(/^(0|[1-9]\d*)$/)),
    input_modalities: modalitiesObservationSchema,
    output_modalities: modalitiesObservationSchema,
    model_family: stringObservationSchema,
    base_weights_lineage: stringObservationSchema,
    catalogue_price: priceObservationSchema,
    generation_cost: costObservationSchema,
    routed_provider: stringObservationSchema,
    reachability: reachabilitySchema,
    functionality: functionalitySchema,
    selection: z
      .object({
        public_council: selectionSchema,
        private_council: selectionSchema,
      })
      .strict(),
  })
  .strict();

const selectedModelSchema = z
  .object({
    key: z.string().min(3),
    slug: z.string().min(1),
    catalogue_provider: z.string().min(1),
    routed_provider: z.string().nullable(),
  })
  .strict();

const queryExampleSchema = z
  .object({
    rule: z.enum(["literal_cheapest_paid", "cheapest_functional"]),
    decision_state: z.enum(["decidable", "blocked"]),
    selected: selectedModelSchema.nullable(),
    missing_fields: z.array(z.string()),
    considered_rows: z.number().int().nonnegative(),
    candidate_rows: z.number().int().nonnegative(),
    elimination_breakdown: z
      .object({
        counts: z.record(z.string(), z.number().int().nonnegative()),
        not_evaluated: z.array(z.string()),
        note: z.string(),
      })
      .strict(),
    basis: z.string(),
  })
  .strict();

const workloadSchema = z
  .object({
    id: z.literal("selection_without_inference"),
    prompt: z.null(),
    requested_output_tokens: z.null(),
    input_tokens: z.null(),
    output_tokens: z.null(),
    sample_size: z.literal(0),
    note: z.string(),
  })
  .strict();

const paginationSchema = z
  .object({
    page_size: z.number().int().positive(),
    page_limit: z.number().int().positive().nullable(),
    pages_scanned: z.number().int().nonnegative(),
    rows_scanned: z.number().int().nonnegative(),
    live_rows_returned: z.number().int().nonnegative(),
    capped: z.boolean(),
    next_cursor: z.string().nullable(),
  })
  .strict();

const noLiveRowsReasonSchema = z.enum([
  "no_key",
  "key_unentitled",
  "endpoint_changed",
  "adapter_broken",
  "genuinely_empty",
]);

/**
 * A missing row is a finding about this capability feed, never proof that a
 * provider has no catalogue. Keep the reason beside the count so a router
 * cannot silently turn an absent adapter into a free/empty provider.
 *
 * These are dated adapter findings, not provider-wide claims:
 * - Crazyrouter's authenticated catalogue was not configured (the public
 *   pricing reader remains a separate surface).
 * - fal is exposed by the media catalogue endpoint, not this text live feed.
 * - Nous's catalogue credential authenticated but its inference probe was
 *   rejected (HTTP 401), so it is not admitted as live.
 * - Sail's previous live read was an invalid payload and the current manifest
 *   exposes no usable live source.
 * - WaveSpeed has a populated media catalogue but no text row in this feed;
 *   empty here is scoped to the feed, not the provider catalogue.
 */
const NO_LIVE_ROWS_FINDINGS: Record<string, {
  reason: z.infer<typeof noLiveRowsReasonSchema>;
  note: string;
}> = {
  crazyrouter: {
    reason: "no_key",
    note: "No authenticated Crazyrouter catalogue key was configured for this capability feed; its public pricing reader is a separate catalogue surface.",
  },
  fal: {
    reason: "endpoint_changed",
    note: "fal is exposed by the media catalogue endpoint, not by this text live-model feed; no row is manufactured from the separate endpoint.",
  },
  nous: {
    reason: "key_unentitled",
    note: "The Nous catalogue credential authenticated, but the recorded inference probe returned HTTP 401; catalogue presence is not treated as live reachability.",
  },
  sail: {
    reason: "adapter_broken",
    note: "The previous Sail live-model read returned an invalid payload and the current manifest exposes no usable Sail live source; no row is manufactured.",
  },
  wavespeed: {
    reason: "genuinely_empty",
    note: "WaveSpeed's public media catalogue is populated, but this text capability feed has no WaveSpeed row; empty is scoped to this feed, not the provider catalogue.",
  },
};

const providerCoverageSchema = z
  .object({
    id: z.string().min(1),
    direct_adapter: z.boolean(),
    live_rows: z.number().int().nonnegative(),
    state: z.enum(["observed", "no_live_rows"]),
    no_live_rows_reason: noLiveRowsReasonSchema.nullable(),
    note: z.string(),
  })
  .strict();

const ledgerSummarySchema = z
  .object({
    schema_version: z.literal("1.0"),
    state: z.enum(["observed", "empty", "unavailable"]),
    checked_at: dateTimeSchema,
    source: z.string().nullable(),
    entry_count: z.number().int().nonnegative(),
    note: z.string(),
  })
  .strict();

const capabilitySuccessSchema = z
  .object({
    status: z.literal("ok"),
    schema_version: z.literal("1.1"),
    generated_at: dateTimeSchema,
    source_endpoint: z.literal(LIVE_MODELS_ENDPOINT),
    source_endpoints: z.array(z.string().min(1)),
    source_stale: z.boolean(),
    scope: z
      .object({
        definition: z.literal("one row per available live model slug"),
        completeness: z.enum(["full", "partial_or_unknown"]),
        missing_fields: z.array(z.string()),
      })
      .strict(),
    workload: workloadSchema,
    measurement: measurementManifestSchema,
    providers: z.array(providerCoverageSchema),
    rows: z.array(capabilityRowSchema),
    queries: z
      .object({
        public_council: queryExampleSchema,
        private_council: queryExampleSchema,
      })
      .strict(),
    functionality_ledger: ledgerSummarySchema,
    model_lineage_ledger: ledgerSummarySchema,
    capability_ledger: ledgerSummarySchema,
    pagination: paginationSchema,
    evidence: z.array(sourceEvidenceSchema),
    warnings: z.array(z.string()),
  })
  .strict();

const capabilityUnavailableSchema = z
  .object({
    status: z.literal("unavailable"),
    summary: z.string(),
    missing_capability: z.literal(LIVE_MODELS_ENDPOINT),
    evidence: z.array(sourceEvidenceSchema),
    warnings: z.array(z.string()),
  })
  .strict();

const capabilityErrorSchema = z
  .object({
    status: z.literal("error"),
    summary: z.string(),
    error: safeDashboardErrorSchema,
  })
  .strict();

export const capabilityStateOutputSchema = z.discriminatedUnion("status", [
  capabilitySuccessSchema,
  capabilityUnavailableSchema,
  capabilityErrorSchema,
]);

export const capabilityStateInputSchema = z
  .object({
    providers: z.array(z.string().min(1)).max(50).optional(),
    // Omitted means full cursor exhaustion. A bound is an explicit degraded
    // read and is reported as capped so it cannot masquerade as the catalogue.
    max_rows: z.number().int().min(1).max(CAPABILITY_STATE_MAX_ROWS).optional(),
    freshness_ttl_seconds: z.number().int().positive().max(31_536_000).default(CAPABILITY_STATE_DEFAULT_TTL_SECONDS),
    generation_cost_ttl_seconds: z.number().int().positive().max(31_536_000).default(GENERATION_COST_DEFAULT_TTL_SECONDS),
  })
  .strict();

export type CapabilityStateOutput = z.infer<typeof capabilityStateOutputSchema>;
export type FunctionalityLedgerEntry = z.infer<typeof functionalityLedgerEntrySchema>;
export type ModelLineageLedgerEntry = z.infer<typeof modelLineageLedgerEntrySchema>;
export type ModelCapabilityLedgerEntry = z.infer<typeof modelCapabilityLedgerEntrySchema>;
export type CapabilityStateDependencies = {
  client: DashboardClient;
  allowedProviders?: string[];
  now?: () => Date;
  /** Optional cached mechanical/functionality ledger supplied by the collector. */
  functionalityLedger?: FunctionalityLedgerEntry[];
  /** Optional cached base-weight lineage ledger. No vendor inference is performed. */
  modelLineageLedger?: ModelLineageLedgerEntry[];
  /** Optional cached capability ledger. Tool support is never inferred from vendor names. */
  modelCapabilityLedger?: ModelCapabilityLedgerEntry[];
};

type LiveModel = z.infer<typeof liveModelSchema>;
type GenerationCostObservation = z.infer<typeof generationCostObservationSchema>;

type ObservationOptions = {
  observedAt: string | null;
  source: string;
  sourceStale: boolean;
  now: string;
  ttlSeconds: number;
};

type LedgerStatus = "observed" | "empty" | "unavailable";

function expiresAt(observedAt: string, ttlSeconds: number): string {
  return new Date(Date.parse(observedAt) + ttlSeconds * 1_000).toISOString();
}

function ageSeconds(observedAt: string, now: string): number {
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(observedAt)) / 1_000));
}

function isExpiredAt(observedAt: string, options: ObservationOptions): boolean {
  const parsed = Date.parse(observedAt);
  return !Number.isFinite(parsed) ||
    options.sourceStale ||
    parsed + options.ttlSeconds * 1_000 <= Date.parse(options.now);
}

function unknownFact<T>(
  reason: string,
  options: ObservationOptions,
  observedAt: string | null = null,
): Observation<T> {
  return {
    state: "unknown",
    value: null,
    observed_at: observedAt,
    checked_at: options.now,
    expires_at: null,
    age_seconds: observedAt === null ? null : ageSeconds(observedAt, options.now),
    source: options.source,
    reason,
  };
}

function observedFact<T>(
  value: T,
  observedAt: string | null,
  options: ObservationOptions,
): Observation<T> {
  if (observedAt === null) return unknownFact<T>("No observation timestamp was published.", options);
  const expires = expiresAt(observedAt, options.ttlSeconds);
  const expired = isExpiredAt(observedAt, options);
  return {
    state: expired ? "expired" : "known",
    value: expired ? null : value,
    observed_at: observedAt,
    checked_at: options.now,
    expires_at: expires,
    age_seconds: ageSeconds(observedAt, options.now),
    source: options.source,
    reason: expired ? "The retained observation is outside its freshness window." : null,
  };
}

function policyFact(value: string, now: string, source: string): Observation<string> {
  return {
    state: "known",
    value,
    observed_at: now,
    checked_at: now,
    expires_at: null,
    age_seconds: 0,
    source,
    reason: "This is a selection policy bound, not a provider measurement.",
  };
}

function revalidateExternal<T>(
  fact: Observation<T>,
  options: ObservationOptions,
): Observation<T> {
  const source = fact.source ?? options.source;
  if (fact.state === "expired" && fact.observed_at !== null) {
    const refreshed = observedFact<T>(
      fact.value as T,
      fact.observed_at,
      { ...options, source },
    );
    return refreshed.state === "known"
      ? { ...refreshed, state: "expired", value: null, reason: "The cached ledger marked this observation expired." }
      : refreshed;
  }
  if (fact.state !== "known" || fact.value === null || fact.observed_at === null) {
    return {
      state: "unknown",
      value: null,
      observed_at: fact.observed_at,
      checked_at: options.now,
      expires_at: null,
      age_seconds: fact.observed_at === null ? null : ageSeconds(fact.observed_at, options.now),
      source,
      reason: fact.reason ?? "The cached ledger has no current value for this field.",
    };
  }
  return observedFact(fact.value, fact.observed_at, { ...options, source });
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function keyFor(provider: string, slug: string): string {
  return provider + ":" + slug;
}

function ledgerEntryFor<T extends { catalogue_provider: string; slug: string }>(
  entries: T[] | undefined,
  provider: string,
  slug: string,
): T | null {
  return entries?.find((entry) =>
    (entry.catalogue_provider === provider && entry.slug === slug) ||
    (entry.catalogue_provider === provider && entry.slug === provider + ":" + slug) ||
    (entry.catalogue_provider === "*" && entry.slug === slug),
  ) ?? null;
}

function latestByObservedAt<T extends { observedAt: string }>(values: T[]): T | null {
  return [...values].sort((left, right) =>
    Date.parse(right.observedAt) - Date.parse(left.observedAt),
  )[0] ?? null;
}

function latestPriceReadAt(row: LiveModel): string | null {
  return latestByObservedAt(row.pricePoints.map((point) => ({ observedAt: point.source.readAt })))?.observedAt ?? null;
}

function bucketForStatus(status: number | null): ErrorBucket | null {
  if (status === null) return "transport";
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "authentication";
  if (status === 404) return "not_found";
  if (status === 408 || status === 504) return "timeout";
  if (status >= 500) return "server_error";
  if (status >= 200 && status < 300) return null;
  return "transport";
}

function measuredCosts(values: GenerationCostObservation[]): GenerationCostObservation[] {
  return values.filter((value) =>
    value.costState === "MEASURED" && value.costUsd !== null,
  );
}

function publicMeasuredCostObservation(
  entry: PublicMeasuredCostEntry,
  catalogueProvider: string,
): GenerationCostObservation {
  const withheldWorkload = {
    name: "published measured-cost workload; token detail withheld",
    inputTokens: null,
    outputTokens: null,
    maxOutputTokens: null,
  } as const;
  return generationCostObservationSchema.parse({
    id: `public:${entry.routedProvider}:${entry.slug}:${entry.observedAt}`,
    provider: catalogueProvider,
    upstreamProvider: entry.routedProvider,
    model: entry.slug,
    observedAt: entry.observedAt,
    provenanceDate: entry.observedAt,
    workload: withheldWorkload,
    vantagePoint: "published ledger; vantage point withheld",
    tokenCounts: { input: "0", output: "0", total: "0" },
    costUsd: entry.measuredCostUsd,
    costState: "MEASURED",
    provenance: "MEASURED",
    httpStatus: null,
    errorBucket: null,
    balanceDeltaUsd: null,
    authoritativeField: "public.measuredCostUsd",
    sourceUrl: entry.sourceUrl,
    latency: {
      ttftMs: null,
      roundTripMs: null,
      sustainedThroughputTps: null,
      workload: withheldWorkload,
      vantagePoint: "published ledger; vantage point withheld",
      tokenBudget: { inputTokens: null, outputTokens: null },
      n: "0",
      percentileMethod: "unknown",
      observedAt: entry.observedAt,
    },
    note: `${entry.method}. The public publication intentionally withholds token counts, volumes, balances, request identifiers, and vantage-point details.`,
  });
}

function costOptions(
  observedAt: string | null,
  now: string,
  ttlSeconds: number,
  sourceStale: boolean,
): ObservationOptions {
  return {
    observedAt,
    source: GENERATION_COSTS_ENDPOINT,
    sourceStale,
    now,
    ttlSeconds,
  };
}

function generationCostFact(
  values: GenerationCostObservation[],
  now: string,
  ttlSeconds: number,
  sourceStale: boolean,
): Observation<GenerationCostObservation[]> {
  const measured = measuredCosts(values);
  if (measured.length === 0) {
    return unknownFact(
      "No authoritative per-generation charge was published for this slug; catalogue rates, derived rates, blocked probes, and zero-delta lag are not substituted.",
      costOptions(null, now, ttlSeconds, sourceStale),
    );
  }
  const latest = latestByObservedAt(measured);
  const options = costOptions(latest?.observedAt ?? null, now, ttlSeconds, sourceStale);
  const fresh = measured.filter((entry) => !isExpiredAt(entry.observedAt, options));
  return fresh.length === 0
    ? observedFact<GenerationCostObservation[]>(measured, latest?.observedAt ?? null, options)
    : observedFact(fresh, latest?.observedAt ?? null, options);
}

function routedProviderFact(
  values: GenerationCostObservation[],
  now: string,
  ttlSeconds: number,
  sourceStale: boolean,
): Observation<string> {
  const latest = latestByObservedAt(values);
  if (latest === null) {
    return unknownFact(
      "No routed-provider observation was published for this slug.",
      costOptions(null, now, ttlSeconds, sourceStale),
    );
  }
  return observedFact(
    latest.upstreamProvider,
    latest.observedAt,
    costOptions(latest.observedAt, now, ttlSeconds, sourceStale),
  );
}

function reachabilityFrom(
  values: GenerationCostObservation[],
  functionality: FunctionalityLedgerEntry | null,
  now: string,
  ttlSeconds: number,
  sourceStale: boolean,
): z.infer<typeof reachabilitySchema> {
  const costProbe = latestByObservedAt(
    values.filter((value) => value.httpStatus !== null || value.errorBucket !== null),
  );
  const probe = costProbe === null && functionality !== null &&
    (functionality.probe_http_status !== null || functionality.probe_error_bucket !== null) &&
    functionality.last_functionally_tested.observed_at !== null
    ? {
      observedAt: functionality.last_functionally_tested.observed_at,
      httpStatus: functionality.probe_http_status,
      errorBucket: functionality.probe_error_bucket,
      source: functionality.resolves.source ?? FUNCTIONALITY_LEDGER_ENDPOINT,
    }
    : costProbe === null
      ? null
      : {
        observedAt: costProbe.observedAt,
        httpStatus: costProbe.httpStatus,
        errorBucket: costProbe.errorBucket,
        source: costProbe.sourceUrl ?? GENERATION_COSTS_ENDPOINT,
      };
  if (probe === null) {
    return {
      state: "unknown",
      freshness_state: "unknown",
      http_status: null,
      error_bucket: null,
      observed_at: null,
      checked_at: now,
      expires_at: null,
      age_seconds: null,
      source: GENERATION_COSTS_ENDPOINT,
      reason: "Catalogue presence is not an inference probe; no per-slug HTTP result is published.",
    };
  }
  const options: ObservationOptions = {
    observedAt: probe.observedAt,
    source: probe.source,
    sourceStale,
    now,
    ttlSeconds,
  };
  const expired = isExpiredAt(probe.observedAt, options);
  const errorBucket = probe.errorBucket ?? bucketForStatus(probe.httpStatus);
  const state = probe.httpStatus === 429 || errorBucket === "rate_limit"
    ? "rate_limited" as const
    : probe.httpStatus !== null && probe.httpStatus >= 200 && probe.httpStatus < 300
      ? "live" as const
      : "unknown" as const;
  return {
    state: expired ? "unknown" : state,
    freshness_state: expired ? "expired" : "known",
    http_status: expired ? null : probe.httpStatus,
    error_bucket: expired ? null : errorBucket,
    observed_at: probe.observedAt,
    checked_at: now,
    expires_at: expiresAt(probe.observedAt, ttlSeconds),
    age_seconds: ageSeconds(probe.observedAt, now),
    source: probe.source,
    reason: expired
      ? "The retained reachability probe is outside its freshness window."
      : state === "rate_limited"
        ? "The latest inference probe was rate limited."
        : state === "unknown"
          ? "The latest inference probe did not establish a live response."
          : null,
  };
}

function defaultFunctionality(
  options: ObservationOptions,
): z.infer<typeof functionalitySchema> {
  const reason = "No cached functionality-ledger entry has been supplied for this slug.";
  return {
    resolves: unknownFact<boolean>(reason, options),
    structured_output_ok: unknownFact<boolean>(reason, options),
    p50_latency: unknownFact<string>(reason, options),
    p95_latency: unknownFact<string>(reason, options),
    latency_bound_ms: policyFact(FUNCTIONALITY_LATENCY_BOUND_MS, options.now, "selection-policy"),
    last_functionally_tested: unknownFact<string>(reason, options),
    semantic_quality: {
      ...unknownFact<"pass" | "fail">(
        "Semantic quality is a Jev/external-judge hook; openDashboard does not implement the judge.",
        options,
      ),
      judge_hook: "reserved_for_external_semantic_judge",
    },
  };
}

function functionalityFor(
  entry: FunctionalityLedgerEntry | null,
  options: ObservationOptions,
): z.infer<typeof functionalitySchema> {
  if (entry === null) return defaultFunctionality(options);
  return {
    resolves: revalidateExternal(entry.resolves, { ...options, source: entry.resolves.source ?? FUNCTIONALITY_LEDGER_ENDPOINT }),
    structured_output_ok: revalidateExternal(entry.structured_output_ok, { ...options, source: entry.structured_output_ok.source ?? FUNCTIONALITY_LEDGER_ENDPOINT }),
    p50_latency: revalidateExternal(entry.p50_latency, { ...options, source: entry.p50_latency.source ?? FUNCTIONALITY_LEDGER_ENDPOINT }),
    p95_latency: revalidateExternal(entry.p95_latency, { ...options, source: entry.p95_latency.source ?? FUNCTIONALITY_LEDGER_ENDPOINT }),
    latency_bound_ms: revalidateExternal(entry.latency_bound_ms, { ...options, source: entry.latency_bound_ms.source ?? FUNCTIONALITY_LEDGER_ENDPOINT }),
    last_functionally_tested: revalidateExternal(entry.last_functionally_tested, { ...options, source: entry.last_functionally_tested.source ?? FUNCTIONALITY_LEDGER_ENDPOINT }),
    semantic_quality: {
      ...revalidateExternal(entry.semantic_quality, { ...options, source: entry.semantic_quality.source ?? FUNCTIONALITY_LEDGER_ENDPOINT }),
      judge_hook: "reserved_for_external_semantic_judge",
    },
  };
}

function lineageFact(
  entry: ModelLineageLedgerEntry | null,
  field: "model_family" | "base_weights_lineage",
  options: ObservationOptions,
): Observation<string> {
  if (entry === null) {
    return unknownFact(
      "No model-family or base-weights lineage was published for this slug; vendor identity is not used as a lineage inference.",
      { ...options, source: MODEL_LINEAGE_ENDPOINT },
    );
  }
  return revalidateExternal(entry[field], { ...options, source: entry[field].source ?? MODEL_LINEAGE_ENDPOINT });
}

function capabilityFact<T>(
  entry: ModelCapabilityLedgerEntry | null,
  field: "supports_tool_calling" | "input_modalities",
  options: ObservationOptions,
): Observation<T> {
  if (entry === null) {
    const reason = field === "supports_tool_calling"
      ? "No tool-calling capability was published for this slug; vendor or model naming is not inferred."
      : "The capability ledger did not publish input modalities for this slug.";
    return unknownFact<T>(reason, { ...options, source: MODEL_CAPABILITY_ENDPOINT });
  }
  return revalidateExternal(entry[field] as Observation<T>, {
    ...options,
    source: entry[field].source ?? MODEL_CAPABILITY_ENDPOINT,
  });
}

function compareDecimal(left: string, right: string): number {
  const [leftWhole = "0", leftFraction = ""] = left.split(".", 2);
  const [rightWhole = "0", rightFraction = ""] = right.split(".", 2);
  const leftDigits = leftWhole.replace(/^0+(?=\d)/, "");
  const rightDigits = rightWhole.replace(/^0+(?=\d)/, "");
  if (leftDigits.length !== rightDigits.length) return leftDigits.length < rightDigits.length ? -1 : 1;
  if (leftDigits !== rightDigits) return leftDigits < rightDigits ? -1 : 1;
  const scale = Math.max(leftFraction.length, rightFraction.length);
  const leftPadded = leftFraction.padEnd(scale, "0");
  const rightPadded = rightFraction.padEnd(scale, "0");
  return leftPadded === rightPadded ? 0 : leftPadded < rightPadded ? -1 : 1;
}

function latestMeasuredCost(row: z.infer<typeof capabilityRowSchema>): string | null {
  const values = row.generation_cost.value;
  if (row.generation_cost.state !== "known" || values === null) return null;
  const matchingRoute = row.routed_provider.value === null
    ? values
    : values.filter((value) => value.upstreamProvider === row.routed_provider.value);
  return latestByObservedAt(matchingRoute.length > 0 ? matchingRoute : values)?.costUsd ?? null;
}

function selectionFor(
  row: z.infer<typeof capabilityRowSchema>,
  kind: "public" | "private",
) {
  const missing: string[] = [];
  const ineligible: string[] = [];
  const failedGates: string[] = [];
  if (row.billing_class.state === "known" && row.billing_class.value === "free") {
    if (kind === "public") {
      ineligible.push("billing_class=free");
      failedGates.push("billing_class=free");
    }
  } else if (row.billing_class.state !== "known") {
    missing.push("billing_class");
    failedGates.push("billing_class_unknown_or_expired");
  }
  if (row.generation_cost.state !== "known" || latestMeasuredCost(row) === null) {
    missing.push("generation_cost");
    failedGates.push("generation_cost_unknown_or_expired");
  }

  if (kind === "private") {
    for (const field of ["model_family", "base_weights_lineage"] as const) {
      const observation = row[field];
      if (observation.state !== "known") missing.push(field);
    }
    if (row.supports_tool_calling.state === "known" && row.supports_tool_calling.value === false) {
      ineligible.push("supports_tool_calling=false");
      failedGates.push("supports_tool_calling=false");
    } else if (row.supports_tool_calling.state !== "known") {
      missing.push("supports_tool_calling");
      failedGates.push("supports_tool_calling_unknown_or_expired");
    }
    if (row.reachability.state === "rate_limited") {
      ineligible.push("reachability=rate_limited");
      failedGates.push("reachability=rate_limited");
    } else if (row.reachability.state !== "live") {
      missing.push("reachability");
      failedGates.push("reachability_unknown_or_expired");
    }
    const mechanical: Array<["resolves" | "structured_output_ok", Observation<boolean>]> = [
      ["resolves", row.functionality.resolves],
      ["structured_output_ok", row.functionality.structured_output_ok],
    ];
    for (const [field, observation] of mechanical) {
      if (observation.state !== "known") {
        missing.push("functionality." + field);
        failedGates.push("functionality." + field + "_untested_or_expired");
      } else if (observation.value === false) {
        ineligible.push("functionality." + field + "=false");
        failedGates.push("functionality." + field + "=false");
      }
    }
    for (const field of ["p50_latency", "p95_latency", "last_functionally_tested"] as const) {
      const observation = row.functionality[field];
      if (observation.state !== "known") {
        missing.push("functionality." + field);
        failedGates.push("functionality_untested_or_expired");
      }
    }
    const p95 = row.functionality.p95_latency.value;
    const bound = row.functionality.latency_bound_ms.value;
    if (row.functionality.p95_latency.state === "known" && row.functionality.latency_bound_ms.state === "known" && p95 !== null && bound !== null && compareDecimal(p95, bound) > 0) {
      ineligible.push("functionality.p95_latency>" + bound);
      failedGates.push("functionality.p95_latency_exceeds_bound");
    }
    const semantic = row.functionality.semantic_quality;
    if (semantic.state !== "known") {
      missing.push("functionality.semantic_quality");
      failedGates.push("functionality.semantic_quality_untested_or_expired");
    } else if (semantic.value === "fail") {
      ineligible.push("functionality.semantic_quality=fail");
      failedGates.push("functionality.semantic_quality=fail");
    }
  }

  if (ineligible.length > 0) {
    return {
      state: "ineligible" as const,
      reason: ineligible.join(", "),
      missing_fields: unique(missing),
      failed_gates: unique(failedGates),
    };
  }
  if (missing.length > 0) {
    return {
      state: "unknown" as const,
      reason: "Required evidence is missing or expired.",
      missing_fields: unique(missing),
      failed_gates: unique(failedGates),
    };
  }
  return {
    state: "eligible" as const,
    reason: kind === "public"
      ? "Current paid classification and authoritative per-generation cost are present."
      : "Current cost, live reachability, tool support, mechanical functionality, latency bound, and external semantic judgment are present.",
    missing_fields: [],
    failed_gates: [],
  };
}

function eliminationBreakdown(
  rows: z.infer<typeof capabilityRowSchema>[],
  selectionKey: "public_council" | "private_council",
) {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const gate of row.selection[selectionKey].failed_gates) {
      counts[gate] = (counts[gate] ?? 0) + 1;
    }
  }
  return {
    counts,
    not_evaluated: ["family_collision"],
    note: "Counts are per-row gate observations and are not mutually exclusive. family_collision requires the already-seated council roster and is evaluated by the caller, not by this single-seat query.",
  };
}

function queryFor(
  rows: z.infer<typeof capabilityRowSchema>[],
  kind: "public" | "private",
) {
  const rule = kind === "public"
    ? "literal_cheapest_paid" as const
    : "cheapest_functional" as const;
  const selectionKey = kind === "public" ? "public_council" : "private_council";
  const candidates = rows.filter((row) => row.selection[selectionKey].state === "eligible");
  const breakdown = eliminationBreakdown(rows, selectionKey);
  if (candidates.length > 0) {
    const selected = [...candidates].sort((left, right) =>
      compareDecimal(
        latestMeasuredCost(left) ?? "999999999999",
        latestMeasuredCost(right) ?? "999999999999",
      ) || left.key.localeCompare(right.key),
    )[0]!;
    return {
      rule,
      decision_state: "decidable" as const,
      selected: {
        key: selected.key,
        slug: selected.slug,
        catalogue_provider: selected.catalogue_provider,
        routed_provider: selected.routed_provider.value,
      },
      missing_fields: [],
      considered_rows: rows.length,
      candidate_rows: candidates.length,
      elimination_breakdown: breakdown,
      basis: kind === "public"
        ? "Authoritative measured generation cost, ascending; paid is the only eligibility policy and catalogue price is never substituted."
        : "Authoritative measured generation cost among rows that pass lineage diversity, every mechanical functionality gate, and the external semantic-quality hook.",
    };
  }
  const required = kind === "public"
    ? ["billing_class", "generation_cost"]
    : [
      "generation_cost",
      "supports_tool_calling",
      "reachability",
      "model_family",
      "base_weights_lineage",
      "functionality.resolves",
      "functionality.structured_output_ok",
      "functionality.p50_latency",
      "functionality.p95_latency",
      "functionality.last_functionally_tested",
      "functionality.semantic_quality",
    ];
  return {
    rule,
    decision_state: "blocked" as const,
    selected: null,
    missing_fields: unique(rows.flatMap((row) => row.selection[selectionKey].missing_fields).concat(required)),
    considered_rows: rows.length,
    candidate_rows: 0,
    elimination_breakdown: breakdown,
    basis: kind === "public"
      ? "The literal cheapest paid model requires a current paid classification and an authoritative per-generation charge."
      : "The cheapest functional model requires explicit model-family/base-weight lineage, all mechanical gates, a current live probe, an actual tool-calling capability, and a separate semantic judgment.",
  };
}

export type CapabilityStateBuildInput = {
  rows: LiveModel[];
  sourceStale: boolean;
  costSourceStale?: boolean;
  /** Endpoint that supplied the measured cost rows; defaults to the legacy full ledger. */
  generationCostSourceEndpoint?: string;
  observedAt: string;
  now: string;
  freshnessTtlSeconds: number;
  generationCostTtlSeconds?: number;
  providers?: string[];
  costObservations?: GenerationCostObservation[];
  functionalityLedger?: FunctionalityLedgerEntry[];
  modelLineageLedger?: ModelLineageLedgerEntry[];
  modelCapabilityLedger?: ModelCapabilityLedgerEntry[];
  functionalityLedgerState?: LedgerStatus;
  modelLineageLedgerState?: LedgerStatus;
  modelCapabilityLedgerState?: LedgerStatus;
  pagination?: z.infer<typeof paginationSchema>;
  evidence?: z.infer<typeof sourceEvidenceSchema>[];
  warnings?: string[];
};

export function buildCapabilityState(input: CapabilityStateBuildInput): CapabilityStateOutput {
  const generationCostTtlSeconds = input.generationCostTtlSeconds ?? GENERATION_COST_DEFAULT_TTL_SECONDS;
  const allowed = input.providers === undefined ? null : new Set(input.providers);
  const liveRows = input.rows
    .filter((row) => row.availability === "available")
    .filter((row) => allowed === null || allowed.has(row.provider))
    .sort((left, right) => left.provider.localeCompare(right.provider) || left.id.localeCompare(right.id));
  const costSourceStale = input.costSourceStale ?? input.sourceStale;
  const rows = liveRows.map((row) => {
    const catalogueOptions: ObservationOptions = {
      observedAt: row.lastConfirmedAt,
      source: LIVE_MODELS_ENDPOINT,
      sourceStale: input.sourceStale,
      now: input.now,
      ttlSeconds: input.freshnessTtlSeconds,
    };
    const costRows = [
      ...(row.generationCosts ?? []),
      ...(input.costObservations ?? []).filter((observation) =>
        observation.provider === row.provider && observation.model === row.id,
      ),
    ];
    const priceObservedAt = latestPriceReadAt(row);
    const priceSource = row.pricePoints.find((point) => point.source.readAt === priceObservedAt)?.source.url ?? LIVE_MODELS_ENDPOINT;
    const priceOptions: ObservationOptions = {
      ...catalogueOptions,
      observedAt: priceObservedAt,
      source: priceSource,
    };
    const lineage = ledgerEntryFor(input.modelLineageLedger, row.provider, row.id);
    const functionality = ledgerEntryFor(input.functionalityLedger, row.provider, row.id);
    const capabilities = ledgerEntryFor(input.modelCapabilityLedger, row.provider, row.id);
    const result = {
      key: keyFor(row.provider, row.id),
      slug: row.id,
      catalogue_provider: row.provider,
      display_name: row.displayName,
      billing_class: row.isFree === null
        ? unknownFact<"paid" | "free">("The catalogue did not establish whether this slug is paid or free.", catalogueOptions)
        : observedFact<"paid" | "free">(row.isFree ? "free" : "paid", row.lastConfirmedAt, catalogueOptions),
      supports_tool_calling: capabilityFact<boolean>(capabilities, "supports_tool_calling", catalogueOptions),
      context_window: row.contextLength === null
        ? unknownFact<string>("The live-model source did not publish a context window.", catalogueOptions)
        : observedFact(row.contextLength, row.lastConfirmedAt, catalogueOptions),
      input_modalities: capabilityFact<string[]>(capabilities, "input_modalities", catalogueOptions),
      output_modalities: row.outputModalities === null
        ? unknownFact<string[]>("The live-model source did not publish output modalities.", catalogueOptions)
        : observedFact(row.outputModalities, row.lastConfirmedAt, catalogueOptions),
      model_family: lineageFact(lineage, "model_family", catalogueOptions),
      base_weights_lineage: lineageFact(lineage, "base_weights_lineage", catalogueOptions),
      catalogue_price: row.pricingState === "published" && row.pricePoints.length > 0
        ? observedFact(row.pricePoints, priceObservedAt, priceOptions)
        : unknownFact<z.infer<typeof pricePointSchema>[]>(
          "The catalogue did not publish a complete price for this row.",
          catalogueOptions,
        ),
      generation_cost: generationCostFact(costRows, input.now, generationCostTtlSeconds, costSourceStale),
      routed_provider: routedProviderFact(costRows, input.now, generationCostTtlSeconds, costSourceStale),
      reachability: reachabilityFrom(costRows, functionality, input.now, generationCostTtlSeconds, costSourceStale),
      functionality: functionalityFor(functionality, {
        ...catalogueOptions,
        source: FUNCTIONALITY_LEDGER_ENDPOINT,
      }),
    };
    const typed = result as z.infer<typeof capabilityRowSchema>;
    return {
      ...result,
      selection: {
        public_council: selectionFor(typed, "public"),
        private_council: selectionFor(typed, "private"),
      },
    };
  });
  const parsedRows = capabilityRowSchema.array().parse(rows);
  const pagination = input.pagination ?? {
    page_size: CAPABILITY_STATE_PAGE_SIZE,
    page_limit: CAPABILITY_STATE_PAGE_LIMIT,
    pages_scanned: 1,
    rows_scanned: input.rows.length,
    live_rows_returned: rows.length,
    capped: false,
    next_cursor: null,
  };
  const providerIds = unique([...PROVIDER_IDS, ...liveRows.map((row) => row.provider)]);
  const missingFields = unique([
    ...(pagination.capped ? ["rows"] : []),
    ...parsedRows.flatMap((row) => row.selection.public_council.missing_fields),
    ...parsedRows.flatMap((row) => row.selection.private_council.missing_fields),
  ]);
  const functionalityLedgerState = input.functionalityLedgerState ??
    (input.functionalityLedger === undefined ? "unavailable" : input.functionalityLedger.length > 0 ? "observed" : "empty");
  const modelLineageLedgerState = input.modelLineageLedgerState ??
    (input.modelLineageLedger === undefined ? "unavailable" : input.modelLineageLedger.length > 0 ? "observed" : "empty");
  const modelCapabilityLedgerState = input.modelCapabilityLedgerState ??
    (input.modelCapabilityLedger === undefined ? "unavailable" : input.modelCapabilityLedger.length > 0 ? "observed" : "empty");
  return capabilitySuccessSchema.parse({
    status: "ok",
    schema_version: "1.1",
    generated_at: input.now,
    source_endpoint: LIVE_MODELS_ENDPOINT,
    source_endpoints: unique([
      LIVE_MODELS_ENDPOINT,
      ...(input.costObservations === undefined ? [] : [input.generationCostSourceEndpoint ?? GENERATION_COSTS_ENDPOINT]),
      ...(input.functionalityLedger === undefined ? [] : [FUNCTIONALITY_LEDGER_ENDPOINT]),
      ...(input.modelLineageLedger === undefined ? [] : [MODEL_LINEAGE_ENDPOINT]),
      ...(input.modelCapabilityLedger === undefined ? [] : [MODEL_CAPABILITY_ENDPOINT]),
    ]),
    source_stale: input.sourceStale || costSourceStale,
    scope: {
      definition: "one row per available live model slug",
      completeness: pagination.capped ? "partial_or_unknown" : "full",
      missing_fields: missingFields,
    },
    workload: {
      id: "selection_without_inference",
      prompt: null,
      requested_output_tokens: null,
      input_tokens: null,
      output_tokens: null,
      sample_size: 0,
      note: "No inference workload was run by this read. Measured charges, reachability, latency, and functionality remain explicit UNKNOWN or EXPIRED values until their own evidence is supplied.",
    },
    measurement: WEEKLY_MEASUREMENT_MANIFEST,
    providers: providerIds.sort().map((id) => {
      const count = parsedRows.filter((row) => row.catalogue_provider === id).length;
      const noLiveRowsFinding = count === 0 ? NO_LIVE_ROWS_FINDINGS[id] : undefined;
      return {
        id,
        direct_adapter: (PROVIDER_IDS as readonly string[]).includes(id),
        live_rows: count,
        state: count > 0 ? "observed" as const : "no_live_rows" as const,
        no_live_rows_reason: noLiveRowsFinding?.reason ?? null,
        note: count > 0
          ? "At least one available live-model row was observed."
          : noLiveRowsFinding?.note ?? "No available live-model row is present in this dated snapshot; no provider-wide emptiness claim is established.",
      };
    }),
    rows: parsedRows,
    queries: {
      public_council: queryFor(parsedRows, "public"),
      private_council: queryFor(parsedRows, "private"),
    },
    functionality_ledger: {
      schema_version: "1.0",
      state: functionalityLedgerState,
      checked_at: input.now,
      source: functionalityLedgerState === "observed" ? FUNCTIONALITY_LEDGER_ENDPOINT : null,
      entry_count: input.functionalityLedger?.length ?? 0,
      note: functionalityLedgerState === "observed"
        ? "Mechanical resolution, structured-output, latency and external semantic-hook facts came from the cached per-slug ledger."
        : "No cached per-slug functionality ledger was available; UNKNOWN is intentional and never treated as a pass.",
    },
    model_lineage_ledger: {
      schema_version: "1.0",
      state: modelLineageLedgerState,
      checked_at: input.now,
      source: modelLineageLedgerState === "observed" ? MODEL_LINEAGE_ENDPOINT : null,
      entry_count: input.modelLineageLedger?.length ?? 0,
      note: modelLineageLedgerState === "observed"
        ? "Family and base-weight lineage came from an explicit lineage ledger."
        : "No explicit family/base-weight lineage was available; vendor identity is not used as a proxy.",
    },
    capability_ledger: {
      schema_version: "1.0",
      state: modelCapabilityLedgerState,
      checked_at: input.now,
      source: modelCapabilityLedgerState === "observed" ? MODEL_CAPABILITY_ENDPOINT : null,
      entry_count: input.modelCapabilityLedger?.length ?? 0,
      note: modelCapabilityLedgerState === "observed"
        ? "Tool-calling and input-modality facts came from an explicit capability ledger."
        : "No explicit tool-calling/input-modality ledger was available; UNKNOWN is not treated as support.",
    },
    pagination,
    evidence: input.evidence ?? [],
    warnings: input.warnings ?? [],
  });
}

async function scanLiveModels(
  client: DashboardClient,
  maxRows: number | null,
  allowedProviders?: string[],
): Promise<{
  rows: LiveModel[];
  evidence: z.infer<typeof sourceEvidenceSchema>[];
  stale: boolean;
  pagesScanned: number;
  rowsScanned: number;
  capped: boolean;
  nextCursor: string | null;
}> {
  const rows: LiveModel[] = [];
  const evidence: z.infer<typeof sourceEvidenceSchema>[] = [];
  let cursor: string | null = null;
  let pagesScanned = 0;
  let rowsScanned = 0;
  let stale = false;
  let capped = false;
  while (true) {
    if (maxRows !== null && rows.length >= maxRows) {
      capped = cursor !== null;
      break;
    }
    const query = new URLSearchParams({ limit: String(CAPABILITY_STATE_PAGE_SIZE) });
    if (cursor !== null) query.set("cursor", cursor);
    const page = await client.get(LIVE_MODELS_ENDPOINT, query, liveModelsResponseSchema);
    pagesScanned += 1;
    const selectedPageRows = page.data.filter((row) =>
      allowedProviders === undefined || allowedProviders.includes(row.provider),
    );
    rowsScanned += selectedPageRows.length;
    const availablePageRows = selectedPageRows.filter((row) => row.availability === "available");
    const rowsToTake = maxRows === null
      ? availablePageRows
      : availablePageRows.slice(0, maxRows - rows.length);
    rows.push(...rowsToTake);
    evidence.push(sourceEvidence(LIVE_MODELS_ENDPOINT, page));
    stale ||= page.stale;
    cursor = page.cursor;
    if (maxRows !== null && availablePageRows.length > rowsToTake.length) {
      capped = true;
      break;
    }
    if (cursor === null) break;
  }
  return { rows, evidence, stale, pagesScanned, rowsScanned, capped, nextCursor: capped ? cursor : null };
}

const functionalityLedgerResponseSchema = z
  .object({
    schema_version: z.literal("1.0"),
    generated_at: dateTimeSchema,
    source: z.string().nullable(),
    entries: z.array(functionalityLedgerEntrySchema),
  })
  .strict();

const modelLineageLedgerResponseSchema = z
  .object({
    schema_version: z.literal("1.0"),
    generated_at: dateTimeSchema,
    source: z.string().nullable(),
    entries: z.array(modelLineageLedgerEntrySchema),
  })
  .strict();

const modelCapabilityLedgerResponseSchema = z
  .object({
    schema_version: z.literal("1.0"),
    generated_at: dateTimeSchema,
    source: z.string().nullable(),
    entries: z.array(modelCapabilityLedgerEntrySchema),
  })
  .strict();

export async function runCapabilityState(
  rawInput: z.input<typeof capabilityStateInputSchema>,
  dependencies: CapabilityStateDependencies,
): Promise<CapabilityStateOutput> {
  const input = capabilityStateInputSchema.parse(rawInput);
  const allowed = dependencies.allowedProviders === undefined
    ? input.providers
    : input.providers?.filter((id) => dependencies.allowedProviders?.includes(id));
  try {
    const manifest = await dependencies.client.get(MANIFEST_ENDPOINT, new URLSearchParams(), manifestSchema);
    const manifestEvidence = sourceEvidence(MANIFEST_ENDPOINT, manifest);
    if (!manifest.routes.includes(LIVE_MODELS_ENDPOINT)) {
      return {
        status: "unavailable",
        summary: "The dashboard does not publish live model rows, so a complete capability state cannot be built.",
        missing_capability: LIVE_MODELS_ENDPOINT,
        evidence: [manifestEvidence],
        warnings: [],
      };
    }
    const scan = await scanLiveModels(dependencies.client, input.max_rows ?? null, allowed);
    const now = (dependencies.now ?? (() => new Date()))().toISOString();
    const warnings: string[] = [];
    let costObservations: GenerationCostObservation[] | undefined;
    let costSourceStale = false;
    let generationCostSourceEndpoint: string | undefined;
    const evidence = [manifestEvidence, ...scan.evidence];
    if (manifest.routes.includes(GENERATION_COSTS_ENDPOINT)) {
      try {
        const costs = await dependencies.client.get(
          GENERATION_COSTS_ENDPOINT,
          new URLSearchParams(),
          generationCostCollectionSchema,
        );
        costObservations = costs.data;
        costSourceStale = costs.stale;
        generationCostSourceEndpoint = GENERATION_COSTS_ENDPOINT;
        evidence.push(sourceEvidence(GENERATION_COSTS_ENDPOINT, costs));
      } catch (error) {
        const safe = safeDashboardError(error);
        warnings.push("Generation-cost evidence is unavailable; generation_cost, routed_provider, and reachability remain UNKNOWN: " + safe.message);
      }
    } else if (manifest.routes.includes(MEASURED_COSTS_ENDPOINT)) {
      try {
        const published = await dependencies.client.get(
          MEASURED_COSTS_ENDPOINT,
          new URLSearchParams(),
          publicMeasuredCostsResponseSchema,
        );
        // The public publication deliberately contains no catalogue-provider
        // field. Join each published slug to the scanned row, then retain the
        // routed provider as the observation's upstream provider. A slug with
        // no live row remains absent rather than becoming a phantom candidate.
        costObservations = published.data.flatMap((entry) =>
          scan.rows
            .filter((row) => row.id === entry.slug)
            .map((row) => publicMeasuredCostObservation(entry, row.provider)),
        );
        costSourceStale = published.stale;
        generationCostSourceEndpoint = MEASURED_COSTS_ENDPOINT;
        evidence.push(sourceEvidence(MEASURED_COSTS_ENDPOINT, published));
      } catch (error) {
        const safe = safeDashboardError(error);
        warnings.push("The public measured-cost ledger is unavailable; generation_cost, routed_provider, and reachability remain UNKNOWN: " + safe.message);
      }
    } else {
      warnings.push("The manifest does not publish " + GENERATION_COSTS_ENDPOINT + " or " + MEASURED_COSTS_ENDPOINT + "; generation_cost, routed_provider, and reachability remain UNKNOWN.");
    }

    let functionalityLedger = dependencies.functionalityLedger;
    let functionalityLedgerState: LedgerStatus = functionalityLedger === undefined ? "unavailable" : functionalityLedger.length > 0 ? "observed" : "empty";
    if (functionalityLedger === undefined && manifest.routes.includes(FUNCTIONALITY_LEDGER_ENDPOINT)) {
      try {
        const ledger = await dependencies.client.get(
          FUNCTIONALITY_LEDGER_ENDPOINT,
          new URLSearchParams(),
          functionalityLedgerResponseSchema,
        );
        functionalityLedger = ledger.entries;
        functionalityLedgerState = ledger.entries.length > 0 ? "observed" : "empty";
        evidence.push(sourceEvidence(FUNCTIONALITY_LEDGER_ENDPOINT, { publishedAt: ledger.generated_at, provenance: [] }));
      } catch (error) {
        const safe = safeDashboardError(error);
        warnings.push("The functionality ledger is unavailable; mechanical gates remain UNKNOWN: " + safe.message);
      }
    } else if (functionalityLedger === undefined) {
      warnings.push("The manifest does not publish " + FUNCTIONALITY_LEDGER_ENDPOINT + "; mechanical functionality remains UNKNOWN.");
    }

    let modelLineageLedger = dependencies.modelLineageLedger;
    let modelLineageLedgerState: LedgerStatus = modelLineageLedger === undefined ? "unavailable" : modelLineageLedger.length > 0 ? "observed" : "empty";
    if (modelLineageLedger === undefined && manifest.routes.includes(MODEL_LINEAGE_ENDPOINT)) {
      try {
        const ledger = await dependencies.client.get(
          MODEL_LINEAGE_ENDPOINT,
          new URLSearchParams(),
          modelLineageLedgerResponseSchema,
        );
        modelLineageLedger = ledger.entries;
        modelLineageLedgerState = ledger.entries.length > 0 ? "observed" : "empty";
        evidence.push(sourceEvidence(MODEL_LINEAGE_ENDPOINT, { publishedAt: ledger.generated_at, provenance: [] }));
      } catch (error) {
        const safe = safeDashboardError(error);
        warnings.push("The model-lineage ledger is unavailable; model_family and base_weights_lineage remain UNKNOWN: " + safe.message);
      }
    } else if (modelLineageLedger === undefined) {
      warnings.push("The manifest does not publish " + MODEL_LINEAGE_ENDPOINT + "; model_family and base_weights_lineage remain UNKNOWN.");
    }

    let modelCapabilityLedger = dependencies.modelCapabilityLedger;
    let modelCapabilityLedgerState: LedgerStatus = modelCapabilityLedger === undefined ? "unavailable" : modelCapabilityLedger.length > 0 ? "observed" : "empty";
    if (modelCapabilityLedger === undefined && manifest.routes.includes(MODEL_CAPABILITY_ENDPOINT)) {
      try {
        const ledger = await dependencies.client.get(
          MODEL_CAPABILITY_ENDPOINT,
          new URLSearchParams(),
          modelCapabilityLedgerResponseSchema,
        );
        modelCapabilityLedger = ledger.entries;
        modelCapabilityLedgerState = ledger.entries.length > 0 ? "observed" : "empty";
        evidence.push(sourceEvidence(MODEL_CAPABILITY_ENDPOINT, { publishedAt: ledger.generated_at, provenance: [] }));
      } catch (error) {
        const safe = safeDashboardError(error);
        warnings.push("The model-capability ledger is unavailable; supports_tool_calling and input_modalities remain UNKNOWN: " + safe.message);
      }
    } else if (modelCapabilityLedger === undefined) {
      warnings.push("The manifest does not publish " + MODEL_CAPABILITY_ENDPOINT + "; supports_tool_calling and input_modalities remain UNKNOWN.");
    }

    const built = buildCapabilityState({
      rows: scan.rows,
      sourceStale: scan.stale,
      costSourceStale,
      generationCostSourceEndpoint,
      observedAt: now,
      now,
      freshnessTtlSeconds: input.freshness_ttl_seconds,
      generationCostTtlSeconds: input.generation_cost_ttl_seconds,
      ...(allowed ? { providers: allowed } : {}),
      ...(costObservations === undefined ? {} : { costObservations }),
      ...(functionalityLedger === undefined ? {} : { functionalityLedger }),
      ...(modelLineageLedger === undefined ? {} : { modelLineageLedger }),
      ...(modelCapabilityLedger === undefined ? {} : { modelCapabilityLedger }),
      functionalityLedgerState,
      modelLineageLedgerState,
      modelCapabilityLedgerState,
      pagination: {
        page_size: CAPABILITY_STATE_PAGE_SIZE,
        page_limit: CAPABILITY_STATE_PAGE_LIMIT,
        pages_scanned: scan.pagesScanned,
        rows_scanned: scan.rowsScanned,
        live_rows_returned: scan.rows.length,
        capped: scan.capped,
        next_cursor: scan.nextCursor,
      },
      evidence,
      warnings: [
        ...warnings,
        ...(scan.capped ? ["The live-model scan reached its declared bound; omitted slugs remain UNKNOWN."] : []),
      ],
    });
    return capabilityStateOutputSchema.parse(built);
  } catch (error) {
    const safeError = safeDashboardError(error);
    return { status: "error", summary: safeError.message, error: safeError };
  }
}

export function registerCapabilityState(
  server: McpServer,
  dependencies: CapabilityStateDependencies,
): void {
  server.registerTool(
    "dashboard_capability_state",
    {
      title: "Capability state for deterministic model selection",
      description: "Return one snake_case, evidence-shaped row per available live model slug and two decisions over that same table: literally cheapest paid for the public council and cheapest functional for the private council. Every field carries its own checked_at, observed_at, expires_at and age_seconds. Catalogue price is never substituted for actual per-generation cost; lineage, tool support, reachability, functionality, and semantic quality remain explicit UNKNOWN or EXPIRED values until their own evidence exists.",
      inputSchema: capabilityStateInputSchema,
      outputSchema: capabilityStateOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runCapabilityState(input, dependencies)),
  );
}

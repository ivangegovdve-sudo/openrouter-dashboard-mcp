import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import { liveModelSchema, liveModelsResponseSchema } from "../dashboard/schemas/live-models.js";
import { manifestSchema } from "../dashboard/schemas/openrouter.js";
import { pricePointSchema } from "../contract.js";
import { generationCostObservationSchema } from "../generation-cost.js";
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
export const CAPABILITY_STATE_PAGE_SIZE = 500;
export const CAPABILITY_STATE_PAGE_LIMIT = 8;
export const CAPABILITY_STATE_DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
export const CAPABILITY_STATE_MAX_ROWS = 2_000;

const observationStateSchema = z.enum(["known", "unknown", "expired"]);
const decimalStringSchema = z.string().regex(/^(0|[1-9]\d*)(?:\.\d+)?$/);
const timestampObservationSchema = z
  .object({
    state: observationStateSchema,
    value: z.string().datetime({ offset: true }).nullable(),
    observedAt: z.string().datetime({ offset: true }).nullable(),
    source: z.string().nullable(),
    reason: z.string().nullable(),
  })
  .strict();

function observationSchema<T extends z.ZodTypeAny>(value: T) {
  return z
    .object({
      state: observationStateSchema,
      value: value.nullable(),
      observedAt: z.string().datetime({ offset: true }).nullable(),
      source: z.string().nullable(),
      reason: z.string().nullable(),
    })
    .strict();
}

const boolObservationSchema = observationSchema(z.boolean());
const stringObservationSchema = observationSchema(z.string());
const modalitiesObservationSchema = observationSchema(z.array(z.string()));
const priceObservationSchema = observationSchema(z.array(pricePointSchema));

const costValueSchema = z.array(generationCostObservationSchema);
const costObservationSchema = observationSchema(costValueSchema);

const reachabilitySchema = z
  .object({
    state: z.enum(["live", "rate_limited", "unknown"]),
    httpStatus: z.number().int().min(100).max(599).nullable(),
    errorBucket: z
      .enum(["rate_limit", "authentication", "not_found", "server_error", "timeout", "transport"])
      .nullable(),
    observedAt: z.string().datetime({ offset: true }).nullable(),
    source: z.string().nullable(),
    reason: z.string().nullable(),
  })
  .strict();

const semanticQualitySchema = observationSchema(z.enum(["pass", "fail"])).extend({
  judgeHook: z.literal("reserved_for_external_semantic_judge"),
});

const functionalitySchema = z
  .object({
    resolves: boolObservationSchema,
    structuredOutputOk: boolObservationSchema,
    p50Latency: observationSchema(decimalStringSchema),
    p95Latency: observationSchema(decimalStringSchema),
    latencyBoundMs: observationSchema(decimalStringSchema),
    lastFunctionallyTested: timestampObservationSchema,
    semanticQuality: semanticQualitySchema,
  })
  .strict();

const selectionSchema = z
  .object({
    state: z.enum(["eligible", "ineligible", "unknown"]),
    reason: z.string(),
    missingFields: z.array(z.string()),
  })
  .strict();

const capabilityRowSchema = z
  .object({
    key: z.string().min(3),
    provider: z.string().min(1),
    id: z.string().min(1),
    displayName: z.string().nullable(),
    catalogueAvailability: observationSchema(z.enum(["available", "disappeared"])),
    toolCalling: boolObservationSchema,
    contextWindow: observationSchema(z.string().regex(/^(0|[1-9]\d*)$/)),
    modalities: modalitiesObservationSchema,
    modelFamily: stringObservationSchema,
    cataloguePrice: priceObservationSchema,
    costPerGeneration: costObservationSchema,
    routedProvider: stringObservationSchema,
    reachability: reachabilitySchema,
    functionality: functionalitySchema,
    selection: z
      .object({
        publicCouncil: selectionSchema,
        innerObserver: selectionSchema,
      })
      .strict(),
  })
  .strict();

const selectedModelSchema = z
  .object({
    key: z.string().min(3),
    provider: z.string().min(1),
    id: z.string().min(1),
  })
  .strict();

const queryExampleSchema = z
  .object({
    rule: z.enum(["literal_cheapest_paid", "cheapest_functional"]),
    decisionState: z.enum(["decidable", "blocked"]),
    selected: selectedModelSchema.nullable(),
    missingFields: z.array(z.string()),
    consideredRows: z.number().int().nonnegative(),
    basis: z.string(),
  })
  .strict();

const workloadSchema = z
  .object({
    id: z.literal("selection_without_inference"),
    prompt: z.null(),
    requestedOutputTokens: z.null(),
    inputTokens: z.null(),
    outputTokens: z.null(),
    sampleSize: z.literal(0),
    note: z.string(),
  })
  .strict();

const paginationSchema = z
  .object({
    pageSize: z.number().int().positive(),
    pageLimit: z.number().int().positive(),
    pagesScanned: z.number().int().nonnegative(),
    rowsScanned: z.number().int().nonnegative(),
    liveRowsReturned: z.number().int().nonnegative(),
    capped: z.boolean(),
    nextCursor: z.string().nullable(),
  })
  .strict();
const providerCoverageSchema = z
  .object({
    id: z.string().min(1),
    directAdapter: z.boolean(),
    liveRows: z.number().int().nonnegative(),
    state: z.enum(["observed", "no_live_rows"]),
    note: z.string(),
  })
  .strict();

const capabilitySuccessSchema = z
  .object({
    status: z.literal("ok"),
    schemaVersion: z.literal("1.0"),
    generatedAt: z.string().datetime({ offset: true }),
    sourceEndpoint: z.literal(LIVE_MODELS_ENDPOINT),
    sourceStale: z.boolean(),
    scope: z
      .object({
        definition: z.literal("one row per available live model slug"),
        completeness: z.enum(["full", "partial_or_unknown"]),
        missingFields: z.array(z.string()),
      })
      .strict(),
    workload: workloadSchema,
    providers: z.array(providerCoverageSchema),
    rows: z.array(capabilityRowSchema),
    queries: z
      .object({
        publicCouncil: queryExampleSchema,
        innerObserver: queryExampleSchema,
      })
      .strict(),
    pagination: paginationSchema,
    evidence: z.array(sourceEvidenceSchema),
    warnings: z.array(z.string()),
  })
  .strict();

const capabilityUnavailableSchema = z
  .object({
    status: z.literal("unavailable"),
    summary: z.string(),
    missingCapability: z.literal(LIVE_MODELS_ENDPOINT),
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
    maxRows: z.number().int().min(1).max(CAPABILITY_STATE_MAX_ROWS).default(CAPABILITY_STATE_MAX_ROWS),
    freshnessTtlSeconds: z.number().int().positive().max(31_536_000).default(CAPABILITY_STATE_DEFAULT_TTL_SECONDS),
  })
  .strict();

export type CapabilityStateOutput = z.infer<typeof capabilityStateOutputSchema>;
export type CapabilityStateDependencies = {
  client: DashboardClient;
  allowedProviders?: string[];
  now?: () => Date;
};
type LiveModel = z.infer<typeof liveModelSchema>;

type ObservationOptions = {
  observedAt: string | null;
  source: string;
  sourceStale: boolean;
  now: string;
  ttlSeconds: number;
};

function expiresAt(observedAt: string, ttlSeconds: number): number {
  return Date.parse(observedAt) + ttlSeconds * 1_000;
}

function isExpired(observedAt: string, options: ObservationOptions): boolean {
  const parsed = Date.parse(observedAt);
  return !Number.isFinite(parsed) || options.sourceStale || expiresAt(observedAt, options.ttlSeconds) < Date.parse(options.now);
}

function known<T>(value: T, options: ObservationOptions): { state: "known" | "expired"; value: T; observedAt: string; source: string; reason: string | null } {
  const expired = options.observedAt === null || isExpired(options.observedAt, options);
  const observedAt = options.observedAt ?? options.now;
  return {
    state: expired ? "expired" : "known",
    value,
    observedAt,
    source: options.source,
    reason: expired ? "The retained observation is outside its freshness window." : null,
  };
}

function unknown<T>(reason: string, options: ObservationOptions) {
  return {
    state: "unknown" as const,
    value: null as T | null,
    observedAt: options.observedAt,
    source: options.source,
    reason,
  };
}

function optionFor(row: LiveModel, sourceStale: boolean, now: string, ttlSeconds: number): ObservationOptions {
  return {
    observedAt: row.lastConfirmedAt,
    source: LIVE_MODELS_ENDPOINT,
    sourceStale,
    now,
    ttlSeconds,
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function selectionFor(row: z.infer<typeof capabilityRowSchema>, kind: "public" | "private") {
  const missing: string[] = [];
  const ineligible: string[] = [];
  if (row.catalogueAvailability.state !== "known" || row.catalogueAvailability.value !== "available") missing.push("catalogueAvailability");
  const measuredCost = row.costPerGeneration.state === "known" && row.costPerGeneration.value?.some((observation) => observation.costState === "MEASURED" && observation.costUsd !== null) === true;
  if (!measuredCost) missing.push("costPerGeneration");
  if (row.reachability.state !== "live") missing.push("reachability");
  const measuredValues = row.costPerGeneration.value?.filter((observation) => observation.costState === "MEASURED" && observation.costUsd !== null).map((observation) => observation.costUsd!) ?? [];
  if (kind === "public" && measuredValues.length > 0 && measuredValues.every((value) => value === "0")) ineligible.push("free_model");
  if (kind === "private") {
    if (row.toolCalling.state === "known" && row.toolCalling.value === false) ineligible.push("toolCalling=false");
    else if (row.toolCalling.state !== "known") missing.push("toolCalling");
    for (const field of ["resolves", "structuredOutputOk", "p50Latency", "p95Latency", "lastFunctionallyTested", "semanticQuality"] as const) {
      const observation = row.functionality[field];
      if (observation.state !== "known") missing.push(`functionality.${field}`);
      else if ("value" in observation && observation.value === false) ineligible.push(`functionality.${field}=false`);
    }
  }
  if (row.cataloguePrice.state === "known" && row.cataloguePrice.value?.every((point) => point.amount === "0")) ineligible.push("free_model");
  if (ineligible.length > 0) return { state: "ineligible" as const, reason: ineligible.join(", "), missingFields: unique(missing) };
  if (missing.length > 0) return { state: "unknown" as const, reason: "Required evidence is missing or expired.", missingFields: unique(missing) };
  return { state: "eligible" as const, reason: "All required evidence is current.", missingFields: [] };
}

function queryFor(rows: z.infer<typeof capabilityRowSchema>[], kind: "public" | "private") {
  const rule = kind === "public" ? "literal_cheapest_paid" as const : "cheapest_functional" as const;
  const candidates = rows.filter((row) => row.selection[kind === "public" ? "publicCouncil" : "innerObserver"].state === "eligible");
  if (candidates.length > 0) {
    const selected = [...candidates].sort((a, b) => compareMeasuredCost(a, b) || a.key.localeCompare(b.key))[0]!;
    return {
      rule,
      decisionState: "decidable" as const,
      selected: { key: selected.key, provider: selected.provider, id: selected.id },
      missingFields: [],
      consideredRows: candidates.length,
      basis: kind === "public" ? "measured generation cost, ascending; quality is not a criterion" : "measured generation cost among functionally tested models",
    };
  }
  const required = kind === "public"
    ? ["costPerGeneration", "reachability"]
    : ["costPerGeneration", "reachability", "toolCalling", "functionality.resolves", "functionality.structuredOutputOk", "functionality.p50Latency", "functionality.p95Latency", "functionality.lastFunctionallyTested", "functionality.semanticQuality"];
  return {
    rule,
    decisionState: "blocked" as const,
    selected: null,
    missingFields: unique(rows.flatMap((row) => row.selection[kind === "public" ? "publicCouncil" : "innerObserver"].missingFields).concat(required)),
    consideredRows: rows.length,
    basis: kind === "public" ? "The literal cheapest paid model requires actual per-generation charges; catalogue prices are not substituted." : "A functional model requires every functionality gate and actual per-generation charges.",
  };
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

function compareMeasuredCost(left: z.infer<typeof capabilityRowSchema>, right: z.infer<typeof capabilityRowSchema>): number {
  const cost = (row: z.infer<typeof capabilityRowSchema>) => row.costPerGeneration.value?.find((observation) => observation.costState === "MEASURED" && observation.costUsd !== null)?.costUsd ?? null;
  const leftCost = cost(left);
  const rightCost = cost(right);
  if (leftCost === null && rightCost === null) return 0;
  if (leftCost === null) return 1;
  if (rightCost === null) return -1;
  return compareDecimal(leftCost, rightCost);
}

export type CapabilityStateBuildInput = {
  rows: LiveModel[];
  sourceStale: boolean;
  observedAt: string;
  now: string;
  freshnessTtlSeconds: number;
  providers?: string[];
  pagination?: z.infer<typeof paginationSchema>;
  evidence?: z.infer<typeof sourceEvidenceSchema>[];
  warnings?: string[];
};

export function buildCapabilityState(input: CapabilityStateBuildInput): CapabilityStateOutput {
  const allowed = input.providers === undefined ? null : new Set(input.providers);
  const liveRows = input.rows
    .filter((row) => row.availability === "available")
    .filter((row) => allowed === null || allowed.has(row.provider))
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id));
  const rows = liveRows.map((row) => {
    const options = optionFor(row, input.sourceStale, input.now, input.freshnessTtlSeconds);
    const successfulProbe = row.generationCosts?.find((observation) => observation.costState === "MEASURED" && observation.httpStatus === 200) ?? null;
    const limitedProbe = row.generationCosts?.find((observation) => observation.httpStatus === 429 || observation.errorBucket === "rate_limit") ?? null;
    const contextWindow = row.contextLength === null ? unknown<string>("The live-model source did not publish a context window.", options) : known(row.contextLength, options);
    const modalities = row.outputModalities === null ? unknown<string[]>("The live-model source did not publish output modalities.", options) : known(row.outputModalities, options);
    const cataloguePrice = row.pricingState === "published" && row.pricePoints.length > 0 ? known(row.pricePoints, options) : unknown<z.infer<typeof pricePointSchema>[]>("The catalogue did not publish a complete price for this row.", options);
    const result = {
      key: `${row.provider}:${row.id}`,
      provider: row.provider,
      id: row.id,
      displayName: row.displayName,
      catalogueAvailability: known(row.availability, options),
      toolCalling: unknown<boolean>("No tool-calling capability was published for this slug.", options),
      contextWindow,
      modalities,
      modelFamily: unknown<string>("No model-family or base-weights lineage was published for this slug.", options),
      cataloguePrice,
      costPerGeneration: row.generationCosts?.length > 0
        ? known(row.generationCosts, options)
        : unknown<z.infer<typeof costValueSchema>>("No usage record with an actual per-generation charge was published for this slug.", options),
      routedProvider: unknown<string>("No routed provider observation was published for this slug.", options),
      reachability: successfulProbe === null && limitedProbe === null
        ? {
          state: "unknown" as const,
          httpStatus: null,
          errorBucket: null,
          observedAt: null,
          source: null,
          reason: "Catalogue presence is not an inference probe; no per-slug HTTP result is published.",
        }
        : (() => {
          const probe = successfulProbe ?? limitedProbe!;
          const probeOptions = { ...options, observedAt: probe.observedAt, source: probe.sourceUrl ?? "/api/public/v2/generation-costs" };
          const expired = isExpired(probe.observedAt, probeOptions);
          if (expired) return { state: "unknown" as const, httpStatus: probe.httpStatus, errorBucket: probe.errorBucket, observedAt: probe.observedAt, source: probeOptions.source, reason: "The retained reachability probe is outside its freshness window." };
          if (successfulProbe !== null) return { state: "live" as const, httpStatus: probe.httpStatus, errorBucket: null, observedAt: probe.observedAt, source: probeOptions.source, reason: null };
          return { state: "rate_limited" as const, httpStatus: probe.httpStatus, errorBucket: probe.errorBucket ?? "rate_limit", observedAt: probe.observedAt, source: probeOptions.source, reason: "The last inference probe was rate limited." };
        })(),
      functionality: {
        resolves: unknown<boolean>("No functional resolution probe has been run for this slug.", options),
        structuredOutputOk: unknown<boolean>("No structured-output probe has been run for this slug.", options),
        p50Latency: unknown<string>("No workload latency sample has been published for this slug.", options),
        p95Latency: unknown<string>("No workload latency sample has been published for this slug.", options),
        latencyBoundMs: unknown<string>("No latency bound has been established for this slug.", options),
        lastFunctionallyTested: unknown<string>("No functional test date has been published for this slug.", options),
        semanticQuality: { ...unknown<"pass" | "fail">("An external semantic judge has not run for this slug.", options), judgeHook: "reserved_for_external_semantic_judge" as const },
      },
    };
    return {
      ...result,
      selection: {
        publicCouncil: selectionFor(result as z.infer<typeof capabilityRowSchema>, "public"),
        innerObserver: selectionFor(result as z.infer<typeof capabilityRowSchema>, "private"),
      },
    };
  });
  const pagination = input.pagination ?? {
    pageSize: CAPABILITY_STATE_PAGE_SIZE,
    pageLimit: CAPABILITY_STATE_PAGE_LIMIT,
    pagesScanned: 1,
    rowsScanned: input.rows.length,
    liveRowsReturned: rows.length,
    capped: false,
    nextCursor: null,
  };
  const providerIds = unique([...PROVIDER_IDS, ...liveRows.map((row) => row.provider)]);
  const missingFields = unique([
    ...(pagination.capped ? ["rows"] : []),
    ...rows.flatMap((row) => row.selection.publicCouncil.missingFields),
    ...rows.flatMap((row) => row.selection.innerObserver.missingFields),
  ]);
  return capabilitySuccessSchema.parse({
    status: "ok",
    schemaVersion: "1.0",
    generatedAt: input.now,
    sourceEndpoint: LIVE_MODELS_ENDPOINT,
    sourceStale: input.sourceStale,
    scope: {
      definition: "one row per available live model slug",
      completeness: pagination.capped ? "partial_or_unknown" : "full",
      missingFields,
    },
    workload: {
      id: "selection_without_inference",
      prompt: null,
      requestedOutputTokens: null,
      inputTokens: null,
      outputTokens: null,
      sampleSize: 0,
      note: "No inference workload was run by this read; measured charges, reachability, latency, and functionality stay explicit UNKNOWN values.",
    },
    providers: providerIds.sort().map((id) => {
      const count = rows.filter((row) => row.provider === id).length;
      return {
        id,
        directAdapter: (PROVIDER_IDS as readonly string[]).includes(id),
        liveRows: count,
        state: count > 0 ? "observed" as const : "no_live_rows" as const,
        note: count > 0 ? "At least one available live-model row was observed." : "No available live-model row is present in this snapshot; this does not establish an empty provider catalogue.",
      };
    }),
    rows,
    queries: {
      publicCouncil: queryFor(rows, "public"),
      innerObserver: queryFor(rows, "private"),
    },
    pagination,
    evidence: input.evidence ?? [],
    warnings: input.warnings ?? [],
  });
}

async function scanLiveModels(
  client: DashboardClient,
  maxRows: number,
  allowedProviders?: string[],
): Promise<{ rows: LiveModel[]; evidence: z.infer<typeof sourceEvidenceSchema>[]; stale: boolean; pagesScanned: number; nextCursor: string | null }> {
  const rows: LiveModel[] = [];
  const evidence: z.infer<typeof sourceEvidenceSchema>[] = [];
  let cursor: string | null = null;
  let pagesScanned = 0;
  let stale = false;
  while (pagesScanned < CAPABILITY_STATE_PAGE_LIMIT && rows.length < maxRows) {
    const query = new URLSearchParams({ limit: String(CAPABILITY_STATE_PAGE_SIZE) });
    if (cursor !== null) query.set("cursor", cursor);
    const page = await client.get(LIVE_MODELS_ENDPOINT, query, liveModelsResponseSchema);
    pagesScanned += 1;
    rows.push(...page.data.filter((row) => allowedProviders === undefined || allowedProviders.includes(row.provider)).slice(0, maxRows - rows.length));
    evidence.push(sourceEvidence(LIVE_MODELS_ENDPOINT, page));
    stale ||= page.stale;
    cursor = page.cursor;
    if (cursor === null) break;
  }
  return { rows, evidence, stale, pagesScanned, nextCursor: cursor };
}

export async function runCapabilityState(
  input: z.input<typeof capabilityStateInputSchema>,
  dependencies: CapabilityStateDependencies,
): Promise<CapabilityStateOutput> {
  const parsed = capabilityStateInputSchema.parse(input);
  const allowed = dependencies.allowedProviders === undefined ? parsed.providers : parsed.providers?.filter((id) => dependencies.allowedProviders?.includes(id));
  try {
    const manifest = await dependencies.client.get(MANIFEST_ENDPOINT, new URLSearchParams(), manifestSchema);
    const manifestEvidence = sourceEvidence(MANIFEST_ENDPOINT, manifest);
    if (!manifest.routes.includes(LIVE_MODELS_ENDPOINT)) {
      return {
        status: "unavailable",
        summary: "The dashboard does not publish live model rows, so a complete capability state cannot be built.",
        missingCapability: LIVE_MODELS_ENDPOINT,
        evidence: [manifestEvidence],
        warnings: [],
      };
    }
    const scan = await scanLiveModels(dependencies.client, parsed.maxRows, allowed);
    const now = (dependencies.now ?? (() => new Date()))().toISOString();
    const built = buildCapabilityState({
      rows: scan.rows,
      sourceStale: scan.stale || manifest.stale === true,
      observedAt: now,
      now,
      freshnessTtlSeconds: parsed.freshnessTtlSeconds,
      ...(allowed ? { providers: allowed } : {}),
      pagination: {
        pageSize: CAPABILITY_STATE_PAGE_SIZE,
        pageLimit: CAPABILITY_STATE_PAGE_LIMIT,
        pagesScanned: scan.pagesScanned,
        rowsScanned: scan.rows.length,
        liveRowsReturned: scan.rows.filter((row) => row.availability === "available").length,
        capped: scan.nextCursor !== null || scan.rows.length >= parsed.maxRows,
        nextCursor: scan.nextCursor,
      },
      evidence: [manifestEvidence, ...scan.evidence],
      warnings: scan.nextCursor === null ? [] : ["The live-model scan reached its declared bound; omitted slugs remain UNKNOWN."] ,
    });
    return capabilityStateOutputSchema.parse(built);
  } catch (error) {
    const safeError = safeDashboardError(error);
    return { status: "error", summary: safeError.message, error: safeError };
  }
}

export function registerCapabilityState(server: McpServer, dependencies: CapabilityStateDependencies): void {
  server.registerTool(
    "dashboard_capability_state",
    {
      title: "Capability state for deterministic model selection",
      description: "Return one evidence-shaped row per available live model slug and two decisions over that same table: literal cheapest paid and cheapest functionally tested. Actual per-generation charges, reachability, tool support, lineage, latency, structured-output, and semantic-quality observations are never substituted with catalogue prices or inferred values; missing and expired fields remain explicit.",
      inputSchema: capabilityStateInputSchema,
      outputSchema: capabilityStateOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runCapabilityState(input, dependencies)),
  );
}


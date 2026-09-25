import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import {
  exactIntegerStringSchema,
  publicProvenanceSchema,
} from "../dashboard/schemas/common.js";
import {
  hasConsistentLiveModelFreeness,
  liveModelSchema,
  liveModelsResponseSchema,
  providerIdSchema,
} from "../dashboard/schemas/live-models.js";
import { manifestSchema } from "../dashboard/schemas/openrouter.js";
import { type GenerationCostObservation } from "../generation-cost.js";
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

export const RESOLVE_MODEL_CAPABILITY_MESSAGE =
  "This tool needs /api/public/v2/live-models, which the dashboard is not currently publishing. Ask about deprecations or history instead, and check dashboard_source_health for which collector is failing.";

export const RESOLVE_MODEL_PAGE_LIMIT = 2;
export const RESOLVE_MODEL_PAGE_SIZE = 500;
export const RESOLVE_MODEL_ITEM_LIMIT = 1_000;
export const RESOLVE_MODEL_RANKED_PAGE_LIMIT = 1;
export const RESOLVE_MODEL_RANKED_ITEM_LIMIT = 500;
export const RESOLVE_MODEL_DEFAULT_FALLBACK_DEPTH = 3;
export const RESOLVE_MODEL_MAX_FALLBACK_DEPTH = 10;

const intentSchema = z.enum([
  "cheapest_capable",
  "largest_context",
  "fastest_available",
  "any_available",
]);

const minContextSchema = z.union([
  exactIntegerStringSchema,
  z.number().int().nonnegative().safe(),
]);

export const resolveModelConstraintsSchema = z
  .object({
    free: z.boolean().optional(),
    minContext: minContextSchema.optional(),
    outputModality: z.string().min(1).max(80).optional(),
    reasoning: z.boolean().optional(),
    providers: z.array(z.string().min(1)).max(3).optional(),
    requireProviderActive: z.literal(true).optional(),
  })
  .strict();

export const resolveModelInputSchema = z
  .object({
    intent: intentSchema,
    constraints: resolveModelConstraintsSchema.default({}),
    fallbackDepth: z
      .number()
      .int()
      .min(1)
      .max(RESOLVE_MODEL_MAX_FALLBACK_DEPTH)
      .default(RESOLVE_MODEL_DEFAULT_FALLBACK_DEPTH),
    verbose: z.boolean().default(false),
  })
  .strict();

const exclusionReasonSchema = z.enum([
  "disappeared",
  "inconsistent_free_metadata",
  "provider_not_allowed",
  "pricing_not_published",
  "pricing_constraint_not_satisfied",
  "context_not_published",
  "context_below_minimum",
  "output_modalities_not_published",
  "output_modality_not_supported",
  "reasoning_not_published",
  "reasoning_constraint_not_satisfied",
  "provider_active_not_published",
  "provider_not_active",
  "absent_from_audit_snapshot",
  "absent_from_ranked_snapshot",
]);

const excludedModelSchema = z
  .object({
    provider: z.string().min(1),
    id: z.string().min(1),
    reason: exclusionReasonSchema,
  })
  .strict();

const resolvedModelSchema = z
  .object({
    provider: z.string().min(1),
    id: z.string().min(1),
    rank: z.number().int().positive(),
    basis: z.enum([
      "measured_generation_cost",
      "usd_per_1m_blended",
      "context_length",
      "throughput_tps",
      "provider_order_then_id",
    ]),
    value: z.string().nullable(),
    measurement: z.enum(["measured", "unmeasured", "not_applicable"]),
    contextLength: exactIntegerStringSchema.nullable(),
    isFree: z.boolean().nullable(),
    availability: z.literal("available"),
    lastConfirmedAt: z.string().datetime({ offset: true }),
    priceState: z.enum(["priced", "offered_unpriced", "not_offered", "unknown"]),
    measuredPrice: z.string().nullable(),
    priceMeasuredAt: z.string().datetime({ offset: true }).nullable(),
    priceEvidence: z.string().url().nullable(),
    details: liveModelSchema.optional(),
  })
  .strict();

const snapshotCapSchema = z
  .object({
    pageLimit: z.number().int().min(1).max(RESOLVE_MODEL_PAGE_LIMIT),
    itemLimit: z.number().int().min(1).max(RESOLVE_MODEL_ITEM_LIMIT),
    pagesScanned: z.number().int().min(0).max(RESOLVE_MODEL_PAGE_LIMIT),
    itemsScanned: z.number().int().min(0).max(RESOLVE_MODEL_ITEM_LIMIT),
    reached: z.boolean(),
    nextCursor: z.string().nullable(),
    sort: z
      .enum(["throughput-desc", "context-desc"])
      .nullable(),
  })
  .strict();

const resolverCapSchema = z
  .object({
    audit: snapshotCapSchema,
    ranking: snapshotCapSchema,
    resolvedLimit: z.number().int().min(1).max(RESOLVE_MODEL_MAX_FALLBACK_DEPTH),
    eligibleCount: z.number().int().nonnegative(),
    resolvedCount: z.number().int().nonnegative(),
    fallbackTruncated: z.boolean(),
    excludedCount: z.number().int().nonnegative(),
  })
  .strict();

const resolveModelSuccessSchema = z
  .object({
    status: z.literal("ok"),
    schemaVersion: z.literal("2.0"),
    summary: z.string(),
    intent: intentSchema,
    constraints: resolveModelConstraintsSchema,
    resolved: z.array(resolvedModelSchema).max(RESOLVE_MODEL_MAX_FALLBACK_DEPTH),
    excluded: z.array(excludedModelSchema),
    unsatisfiable: z.boolean(),
    stale: z.boolean(),
    evidence: z.array(sourceEvidenceSchema),
    provenance: z.array(publicProvenanceSchema),
    warnings: z.array(z.string()),
    cap: resolverCapSchema,
  })
  .strict();

const resolveModelUnavailableSchema = z
  .object({
    status: z.literal("unavailable"),
    summary: z.literal(RESOLVE_MODEL_CAPABILITY_MESSAGE),
    message: z.literal(RESOLVE_MODEL_CAPABILITY_MESSAGE),
    missingCapability: z.literal(LIVE_MODELS_ENDPOINT),
    evidence: z.array(sourceEvidenceSchema),
    provenance: z.array(publicProvenanceSchema),
    warnings: z.array(z.string()),
  })
  .strict();

const resolveModelErrorSchema = z
  .object({
    status: z.literal("error"),
    summary: z.string(),
    error: safeDashboardErrorSchema,
  })
  .strict();

export const resolveModelOutputSchema = z.discriminatedUnion("status", [
  resolveModelSuccessSchema,
  resolveModelUnavailableSchema,
  resolveModelErrorSchema,
]);

export type ResolveModelInput = z.input<typeof resolveModelInputSchema>;
export type ResolveModelOutput = z.infer<typeof resolveModelOutputSchema>;
export type ResolveModelDependencies = { client: DashboardClient; allowedProviders?: string[] };

type ParsedInput = z.output<typeof resolveModelInputSchema>;
type ParsedConstraints = ParsedInput["constraints"];
type Constraints = Omit<ParsedConstraints, "minContext"> & {
  minContext?: string;
};
type NormalizedInput = Omit<ParsedInput, "constraints"> & {
  constraints: Constraints;
};
type Intent = ParsedInput["intent"];
type LiveModel = z.infer<typeof liveModelSchema>;
type ExclusionReason = z.infer<typeof exclusionReasonSchema>;
type ExcludedModel = z.infer<typeof excludedModelSchema>;
type Evidence = z.infer<typeof sourceEvidenceSchema>;
type SnapshotCap = z.infer<typeof snapshotCapSchema>;
type Provenance = z.infer<typeof publicProvenanceSchema>;

type Snapshot = {
  rows: LiveModel[];
  evidence: Evidence[];
  provenance: Provenance[];
  warnings: string[];
  stale: boolean;
  cap: SnapshotCap;
};

const DEFAULT_PROVIDER_ORDER = ["openrouter", "groq", "cerebras"] as const;

function normalizeInput(input: ParsedInput): NormalizedInput {
  const { minContext, ...constraints } = input.constraints;
  return {
    ...input,
    constraints: {
      ...constraints,
      ...(minContext === undefined
        ? {}
        : { minContext: String(minContext) }),
    },
  };
}

function candidateKey(model: Pick<LiveModel, "provider" | "id">): string {
  return `${model.provider}\u0000${model.id}`;
}

function compareExactInteger(left: string, right: string): number {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}

function decimalParts(value: string): { whole: string; fraction: string } {
  const [whole = "0", fraction = ""] = value.split(".", 2);
  return { whole, fraction };
}

function compareExactDecimal(left: string, right: string): number {
  const leftParts = decimalParts(left);
  const rightParts = decimalParts(right);
  const wholeComparison = compareExactInteger(
    leftParts.whole,
    rightParts.whole,
  );
  if (wholeComparison !== 0) return wholeComparison;
  const scale = Math.max(leftParts.fraction.length, rightParts.fraction.length);
  const leftFraction = leftParts.fraction.padEnd(scale, "0");
  const rightFraction = rightParts.fraction.padEnd(scale, "0");
  return leftFraction === rightFraction
    ? 0
    : leftFraction < rightFraction
      ? -1
      : 1;
}

function decimalUnscaled(value: string): { integer: bigint; scale: number } {
  const { whole, fraction } = decimalParts(value);
  return {
    integer: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
  };
}

function formatDecimal(integer: bigint, scale: number): string {
  let digits = integer.toString();
  if (scale === 0) return digits;
  digits = digits.padStart(scale + 1, "0");
  const whole = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return fraction.length === 0 ? whole : `${whole}.${fraction}`;
}

function addExactDecimals(left: string, right: string): string {
  const leftValue = decimalUnscaled(left);
  const rightValue = decimalUnscaled(right);
  const scale = Math.max(leftValue.scale, rightValue.scale);
  const leftInteger =
    leftValue.integer * 10n ** BigInt(scale - leftValue.scale);
  const rightInteger =
    rightValue.integer * 10n ** BigInt(scale - rightValue.scale);
  return formatDecimal(leftInteger + rightInteger, scale);
}

function multiplyDecimalByPowerOfTen(value: string, power: number): string {
  const parsed = decimalUnscaled(value);
  if (parsed.scale >= power) {
    return formatDecimal(parsed.integer, parsed.scale - power);
  }
  return formatDecimal(
    parsed.integer * 10n ** BigInt(power - parsed.scale),
    0,
  );
}

function divideDecimalByTwo(value: string): string {
  const parsed = decimalUnscaled(value);
  if (parsed.integer % 2n === 0n) {
    return formatDecimal(parsed.integer / 2n, parsed.scale);
  }
  return formatDecimal(parsed.integer * 5n, parsed.scale + 1);
}

function knownPriceSum(model: LiveModel): string | null {
  if (
    model.isFree === null &&
    model.missingFields.includes("native_output_pricing")
  ) return null;
  const prompt = model.pricePoints.find((point) => point.unit === "token_in" && point.condition === null)?.amount ?? null;
  const completion = model.pricePoints.find((point) => point.unit === "token_out" && point.condition === null)?.amount ?? null;
  if (prompt === null || completion === null) return null;
  return addExactDecimals(prompt, completion);
}

function blendedUsdPerMillion(model: LiveModel): string | null {
  const sum = knownPriceSum(model);
  if (sum === null) return null;
  return divideDecimalByTwo(multiplyDecimalByPowerOfTen(sum, 6));
}

function staleWarning(stale: boolean): string[] {
  return stale ? [`Data from ${LIVE_MODELS_ENDPOINT} is stale.`] : [];
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function uniqueProvenance(values: readonly Provenance[]): Provenance[] {
  const seen = new Set<string>();
  return values.filter((entry) => {
    const key = `${entry.sourceId}\u0000${entry.runId}\u0000${entry.fetchedAt}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function baseEligibilityQuery(constraints: Constraints): URLSearchParams {
  const query = new URLSearchParams({ availability: "available" });
  if (constraints.free !== undefined) {
    query.set("free", String(constraints.free));
  }
  if (constraints.minContext !== undefined) {
    query.set("minContext", constraints.minContext);
  }
  if (constraints.outputModality !== undefined) {
    query.set("outputModality", constraints.outputModality);
  }
  if (constraints.reasoning !== undefined) {
    query.set("reasoning", String(constraints.reasoning));
  }
  if (constraints.providers?.length === 1) {
    query.set("provider", constraints.providers[0] ?? "");
  }
  return query;
}

function upstreamSort(intent: Intent): "throughput-desc" | "context-desc" | null {
  if (intent === "fastest_available") return "throughput-desc";
  if (intent === "largest_context") return "context-desc";
  return null;
}

function snapshotEvidence(page: z.infer<typeof liveModelsResponseSchema>): Evidence {
  return sourceEvidence(LIVE_MODELS_ENDPOINT, page);
}

async function scanUnranked(
  client: DashboardClient,
  baseQuery: URLSearchParams,
): Promise<Snapshot> {
  const rows: LiveModel[] = [];
  const evidence: Evidence[] = [];
  const provenance: Provenance[] = [];
  const warnings: string[] = [];
  let cursor: string | null = null;
  let pagesScanned = 0;
  let stale = false;

  while (
    pagesScanned < RESOLVE_MODEL_PAGE_LIMIT &&
    rows.length < RESOLVE_MODEL_ITEM_LIMIT
  ) {
    const query = new URLSearchParams(baseQuery);
    query.set("availability", "available");
    query.set("limit", String(RESOLVE_MODEL_PAGE_SIZE));
    query.delete("sort");
    if (cursor === null) query.delete("cursor");
    else query.set("cursor", cursor);

    const page = await client.get(
      LIVE_MODELS_ENDPOINT,
      query,
      liveModelsResponseSchema,
    );
    pagesScanned += 1;
    const remaining = RESOLVE_MODEL_ITEM_LIMIT - rows.length;
    rows.push(...page.data.slice(0, remaining));
    evidence.push(snapshotEvidence(page));
    provenance.push(...page.provenance);
    warnings.push(...staleWarning(page.stale));
    stale ||= page.stale;
    cursor = page.cursor;
    if (cursor === null) break;
  }

  const reached = rows.length >= RESOLVE_MODEL_ITEM_LIMIT || cursor !== null;
  return {
    rows,
    evidence,
    provenance,
    warnings,
    stale,
    cap: {
      pageLimit: RESOLVE_MODEL_PAGE_LIMIT,
      itemLimit: RESOLVE_MODEL_ITEM_LIMIT,
      pagesScanned,
      itemsScanned: rows.length,
      reached,
      nextCursor: cursor,
      sort: null,
    },
  };
}

async function scanRanked(
  client: DashboardClient,
  baseQuery: URLSearchParams,
  sort: "throughput-desc" | "context-desc",
): Promise<Snapshot> {
  const query = new URLSearchParams(baseQuery);
  query.set("availability", "available");
  query.set("limit", String(RESOLVE_MODEL_RANKED_ITEM_LIMIT));
  query.set("sort", sort);
  query.delete("cursor");
  const page = await client.get(
    LIVE_MODELS_ENDPOINT,
    query,
    liveModelsResponseSchema,
  );
  const rows = page.data.slice(0, RESOLVE_MODEL_RANKED_ITEM_LIMIT);
  const reached =
    page.data.length >= RESOLVE_MODEL_RANKED_ITEM_LIMIT || page.cursor !== null;
  const warnings = staleWarning(page.stale);
  if (page.cursor !== null) {
    warnings.push(
      "The ranked snapshot unexpectedly returned a cursor; it was not paginated because cursor and sort cannot be combined.",
    );
  }
  return {
    rows,
    evidence: [snapshotEvidence(page)],
    provenance: [...page.provenance],
    warnings,
    stale: page.stale,
    cap: {
      pageLimit: RESOLVE_MODEL_RANKED_PAGE_LIMIT,
      itemLimit: RESOLVE_MODEL_RANKED_ITEM_LIMIT,
      pagesScanned: 1,
      itemsScanned: rows.length,
      reached,
      nextCursor: page.cursor,
      sort,
    },
  };
}

function pushReason(
  reasons: ExclusionReason[],
  reason: ExclusionReason,
): void {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function exclusionReasons(
  model: LiveModel,
  constraints: Constraints,
  intent: Intent,
): ExclusionReason[] {
  const reasons: ExclusionReason[] = [];
  if (model.availability !== "available") pushReason(reasons, "disappeared");
  if (!hasConsistentLiveModelFreeness(model)) {
    pushReason(reasons, "inconsistent_free_metadata");
  }

  if (
    constraints.providers !== undefined &&
    !constraints.providers.includes(model.provider)
  ) {
    pushReason(reasons, "provider_not_allowed");
  }

  if (constraints.free !== undefined) {
    if (model.isFree === null) pushReason(reasons, "pricing_not_published");
    else if (model.isFree !== constraints.free) {
      pushReason(reasons, "pricing_constraint_not_satisfied");
    }
  }

  if (constraints.minContext !== undefined) {
    if (model.contextLength === null) {
      pushReason(reasons, "context_not_published");
    } else if (
      compareExactInteger(model.contextLength, constraints.minContext) < 0
    ) {
      pushReason(reasons, "context_below_minimum");
    }
  }

  if (constraints.outputModality !== undefined) {
    if (model.outputModalities === null) {
      pushReason(reasons, "output_modalities_not_published");
    } else if (!model.outputModalities.includes(constraints.outputModality)) {
      pushReason(reasons, "output_modality_not_supported");
    }
  }

  if (constraints.reasoning !== undefined) {
    if (model.reasoningEfforts === null) {
      pushReason(reasons, "reasoning_not_published");
    } else if (constraints.reasoning === false) {
      pushReason(reasons, "reasoning_constraint_not_satisfied");
    }
  }

  if (constraints.requireProviderActive !== undefined) {
    if (model.providerActive === null) {
      pushReason(reasons, "provider_active_not_published");
    } else if (model.providerActive !== constraints.requireProviderActive) {
      pushReason(reasons, "provider_not_active");
    }
  }

  if (intent === "cheapest_capable") {
    if (knownPriceSum(model) === null) {
      pushReason(reasons, "pricing_not_published");
    }
    const latestCost = latestMeasuredObservation(model);
    if (!latestCost || latestCost.costUsd === null) {
      pushReason(reasons, "pricing_not_published");
    }
  }
  if (intent === "largest_context" && model.contextLength === null) {
    pushReason(reasons, "context_not_published");
  }
  return reasons;
}

function addExcluded(
  excluded: ExcludedModel[],
  seen: Set<string>,
  model: LiveModel,
  reason: ExclusionReason,
): void {
  const key = `${candidateKey(model)}\u0000${reason}`;
  if (seen.has(key)) return;
  seen.add(key);
  excluded.push({ provider: model.provider, id: model.id, reason });
}

function providerOrder(constraints: Constraints): readonly string[] {
  return constraints.providers ?? DEFAULT_PROVIDER_ORDER;
}

function tieBreak(
  left: LiveModel,
  right: LiveModel,
  constraints: Constraints,
): number {
  const order = providerOrder(constraints);
  const leftProvider = order.indexOf(left.provider);
  const rightProvider = order.indexOf(right.provider);
  if (leftProvider !== rightProvider) return leftProvider - rightProvider;
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}

function rankCandidates(
  rows: readonly LiveModel[],
  intent: Intent,
  constraints: Constraints,
): LiveModel[] {
  return [...rows].sort((left, right) => {
    let comparison = 0;
    if (intent === "cheapest_capable") {
      const leftMeasured = latestMeasuredObservation(left)?.costUsd ?? null;
      const rightMeasured = latestMeasuredObservation(right)?.costUsd ?? null;
      if (leftMeasured !== null && rightMeasured !== null) {
        comparison = compareExactDecimal(leftMeasured, rightMeasured);
      } else {
        const leftPrice = knownPriceSum(left);
        const rightPrice = knownPriceSum(right);
        if (leftPrice !== null && rightPrice !== null) {
          comparison = compareExactDecimal(leftPrice, rightPrice);
        }
      }
    } else if (intent === "largest_context") {
      if (left.contextLength !== null && right.contextLength !== null) {
        comparison = -compareExactInteger(left.contextLength, right.contextLength);
      }
    } else if (intent === "fastest_available") {
      const leftThroughput = left.performance?.throughputTps ?? null;
      const rightThroughput = right.performance?.throughputTps ?? null;
      if (leftThroughput === null && rightThroughput !== null) comparison = 1;
      else if (leftThroughput !== null && rightThroughput === null) comparison = -1;
      else if (leftThroughput !== null && rightThroughput !== null) {
        comparison = -compareExactDecimal(leftThroughput, rightThroughput);
      }
    }
    return comparison !== 0 ? comparison : tieBreak(left, right, constraints);
  });
}

function resolvedBasis(intent: Intent): z.infer<typeof resolvedModelSchema>["basis"] {
  if (intent === "cheapest_capable") return "measured_generation_cost";
  if (intent === "largest_context") return "context_length";
  if (intent === "fastest_available") return "throughput_tps";
  return "provider_order_then_id";
}

function resolvedValue(model: LiveModel, intent: Intent): string | null {
  if (intent === "cheapest_capable") {
    const latestCost = latestMeasuredObservation(model);
    return latestCost ? latestCost.costUsd : blendedUsdPerMillion(model);
  }
  if (intent === "largest_context") return model.contextLength;
  if (intent === "fastest_available") {
    return model.performance?.throughputTps ?? null;
  }
  return null;
}


function latestMeasuredObservation(model: LiveModel): GenerationCostObservation | null {
  const values = model.generationCosts;
  if (!values || values.length === 0) return null;
  const measured = values.filter((item) => item.costState === "MEASURED" && item.costUsd !== null);
  if (measured.length === 0) return null;
  return measured.sort((left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt))[0] ?? null;
}

function determinePriceState(model: LiveModel): "priced" | "offered_unpriced" | "not_offered" | "unknown" {
  if (model.availability === "disappeared") {
    return "not_offered";
  }
  if (model.pricingState === "published") {
    return "priced";
  } else if (model.pricingState === "not_published") {
    return "offered_unpriced";
  }
  return "unknown";
}

function measurementFor(
  model: LiveModel,
  intent: Intent,
): "measured" | "unmeasured" | "not_applicable" {
  if (intent === "any_available") return "not_applicable";
  if (intent === "fastest_available") {
    return model.performance?.throughputTps === null || model.performance === null
      ? "unmeasured"
      : "measured";
  }
  return "measured";
}

export async function runResolveModel(
  rawInput: ResolveModelInput,
  { client, allowedProviders }: ResolveModelDependencies,
): Promise<ResolveModelOutput> {
  try {
    const input = normalizeInput(resolveModelInputSchema.parse(rawInput));
    const manifest = await client.get(
      MANIFEST_ENDPOINT,
      new URLSearchParams(),
      manifestSchema,
    );
    const manifestEvidence = sourceEvidence(MANIFEST_ENDPOINT, manifest);
    if (!manifest.routes.includes(LIVE_MODELS_ENDPOINT)) {
      return {
        status: "unavailable",
        summary: RESOLVE_MODEL_CAPABILITY_MESSAGE,
        message: RESOLVE_MODEL_CAPABILITY_MESSAGE,
        missingCapability: LIVE_MODELS_ENDPOINT,
        evidence: [manifestEvidence],
        provenance: [...manifest.provenance],
        warnings: [],
      };
    }

    const auditQuery = new URLSearchParams({ availability: "available" });
    const eligibilityQuery = baseEligibilityQuery(input.constraints);
    const sort = upstreamSort(input.intent);
    const [auditRead, rankingRead] = await Promise.all([
      scanUnranked(client, auditQuery),
      sort === null
        ? scanUnranked(client, eligibilityQuery)
        : scanRanked(client, eligibilityQuery, sort),
    ]);
    const visible = (snapshot: Snapshot): Snapshot => allowedProviders === undefined
      ? snapshot
      : { ...snapshot, rows: snapshot.rows.filter((row) => allowedProviders.includes(row.provider)) };
    const audit = visible(auditRead);
    const ranking = visible(rankingRead);

    const excluded: ExcludedModel[] = [];
    const excludedSeen = new Set<string>();
    const auditRows = new Map<string, LiveModel>();
    const rankingRows = new Map<string, LiveModel>();
    const auditEligible = new Map<string, LiveModel>();
    const rankingEligible = new Map<string, LiveModel>();

    for (const row of audit.rows) {
      const key = candidateKey(row);
      auditRows.set(key, row);
      const reasons = exclusionReasons(row, input.constraints, input.intent);
      if (reasons.length === 0) auditEligible.set(key, row);
      else {
        for (const reason of reasons) {
          addExcluded(excluded, excludedSeen, row, reason);
        }
      }
    }

    for (const row of ranking.rows) {
      const key = candidateKey(row);
      rankingRows.set(key, row);
      const reasons = exclusionReasons(row, input.constraints, input.intent);
      if (reasons.length === 0) rankingEligible.set(key, row);
      else {
        for (const reason of reasons) {
          addExcluded(excluded, excludedSeen, row, reason);
        }
      }
    }

    for (const [key, row] of auditEligible) {
      if (!rankingRows.has(key)) {
        addExcluded(
          excluded,
          excludedSeen,
          row,
          "absent_from_ranked_snapshot",
        );
      }
    }
    for (const [key, row] of rankingEligible) {
      if (!auditRows.has(key)) {
        addExcluded(
          excluded,
          excludedSeen,
          row,
          "absent_from_audit_snapshot",
        );
      }
    }

    const eligible = [...auditEligible.entries()]
      .filter(([key]) => rankingEligible.has(key))
      .map(([, row]) => row);
    const ranked = rankCandidates(eligible, input.intent, input.constraints);
    const selected = ranked.slice(0, input.fallbackDepth);
    const resolved = selected.map((model, index) => {
      const latestCost = latestMeasuredObservation(model);
      return {
      provider: model.provider,
      id: model.id,
      rank: index + 1,
      basis: resolvedBasis(input.intent),
      value: resolvedValue(model, input.intent),
      measurement: measurementFor(model, input.intent),
      contextLength: model.contextLength,
      isFree: model.isFree,
      availability: "available" as const,
      lastConfirmedAt: model.lastConfirmedAt,
      priceState: determinePriceState(model),
      measuredPrice: latestCost?.costUsd ?? null,
      priceMeasuredAt: latestCost?.observedAt ?? null,
      priceEvidence: latestCost?.sourceUrl ?? null,
      ...(input.verbose ? { details: model } : {}),
    };});
    const unsatisfiable = resolved.length === 0;

    const warnings = [
      ...audit.warnings,
      ...ranking.warnings,
      ...(audit.cap.reached
        ? ["The availability audit reached its declared 1,000-row bound."]
        : []),
      ...(ranking.cap.reached
        ? ["The ranking snapshot reached its declared bound."]
        : []),
      ...(excluded.some(
        (row) =>
          row.reason === "absent_from_audit_snapshot" ||
          row.reason === "absent_from_ranked_snapshot",
      )
        ? [
            "The two required candidate snapshots differed; only their eligible intersection could resolve.",
          ]
        : []),
    ];
    const provenance = uniqueProvenance([
      ...manifest.provenance,
      ...audit.provenance,
      ...ranking.provenance,
    ]);

    return {
      status: "ok",
      schemaVersion: "2.0",
      summary: unsatisfiable
        ? "No model in both bounded snapshots satisfies every requested constraint."
        : `Resolved ${resolved.length} model${resolved.length === 1 ? "" : "s"} from the eligible intersection.`,
      intent: input.intent,
      constraints: input.constraints,
      resolved,
      excluded,
      unsatisfiable,
      stale: audit.stale || ranking.stale,
      evidence: [manifestEvidence, ...audit.evidence, ...ranking.evidence],
      provenance,
      warnings: uniqueStrings(warnings),
      cap: {
        audit: audit.cap,
        ranking: ranking.cap,
        resolvedLimit: input.fallbackDepth,
        eligibleCount: eligible.length,
        resolvedCount: resolved.length,
        fallbackTruncated: eligible.length > resolved.length,
        excludedCount: excluded.length,
      },
    };
  } catch (error) {
    const safeError = safeDashboardError(error);
    return {
      status: "error",
      summary: safeError.message,
      error: safeError,
    };
  }
}

export function registerResolveModel(
  server: McpServer,
  dependencies: ResolveModelDependencies,
): void {
  server.registerTool(
    "dashboard_resolve_model",
    {
      title: "Dashboard resolve model",
      description:
        "Resolve a durable model-selection intent into a bounded ranked fallback list. Every result satisfies every explicit constraint in both required catalogue snapshots; unknown values never count favourably and no near miss is returned.",
      inputSchema: resolveModelInputSchema,
      outputSchema: resolveModelOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runResolveModel(input, dependencies)),
  );
}

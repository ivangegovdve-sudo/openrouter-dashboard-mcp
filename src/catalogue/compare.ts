import { z } from "zod";

import { collectCrazyrouterCatalogue, crazyrouterIdentity, type CollectCrazyrouterOptions, type CrazyrouterIdentity } from "./crazyrouter.js";
import { exactDecimalRatio } from "./decimal.js";
import { parseNativeJson } from "./json.js";
import { pricePoint } from "./price-set.js";
import { record, type NativeRecord } from "./normalize.js";
import { catalogueProviderSchema, type CatalogueModel } from "./schemas.js";
import { normalizedFigureSchema, pricePointSchema, type NormalizedFigure, type PricePoint, type PriceUnit } from "../contract.js";

export const OPENROUTER_COMPARISON_URL = "https://openrouter.ai/api/v1/models?output_modalities=all";

export const priceComparisonInputSchema = z.object({
  modelIds: z.array(z.string().min(1)).min(1).max(20).optional(),
  offset: z.number().int().min(0).max(20000).default(0),
  limit: z.number().int().min(1).max(500).default(50),
}).strict();

const rationalSchema = z.object({
  numerator: z.string().regex(/^-?\d+$/),
  denominator: z.string().regex(/^[1-9]\d*$/),
  value: z.string().regex(/^-?\d+(?:\.\d+)?$/).optional(),
}).strict();

const pairSchema = z.object({
  left: pricePointSchema,
  right: pricePointSchema,
  leftNormalized: normalizedFigureSchema,
  rightNormalized: normalizedFigureSchema,
  savingsPercent: rationalSchema,
  direction: z.enum(["cheaper", "equal", "more_expensive"]),
}).strict();

const comparisonLegSchema = z.object({
  status: z.enum(["comparable", "not_comparable"]),
  reason: z.string().optional(),
  unit: z.string().optional(),
  assumption: z.string().optional(),
  pricePoints: z.object({ left: z.array(pricePointSchema), right: z.array(pricePointSchema) }).strict(),
  pairs: z.array(pairSchema),
}).strict();

const identitySchema = z.object({
  exactModelAlias: z.string(),
  authorNamespace: z.string().optional(),
  nativeVendorName: z.string().nullable(),
  nativeOwner: z.string().nullable(),
  basis: z.string(),
  snapshotEquivalence: z.literal("not_established"),
}).strict();

const rowSchema = z.object({
  id: z.string(),
  status: z.enum(["comparable", "price_not_available", "openrouter_model_not_found", "identity_not_established", "source_unavailable", "crazyrouter_model_not_observed"]),
  reason: z.string().optional(),
  identity: identitySchema,
  crazyrouter: z.object({ id: z.string(), pricingState: z.enum(["published", "not_published", "unknown"]), reason: z.string().optional(), pricePoints: z.array(pricePointSchema), sourceUrl: z.string().url(), observedAt: z.string().datetime({ offset: true }), sourceIndex: z.number().int().nonnegative() }).strict().nullable(),
  openrouter: z.object({ id: z.string(), canonicalSlug: z.string().nullable(), pricePoints: z.array(pricePointSchema), sourceUrl: z.string().url(), observedAt: z.string().datetime({ offset: true }) }).strict().nullable(),
  comparisons: z.object({ input: comparisonLegSchema, output: comparisonLegSchema }).strict(),
}).strict();

const openrouterSourceSchema = z.object({
  status: z.enum(["available", "unavailable"]),
  sourceUrl: z.string().url(),
  observedAt: z.string().datetime({ offset: true }),
  received: z.number().int().nonnegative().nullable(),
  error: z.string().optional(),
  scope: z.literal("public_models_output_modalities_all"),
  requestParameters: z.record(z.string(), z.unknown()),
}).strict();

export const priceComparisonOutputSchema = z.object({
  status: z.enum(["ok", "partial", "error"]),
  summary: z.string(),
  observedAt: z.string().datetime({ offset: true }),
  sources: z.object({ crazyrouter: catalogueProviderSchema, openrouter: openrouterSourceSchema }).strict(),
  rows: z.array(rowSchema),
  population: z.object({
    acquiredCrazyrouterRows: z.number().int().nonnegative().nullable(),
    retainedCrazyrouterRows: z.number().int().nonnegative().nullable(),
    openrouterReceivedRows: z.number().int().nonnegative().nullable(),
    excludedByUserFilter: z.number().int().nonnegative(),
    missingRequestedIds: z.array(z.string()),
    beforePagination: z.number().int().nonnegative(),
    returned: z.number().int().nonnegative(),
    comparableBeforePagination: z.number().int().nonnegative(),
    offset: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    nextOffset: z.number().int().nonnegative().nullable(),
    filterRule: z.string(),
    platformPopulationEstablished: z.literal(false),
  }).strict(),
  vendorClaim: z.object({ text: z.string(), attribution: z.literal("Crazyrouter Team"), sourceUrl: z.string().url(), publishedAt: z.string().date(), observedAt: z.string().date(), scope: z.string(), globalAssessment: z.literal("not_established") }).strict(),
  warnings: z.array(z.string()),
}).strict();

export type PriceComparisonInput = z.input<typeof priceComparisonInputSchema>;
export type PriceComparisonOutput = z.infer<typeof priceComparisonOutputSchema>;
export type PriceComparisonDependencies = Omit<CollectCrazyrouterOptions, "group">;

export type PriceSetComparison =
  | { status: "comparable"; unit: PriceUnit; assumption: string; pairs: ComparablePair[] }
  | { status: "refused"; reason: string; leftUnits: PriceUnit[]; rightUnits: PriceUnit[] };

type ComparablePair = { left: PricePoint; right: PricePoint; leftNormalized: NormalizedFigure; rightNormalized: NormalizedFigure; savingsPercent: z.infer<typeof rationalSchema>; direction: "cheaper" | "equal" | "more_expensive" };

function decimalRatio(value: string): { numerator: bigint; denominator: bigint } {
  const result = exactDecimalRatio(value);
  return { numerator: BigInt(result.numerator), denominator: BigInt(result.denominator) };
}

function compareDecimal(left: string, right: string): number {
  const a = decimalRatio(left), b = decimalRatio(right);
  const difference = a.numerator * b.denominator - b.numerator * a.denominator;
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

function percentageDifference(left: string, right: string): z.infer<typeof rationalSchema> {
  const a = decimalRatio(left), b = decimalRatio(right);
  if (b.numerator === 0n) return { numerator: "0", denominator: "1", value: "0" };
  const difference = b.numerator * a.denominator - a.numerator * b.denominator;
  const sign = difference < 0n ? "-" : "";
  const absolute = difference < 0n ? -difference : difference;
  const numerator = absolute * 100n;
  const denominator = b.numerator * a.denominator;
  let aGcd = numerator, bGcd = denominator;
  while (bGcd !== 0n) [aGcd, bGcd] = [bGcd, aGcd % bGcd];
  const reducedNumerator = numerator / (aGcd || 1n);
  const reducedDenominator = denominator / (aGcd || 1n);
  const decimal = exactDecimalRatio(String(reducedNumerator), "1", String(reducedDenominator));
  return { numerator: `${sign}${reducedNumerator}`, denominator: String(reducedDenominator), ...(decimal.value === undefined ? {} : { value: `${sign}${decimal.value}` }) };
}

function conditionKey(point: PricePoint): string {
  return JSON.stringify(point.condition);
}

function normalized(point: PricePoint, unit: PriceUnit, assumption: string): NormalizedFigure {
  return normalizedFigureSchema.parse({ value: point.amount, unit, assumption, derived_from: point.id });
}

/** Compare every point with the same unit and condition, or refuse explicitly. */
export function comparePriceSets(left: PricePoint[], right: PricePoint[], basis: { unit: PriceUnit; assumption: string }): PriceSetComparison {
  if (!basis.assumption.trim()) return { status: "refused", reason: "A comparison basis must state its assumption", leftUnits: [...new Set(left.map(point => point.unit))], rightUnits: [...new Set(right.map(point => point.unit))] };
  const leftUnits = [...new Set(left.map(point => point.unit))];
  const rightUnits = [...new Set(right.map(point => point.unit))];
  if (leftUnits.some(unit => unit !== basis.unit) || rightUnits.some(unit => unit !== basis.unit) || leftUnits.length === 0 || rightUnits.length === 0) {
    return { status: "refused", reason: `No common comparison unit: left has ${leftUnits.join(", ") || "none"}; right has ${rightUnits.join(", ") || "none"}`, leftUnits, rightUnits };
  }
  const leftConditions = new Set(left.map(conditionKey));
  const rightConditions = new Set(right.map(conditionKey));
  if (leftConditions.size !== rightConditions.size || [...leftConditions].some(condition => !rightConditions.has(condition))) {
    return { status: "refused", reason: "Price conditions do not align; every conditional point must have an explicitly comparable condition on both sides", leftUnits, rightUnits };
  }
  const pairs: ComparablePair[] = [];
  for (const leftPoint of left) {
    for (const rightPoint of right) {
      if (leftPoint.unit !== rightPoint.unit || conditionKey(leftPoint) !== conditionKey(rightPoint)) continue;
      // NUMERIC ZERO, NOT THE LITERAL STRING "0". This compared the amount against "0"
      // by string equality, so "0.0", "0.00" and "0.000" -- all valid decimal amounts
      // under the price-point schema, and all exactly what a free model quotes -- walked
      // past the guard. percentageDifference then hit its own numeric zero check and
      // returned 0%, so a free model against a paid one was reported `comparable` with
      // "0% cheaper" instead of being refused. The refusal rule was defeated by a
      // trailing zero.
      if (decimalRatio(rightPoint.amount).numerator === 0n) {
        return { status: "refused", reason: "A percentage comparison has no nonzero baseline", leftUnits, rightUnits };
      }
      const comparison = compareDecimal(leftPoint.amount, rightPoint.amount);
      pairs.push({ left: leftPoint, right: rightPoint, leftNormalized: normalized(leftPoint, basis.unit, basis.assumption), rightNormalized: normalized(rightPoint, basis.unit, basis.assumption), savingsPercent: percentageDifference(leftPoint.amount, rightPoint.amount), direction: comparison < 0 ? "cheaper" : comparison > 0 ? "more_expensive" : "equal" });
    }
  }
  if (pairs.length === 0) return { status: "refused", reason: "No price points share both a unit and condition", leftUnits, rightUnits };
  return { status: "comparable", unit: basis.unit, assumption: basis.assumption, pairs };
}

class ComparisonSourceError extends Error {}

async function openrouterSource(fetchImpl: typeof fetch, timeout: number, observedAt: string): Promise<{ source: z.infer<typeof openrouterSourceSchema>; rows: NativeRecord[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const requestParameters: Record<string, unknown> = { output_modalities: "all", modelFilter: "none", priceFilter: "none", receivedRows: null, sourceListedCount: null, excludedCount: null, exclusionRules: [], denominatorBasis: "documented unpaginated response data.length", sourceDocumentation: "https://openrouter.ai/docs/api/api-reference/models/get-models" };
  try {
    const response = await fetchImpl(OPENROUTER_COMPARISON_URL, { method: "GET", redirect: "error", signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new ComparisonSourceError(`HTTP_${response.status}`);
    if (!response.body) throw new ComparisonSourceError("EMPTY_RESPONSE_BODY");
    const reader = response.body.getReader(), decoder = new TextDecoder(); let bytes = 0, text = "";
    while (true) { const { done, value } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > 12 * 1024 * 1024) { await reader.cancel(); throw new ComparisonSourceError("RESPONSE_SIZE_LIMIT"); } text += decoder.decode(value, { stream: true }); }
    const payload = record(parseNativeJson(text + decoder.decode()));
    if (!Array.isArray(payload.data) || payload.success === false || payload.data.length > 20000 || payload.data.some(raw => typeof record(raw).id !== "string" || !record(raw).id)) throw new ComparisonSourceError("MODELS_SHAPE_CHANGED");
    if (payload.has_more === true || payload.next_cursor || (payload.total !== undefined && String(payload.total) !== String(payload.data.length))) throw new ComparisonSourceError("UNEXPECTED_PAGINATION_OR_TOTAL");
    requestParameters.receivedRows = payload.data.length; requestParameters.sourceListedCount = payload.data.length; requestParameters.excludedCount = 0;
    return { source: { status: "available", sourceUrl: OPENROUTER_COMPARISON_URL, observedAt, received: payload.data.length, scope: "public_models_output_modalities_all", requestParameters }, rows: payload.data as NativeRecord[] };
  } catch (error) {
    return { source: { status: "unavailable", sourceUrl: OPENROUTER_COMPARISON_URL, observedAt, received: null, scope: "public_models_output_modalities_all", error: controller.signal.aborted ? "SOURCE_TIMEOUT" : error instanceof ComparisonSourceError ? error.message : "SOURCE_FETCH_OR_SHAPE_FAILED", requestParameters }, rows: [] };
  } finally { clearTimeout(timer); }
}

function pointsForLeg(points: PricePoint[], unit: PriceUnit): PricePoint[] { return points.filter(point => point.unit === unit); }

function comparisonLeg(left: PricePoint[], right: PricePoint[], unit: PriceUnit, assumption: string): z.infer<typeof comparisonLegSchema> {
  const result = comparePriceSets(pointsForLeg(left, unit), pointsForLeg(right, unit), { unit, assumption });
  if (result.status === "refused") return { status: "not_comparable", reason: result.reason, pricePoints: { left, right }, pairs: [] };
  return { status: "comparable", unit: result.unit, assumption: result.assumption, pricePoints: { left, right }, pairs: result.pairs };
}

function openrouterPrices(row: NativeRecord, observedAt: string, dropped: string[]): PricePoint[] {
  const native = record(row.pricing), points: PricePoint[] = [];
  for (const [field, unit] of [["prompt", "token_in"], ["completion", "token_out"]] as const) {
    if (typeof native[field] !== "string") continue;
    try { points.push(pricePoint({ id: `openrouter:${String(row.id)}:${unit}`, amount: native[field], unit, condition: null, sourceUrl: OPENROUTER_COMPARISON_URL, readAt: observedAt, provenance: "published" })); } catch { dropped.push(`${String(row.id)} (${unit})`); }
  }
  return points;
}

const directReferences: Record<string, [string, string]> = { "gpt-4o": ["2.5", "10"], "gpt-4o-mini": ["0.15", "0.6"], "gpt-4.1": ["2", "8"] };
function directReference(identity: CrazyrouterIdentity, observedAt: string): { input: PricePoint; output: PricePoint } | null {
  if (identity.authorNamespace !== "openai" || !Object.hasOwn(directReferences, identity.exactModelAlias)) return null;
  const [input, output] = directReferences[identity.exactModelAlias]!;
  const sourceUrl = `https://developers.openai.com/api/docs/models/${identity.exactModelAlias}`;
  const point = (value: string, unit: PriceUnit, leg: string) => pricePoint({ id: `openai:${identity.exactModelAlias}:${leg}`, amount: exactDecimalRatio(value, "1", "1000000").value!, unit, condition: null, sourceUrl, readAt: `${observedAt.slice(0, 10)}T00:00:00.000Z`, provenance: "published" });
  return { input: point(input, "token_in", "input"), output: point(output, "token_out", "output") };
}

function rowFor(id: string, model: CatalogueModel | undefined, orById: Map<string, NativeRecord[]>, orAvailable: boolean, crazyAvailable: boolean, crazyComplete: boolean, duplicateCrazy: boolean, observedAt: string, dropped: string[]) {
  const identity: CrazyrouterIdentity = model ? crazyrouterIdentity(model) : { exactModelAlias: id, nativeOwner: null, nativeVendorName: null, basis: "model_not_observed", snapshotEquivalence: "not_established" };
  const expectedId = identity.authorNamespace ? `${identity.authorNamespace}/${identity.exactModelAlias}` : undefined;
  const matches = expectedId ? orById.get(expectedId) ?? [] : [];
  const matched = matches.length === 1 && !duplicateCrazy ? matches[0] : undefined;
  const crazyPoints = model?.pricePoints ?? [];
  const openrouterPoints = matched ? openrouterPrices(matched, observedAt, dropped) : [];
  const comparisons = { input: comparisonLeg(crazyPoints, openrouterPoints, "token_in", "same provider price per input token"), output: comparisonLeg(crazyPoints, openrouterPoints, "token_out", "same provider price per output token") };
  let status: "comparable" | "price_not_available" | "openrouter_model_not_found" | "identity_not_established" | "source_unavailable" | "crazyrouter_model_not_observed" = "comparable";
  let reason: string | undefined;
  if (!crazyAvailable || !orAvailable) { status = "source_unavailable"; reason = "source_acquisition_failed_not_model_absence"; }
  // ABSENCE MAY ONLY BE ASSERTED FROM A COMPLETE CATALOGUE. `crazyAvailable` was passed
  // as `status !== "unavailable"`, so a PARTIAL acquisition counted as available and a
  // model that merely sat on a page we never read was reported
  // `crazyrouter_model_not_observed` -- a positive claim that Crazyrouter does not carry
  // it. Not reading a page is not evidence of absence. When the population is not full,
  // the honest answer is that the source could not settle the question.
  else if (!model && !crazyComplete) { status = "source_unavailable"; reason = "crazyrouter_catalogue_incomplete_absence_not_established"; }
  else if (!model) status = "crazyrouter_model_not_observed";
  else if (!identity.authorNamespace || matches.length > 1 || duplicateCrazy) { status = "identity_not_established"; reason = matches.length > 1 || duplicateCrazy ? "ambiguous_native_identity" : identity.basis; }
  else if (!matched) status = "openrouter_model_not_found";
  else if (comparisons.input.status !== "comparable" || comparisons.output.status !== "comparable") { status = "price_not_available"; reason = [comparisons.input.reason, comparisons.output.reason].filter(Boolean).join("; "); }
  return { id, status, ...(reason ? { reason } : {}), identity,
    crazyrouter: model ? { id: model.id, pricingState: model.pricingState, ...(model.pricingNote ? { reason: model.pricingNote } : {}), pricePoints: crazyPoints, ...model.provenance } : null,
    openrouter: matched ? { id: String(matched.id), canonicalSlug: typeof matched.canonical_slug === "string" ? matched.canonical_slug : null, pricePoints: openrouterPoints, sourceUrl: OPENROUTER_COMPARISON_URL, observedAt } : null,
    comparisons };
}

export async function runPriceComparison(rawInput: PriceComparisonInput, dependencies: PriceComparisonDependencies = {}): Promise<PriceComparisonOutput> {
  const input = priceComparisonInputSchema.parse(rawInput);
  const observedAt = (dependencies.now ?? (() => new Date()))().toISOString();
  const [crazy, openrouter] = await Promise.all([collectCrazyrouterCatalogue(dependencies), openrouterSource(dependencies.fetchImpl ?? fetch, Math.min(30000, Math.max(1, dependencies.timeoutMs ?? 10000)), observedAt)]);
  const selected = input.modelIds ? new Set(input.modelIds) : undefined;
  const selectedModels = crazy.models.filter(model => !selected || selected.has(model.id));
  const identityCounts = new Map<string, number>();
  const orById = new Map<string, NativeRecord[]>();
  for (const model of crazy.models) identityCounts.set(model.id, (identityCounts.get(model.id) ?? 0) + 1);
  for (const row of openrouter.rows) { const id = String(row.id); const matches = orById.get(id) ?? []; matches.push(row); orById.set(id, matches); }
  const requestedNotObserved = [...(selected ?? [])].filter(id => !identityCounts.has(id));
  // A native price we could not represent is UNREAD, not absent. This was swallowed by a
  // bare `catch {}` whose comment said "remains unobserved" while nothing told the caller
  // so, and the row still reported a clean comparison against whatever survived.
  const droppedOpenrouterPrices: string[] = [];
  // Completeness, not mere availability, is what licenses a claim of absence.
  const crazyComplete = crazy.provider.status === "available" && crazy.provider.population.completeness === "full";
  const rows = selectedModels.map(model => rowFor(model.id, model, orById, openrouter.source.status === "available", crazy.provider.status !== "unavailable", crazyComplete, identityCounts.get(model.id)! > 1, observedAt, droppedOpenrouterPrices));
  rows.push(...requestedNotObserved.map(id => rowFor(id, undefined, orById, openrouter.source.status === "available", crazy.provider.status !== "unavailable", crazyComplete, false, observedAt, droppedOpenrouterPrices)));
  const comparable = rows.filter(row => row.status === "comparable").length;
  const paged = rows.slice(input.offset, input.offset + input.limit);
  return priceComparisonOutputSchema.parse({
    status: crazy.provider.status === "unavailable" && openrouter.source.status === "unavailable" ? "error" : crazy.provider.status !== "available" || crazy.provider.population.completeness !== "full" || openrouter.source.status !== "available" ? "partial" : "ok",
    summary: `${comparable} of ${rows.length} retained comparison rows are independently comparable; ${paged.length} rows returned. Every comparable row carries all matching price points and conditions; incompatible units or conditions are refused.`,
    observedAt,
    sources: { crazyrouter: crazy.provider, openrouter: openrouter.source },
    rows: paged,
    population: { acquiredCrazyrouterRows: crazy.provider.population.received, retainedCrazyrouterRows: crazy.provider.population.retained, openrouterReceivedRows: openrouter.source.received, excludedByUserFilter: crazy.models.length - selectedModels.length, missingRequestedIds: crazyComplete ? requestedNotObserved : [], beforePagination: rows.length, returned: paged.length, comparableBeforePagination: comparable, offset: input.offset, limit: input.limit, nextOffset: input.offset + paged.length < rows.length ? input.offset + paged.length : null, filterRule: selected ? "exact Crazyrouter native id allowlist; missing requested ids retained explicitly" : "all acquired Crazyrouter identities, including unpriced and unmatched", platformPopulationEstablished: false },
    vendorClaim: { text: "Pay-as-you-go pricing: 20–50% cheaper than official provider rates on most models", attribution: "Crazyrouter Team", sourceUrl: "https://crazyrouter.com/en/blog/openrouter-vs-crazyrouter-ai-api-router-comparison-2026", publishedAt: "2026-03-01", observedAt: "2026-09-08", scope: "Vendor claim versus official provider rates on most models; not a universal guarantee or an OpenRouter-specific comparison.", globalAssessment: "not_established" },
    warnings: [...(crazyComplete || requestedNotObserved.length === 0 ? [] : [`${requestedNotObserved.length} requested id${requestedNotObserved.length === 1 ? "" : "s"} ${requestedNotObserved.length === 1 ? "was" : "were"} not found in an INCOMPLETE Crazyrouter catalogue, so missingRequestedIds is empty rather than listing them: not reading a page is not evidence a model is absent from it.`]), ...(droppedOpenrouterPrices.length === 0 ? [] : [`${droppedOpenrouterPrices.length} OpenRouter native price${droppedOpenrouterPrices.length === 1 ? "" : "s"} could not be represented and ${droppedOpenrouterPrices.length === 1 ? "was" : "were"} omitted from the comparison baseline: ${[...new Set(droppedOpenrouterPrices)].join(", ")}. A comparison missing a baseline point is narrower than it looks.`]), "Overall status describes source acquisition and token-visible catalogue completeness, not universal price coverage; each row carries its own comparison status.", "Join uses explicit author namespace and exact API alias only; immutable snapshot and deployment equivalence are not established.", "Every comparison is basis-bound and refuses incompatible units or conditions rather than coercing them."]
  });
}

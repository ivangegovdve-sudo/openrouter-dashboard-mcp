import { z } from "zod";
import { collectCrazyrouterCatalogue, crazyrouterIdentity, type CollectCrazyrouterOptions, type CrazyrouterIdentity } from "./crazyrouter.js";
import { exactDecimalRatio, normalizeExactPrice } from "./decimal.js";
import { parseNativeJson } from "./json.js";
import { record, type NativeRecord } from "./normalize.js";
import { catalogueProviderSchema, exactPriceSchema, type CatalogueModel, type ExactPrice } from "./schemas.js";

export const OPENROUTER_COMPARISON_URL = "https://openrouter.ai/api/v1/models?output_modalities=all";
export const priceComparisonInputSchema = z.object({
  modelIds: z.array(z.string().min(1)).min(1).max(20).optional(),
  offset: z.number().int().min(0).max(20000).default(0),
  limit: z.number().int().min(1).max(500).default(50),
}).strict();
const rationalSchema = z.object({ numerator: z.string().regex(/^-?\d+$/), denominator: z.string().regex(/^[1-9]\d*$/), value: z.string().regex(/^-?\d+(?:\.\d+)?$/).optional() }).strict();
const legSchema = z.object({ status: z.enum(["comparable", "not_comparable"]),
  direction: z.enum(["cheaper", "equal", "more_expensive"]).optional(), savingsPercent: rationalSchema.optional(), reason: z.string().optional(),
  crazyrouterPrice: exactPriceSchema.nullable(), baselinePrice: exactPriceSchema.nullable(),
}).strict();
const identitySchema = z.object({ exactModelAlias: z.string(), authorNamespace: z.string().optional(), nativeVendorName: z.string().nullable(), nativeOwner: z.string().nullable(), basis: z.string(), snapshotEquivalence: z.literal("not_established") }).strict();
const rowSchema = z.object({ id: z.string(), status: z.enum(["comparable", "price_not_available", "openrouter_model_not_found", "identity_not_established", "source_unavailable", "crazyrouter_model_not_observed"]), reason: z.string().optional(),
  identity: identitySchema,
  crazyrouter: z.object({ id: z.string(), pricingStatus: z.enum(["available", "price_not_available"]), reason: z.string().optional(), prices: z.array(exactPriceSchema), sourceUrl: z.string().url(), observedAt: z.string().datetime({ offset: true }), sourceIndex: z.number().int().nonnegative() }).strict().nullable(),
  openrouter: z.object({ id: z.string(), canonicalSlug: z.string().nullable(), prices: z.array(exactPriceSchema), sourceUrl: z.string().url(), observedAt: z.string().datetime({ offset: true }) }).strict().nullable(),
  comparisons: z.object({ input: legSchema, output: legSchema }).strict(),
  directProvider: z.object({ provider: z.literal("openai"), modelAlias: z.string(), basis: z.literal("dated_published_reference_not_live"), observedAt: z.string().date(), sourceUrl: z.string().url(), input: exactPriceSchema, output: exactPriceSchema }).strict().nullable(),
  claimAssessment: z.object({ status: z.enum(["within_range_for_this_model", "outside_range_for_this_model", "not_comparable"]), explanation: z.string(), input: legSchema, output: legSchema }).strict(),
}).strict();
const openrouterSourceSchema = z.object({ status: z.enum(["available", "unavailable"]), sourceUrl: z.string().url(), observedAt: z.string().datetime({ offset: true }), received: z.number().int().nonnegative().nullable(), error: z.string().optional(), scope: z.literal("public_models_output_modalities_all"), requestParameters: z.record(z.string(), z.unknown()) }).strict();
export const priceComparisonOutputSchema = z.object({
  status: z.enum(["ok", "partial", "error"]), summary: z.string(), observedAt: z.string().datetime({ offset: true }),
  sources: z.object({ crazyrouter: catalogueProviderSchema, openrouter: openrouterSourceSchema }).strict(),
  rows: z.array(rowSchema),
  population: z.object({ acquiredCrazyrouterRows: z.number().int().nonnegative().nullable(), retainedCrazyrouterRows: z.number().int().nonnegative().nullable(), openrouterReceivedRows: z.number().int().nonnegative().nullable(),
    excludedByUserFilter: z.number().int().nonnegative(), missingRequestedIds: z.array(z.string()), beforePagination: z.number().int().nonnegative(), returned: z.number().int().nonnegative(),
    comparableBeforePagination: z.number().int().nonnegative(), offset: z.number().int().nonnegative(), limit: z.number().int().positive(), nextOffset: z.number().int().nonnegative().nullable(),
    filterRule: z.string(), platformPopulationEstablished: z.literal(false) }).strict(),
  vendorClaim: z.object({ text: z.string(), attribution: z.literal("Crazyrouter Team"), sourceUrl: z.string().url(), publishedAt: z.string().date(), observedAt: z.string().date(),
    scope: z.string(), globalAssessment: z.literal("not_established") }).strict(),
  contradictions: z.array(z.object({ modelId: z.string(), sourceUrl: z.string().url(), observedAt: z.string().date(), sourceReviewedAt: z.string().date(),
    statement: z.string(), currentInputUsdPerMillion: z.string(), currentOutputUsdPerMillion: z.string(), assessment: z.literal("published_landing_price_differs_from_current_public_quote") }).strict()),
  warnings: z.array(z.string()),
}).strict();
export type PriceComparisonInput = z.input<typeof priceComparisonInputSchema>;
export type PriceComparisonOutput = z.infer<typeof priceComparisonOutputSchema>;
export type PriceComparisonDependencies = Omit<CollectCrazyrouterOptions, "group">;
type ComparisonLeg = z.infer<typeof legSchema>;
type ComparisonRow = z.infer<typeof rowSchema>;
class ComparisonSourceError extends Error {}
async function openrouterSource(fetchImpl: typeof fetch, timeout: number, observedAt: string): Promise<{ source: z.infer<typeof openrouterSourceSchema>; rows: NativeRecord[] }> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
  const requestParameters: Record<string, unknown> = { output_modalities: "all", modelFilter: "none", priceFilter: "none", receivedRows: null, sourceListedCount: null, excludedCount: null, exclusionRules: [],
    denominatorBasis: "documented unpaginated response data.length", sourceDocumentation: "https://openrouter.ai/docs/api/api-reference/models/get-models" };
  try {
    const response = await fetchImpl(OPENROUTER_COMPARISON_URL, { method: "GET", redirect: "error", signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new ComparisonSourceError(`HTTP_${response.status}`);
    if (!response.body) throw new ComparisonSourceError("EMPTY_RESPONSE_BODY");
    const reader = response.body.getReader(), decoder = new TextDecoder(); let bytes = 0, text = "";
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 12 * 1024 * 1024) { await reader.cancel(); throw new ComparisonSourceError("RESPONSE_SIZE_LIMIT"); }
      text += decoder.decode(value, { stream: true });
    }
    const payload = record(parseNativeJson(text + decoder.decode()));
    if (!Array.isArray(payload.data) || payload.success === false || payload.data.length > 20000 || payload.data.some(raw => typeof record(raw).id !== "string" || !record(raw).id)) throw new ComparisonSourceError("MODELS_SHAPE_CHANGED");
    if (payload.has_more === true || payload.next_cursor || (payload.total !== undefined && String(payload.total) !== String(payload.data.length))) throw new ComparisonSourceError("UNEXPECTED_PAGINATION_OR_TOTAL");
    requestParameters.receivedRows = payload.data.length; requestParameters.sourceListedCount = payload.data.length; requestParameters.excludedCount = 0;
    return { source: { status: "available", sourceUrl: OPENROUTER_COMPARISON_URL, observedAt, received: payload.data.length, scope: "public_models_output_modalities_all", requestParameters }, rows: payload.data as NativeRecord[] };
  } catch (error) {
    return { source: { status: "unavailable", sourceUrl: OPENROUTER_COMPARISON_URL, observedAt, received: null, scope: "public_models_output_modalities_all",
      error: controller.signal.aborted ? "SOURCE_TIMEOUT" : error instanceof ComparisonSourceError ? error.message : "SOURCE_FETCH_OR_SHAPE_FAILED", requestParameters }, rows: [] };
  } finally { clearTimeout(timer); }
}
function priceLeg(prices: ExactPrice[], unit: ExactPrice["unit"]): ExactPrice | null {
  const matches = prices.filter(price => price.unit === unit); return matches.length === 1 ? matches[0]! : null;
}
function comparison(price: ExactPrice | null, baseline: ExactPrice | null): ComparisonLeg {
  if (!price || !baseline) return { status: "not_comparable", reason: "price_not_available", crazyrouterPrice: price, baselinePrice: baseline };
  const n = BigInt(price.exact.numerator), d = BigInt(price.exact.denominator), bn = BigInt(baseline.exact.numerator), bd = BigInt(baseline.exact.denominator);
  if (bn === 0n) return { status: "not_comparable", reason: "zero_baseline", crazyrouterPrice: price, baselinePrice: baseline };
  const difference = bn * d - n * bd;
  const ratio = exactDecimalRatio(String(difference < 0n ? -difference : difference), "100", String(bn * d));
  const savingsPercent = difference < 0n ? { ...ratio, numerator: `-${ratio.numerator}`, ...(ratio.value === undefined ? {} : { value: `-${ratio.value}` }) } : ratio;
  return { status: "comparable", direction: difference > 0n ? "cheaper" : difference < 0n ? "more_expensive" : "equal", savingsPercent, crazyrouterPrice: price, baselinePrice: baseline };
}
function openrouterPrices(row: NativeRecord): ExactPrice[] {
  const native = record(row.pricing), prices: ExactPrice[] = [];
  for (const [field, unit] of [["prompt", "usd_per_input_token"], ["completion", "usd_per_output_token"]] as const) {
    if (typeof native[field] !== "string") continue;
    try { prices.push(normalizeExactPrice({ value: native[field], nativeUnit: unit, sourceField: `pricing.${field}`, unit, sourceUrl: OPENROUTER_COMPARISON_URL,
      conditions: { currency: "USD", basis: "public_catalogue_base_token_price", excludes: ["cache token categories", "tool or search fees", "account-specific billing adjustments"] } })); }
    catch { /* Missing or unsupported native prices stay unknown, including -1. */ }
  }
  return prices;
}
const directReferences: Record<string, [string, string]> = { "gpt-4o": ["2.5", "10"], "gpt-4o-mini": ["0.15", "0.6"], "gpt-4.1": ["2", "8"] };
function directReference(identity: CrazyrouterIdentity): ComparisonRow["directProvider"] {
  if (identity.authorNamespace !== "openai" || !Object.hasOwn(directReferences, identity.exactModelAlias)) return null;
  const [input, output] = directReferences[identity.exactModelAlias]!, sourceUrl = `https://developers.openai.com/api/docs/models/${identity.exactModelAlias}`;
  const price = (value: string, unit: ExactPrice["unit"]) => normalizeExactPrice({ value, nativeUnit: "usd_per_million_tokens", sourceField: unit === "usd_per_input_token" ? "Text tokens.Input" : "Text tokens.Output", unit, divisor: "1000000", sourceUrl,
    conditions: { currency: "USD", basis: "dated_published_reference_not_live", observedAt: "2026-09-08", pricingTier: "standard_uncached_text_tokens" } });
  return { provider: "openai", modelAlias: identity.exactModelAlias, basis: "dated_published_reference_not_live", observedAt: "2026-09-08", sourceUrl,
    input: price(input, "usd_per_input_token"), output: price(output, "usd_per_output_token") };
}
const inClaimRange = (leg: ComparisonLeg) => leg.savingsPercent !== undefined && BigInt(leg.savingsPercent.numerator) >= 20n * BigInt(leg.savingsPercent.denominator) && BigInt(leg.savingsPercent.numerator) <= 50n * BigInt(leg.savingsPercent.denominator);
function rowFor(id: string, model: CatalogueModel | undefined, orById: Map<string, NativeRecord[]>, orAvailable: boolean, crazyAvailable: boolean, duplicateCrazy: boolean, observedAt: string): ComparisonRow {
  const identity: CrazyrouterIdentity = model ? crazyrouterIdentity(model) : { exactModelAlias: id, nativeOwner: null, nativeVendorName: null, basis: "model_not_observed", snapshotEquivalence: "not_established" };
  const expectedId = identity.authorNamespace ? `${identity.authorNamespace}/${identity.exactModelAlias}` : undefined;
  const matches = expectedId ? orById.get(expectedId) ?? [] : [];
  const matched = matches.length === 1 && !duplicateCrazy ? matches[0] : undefined;
  const nativePrices = matched ? openrouterPrices(matched) : [], crazyPrices = model?.pricing.prices ?? [];
  const inputPrice = priceLeg(crazyPrices, "usd_per_input_token"), outputPrice = priceLeg(crazyPrices, "usd_per_output_token");
  const comparisons = { input: comparison(inputPrice, priceLeg(nativePrices, "usd_per_input_token")), output: comparison(outputPrice, priceLeg(nativePrices, "usd_per_output_token")) };
  let status: ComparisonRow["status"] = "comparable", reason: string | undefined;
  if (!crazyAvailable || !orAvailable) { status = "source_unavailable"; reason = "source_acquisition_failed_not_model_absence"; }
  else if (!model) status = "crazyrouter_model_not_observed";
  else if (!identity.authorNamespace || matches.length > 1 || duplicateCrazy) { status = "identity_not_established"; reason = matches.length > 1 || duplicateCrazy ? "ambiguous_native_identity" : identity.basis; }
  else if (!matched) status = "openrouter_model_not_found";
  else if (comparisons.input.status !== "comparable" || comparisons.output.status !== "comparable") status = "price_not_available";
  const directProvider = duplicateCrazy ? null : directReference(identity);
  const claimInput = comparison(inputPrice, directProvider?.input ?? null), claimOutput = comparison(outputPrice, directProvider?.output ?? null);
  const directComparable = claimInput.status === "comparable" && claimOutput.status === "comparable";
  const claimStatus = !directComparable ? "not_comparable" : inClaimRange(claimInput) && inClaimRange(claimOutput) ? "within_range_for_this_model" : "outside_range_for_this_model";
  return { id, status, ...(reason ? { reason } : {}), identity,
    crazyrouter: model ? { id: model.id, pricingStatus: model.pricing.status, ...(model.pricing.reason ? { reason: model.pricing.reason } : {}), prices: crazyPrices, ...model.provenance } : null,
    openrouter: matched ? { id: String(matched.id), canonicalSlug: typeof matched.canonical_slug === "string" ? matched.canonical_slug : null, prices: nativePrices, sourceUrl: OPENROUTER_COMPARISON_URL, observedAt } : null,
    comparisons, directProvider, claimAssessment: { status: claimStatus, explanation: "Assesses these two base-token legs against a dated direct-provider reference. A result for one alias does not establish or disprove the vendor's most-models claim, and does not verify deployment or snapshot equivalence.", input: claimInput, output: claimOutput } };
}

export async function runPriceComparison(rawInput: PriceComparisonInput, dependencies: PriceComparisonDependencies = {}): Promise<PriceComparisonOutput> {
  const input = priceComparisonInputSchema.parse(rawInput), observedAt = (dependencies.now ?? (() => new Date()))().toISOString();
  const [crazy, openrouter] = await Promise.all([collectCrazyrouterCatalogue(dependencies), openrouterSource(dependencies.fetchImpl ?? fetch, Math.min(30000, Math.max(1, dependencies.timeoutMs ?? 10000)), observedAt)]);
  const selected = input.modelIds ? new Set(input.modelIds) : undefined, selectedModels = crazy.models.filter(model => !selected || selected.has(model.id));
  const identityCounts = new Map<string, number>(), orById = new Map<string, NativeRecord[]>();
  for (const model of crazy.models) identityCounts.set(model.id, (identityCounts.get(model.id) ?? 0) + 1);
  for (const row of openrouter.rows) { const id = String(row.id), matches = orById.get(id) ?? []; matches.push(row); orById.set(id, matches); }
  const requestedNotObserved = [...(selected ?? [])].filter(id => !identityCounts.has(id));
  const missingRequestedIds = crazy.provider.status === "unavailable" ? [] : requestedNotObserved;
  const rows = selectedModels.map(model => rowFor(model.id, model, orById, openrouter.source.status === "available", crazy.provider.status !== "unavailable", identityCounts.get(model.id)! > 1, observedAt));
  rows.push(...requestedNotObserved.map(id => rowFor(id, undefined, orById, openrouter.source.status === "available", crazy.provider.status !== "unavailable", false, observedAt)));
  const comparable = rows.filter(row => row.status === "comparable").length, paged = rows.slice(input.offset, input.offset + input.limit);
  const contradictions: PriceComparisonOutput["contradictions"] = [];
  const mini = selectedModels.find(model => model.id === "gpt-5-mini");
  if (mini && crazyrouterIdentity(mini).authorNamespace === "openai") {
    const prices = mini.pricing.prices, p = priceLeg(prices, "usd_per_input_token"), c = priceLeg(prices, "usd_per_output_token");
    if (p?.value && c?.value) {
      const prompt = exactDecimalRatio(p.value, "1000000").value!, completion = exactDecimalRatio(c.value, "1000000").value!;
      if (prompt !== "0.14" || completion !== "1.1") contradictions.push({ modelId: mini.id, sourceUrl: "https://crazyrouter.com/models/gpt-5-mini", observedAt: "2026-09-08", sourceReviewedAt: "2026-03-12",
        statement: "The model landing page advertises 45% off and USD 0.14 input / 1.10 output per million tokens; its exact gpt-5-mini alias differs from the current public default-group quote.",
        currentInputUsdPerMillion: prompt, currentOutputUsdPerMillion: completion, assessment: "published_landing_price_differs_from_current_public_quote" });
    }
  }
  return priceComparisonOutputSchema.parse({ status: crazy.provider.status === "unavailable" && openrouter.source.status === "unavailable" ? "error" : crazy.provider.status !== "available" || crazy.provider.population.completeness !== "full" || openrouter.source.status !== "available" ? "partial" : "ok",
    summary: `${comparable} of ${rows.length} retained comparison rows have both input and output prices; ${paged.length} rows returned. Public quotes do not establish account charges or identical model snapshots.`, observedAt,
    sources: { crazyrouter: crazy.provider, openrouter: openrouter.source }, rows: paged,
    population: { acquiredCrazyrouterRows: crazy.provider.population.received, retainedCrazyrouterRows: crazy.provider.population.retained, openrouterReceivedRows: openrouter.source.received,
      excludedByUserFilter: crazy.models.length - selectedModels.length, missingRequestedIds, beforePagination: rows.length, returned: paged.length, comparableBeforePagination: comparable,
      offset: input.offset, limit: input.limit, nextOffset: input.offset + paged.length < rows.length ? input.offset + paged.length : null,
      filterRule: selected ? "exact Crazyrouter native id allowlist; missing requested ids retained explicitly" : "all acquired Crazyrouter identities, including unpriced and unmatched", platformPopulationEstablished: false },
    vendorClaim: { text: "Pay-as-you-go pricing: 20–50% cheaper than official provider rates on most models", attribution: "Crazyrouter Team", sourceUrl: "https://crazyrouter.com/en/blog/openrouter-vs-crazyrouter-ai-api-router-comparison-2026", publishedAt: "2026-03-01", observedAt: "2026-09-08", scope: "Vendor claim versus official provider rates on most models; not a universal guarantee or an OpenRouter-specific comparison.", globalAssessment: "not_established" },
    contradictions, warnings: ["Overall status describes source acquisition and token-visible catalogue completeness, not universal price coverage; each row carries its own comparison status.", "Join uses explicit author namespace and exact API alias only; immutable snapshot and deployment equivalence are not established.", "OpenRouter and Crazyrouter prices are public base-token quotes; cache, tool fees and account-specific adjustments are excluded.", "Direct-provider baselines are three dated published references, not freshly fetched prices. Other direct baselines remain unknown."] });
}

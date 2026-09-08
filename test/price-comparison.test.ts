import assert from "node:assert/strict";
import test from "node:test";
const now = () => new Date("2026-09-08T16:30:00.000Z");
async function module() {
  try { return await import("../src/catalogue/compare.js"); }
  catch (error) { assert.fail(`Price comparison must load: ${String(error)}`); }
}
function sources(args: { ids?: string[]; rows?: unknown[]; openrouter?: unknown[]; failOpenrouter?: boolean } = {}): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    assert.equal(init?.method, "GET");
    assert.equal(init?.redirect, "error");
    if (url === "https://api.crazyrouter.com/v1/models") return Response.json({ success: true, object: "list", data: (args.ids ?? ["gpt-4o"]).map(id => ({ id, owned_by: "openai" })) });
    if (url === "https://crazyrouter.com/api/pricing") return Response.json({ success: true, data: args.rows ?? [crazy("gpt-4o")], group_ratio: { default: 1 }, vendors: [{ id: 4, name: "OpenAI" }] });
    assert.equal(url, "https://openrouter.ai/api/v1/models?output_modalities=all");
    assert.equal(new Headers(init?.headers).get("Authorization"), null);
    return args.failOpenrouter ? new Response("credential-reflected-error", { status: 503 }) : Response.json({ data: args.openrouter ?? [or("openai/gpt-4o")] });
  };
}
const crazy = (id: string, overrides: Record<string, unknown> = {}) => ({ model_name: id, quota_type: 0, model_ratio: 1.25, completion_ratio: 4, discount: 0.65, enable_groups: ["default"], vendor_id: 4, ...overrides });
const or = (id: string, prompt = "0.0000025", completion = "0.00001") => ({ id, canonical_slug: `${id}-snapshot`, pricing: { prompt, completion } });

test("price comparison calculates exact input/output savings for an independently quoted alias", async () => {
  const { runPriceComparison, priceComparisonOutputSchema } = await module();
  const result = await runPriceComparison({}, { apiKey: "synthetic-key", now,
    fetchImpl: sources({ ids: ["gpt-5-mini"], rows: [crazy("gpt-5-mini", { model_ratio: 0.125, completion_ratio: 8 })], openrouter: [or("openai/gpt-5-mini", "0.00000025", "0.000002")] }) });
  priceComparisonOutputSchema.parse(result);
  assert.equal(result.status, "ok");
  assert.equal(result.rows[0]?.openrouter?.canonicalSlug, "openai/gpt-5-mini-snapshot");
  assert.equal(result.rows[0]?.identity.snapshotEquivalence, "not_established");
  assert.equal(result.rows[0]?.comparisons.input.direction, "cheaper");
  assert.deepEqual(result.rows[0]?.comparisons.input.savingsPercent, { numerator: "35", denominator: "1", value: "35" });
  assert.deepEqual(result.rows[0]?.comparisons.output.savingsPercent, { numerator: "35", denominator: "1", value: "35" });
  assert.equal(result.rows[0]?.directProvider, null);
  assert.equal(result.rows[0]?.claimAssessment.status, "not_comparable");
  assert.equal(result.vendorClaim.globalAssessment, "not_established");
});

test("price comparison excludes Crazyrouter prices derived from OpenAI list prices", async () => {
  const { runPriceComparison, priceComparisonOutputSchema } = await module();
  const result = await runPriceComparison({}, { apiKey: "synthetic-key", now, fetchImpl: sources() });
  priceComparisonOutputSchema.parse(result);
  const row = result.rows[0]!;
  assert.equal(row.status, "price_derived_not_comparable");
  assert.equal(row.comparisons.input.status, "not_comparable");
  assert.equal(row.comparisons.input.reason, "crazyrouter_price_derived_from_direct_provider_reference");
  assert.equal(row.comparisons.input.baselinePrice, null);
  assert.equal(row.comparisons.output.status, "not_comparable");
  assert.equal(row.claimAssessment.status, "not_comparable");
  assert.equal(row.crazyrouter?.prices[0]?.provenance?.basis, "derived");
  assert.equal(row.crazyrouter?.prices[0]?.provenance?.observedMultiplier, "0.65");
  assert.equal(result.population.comparableBeforePagination, 0);
  assert.doesNotMatch(JSON.stringify(result), /35% lower|savingsPercent/);
});

test("price comparison reports a scoped contradiction without converting most-models marketing into a universal guarantee", async () => {
  const { runPriceComparison } = await module();
  const result = await runPriceComparison({}, { apiKey: "synthetic-key", now, fetchImpl: sources({ rows: [crazy("gpt-4o", { discount: 1.1 })] }) });
  assert.equal(result.rows[0]?.comparisons.input.direction, "more_expensive");
  assert.deepEqual(result.rows[0]?.comparisons.input.savingsPercent, { numerator: "-10", denominator: "1", value: "-10" });
  assert.equal(result.rows[0]?.claimAssessment.status, "outside_range_for_this_model");
  assert.match(result.rows[0]?.claimAssessment.explanation ?? "", /does not establish/i);
});

test("price comparison retains unpriced and unmatched rows including suffix near misses", async () => {
  const { runPriceComparison } = await module();
  const ids = ["gpt-4o", "unpriced", "near-match", "gpt-4o:free"];
  const result = await runPriceComparison({}, { apiKey: "synthetic-key", now, fetchImpl: sources({ ids, rows: [crazy("gpt-4o"), crazy("near-match"), crazy("gpt-4o:free")], openrouter: [or("openai/gpt-4o"), or("openai/unpriced"), or("openai/near_match")] }) });
  assert.deepEqual(result.rows.map(row => row.id), ids);
  assert.deepEqual(result.rows.map(row => row.status), ["price_derived_not_comparable", "price_not_available", "openrouter_model_not_found", "openrouter_model_not_found"]);
  assert.equal(result.population.acquiredCrazyrouterRows, 4);
  assert.equal(result.population.beforePagination, 4);
});

test("price comparison preserves exact subcent native prices and rejects zero denominators", async () => {
  const { runPriceComparison } = await module();
  const result = await runPriceComparison({}, { apiKey: "synthetic-key", now, fetchImpl: sources({ rows: [crazy("gpt-4o", { model_ratio: "0.000000000000000000001", completion_ratio: 1, discount: 1 })], openrouter: [or("openai/gpt-4o", "0.000000000000000000000000003", "0")] }) });
  assert.equal(result.rows[0]?.comparisons.input.savingsPercent?.numerator, "100");
  assert.equal(result.rows[0]?.comparisons.input.savingsPercent?.denominator, "3");
  assert.equal(result.rows[0]?.comparisons.input.savingsPercent?.value, undefined);
  assert.equal(result.rows[0]?.comparisons.output.status, "not_comparable");
  assert.equal(result.rows[0]?.comparisons.output.reason, "zero_baseline");
});

test("price comparison separates failed OpenRouter acquisition from absent models", async () => {
  const { runPriceComparison } = await module();
  const result = await runPriceComparison({}, { apiKey: "synthetic-key", now, fetchImpl: sources({ failOpenrouter: true }) });
  assert.equal(result.status, "partial");
  assert.equal(result.sources.openrouter.status, "unavailable");
  assert.equal(result.sources.openrouter.received, null);
  assert.equal(result.rows[0]?.status, "source_unavailable");
  assert.doesNotMatch(JSON.stringify(result), /synthetic-key|credential-reflected-error/);
});

test("price comparison pagination retains full denominators and explicitly returns missing requested ids", async () => {
  const { runPriceComparison } = await module();
  const result = await runPriceComparison({ modelIds: ["gpt-4o", "missing"], offset: 1, limit: 1 }, { apiKey: "synthetic-key", now, fetchImpl: sources({ ids: ["gpt-4o", "other"] }) });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0]?.id, "missing");
  assert.equal(result.rows[0]?.status, "crazyrouter_model_not_observed");
  assert.equal(result.population.acquiredCrazyrouterRows, 2);
  assert.equal(result.population.excludedByUserFilter, 1);
  assert.equal(result.population.beforePagination, 2);
  assert.equal(result.population.returned, 1);
});

test("price comparison refuses conflicting vendor evidence and ambiguous OpenRouter ids", async () => {
  const { runPriceComparison } = await module();
  const conflictFetch = sources();
  const result = await runPriceComparison({}, { apiKey: "synthetic-key", now, fetchImpl: async (input, init) => String(input) === "https://api.crazyrouter.com/v1/models"
    ? Response.json({ success: true, object: "list", data: [{ id: "gpt-4o", owned_by: "anthropic" }] }) : conflictFetch(input, init) });
  assert.equal(result.rows[0]?.status, "identity_not_established");
  const duplicate = await runPriceComparison({}, { apiKey: "synthetic-key", now, fetchImpl: sources({ openrouter: [or("openai/gpt-4o"), or("openai/gpt-4o")] }) });
  assert.equal(duplicate.rows[0]?.status, "identity_not_established");
});

test("price comparison exposes the exact-alias landing-price discrepancy", async () => {
  const { runPriceComparison } = await module();
  const result = await runPriceComparison({}, { apiKey: "synthetic-key", now, fetchImpl: sources({ ids: ["gpt-5-mini"], rows: [crazy("gpt-5-mini", { model_ratio: 0.125, completion_ratio: 8 })], openrouter: [or("openai/gpt-5-mini", "0.00000025", "0.000002")] }) });
  assert.equal(result.contradictions[0]?.modelId, "gpt-5-mini");
  assert.equal(result.contradictions[0]?.currentInputUsdPerMillion, "0.1625");
  assert.equal(result.contradictions[0]?.currentOutputUsdPerMillion, "1.3");
  assert.equal(result.rows[0]?.directProvider, null);
});

test("price comparison does not call an unauthenticated pricing subset full or failed acquisition missing ids", async () => {
  const { runPriceComparison } = await module();
  const partial = await runPriceComparison({}, { apiKey: null, now, fetchImpl: sources() });
  assert.equal(partial.status, "partial");
  assert.equal(partial.sources.openrouter.requestParameters.output_modalities, "all");
  assert.equal(partial.sources.openrouter.requestParameters.receivedRows, 1);
  const fetchImpl = sources();
  const failed = await runPriceComparison({ modelIds: ["gpt-4o"] }, { apiKey: "synthetic-key", now, fetchImpl: async (url, init) => String(url) === "https://api.crazyrouter.com/v1/models" ? new Response("rejected", { status: 401 }) : fetchImpl(url, init) });
  assert.equal(failed.rows[0]?.status, "source_unavailable");
  assert.deepEqual(failed.population.missingRequestedIds, []);
});

import assert from "node:assert/strict";
import test from "node:test";
import { catalogueModelSchema, catalogueProviderSchema } from "../src/catalogue/schemas.js";

const modelsUrl = "https://api.crazyrouter.com/v1/models";
const pricingUrl = "https://crazyrouter.com/api/pricing";
const now = () => new Date("2026-09-08T16:00:00.000Z");
async function collector() {
  try { return (await import("../src/catalogue/crazyrouter.js")).collectCrazyrouterCatalogue; }
  catch (error) { assert.fail(`Crazyrouter collector must load: ${String(error)}`); }
}
function list(ids: unknown[]) {
  return JSON.stringify({ success: true, object: "list", data: ids.map(id => ({ id, object: "model", owned_by: "openai" })) });
}
function tokenRow(model_name: string, extra: Record<string, unknown> = {}) {
  return { model_name, vendor_id: 4, quota_type: 0, model_ratio: 1.25, completion_ratio: 4, model_price: 0,
    discount: 0.65, enable_groups: ["default"], public_endpoint_types: ["openai"], ...extra };
}
function pricing(rows: unknown[], extra: Record<string, unknown> = {}) {
  return JSON.stringify({ success: true, data: rows, group_ratio: { default: 1 }, vendors: [{ id: 4, name: "OpenAI" }], ...extra });
}
function source(models: string, prices: string, requests: Array<{ url: string; init?: RequestInit }> = []): typeof fetch {
  return async (input, init) => {
    const url = String(input); requests.push({ url, init });
    assert.equal(init?.method, "GET");
    assert.equal(init?.redirect, "error");
    assert.ok(url === modelsUrl || url === pricingUrl, "credentials and catalogue calls must stay on fixed source URLs");
    return new Response(url === modelsUrl ? models : prices, { headers: { "Content-Type": "application/json" } });
  };
}

test("Crazyrouter retains every key-visible identity even when price metadata is absent", async () => {
  const collect = await collector();
  const result = await collect({ apiKey: "synthetic-key", now,
    fetchImpl: source(list(["gpt-4o", "unpriced", "near-match"]), pricing([tokenRow("gpt-4o"), tokenRow("near_match")])) });
  catalogueProviderSchema.parse(result.provider);
  result.models.forEach(model => catalogueModelSchema.parse(model));
  assert.deepEqual(result.models.map(model => model.id), ["gpt-4o", "unpriced", "near-match"]);
  assert.deepEqual(result.provider.population, { listed: 3, received: 3, retained: 3, excluded: 0, exclusionRules: [], completeness: "full" });
  assert.equal(result.provider.requestParameters.populationScope, "models_visible_to_current_api_key");
  assert.equal(result.provider.requestParameters.platformModelCount, null);
  assert.equal(result.models[1]?.pricingState, "unknown");
  assert.equal(result.models[2]?.pricingState, "unknown", "no approximate model-name join");
  const prices = result.models[0]!.pricePoints;
  assert.deepEqual(prices.map(price => [price.unit, price.amount]), [
    ["token_in", "0.000001625"], ["token_out", "0.0000065"],
  ]);
  assert.equal(prices[0]!.provenance, "derived");
  assert.equal(prices[0]!.sourceText, "Crazyrouter model discount badge: 0.65");
  assert.equal(result.models[0]!.nativePricing?.pricingRow?.discount, "0.65");
});

test("Crazyrouter marks the exact OpenAI-rate aliases as derived prices", async () => {
  const collect = await collector();
  const result = await collect({ apiKey: "synthetic-key", now,
    fetchImpl: source(list(["gpt-4o", "other"]), pricing([tokenRow("gpt-4o"), tokenRow("other")])) });
  const derived = result.models[0]!.pricePoints;
  assert.deepEqual(derived.map(price => [price.provenance, price.derivedFrom]), [
    ["derived", "https://developers.openai.com/api/docs/models/gpt-4o"],
    ["derived", "https://developers.openai.com/api/docs/models/gpt-4o"],
  ]);
  assert.equal(result.models[1]!.pricePoints[0]!.provenance, "derived");
});

test("Crazyrouter preserves source decimal digits rather than rounding JSON numbers", async () => {
  const collect = await collector();
  const native = '{"success":true,"group_ratio":{"default":1},"data":[{"model_name":"exact","quota_type":0,"model_ratio":0.123456789012345678901,"completion_ratio":3,"discount":1,"enable_groups":["default"]}]}';
  const result = await collect({ apiKey: "synthetic-key", now, fetchImpl: source(list(["exact"]), native) });
  const prices = result.models[0]!.pricePoints;
  assert.equal(prices[0]!.amount, "0.000000246913578024691357802");
  assert.equal(prices[1]!.amount, "0.000000740740734074074073406");
  assert.equal(result.models[0]!.nativePricing?.pricingRow?.model_ratio, "0.123456789012345678901");
});

test("Crazyrouter does not apply plain token ratios to custom billing or unsupported groups", async () => {
  const collect = await collector();
  const rows = [
    tokenRow("tiered", { billing_mode: "tiered_expr", billing_expr: "tier('large',p*99+c*99)" }),
    tokenRow("separate-tier", { tiered_expr: "tier('large',p*99+c*99)" }),
    tokenRow("timed", { time_pricing: { peak: {}, off_peak: {} } }),
    tokenRow("image", { quota_type: 1, billing_mode: "per_image", model_price: 0.1 }),
    tokenRow("other-group", { enable_groups: ["vip"] }),
    tokenRow("invalid", { model_ratio: -1 }),
  ];
  const result = await collect({ apiKey: "synthetic-key", now, fetchImpl: source(list(rows.map(row => row.model_name)), pricing(rows)) });
  assert.equal(result.models.length, 6);
  assert.ok(result.models.every(model => model.pricePoints.length === 0 && model.pricingState === "unknown"));
  assert.equal(result.models[3]!.mediaKind, "image");
});

test("Crazyrouter keeps DeepSeek peak and off-peak hours on published price points", async () => {
  const collect = await collector();
  const result = await collect({ apiKey: "synthetic-key", now, fetchImpl: source(
    list(["deepseek/deepseek-v3"]),
    pricing([tokenRow("deepseek/deepseek-v3", {
      time_pricing: {
        peak: { input_per_million: "0.42", output_per_million: "1.68" },
        off_peak: { input_per_million: "0.21", output_per_million: "0.84" },
      },
    })]),
  ) });
  const points = result.models[0]!.pricePoints;
  assert.equal(points.length, 4);
  assert.ok(points.every(point => point.provenance === "published"));
  assert.deepEqual(points.map(point => [point.condition?.kind, point.condition?.name, point.condition?.timezone, point.condition?.hours]), [
    ["time_band", "off_peak", "Asia/Shanghai", ["00:00-09:00", "12:00-14:00", "18:00-24:00"]],
    ["time_band", "off_peak", "Asia/Shanghai", ["00:00-09:00", "12:00-14:00", "18:00-24:00"]],
    ["time_band", "peak", "Asia/Shanghai", ["09:00-12:00", "14:00-18:00"]],
    ["time_band", "peak", "Asia/Shanghai", ["09:00-12:00", "14:00-18:00"]],
  ]);
  assert.deepEqual(points.map(point => point.amount), ["0.00000021", "0.00000084", "0.00000042", "0.00000168"]);
});

test("Crazyrouter keeps pricing-source failure distinct from successful empty prices", async () => {
  const collect = await collector();
  const fetchImpl: typeof fetch = async input => String(input) === modelsUrl
    ? new Response(list(["retained"])) : new Response("private body must not leak", { status: 503 });
  const result = await collect({ apiKey: "synthetic-key", now, fetchImpl });
  assert.equal(result.provider.status, "partial");
  assert.equal(result.provider.population.completeness, "full", "identity acquisition succeeded independently");
  assert.equal(result.provider.requestParameters.pricingAcquisitionStatus, "unavailable");
  assert.equal(result.models[0]?.pricingNote, "pricing_source_unavailable");
  assert.doesNotMatch(JSON.stringify(result), /private body|synthetic-key/);
});

test("Crazyrouter authentication never travels to the public price host or errors", async () => {
  const collect = await collector();
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const result = await collect({ apiKey: "synthetic-key", now, fetchImpl: source(list(["x"]), pricing([]), requests) });
  assert.equal(new Headers(requests.find(request => request.url === modelsUrl)?.init?.headers).get("Authorization"), "Bearer synthetic-key");
  assert.equal(new Headers(requests.find(request => request.url === pricingUrl)?.init?.headers).get("Authorization"), null);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-key|Bearer/);
  let calls = 0;
  const failed = await collect({ apiKey: "synthetic-key", now, fetchImpl: async () => { calls++; return new Response("synthetic-key", { status: 401 }); } });
  assert.equal(calls, 1);
  assert.equal(failed.provider.status, "unavailable");
  assert.equal(failed.provider.requestParameters.authenticatedCatalogueStatus, "unavailable");
  assert.equal(failed.provider.population.received, null);
  assert.equal(failed.models.length, 0);
  assert.doesNotMatch(JSON.stringify(failed), /synthetic-key/);
});

test("Crazyrouter without a key reports only public-pricing scope without claiming a full platform catalogue", async () => {
  const collect = await collector();
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const result = await collect({ apiKey: null, now, fetchImpl: source("must not request", pricing([tokenRow("public")]), requests) });
  assert.deepEqual(requests.map(request => request.url), [pricingUrl]);
  assert.equal(result.provider.requestParameters.populationScope, "public_pricing_rows_only");
  assert.equal(result.provider.requestParameters.authenticatedCatalogueStatus, "not_configured");
  assert.equal(result.provider.population.completeness, "unknown");
  assert.equal(result.provider.population.listed, null);
  assert.equal(result.models[0]?.id, "public");
});

test("Crazyrouter rejects false success and exposes excluded malformed identities", async () => {
  const collect = await collector();
  const rejected = await collect({ apiKey: "synthetic-key", now, fetchImpl: source('{"success":false,"object":"list","data":[]}', pricing([])) });
  assert.equal(rejected.provider.status, "unavailable");
  const result = await collect({ apiKey: "synthetic-key", now, fetchImpl: source(list(["kept", null]), pricing([])) });
  assert.equal(result.provider.population.received, 2);
  assert.equal(result.provider.population.retained, 1);
  assert.equal(result.provider.population.excluded, 1);
  assert.equal(result.provider.population.completeness, "partial");
  assert.equal(result.provider.population.exclusionRules.length, 1);
});

test("Crazyrouter refuses duplicate pricing matches and missing conversion coefficients", async () => {
  const collect = await collector();
  const result = await collect({ apiKey: "synthetic-key", now, fetchImpl: source(list(["duplicate", "missing"]), pricing([
    tokenRow("duplicate"), tokenRow("duplicate", { model_ratio: 100 }),
    tokenRow("missing", { discount: undefined }),
  ])) });
  assert.equal(result.models[0]?.pricingNote, "ambiguous_public_pricing_identity");
  assert.equal(result.models[1]?.pricingState, "published");
});

test("Crazyrouter identity joins only explicit author namespaces and preserves the exact alias", async () => {
  const collect = await collector();
  const { crazyrouterIdentity } = await import("../src/catalogue/crazyrouter.js");
  assert.equal(typeof crazyrouterIdentity, "function");
  const result = await collect({ apiKey: "synthetic-key", now, fetchImpl: source(list(["gpt-4o", "No_Fuzzy-Alias"]), pricing([tokenRow("gpt-4o")])) });
  const identity = crazyrouterIdentity(result.models[0]!);
  assert.equal(identity.authorNamespace, "openai");
  assert.equal(identity.exactModelAlias, "gpt-4o");
  assert.equal(identity.snapshotEquivalence, "not_established");
  const unknown = structuredClone(result.models[1]!);
  unknown.nativePricing = { catalogueRow: { id: "No_Fuzzy-Alias", owned_by: "unknown" }, vendor: { name: "unmapped" } };
  assert.equal(crazyrouterIdentity(unknown).authorNamespace, undefined);
  assert.equal(crazyrouterIdentity(unknown).exactModelAlias, "No_Fuzzy-Alias");
  const conflict = structuredClone(result.models[0]!);
  (conflict.nativePricing as { catalogueRow: { owned_by: string } }).catalogueRow.owned_by = "anthropic";
  assert.equal(crazyrouterIdentity(conflict).authorNamespace, undefined);
});

test("Crazyrouter preserves declared larger totals without claiming the fetched rows are full", async () => {
  const collect = await collector();
  const payload = '{"success":true,"object":"list","total":9,"data":[{"id":"first"}],"has_more":true,"next_cursor":"next"}';
  const result = await collect({ apiKey: "synthetic-key", now, fetchImpl: source(payload, pricing([])) });
  assert.equal(result.provider.population.listed, 9);
  assert.equal(result.provider.population.received, 1);
  assert.equal(result.provider.population.retained, 1);
  assert.equal(result.provider.population.completeness, "partial");
});

test("Crazyrouter rejects a successful response that reflects the credential", async () => {
  const collect = await collector();
  const result = await collect({ apiKey: "synthetic-key", now, fetchImpl: source(list(["synthetic-key"]), pricing([])) });
  assert.equal(result.provider.status, "unavailable");
  assert.equal(result.models.length, 0);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-key/);
});

test("Crazyrouter never turns partial or malformed price acquisition into published price absence", async () => {
  const collect = await collector();
  for (const payload of [pricing([], { total: 5, has_more: true, next_cursor: "next" }), pricing([{ model_name: null }])]) {
    const result = await collect({ apiKey: "synthetic-key", now, fetchImpl: source(list(["kept"]), payload) });
    assert.equal(result.provider.status, "partial");
    assert.equal(result.provider.population.completeness, "full");
    assert.equal(result.provider.requestParameters.pricingAcquisitionStatus, "partial");
    assert.equal(result.models[0]?.pricingNote, "pricing_observation_incomplete");
  }
});

test("Crazyrouter vendor joins require unique explicit ids on both sides", async () => {
  const collect = await collector();
  const { crazyrouterIdentity } = await import("../src/catalogue/crazyrouter.js");
  for (const [row, vendors] of [
    [tokenRow("no-vendor", { vendor_id: undefined }), [{ name: "Google" }]],
    [tokenRow("no-vendor"), [{ id: 4, name: "Google" }, { id: 4, name: "OpenAI" }]],
  ] as const) {
    const result = await collect({ apiKey: null, now, fetchImpl: source("unused", pricing([row], { vendors })) });
    assert.equal(crazyrouterIdentity(result.models[0]!).authorNamespace, undefined);
  }
});

test("one unparseable time-band price cannot take down the whole catalogue", async () => {
  // WAS AN UNCAUGHT THROW. decimal()/perMillionToToken() reject a non-terminating source
  // value, and the time-band branch called them bare while the per-token branch beside it
  // wrapped identical calls in try. A single bad row from Crazyrouter therefore rejected
  // collectCrazyrouterCatalogue and returned no catalogue at all -- one bad row taking
  // down every model. A source we do not control must never be able to do that.
  const collect = await collector();
  const bad = tokenRow("banded", { time_pricing: { peak: { input: "1", output: "3" }, off_peak: { input: "1", output: "1/3" } } });
  const result: any = await collect({ apiKey: "synthetic-key", now,
    fetchImpl: source(list(["fine", "banded"]), pricing([tokenRow("fine"), bad])) });
  assert.deepEqual(result.models.map((model: any) => model.id).sort(), ["banded", "fine"], "both identities retained");
  const banded = result.models.find((model: any) => model.id === "banded");
  assert.deepEqual(banded.pricePoints, [], "no partial band price is published");
  assert.notEqual(banded.pricingState, "not_published", "unparseable is unknown, never a claim that no price exists");
  const fine = result.models.find((model: any) => model.id === "fine");
  assert.ok(fine.pricePoints.length > 0, "the healthy model beside it is still priced");
});

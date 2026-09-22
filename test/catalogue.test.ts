import test from "node:test";
import assert from "node:assert/strict";
import { collectMediaCatalogue, DEFAULT_WAVESPEED_ENRICH_IDS, parseNativeJson } from "../src/catalogue/index.js";
import { exactDecimalRatio } from "../src/catalogue/decimal.js";
import { normalizeDeepInfra, normalizeWaveSpeed, normalizeFal, normalizeChutes, parseFalPricingPage } from "../src/catalogue/normalize.js";
import { cataloguePricingSchema } from "../src/catalogue/schemas.js";
import { runCatalogue } from "../src/tools/catalogue.js";
import { normalizePricePoint } from "../src/catalogue/price-set.js";

const observedAt = "2026-09-08T15:00:00Z", sourceUrl = "https://example.test/catalogue";
const deep = (pricing: unknown, type = "text-to-image") => normalizeDeepInfra({ model_name: "vendor/model", reported_type: type, pricing }, sourceUrl, observedAt, 0);
const wave = (extra: Record<string, unknown>) => normalizeWaveSpeed({ model_uuid: "vendor/model", type: "text-to-video", base_price: "375000", input: { properties: { duration: { default: "5" } } }, formula: '{"total_price": base_price * duration / 5}', ...extra }, sourceUrl, observedAt, 0);
const mockFetch = (reply: (url: URL) => unknown): typeof fetch => async input => new Response(JSON.stringify(reply(new URL(String(input)))), { headers: { "content-type": "application/json" } });

test("price decimal arithmetic preserves 0.075/M without floating point notation", () => {
  assert.deepEqual(exactDecimalRatio("0.075", "1", "1000000"), { numerator: "3", denominator: "40000000", value: "0.000000075" });
  assert.equal(exactDecimalRatio("3.75e-1", "1", "5").value, "0.075");
  assert.equal(exactDecimalRatio("1.8e-05", "1", "100").value, "0.00000018");
  assert.equal(exactDecimalRatio("9007199254740993.123456789", "1", "100").value, "90071992547409.93123456789");
  assert.equal(exactDecimalRatio("0", "1", "7").value, "0");
});
test("nonterminating conversion publishes exact fraction without a fabricated rounded decimal", () => {
  assert.deepEqual(exactDecimalRatio("1", "1", "3"), { numerator: "1", denominator: "3" });
  for (const args of [["-1"], ["Infinity"], ["1e100000"], ["1", "1", "0"]]) assert.throws(() => exactDecimalRatio(args[0]!, args[1], args[2]));
});
test("native JSON parsing preserves numeric lexemes and does not alter quoted content", () => {
  assert.deepEqual(parseNativeJson('{"price":0.075,"huge":9007199254740993,"text":"price 0.075","scientific":7.5e-8}'), { price: "0.075", huge: "9007199254740993", text: "price 0.075", scientific: "7.5e-8" });
});
test("DeepInfra cents convert to reference image and video output units, with defaults retained", () => {
  const image = deep({ type: "image_units", cents_per_image_unit: "4", default_width: "0", default_height: "0", default_iterations: "0" });
  assert.equal(image.pricePoints[0]?.amount, "0.04");
  const video = deep({ type: "output_length", cents_per_output_sec: "40" }, "text-to-video");
  assert.equal(video.pricePoints[0]?.amount, "0.4");
  assert.equal(video.pricePoints[0]?.unit, "video_second");
  assert.equal(deep({ type: "image_units", cents_per_image_unit: "1", default_width: "1024", default_height: "1024", default_iterations: "28" }).pricePoints[0]?.amount, "0.01");
});
test("compute time, frame units, absent prices, and video image-units keep identity without false prices", () => {
  for (const [pricing, type, reason] of [
    [{ type: "time", cents_per_sec: "0.05" }, "text-to-image", "compute_second"],
    [{ type: "time", cents_per_sec: "0.05" }, "text-to-video", "compute_second"],
    [{ type: "frame_units", cents_per_frame_unit: "0.01859504" }, "text-to-video", "frame_unit"],
    [{ type: "image_units", cents_per_image_unit: "20" }, "text-to-video", "output_duration"],
    [null, "text-to-image", "price_absent"],
  ] as const) {
    const m = deep(pricing, type);
    assert.equal(m.id, "vendor/model"); assert.equal(m.pricingState, "not_published"); assert.deepEqual(m.pricePoints, []); assert.match(m.pricingNote!, new RegExp(reason));
  }
});
test("WaveSpeed microUSD/base-duration conversion gives exact 0.075/output second", () => {
  const price = wave({}).pricePoints[0]!;
  assert.equal(price.amount, "0.075"); assert.equal(wave({}).nativePricing?.base_price, "375000");
  assert.equal(price.unit, "video_second");
  assert.equal(price.source.url, sourceUrl);
});
test("WaveSpeed native detail input is a JSON encoded string and still normalizes", () => {
  assert.equal(wave({ input: '{"properties":{"duration":{"default":5},"size":{"default":"1280*720"}}}' }).pricePoints[0]?.amount, "0.075");
});
test("WaveSpeed rejects unknown quantity, mismatched base duration, and dynamic or executable formulas", () => {
  for (const extra of [{ input: {} }, { formula: undefined }, { formula: '{"total_price": base_price * duration / 10}' }, { formula: '{"total_price": base_price * (resolution == "1080p" ? 2 : 1)}' }, { formula: 'process.exit()' }, { base_price: "-1" }]) {
    assert.equal(wave(extra).pricingState, "not_published");
  }
});
test("WaveSpeed flat image pricing requires an explicit supported output count", () => {
  const row = { type: "text-to-image", formula: '{"total_price": base_price}', input: { properties: { batch_size: { default: "4" } } } };
  assert.equal(wave(row).pricingState, "not_published");
  assert.equal(wave({ ...row, input: { properties: { num_images: { default: "4" } } } }).pricePoints[0]?.amount, "0.09375");
});
test("Fal unit cells drive conversions; whole-video prices retain their video unit", () => {
  const html = '<table><tr><td><a href="/models/fal-ai/image">Image</a></td><td>image</td><td>$<!-- -->0.03</td></tr><tr><td><a href="/models/fal-ai/video">Video</a></td><td>video</td><td>$0.2</td></tr><tr><td><a href="/models/fal-ai/mp">MP</a></td><td>megapixel</td><td>$0.02</td></tr></table>';
  const prices = parseFalPricingPage(html);
  assert.equal(prices.size, 3);
  const img = normalizeFal({ endpoint_id: "fal-ai/image", metadata: { category: "text-to-image" } }, sourceUrl, observedAt, 0, prices.get("fal-ai/image"));
  assert.equal(img.pricePoints[0]?.amount, "0.03"); assert.equal(img.pricePoints[0]?.unit, "image");
  const video = normalizeFal({ endpoint_id: "fal-ai/video", metadata: { category: "text-to-video" } }, sourceUrl, observedAt, 1, prices.get("fal-ai/video"));
  assert.equal(video.pricingState, "published");
  assert.deepEqual(video.pricePoints.map(point => [point.unit, point.amount]), [["video", "0.2"]]);
});
test("Chutes identity is chute_id and infrastructure prices never become generated image prices", () => {
  const model = normalizeChutes({ chute_id: "abc", name: "image-name", standard_template: null, current_estimated_price: { usd: { second: "0.0005" } } }, sourceUrl, observedAt, 0);
  assert.equal(model.id, "abc"); assert.equal(model.mediaKind, "unknown"); assert.equal(model.pricingState, "not_published");
});
test("Chutes explicit USD per-million token rates coexist with compute prices", () => {
  const model = normalizeChutes({ chute_id: "abc", name: "model", standard_template: "vllm", current_estimated_price: { usd: { second: "0.0005" }, per_million_tokens: { input: { usd: "0.12" }, output: { usd: "0.37" } } } }, sourceUrl, observedAt, 0);
  assert.equal(model.pricingState, "published");
  assert.deepEqual(model.pricePoints.map(p => [p.unit, p.amount]), [["token_in", "0.00000012"], ["token_out", "0.00000037"]]);
});
test("full native catalogue retains unpriced, media, and text rows with population denominator", async () => {
  const result = await collectMediaCatalogue({ providers: ["deepinfra"], fetchImpl: mockFetch(() => [
    { model_name: "image", type: "text-to-image", pricing: { type: "image_units", cents_per_image_unit: "4" } },
    { model_name: "unpriced", type: "text-to-video" },
    { model_name: "text", type: "text-generation", pricing: { type: "tokens", cents_per_input_token: "0.0000075", cents_per_output_token: "0.00001" } },
  ]) });
  assert.deepEqual(result.models.map(m => m.id), ["image", "unpriced", "text"]);
  assert.deepEqual(result.population, { listed: 3, received: 3, retained: 3, excluded: 0, exclusionRules: [], completeness: "full" });
  assert.equal(result.models[2]?.pricePoints[0]?.amount, "0.000000075");
});
test("HTTP failure is unavailable with null counts and never leaks response body", async () => {
  let calls = 0;
  const result = await collectMediaCatalogue({ providers: ["deepinfra"], fetchImpl: async () => { calls++; return new Response("SENSITIVE_BODY", { status: 401 }); } });
  assert.equal(calls, 1); assert.equal(result.providers[0]?.status, "unavailable");
  assert.equal(result.providers[0]?.population.listed, null); assert.equal(result.providers[0]?.population.received, null);
  assert.equal(result.providers[0]?.error, "HTTP_401"); assert.doesNotMatch(JSON.stringify(result), /SENSITIVE_BODY/);
});
test("pagination exhausted retains received rows and full denominator with partial state", async () => {
  const result = await collectMediaCatalogue({ providers: ["chutes"], maxPages: 1, fetchImpl: mockFetch(() => ({ total: 2, items: [{ chute_id: "1", name: "one" }] })) });
  assert.equal(result.models.length, 1); assert.equal(result.providers[0]?.population.listed, 2); assert.equal(result.providers[0]?.population.received, 1); assert.equal(result.providers[0]?.population.completeness, "partial"); assert.equal(result.providers[0]?.error, "PAGE_BUDGET_EXHAUSTED");
});
test("Fal terminal cursor cannot overwrite a contradictory published total", async () => {
  const result = await collectMediaCatalogue({ providers: ["fal"], fetchImpl: mockFetch(() => ({ total: 10, models: [{ endpoint_id: "vendor/model" }], has_more: false, next_cursor: null })) });
  assert.equal(result.providers[0]?.population.listed, 10);
  assert.equal(result.providers[0]?.population.completeness, "partial");
  assert.equal(result.providers[0]?.error, "POPULATION_COUNT_MISMATCH");
});
test("WaveSpeed follows all pages, records no model exclusions, and does not fetch random detail ids", async () => {
  const calls: string[] = [];
  const result = await collectMediaCatalogue({ providers: ["wavespeed"], enrichIds: ["not-listed"], fetchImpl: mockFetch(url => { calls.push(url.href); return { total: 2, items: [{ model_uuid: `image-${url.searchParams.get("page")}`, type: "text-to-image", base_price: "1000" }] }; }) });
  assert.equal(calls.length, 2); assert.equal(result.models.length, 2); assert.equal(result.population.listed, 2); assert.equal(result.population.excluded, 0); assert.equal(result.population.completeness, "full");
  assert.ok(result.models.every(m => m.pricingState === "not_published"));
});
test("pricing schema forbids fabricated available empty prices and unexplained absence", () => {
  assert.equal(cataloguePricingSchema.safeParse({ state: "published", pricePoints: [] }).success, false);
  assert.equal(cataloguePricingSchema.safeParse({ state: "not_published", pricePoints: [] }).success, true);
  const price = normalizePricePoint({ id: "test:image", value: "0", unit: "image", sourceUrl, readAt: observedAt, provenance: "published", measurementOrigin: "catalogue", observed: null });
  assert.equal(cataloguePricingSchema.safeParse({ state: "published", pricePoints: [price] }).success, true);
});

const falModelsResponse = { models: [{ endpoint_id: "fal-ai/image", metadata: { category: "text-to-image" } }], has_more: false, next_cursor: null };
test("Fal pricing HTTP failure preserves full identity population but reports unavailable pricing and partial tool status", async () => {
  const calls: string[] = [];
  const result = await runCatalogue({ providers: ["fal"], offset: 0, limit: 10 }, { client: {} as never, fetchImpl: async input => {
    const url = String(input); calls.push(url);
    return url === "https://fal.ai/pricing" ? new Response("PRIVATE_ERROR_BODY", { status: 503 }) : Response.json(falModelsResponse);
  } });
  assert.equal(result.status, "partial");
  const provider = result.providers[0]!;
  assert.equal(provider.status, "partial");
  assert.deepEqual(provider.population, { listed: 1, received: 1, retained: 1, excluded: 0, exclusionRules: [], completeness: "full" });
  assert.equal(provider.requestParameters.pricingAcquisitionStatus, "unavailable");
  assert.equal(provider.requestParameters.priceSource, "https://fal.ai/pricing");
  assert.equal(provider.requestParameters.pricingError, "HTTP_503");
  assert.equal(provider.requestParameters.publishedPricingRows, undefined);
  assert.equal(result.models[0]?.pricingNote, "pricing_source_unavailable");
  assert.deepEqual(result.models[0]?.pricePoints, []);
  assert.equal(calls.filter(url => url === "https://fal.ai/pricing").length, 1);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_ERROR_BODY|price_not_in_public_pricing_table/);
});
test("Fal malformed pricing table is a failed observation, while a successfully checked absent row stays absent", async () => {
  for (const [html, expectedStatus, expectedReason] of [
    ["<html>layout changed</html>", "partial", "pricing_source_unavailable"],
    ['<table><tr><td><a href="/models/fal-ai/different">Other</a></td><td>image</td><td>$0.03</td></tr></table>', "available", "price_not_in_public_pricing_table_individual_page_not_observed"],
  ] as const) {
    const result = await collectMediaCatalogue({ providers: ["fal"], fetchImpl: async input => String(input) === "https://fal.ai/pricing" ? new Response(html) : Response.json(falModelsResponse) });
    assert.equal(result.providers[0]?.status, expectedStatus);
    assert.equal(result.providers[0]?.population.completeness, "full");
    assert.equal(result.models[0]?.pricingNote, expectedReason);
    assert.equal(result.providers[0]?.requestParameters.pricingAcquisitionStatus, expectedStatus === "partial" ? "unavailable" : "available");
  }
});
const waveDefaultId = DEFAULT_WAVESPEED_ENRICH_IDS[0], waveCallerId = "caller/video";
const waveList = { total: 2, items: [{ model_uuid: waveDefaultId, type: "text-to-video", base_price: "300000" }, { model_uuid: waveCallerId, type: "text-to-video", base_price: "300000" }] };
const waveCallerDetail = { code: 200, data: { model_uuid: waveCallerId, base_price: "300000", input: '{"properties":{"duration":{"default":5}}}', formula: '{"total_price": base_price * duration / 5}' } };
test("WaveSpeed isolated default detail failures do not prevent later caller price acquisition", async () => {
  const isolatedFailures: Array<[() => Response, string]> = [
    [() => new Response("missing", { status: 404 }), "HTTP_404"],
    [() => new Response("not-json"), "DETAIL_JSON_INVALID"],
    [() => Response.json({ code: 200, data: { model_uuid: "different/model" } }), "DETAIL_IDENTITY_MISMATCH"],
    [() => Response.json({ data: {} }), "DETAIL_RESPONSE_SHAPE_CHANGED"],
  ];
  for (const [failure, expectedError] of isolatedFailures) {
    const calls: string[] = [];
    const result = await collectMediaCatalogue({ providers: ["wavespeed"], enrichIds: [waveCallerId], fetchImpl: async input => {
      const url = String(input); calls.push(url);
      if (url.startsWith("https://wavespeed.ai/api/models?")) return Response.json(waveList);
      if (url.endsWith(waveDefaultId)) return failure();
      assert.ok(url.endsWith(waveCallerId)); return Response.json(waveCallerDetail);
    } });
    assert.equal(result.models.find(model => model.id === waveCallerId)?.pricePoints[0]?.amount, "0.06", expectedError);
    assert.equal(result.models.find(model => model.id === waveDefaultId)?.pricingNote, "pricing_source_unavailable");
    assert.equal(result.providers[0]?.status, "partial");
    assert.equal(result.providers[0]?.population.completeness, "full");
    assert.deepEqual(result.providers[0]?.requestParameters.enrichedIds, [waveCallerId]);
    assert.deepEqual(result.providers[0]?.requestParameters.detailFailures, [{ id: waveDefaultId, error: expectedError }]);
    assert.equal(calls.length, 3);
  }
});
test("WaveSpeed shared service failures stop further detail calls without retrying or discarding identities", async () => {
  for (const status of [401, 403, 429, 503]) {
    let calls = 0;
    const result = await collectMediaCatalogue({ providers: ["wavespeed"], enrichIds: [waveCallerId], fetchImpl: async input => {
      calls++;
      return String(input).startsWith("https://wavespeed.ai/api/models?") ? Response.json(waveList) : new Response("not reflected", { status });
    } });
    assert.equal(calls, 2);
    assert.equal(result.models.length, 2);
    assert.equal(result.providers[0]?.status, "partial");
    assert.equal(result.providers[0]?.population.completeness, "full");
    assert.equal(result.providers[0]?.requestParameters.detailStopReason, `HTTP_${status}`);
    assert.deepEqual(result.providers[0]?.requestParameters.enrichedIds, []);
  }
});
test("WaveSpeed shared deadline stops before requesting detail and preserves the collected population", async context => {
  let clock = 0, calls = 0;
  context.mock.method(Date, "now", () => clock);
  const result = await collectMediaCatalogue({ providers: ["wavespeed"], enrichIds: [waveCallerId], fetchImpl: async () => {
    calls++; clock = 60001; return Response.json(waveList);
  } });
  assert.equal(calls, 1);
  assert.equal(result.models.length, 2);
  assert.equal(result.providers[0]?.population.completeness, "full");
  assert.equal(result.providers[0]?.status, "partial");
  assert.equal(result.providers[0]?.requestParameters.detailStopReason, "PROVIDER_TIME_BUDGET");
});
test("WaveSpeed request timeout and application-level auth error stop the detail batch", async () => {
  for (const failureKind of ["timeout", "application_auth"] as const) {
    let calls = 0;
    const result = await collectMediaCatalogue({ providers: ["wavespeed"], timeoutMs: 1, enrichIds: [waveCallerId], fetchImpl: async (input, init) => {
      calls++;
      if (String(input).startsWith("https://wavespeed.ai/api/models?")) return Response.json(waveList);
      if (failureKind === "application_auth") return Response.json({ code: 401, message: "not reflected" });
      return new Promise<Response>((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(new Error("not reflected")), { once: true }));
    } });
    assert.equal(calls, 2);
    assert.equal(result.providers[0]?.status, "partial");
    assert.equal(result.providers[0]?.population.completeness, "full");
    assert.equal(result.providers[0]?.requestParameters.detailStopReason, failureKind === "timeout" ? "SOURCE_TIMEOUT" : "HTTP_401");
    assert.doesNotMatch(JSON.stringify(result), /not reflected/);
  }
});

test("WaveSpeed preserves a verified catalogue price when optional details fail or cannot establish an updated price", async () => {
  const list = { total: 1, items: [{ model_uuid: waveDefaultId, type: "text-to-video", base_price: "300000", input: '{"properties":{"duration":{"default":5}}}', formula: '{"total_price": base_price * duration / 5}' }] };
  const detailCases = [
    () => new Response("missing", { status: 404 }),
    () => Response.json({ code: 200, data: { model_uuid: waveDefaultId, base_price: "400000", input: list.items[0]!.input, formula: "unsupported_pricing_formula" } }),
    () => Response.json({ code: 200, data: { model_uuid: waveDefaultId } }),
  ];
  for (const response of detailCases) {
    const result = await collectMediaCatalogue({ providers: ["wavespeed"], fetchImpl: async input => String(input).startsWith("https://wavespeed.ai/api/models?") ? Response.json(list) : response() });
    const row = result.models[0]!;
    assert.equal(row.pricingState, "published");
    assert.equal(row.pricePoints[0]?.amount, "0.06");
    assert.equal(row.provenance.sourceUrl, "https://wavespeed.ai/api/models?page=1&page_size=200");
    assert.equal(row.pricePoints[0]?.source.url, row.provenance.sourceUrl);
    assert.equal(result.providers[0]?.status, "partial");
    assert.equal(result.population.completeness, "full");
    const observations = result.providers[0]?.requestParameters.detailPriceObservations as Array<Record<string, unknown>>;
    assert.equal(observations[0]?.retainedPriceSourceUrl, row.provenance.sourceUrl);
    assert.equal(observations[0]?.sourceUrl, `https://api.wavespeed.ai/center/default/api/v1/model_product/detail/${waveDefaultId}`);
    assert.notEqual(observations[0]?.status, "available");
  }
});

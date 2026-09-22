import test from "node:test";
import assert from "node:assert/strict";
import { collectMediaCatalogue } from "../src/catalogue/index.js";

const apiKey = "test-only-fal-key";
const seedream = "fal-ai/bytedance/seedream/v4/text-to-image";
const kontext = "fal-ai/flux-pro/kontext";
const kling = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
const model = (id: string, category = "text-to-image") => ({ endpoint_id: id, metadata: { category } });
const modelsBody = (models: unknown[]) => ({ models, has_more: false, next_cursor: null });
const price = (id: string, unit = "images", value: string | number = "0.03", currency = "USD") => ({ endpoint_id: id, unit, unit_price: value, currency });
const pricesBody = (prices: unknown[]) => ({ prices, has_more: false, next_cursor: null });

test("authenticated fal prices every catalogue identity in bounded 50-ID batches with account scope", async () => {
  const ids = [seedream, kontext, kling, ...Array.from({ length: 98 }, (_, index) => `vendor/image-${index}`)];
  const requested: string[][] = [];
  const result = await collectMediaCatalogue({ providers: ["fal"], falApiKey: apiKey, fetchImpl: async (input, init) => {
    const url = new URL(String(input));
    assert.equal(url.origin, "https://api.fal.ai");
    assert.equal(new Headers(init?.headers).get("Authorization"), `Key ${apiKey}`);
    assert.equal(init?.redirect, "error"); assert.equal(init?.method, "GET");
    if (url.pathname === "/v1/models") return Response.json(modelsBody(ids.map(id => model(id, id === kling ? "image-to-video" : "text-to-image"))));
    assert.equal(url.pathname, "/v1/models/pricing");
    const batch = url.searchParams.getAll("endpoint_id"); requested.push(batch);
    return Response.json(pricesBody(batch.filter(id => id !== ids.at(-1)).map(id => price(id, id === kling ? "seconds" : "images", id === kling ? "0.07" : id === kontext ? "0.04" : "0.03"))));
  } });
  assert.deepEqual(requested.map(batch => batch.length), [50, 50, 1]);
  assert.deepEqual(requested.flat(), ids);
  assert.equal(result.population.retained, 101); assert.equal(result.population.excluded, 0);
  assert.equal(result.providers[0]?.status, "available");
  assert.equal(result.models.find(row => row.id === seedream)?.pricePoints[0]?.amount, "0.03");
  assert.equal(result.models.find(row => row.id === kontext)?.pricePoints[0]?.amount, "0.04");
  const video = result.models.find(row => row.id === kling)?.pricePoints[0];
  assert.equal(video?.amount, "0.07"); assert.equal(video?.unit, "video_second");
  // RESTORED FROM THE 0.9 SHAPE, WHICH ASSERTED conditions.priceScope HERE. The 1.0
  // rewrite dropped that assertion with no replacement and the price went out as
  // `condition: null` -- claiming no condition applies to a rate that is specific to this
  // account. Every price from the authenticated endpoint must name its scope.
  assert.deepEqual(video?.condition, { kind: "price_scope", name: "authenticated_account" });
  for (const row of result.models) {
    for (const point of row.pricePoints) {
      assert.equal(point.condition?.kind, "price_scope", `${row.id}: an authenticated price must carry its scope`);
      assert.equal((point.condition as { name: string }).name, "authenticated_account");
    }
  }
  assert.equal(result.models.find(row => row.id === kling)?.nativePricing?.[0]?.unit, "seconds");
  assert.equal(result.models.at(-1)?.pricingNote, "price_not_returned_by_authenticated_source");
  assert.deepEqual(result.providers[0]?.requestParameters.pricePopulation, { listed: 101, requested: 101, observed: 101, receivedPriceRows: 100, withNativePrice: 100, withoutNativePrice: 1, unobserved: 0, normalized: 100, uncomparable: 0 });
  assert.equal(result.providers[0]?.requestParameters.priceBatchLimit, 40);
  assert.equal(result.providers[0]?.requestParameters.priceBatchesFetched, 3);
  assert.doesNotMatch(JSON.stringify(result), /test-only-fal-key|Authorization/);
});

test("authenticated fal retains exact native unknown units, currencies and quantity ambiguity without dropping models", async () => {
  const rows = [model("vendor/exact"), model("vendor/compute", "image-to-video"), model("vendor/whole-video", "text-to-video"), model("vendor/foreign"), model("vendor/mp"), model("vendor/invalid")];
  const native = [price("vendor/exact", "images", "7.5e-8"), price("vendor/compute", "gpu_seconds", "0.4"), price("vendor/whole-video", "videos", "0.4"), price("vendor/foreign", "images", "1", "EUR"), price("vendor/mp", "megapixels", "0.075"), price("vendor/invalid", "images", "-1")];
  const result = await collectMediaCatalogue({ providers: ["fal"], falApiKey: apiKey, fetchImpl: async input => Response.json(String(input).includes("/pricing?") ? pricesBody(native) : modelsBody(rows)) });
  assert.equal(result.models.length, 6);
  assert.equal(result.models[0]?.pricePoints[0]?.amount, "0.000000075");
  assert.equal(result.models.find(row => row.id === "vendor/whole-video")?.pricingState, "published");
  assert.equal(result.models.find(row => row.id === "vendor/whole-video")?.pricePoints[0]?.unit, "video");
  assert.equal(result.models[0]?.nativePricing?.[0]?.unit_price, "7.5e-8");
  assert.equal(result.models[1]?.pricingNote, "native_billing_unit_not_comparable");
  assert.equal(result.models[2]?.pricingNote, "native_billing_unit_not_comparable");
  assert.equal(result.models[3]?.pricingNote, "native_currency_not_usd");
  assert.equal(result.models[4]?.pricePoints[0]?.amount, "0.075");
  assert.equal(result.models[4]?.pricePoints[0]?.unit, "megapixel");
  assert.equal(result.models[5]?.pricingNote, "invalid_native_decimal");
  assert.deepEqual(result.models[1]?.nativePricing, [native[1]]);
});

test("authenticated fal preserves completed price batches and distinguishes failed from never observed batches", async () => {
  const rows = Array.from({ length: 101 }, (_, index) => model(`vendor/${index}`)); let batches = 0;
  const result = await collectMediaCatalogue({ providers: ["fal"], falApiKey: apiKey, fetchImpl: async input => {
    const url = new URL(String(input));
    if (url.pathname === "/v1/models") return Response.json(modelsBody(rows));
    batches++;
    return batches === 1 ? Response.json(pricesBody(url.searchParams.getAll("endpoint_id").map(id => price(id)))) : new Response(apiKey, { status: 429 });
  } });
  assert.equal(batches, 2); assert.equal(result.providers[0]?.status, "partial");
  assert.equal(result.population.completeness, "full"); assert.equal(result.models.length, 101);
  assert.equal(result.models[0]?.pricingState, "published");
  assert.equal(result.models[50]?.pricingNote, "pricing_source_unavailable");
  assert.equal(result.models[100]?.pricingNote, "pricing_not_observed_after_source_failure");
  assert.equal(result.providers[0]?.requestParameters.pricingError, "HTTP_429");
  assert.doesNotMatch(JSON.stringify(result), /test-only-fal-key/);
});

test("authenticated fal price budget keeps all identities and reports unobserved prices", async () => {
  const rows = Array.from({ length: 51 }, (_, index) => model(`vendor/${index}`)); let batches = 0;
  const result = await collectMediaCatalogue({ providers: ["fal"], falApiKey: apiKey, maxFalPriceBatches: 1, fetchImpl: async input => {
    const url = new URL(String(input)); if (url.pathname === "/v1/models") return Response.json(modelsBody(rows));
    batches++; return Response.json(pricesBody(url.searchParams.getAll("endpoint_id").map(id => price(id))));
  } });
  assert.equal(batches, 1); assert.equal(result.models.length, 51); assert.equal(result.providers[0]?.status, "partial");
  assert.equal(result.models[50]?.pricingNote, "pricing_not_observed_price_batch_budget");
  assert.equal(result.providers[0]?.requestParameters.pricingError, "PRICE_BATCH_BUDGET_EXHAUSTED");
});

test("authenticated fal refuses unexpected identity and unsupported pricing pagination", async () => {
  for (const body of [pricesBody([price("not-requested")]), { prices: [price(seedream)], has_more: true, next_cursor: "unadvertised" }]) {
    let priceCalls = 0;
    const result = await collectMediaCatalogue({ providers: ["fal"], falApiKey: apiKey, fetchImpl: async input => {
      if (!String(input).includes("/pricing?")) return Response.json(modelsBody([model(seedream)]));
      priceCalls++; return Response.json(body);
    } });
    assert.equal(priceCalls, 1); assert.equal(result.models[0]?.pricingState, "unknown");
    assert.equal(result.providers[0]?.status, "partial"); assert.equal(result.population.completeness, "full");
  }
});

test("an explicit empty fal key selects the public fallback without sending credentials to the website", async () => {
  const urls: string[] = [];
  const result = await collectMediaCatalogue({ providers: ["fal"], falApiKey: "", fetchImpl: async (input, init) => {
    const url = String(input); urls.push(url); assert.equal(new Headers(init?.headers).get("Authorization"), null);
    return url === "https://fal.ai/pricing" ? new Response(`<table><tr><td><a href="/models/${seedream}">Model</a></td><td>image</td><td>$0.03</td></tr></table>`) : Response.json(modelsBody([model(seedream)]));
  } });
  assert.equal(result.models[0]?.pricePoints[0]?.amount, "0.03");
  assert.equal(result.providers[0]?.requestParameters.pricingAuthentication, "none");
  assert.deepEqual(urls, ["https://api.fal.ai/v1/models?limit=1000", "https://fal.ai/pricing"]);
});

test("duplicate fal catalogue rows keep the identity warning and use unique IDs for price population", async () => {
  const result = await collectMediaCatalogue({ providers: ["fal"], falApiKey: apiKey, fetchImpl: async input => Response.json(String(input).includes("/pricing?") ? pricesBody([price(seedream)]) : modelsBody([model(seedream), model(seedream)])) });
  assert.equal(result.models.length, 2);
  assert.equal(result.providers[0]?.status, "partial");
  assert.equal(result.providers[0]?.error, "DUPLICATE_IDENTITY_DURING_PAGINATION");
  assert.equal(result.population.completeness, "partial");
  assert.deepEqual(result.providers[0]?.requestParameters.pricePopulation, { listed: 1, requested: 1, observed: 1, receivedPriceRows: 1, withNativePrice: 1, withoutNativePrice: 0, unobserved: 0, normalized: 1, uncomparable: 0 });
});

test("inherited object keys cannot masquerade as fal output-second contracts", async () => {
  const ids = ["__proto__", "toString", "vendor/unknown"];
  const result = await collectMediaCatalogue({ providers: ["fal"], falApiKey: apiKey, fetchImpl: async input => Response.json(String(input).includes("/pricing?") ? pricesBody(ids.map(id => price(id, "seconds", "0.07"))) : modelsBody(ids.map(id => model(id, "text-to-video")))) });
  assert.equal(result.models.length, 3);
  for (const row of result.models) {
    assert.equal(row.pricingState, "unknown");
    assert.equal(row.pricingNote, "second_unit_not_established_as_video_output");
    assert.equal(row.pricePoints.length, 0);
  }
});

test("authenticated fal rejects credentials reflected in successful catalogue or pricing bodies", async () => {
  for (const reflectedSource of ["catalogue", "pricing"]) {
    let requests = 0;
    const result = await collectMediaCatalogue({ providers: ["fal"], falApiKey: apiKey, fetchImpl: async input => {
      requests++;
      if (String(input).includes("/pricing?")) return Response.json(pricesBody([{ ...price(seedream), description: apiKey }]));
      return Response.json(modelsBody([model(reflectedSource === "catalogue" ? apiKey : seedream)]));
    } });
    assert.equal(JSON.stringify(result).includes(apiKey), false);
    if (reflectedSource === "catalogue") {
      assert.equal(requests, 1);
      assert.equal(result.providers[0]?.status, "unavailable");
      assert.equal(result.providers[0]?.error, "SOURCE_CREDENTIAL_REFLECTION");
      assert.equal(result.population.retained, null);
      assert.equal(result.models.length, 0);
    } else {
      assert.equal(requests, 2);
      assert.equal(result.providers[0]?.status, "partial");
      assert.equal(result.providers[0]?.requestParameters.pricingError, "SOURCE_CREDENTIAL_REFLECTION");
      assert.equal(result.population.completeness, "full");
      assert.equal(result.models[0]?.pricingNote, "pricing_source_unavailable");
      assert.equal(result.models[0]?.nativePricing, null);
    }
  }
});

test("an authenticated fal price says whose price it is, and will not compare with a public one", async () => {
  // WAS `condition: null`, WHICH ASSERTS THAT NO CONDITION APPLIES. These prices come
  // from the authenticated pricing endpoint and are what THIS account is charged. The old
  // shape carried conditions.priceScope = "authenticated_account" per price; the 1.0
  // rewrite dropped it to provider-level requestParameters, so a consumer reading one
  // price point could not tell an account rate from a list rate -- and comparePriceSets,
  // which keys on the condition, saw two nulls and called them directly comparable.
  const { pricePoint } = await import("../src/catalogue/price-set.js");
  const { comparePriceSets } = await import("../src/catalogue/compare.js");
  const make = (id: string, condition: unknown) => pricePoint({
    id, amount: "0.03", unit: "image", condition: condition as never,
    sourceUrl: "https://api.fal.ai/v1/models/pricing", readAt: "2026-09-08T15:00:00Z", provenance: "published", measurementOrigin: "catalogue", observed: null,
  });
  const account = make("fal:x:image:account", { kind: "price_scope", name: "authenticated_account" });
  const publicList = make("fal:x:image", null);
  assert.equal(account.condition?.kind, "price_scope");

  const result = comparePriceSets([account], [publicList], { unit: "image", assumption: "one generated image" });
  assert.equal(result.status, "refused", "an account price and an unconditioned price are not the same quantity");
  assert.match(result.reason, /condition/i);
});

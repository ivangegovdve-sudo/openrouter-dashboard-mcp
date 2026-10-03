import assert from "node:assert/strict";
import test from "node:test";

import { collectHiggsfieldCatalogue, HIGGSFIELD_COMPARE_URL, parseHiggsfieldCompare } from "../src/catalogue/higgsfield.js";
import { normalizePricePoint } from "../src/catalogue/price-set.js";
import { comparePriceSets } from "../src/catalogue/compare.js";
import { pricePointSchema } from "../src/contract.js";

const observedAt = "2026-09-22T12:00:00.000Z";
const payload = {
  plan_set_key: "ps_a3",
  country_code: null,
  plans: [
    { name: "Free", plan_type: "free", billing_period: "monthly", credits: 0, final_price: 0, final_monthly_price: 0, currency: "eur" },
  ],
  categories: [
    { slug: "video", name: "Video", features: [
      { name: "Seedance 2.0 720p", detail: "~22 credits/5s", values: { free: { type: "bool", value: false } } },
      { name: "Concurrent Jobs", detail: "", values: { free: { type: "string", value: "1 concurrent job" } } },
    ] },
    { slug: "image", name: "Image", features: [
      { name: "Nano Banana Pro", detail: "2 credit/image", values: { free: { type: "bool", value: true } } },
    ] },
  ],
};

test("Higgsfield keeps native web credits as catalogue-only price rows", () => {
  const result = parseHiggsfieldCompare(payload, observedAt);
  assert.equal(result.provider.provider, "higgsfield");
  assert.equal(result.provider.population.listed, 3);
  assert.equal(result.provider.population.retained, 2);
  assert.equal(result.models.find((model) => model.mediaKind === "image")?.pricePoints[0]?.unit, "credit_image");
  assert.equal(result.models.find((model) => model.mediaKind === "video")?.pricePoints[0]?.unit, "credit_video");
  for (const model of result.models) {
    for (const point of model.pricePoints) {
      assert.equal(point.measurement_origin, "catalogue");
      assert.equal(point.observed, null);
      assert.notEqual(point.measurement_origin, null);
      assert.ok(["catalogue", "live_provider_read", "unknown"].includes(point.measurement_origin));
    }
  }
  assert.equal(result.provider.requestParameters.pricingUnits, "native_web_plan_credits");
  assert.equal(result.provider.requestParameters.observedAmountField, null);
});

test("Higgsfield plan metadata does not emit currency-denominated price fields", () => {
  const result = parseHiggsfieldCompare(payload, observedAt);
  const plans = result.provider.requestParameters.plans;
  assert.ok(Array.isArray(plans));
  for (const plan of plans) {
    assert.equal(Object.hasOwn(plan, "price"), false);
    assert.equal(Object.hasOwn(plan, "monthlyPrice"), false);
    assert.equal(Object.hasOwn(plan, "currency"), false);
  }
});

test("Higgsfield preserves duration and approximate-rate conditions", () => {
  const first = parseHiggsfieldCompare(payload, observedAt).models[0]!.pricePoints;
  const changed = structuredClone(payload);
  changed.categories[0]!.features[0]!.detail = "~22 credits/10s";
  const second = parseHiggsfieldCompare(changed, observedAt).models[0]!.pricePoints;
  assert.deepEqual(first[0]!.condition, { kind: "generation", durationSeconds: "5", approximate: true });
  assert.equal(comparePriceSets(first, second, { unit: "credit_video", assumption: "same generation duration" }).status, "refused");
});

test("Higgsfield retains unread generation rates and excluded access rows", () => {
  const changed = structuredClone(payload);
  changed.categories[1]!.features[0]!.detail = "2 credits/image (HD)";
  const result = parseHiggsfieldCompare(changed, observedAt);
  assert.equal(result.provider.status, "partial");
  assert.equal(result.provider.population.completeness, "partial");
  assert.equal(result.provider.population.retained, 2);
  assert.equal(result.models[1]!.pricingState, "unknown");
  assert.deepEqual(result.models[1]!.pricePoints, []);
  assert.equal(result.provider.requestParameters.pricingAcquisitionStatus, "HIGGSFIELD_PRICE_SHAPE_CHANGED");
  assert.equal((result.provider.requestParameters.excludedRows as unknown[]).length, 1);
});

test("every Higgsfield price row must carry a non-default measurement origin", async () => {
  const result = await collectHiggsfieldCatalogue({
    now: () => new Date(observedAt),
    fetchImpl: async (url) => {
      assert.equal(url, HIGGSFIELD_COMPARE_URL);
      return new Response(JSON.stringify(payload), { headers: { "content-type": "application/json" } });
    },
  });
  const rows = result.models.flatMap((model) => model.pricePoints);
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.equal(pricePointSchema.safeParse(row).success, true);
    assert.equal(typeof row.measurement_origin, "string");
    assert.notEqual(row.measurement_origin, "");
    assert.equal(pricePointSchema.safeParse({ ...row, measurement_origin: null }).success, false);
  }
  assert.throws(() => normalizePricePoint({ id: "missing-origin", value: "1", unit: "credit_image", sourceUrl: HIGGSFIELD_COMPARE_URL, readAt: observedAt } as never));
});

test("a missing Higgsfield price endpoint remains a known provider with PRICES_UNPUBLISHED", async () => {
  const result = await collectHiggsfieldCatalogue({
    fetchImpl: async () => new Response("missing", { status: 404 }),
  });
  assert.equal(result.models.length, 0);
  assert.equal(result.provider.provider, "higgsfield");
  assert.equal(result.provider.status, "unavailable");
  assert.equal(result.provider.error, "PRICES_UNPUBLISHED");
  assert.equal(result.provider.requestParameters.pricingAcquisitionStatus, "PRICES_UNPUBLISHED");
});

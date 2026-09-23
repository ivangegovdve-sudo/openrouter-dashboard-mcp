import assert from "node:assert/strict";
import test from "node:test";
import { collectNativePriceCatalogue, NATIVE_PRICE_SOURCES } from "../src/catalogue/native-price.js";
import { catalogueModelSchema } from "../src/catalogue/schemas.js";

const observedAt = "2026-09-22T10:00:00Z";

function responseFor(url: string): unknown {
  if (url === NATIVE_PRICE_SOURCES.qwencloud) {
    return {
      output: {
        models: [{
          model_id: "qwen/test",
          model_type: "llm",
          prices: [{
            range_name: "Default",
            prices: [
              { type: "input_token", price: "2", price_unit: "Per 1M tokens" },
              { type: "output_token", price: "3", price_unit: "Per 1M tokens" },
            ],
          }],
        }],
      },
    };
  }
  if (url === NATIVE_PRICE_SOURCES.novita) {
    return {
      data: [{
        id: "novita/test",
        model_type: "llm",
        is_tiered_billing: false,
        pricing: {
          prompt: { price_per_m_decimal: "0.25" },
          completion: { price_per_m_decimal: "0.75" },
        },
      }],
    };
  }
  return {
    data: [{
      id: url.includes("groq") ? "groq/test" : url.includes("nous") ? "nous/test" : url.includes("sambanova") ? "samba/test" : "openrouter/test",
      model_type: "text-generation",
      pricing: { prompt: "0.000001", completion: "0.000002" },
    }],
  };
}

test("native JSON collectors keep published amounts separate from observations and mark catalogue origin", async () => {
  const result = await collectNativePriceCatalogue({
    providers: ["openrouter", "groq", "nous", "qwencloud", "novita", "sambanova"],
    apiKeys: { groq: "test-groq-key", qwencloud: "test-qwen-key" },
    now: () => new Date(observedAt),
    fetchImpl: async input => Response.json(responseFor(String(input))),
  });

  assert.equal(result.providers.length, 6);
  assert.equal(result.models.length, 6);
  assert.ok(result.models.every(model => model.pricingState === "published"));
  const points = result.models.flatMap(model => model.pricePoints);
  assert.ok(points.length >= 12);
  assert.ok(points.every(point => point.measurement_origin === "catalogue"));
  assert.ok(points.every(point => point.observed === null));
  assert.equal(result.models.find(model => model.provider === "qwencloud")?.pricePoints.find(point => point.unit === "token_in")?.amount, "0.000002");
  assert.equal(result.models.find(model => model.provider === "qwencloud")?.pricePoints.find(point => point.unit === "token_out")?.amount, "0.000003");
});

test("a missing native key is unavailable rather than an empty or free price result", async () => {
  const result = await collectNativePriceCatalogue({
    providers: ["qwencloud"],
    fetchImpl: async () => { throw new Error("must not fetch without a key"); },
  });
  assert.equal(result.providers[0]?.status, "unavailable");
  assert.equal(result.providers[0]?.error, "KEY_NOT_CONFIGURED");
  assert.deepEqual(result.models, []);
});

test("credit-priced provider metadata cannot carry a currency field", () => {
  const base = {
    provider: "credit-provider",
    id: "credit-provider/image",
    displayName: "Credit image",
    mediaKind: "image" as const,
    nativeType: "image-generation",
    pricePoints: [{
      id: "credit-provider:image",
      amount: "2",
      unit: "credit_image" as const,
      observed: null,
      measurement_origin: "catalogue" as const,
      condition: null,
      source: { url: "https://example.test/pricing", readAt: observedAt },
      provenance: "published" as const,
    }],
    pricingState: "published" as const,
    provenance: { sourceUrl: "https://example.test/pricing", observedAt, sourceIndex: 0 },
  };
  assert.equal(catalogueModelSchema.safeParse({ ...base, nativePricing: { credits: 2 } }).success, true);
  assert.equal(catalogueModelSchema.safeParse({ ...base, nativePricing: { credits: 2, currency: "USD" } }).success, false);
  assert.equal(catalogueModelSchema.safeParse({ ...base, nativePricing: { credits: 2, currency_code: "USD" } }).success, false);
});

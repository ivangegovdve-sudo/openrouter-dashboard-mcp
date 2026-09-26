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

test("AkashML is priced per model from its keyed catalogue and carries observed response shapes", async () => {
  const rows = [
    { id: "zai-org/GLM-5.3", name: "GLM 5.3", context_length: 1048576, output_modalities: ["text"], supported_features: ["tools", "reasoning"], pricing: { input: "0.0000013", output: "0.0000044", request: "0", input_cache_read: "0.00000026" } },
    { id: "meta-llama/Llama-3.3-70B-Instruct", context_length: 131072, output_modalities: ["text"], supported_features: ["tools"], pricing: { input: "0.0000002", output: "0.00000052" } },
    { id: "akash/new-model", output_modalities: ["text"], supported_features: ["reasoning"], pricing: { input: "0.0000001", output: "0.0000002" } },
  ];
  let authorization: string | null = null;
  const result = await collectNativePriceCatalogue({
    providers: ["akashml"],
    apiKeys: { akashml: "test-akashml-key" },
    now: () => new Date(observedAt),
    fetchImpl: async (input, init) => {
      assert.equal(String(input), NATIVE_PRICE_SOURCES.akashml);
      authorization = new Headers(init?.headers).get("Authorization");
      return Response.json({ object: "list", data: rows });
    },
  });
  assert.equal(authorization, "Bearer test-akashml-key");
  assert.equal(result.providers[0]?.status, "available");
  const glm = result.models.find(model => model.id === "zai-org/GLM-5.3");
  const llama = result.models.find(model => model.id === "meta-llama/Llama-3.3-70B-Instruct");
  const fresh = result.models.find(model => model.id === "akash/new-model");
  assert.equal(glm?.mediaKind, "text");
  assert.equal(glm?.contextLength, 1048576);
  assert.equal(glm?.pricePoints.find(point => point.unit === "token_out")?.amount, "0.0000044");
  assert.equal(glm?.pricePoints.find(point => point.unit === "token_cached")?.amount, "0.00000026");
  // The dearest model is the one observed spending its whole budget on reasoning.
  assert.equal(glm?.responseShape?.reasoningAdvertised, true);
  assert.equal(glm?.responseShape?.emptyContentObserved, "observed");
  assert.equal(glm?.responseShape?.reasoningField, "message.reasoning_content");
  assert.ok(glm?.responseShape?.observations.some(item => item.contentChars === 0 && item.finishReason === "length"));
  assert.equal(llama?.responseShape?.emptyContentObserved, "not_observed");
  assert.equal(llama?.responseShape?.reasoningField, null);
  // A model this build never called is unknown, not safe.
  assert.equal(fresh?.responseShape?.emptyContentObserved, "unknown");
  assert.equal(fresh?.responseShape?.reasoningField, "unknown");
  assert.equal(fresh?.responseShape?.answerField, "unknown");
  assert.equal(glm?.responseShape?.answerField, "message.content");
});

test("AkashML without a key is unavailable, not an empty or free catalogue", async () => {
  const previous = process.env.AKASHML_API_KEY;
  delete process.env.AKASHML_API_KEY;
  try {
    const result = await collectNativePriceCatalogue({
      providers: ["akashml"],
      fetchImpl: async () => { throw new Error("must not fetch without a key"); },
    });
    assert.equal(result.providers[0]?.error, "KEY_NOT_CONFIGURED");
    assert.deepEqual(result.models, []);
  } finally {
    if (previous !== undefined) process.env.AKASHML_API_KEY = previous;
  }
});

test("io.net JSON-number prices convert exactly, including exponent notation", async () => {
  const result = await collectNativePriceCatalogue({
    providers: ["ionet"],
    now: () => new Date(observedAt),
    fetchImpl: async input => {
      assert.equal(String(input), NATIVE_PRICE_SOURCES.ionet);
      return new Response('{"object":"list","data":[{"id":"openai/gpt-oss-120b","context_window":131072,"output_modalities":["text"],"supports_reasoning":true,"input_token_price":1.78e-7,"output_token_price":6.8e-7,"cache_read_token_price":8.9e-8,"min_access_tier":2}]}', { headers: { "Content-Type": "application/json" } });
    },
  });
  const model = result.models[0];
  assert.equal(model?.provider, "ionet");
  assert.equal(model?.pricePoints.find(point => point.unit === "token_in")?.amount, "0.000000178");
  assert.equal(model?.pricePoints.find(point => point.unit === "token_out")?.amount, "0.00000068");
  assert.equal(model?.pricePoints.find(point => point.unit === "token_cached")?.amount, "0.000000089");
  assert.equal(model?.contextLength, 131072);
  assert.equal((model?.nativePricing as { min_access_tier?: number }).min_access_tier, 2);
  assert.equal(model?.responseShape?.reasoningAdvertised, true);
  assert.equal(model?.responseShape?.emptyContentObserved, "unknown");
  assert.equal(model?.responseShape?.answerField, "unknown");
});

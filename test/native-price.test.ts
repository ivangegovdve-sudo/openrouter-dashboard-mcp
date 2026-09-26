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

test("io.net reasoning models carry measured empty answers and an answer-budget range, not a single floor", async () => {
  const result = await collectNativePriceCatalogue({
    providers: ["ionet"],
    now: () => new Date(observedAt),
    fetchImpl: async () => Response.json({ object: "list", data: [
      { id: "zai-org/GLM-5.3-Flash", output_modalities: ["text"], supports_reasoning: true, input_token_price: 2.1e-7, output_token_price: 7e-7 },
      { id: "deepseek-ai/DeepSeek-V4.1-Flash", output_modalities: ["text"], supports_reasoning: true, input_token_price: 2.8e-7, output_token_price: 0.00000109 },
    ] }),
  });
  const glm = result.models.find(model => model.id === "zai-org/GLM-5.3-Flash")?.responseShape;
  const deepseek = result.models.find(model => model.id === "deepseek-ai/DeepSeek-V4.1-Flash")?.responseShape;
  assert.equal(glm?.emptyContentObserved, "observed");
  assert.equal(glm?.reasoningField, "message.reasoning_content");
  assert.equal(deepseek?.emptyContentObserved, "observed");
  // The budget a one-word answer needed differs by model AND by call.
  assert.equal(glm?.answerCompletionTokens?.min, "95");
  assert.equal(glm?.answerCompletionTokens?.max, "218");
  assert.equal(glm?.answerCompletionTokens?.samples, 3);
  assert.ok(Number(deepseek?.answerCompletionTokens?.max) < Number(glm?.answerCompletionTokens?.min));
});

test("a Cloudflare 1010 on a keyed catalogue is an edge block, not a rejected credential", async () => {
  const edge = await collectNativePriceCatalogue({
    providers: ["akashml"],
    apiKeys: { akashml: "valid-key" },
    fetchImpl: async () => new Response("error code: 1010", { status: 403, headers: { server: "cloudflare", "cf-ray": "abc-SOF" } }),
  });
  assert.equal(edge.providers[0]?.error, "EDGE_BLOCKED");
  const rejected = await collectNativePriceCatalogue({
    providers: ["akashml"],
    apiKeys: { akashml: "dead-key" },
    fetchImpl: async () => new Response('{"detail":"Invalid API Key"}', { status: 401, headers: { server: "cloudflare", "cf-ray": "abc-SOF" } }),
  });
  assert.equal(rejected.providers[0]?.error, "PROVIDER_REJECTED");
});

test("a public catalogue's 401/403 is an HTTP error, never a rejected credential", async () => {
  const result = await collectNativePriceCatalogue({
    providers: ["ionet"],
    fetchImpl: async () => new Response("forbidden", { status: 403, headers: { server: "cloudflare" } }),
  });
  assert.equal(result.providers[0]?.error, "HTTP_ERROR");
});

test("Sail rows are priced only from the digest-verified document and carry measured shapes and the batch lane", async () => {
  const fs = await import("node:fs");
  const doc = fs.readFileSync("sail-pricing.md");
  const ids = ["google/gemma-4-12B-it", "zai-org/GLM-5.3", "nvidia/Gemma-4-31B-IT-NVFP4", "Qwen/Qwen3.6-35B-A3B", "sail/never-called"];
  const collect = (body: Buffer) => collectNativePriceCatalogue({
    providers: ["sail"],
    apiKeys: { sail: "test-sail-key" },
    now: () => new Date(observedAt),
    fetchImpl: async (input) => String(input) === NATIVE_PRICE_SOURCES.sail
      ? Response.json({ object: "list", data: ids.map(id => ({ id, object: "model", owned_by: "x" })) })
      : new Response(new Uint8Array(body)),
  });

  const verified = await collect(doc);
  assert.equal(verified.providers[0]?.requestParameters.pricingDigest, "verified");
  const glm = verified.models.find(model => model.id === "zai-org/GLM-5.3");
  assert.equal(glm?.pricePoints.find(point => point.unit === "token_out" && point.condition?.name === "ASAP")?.amount, "0.00000308");
  const gemma = verified.models.find(model => model.id === "google/gemma-4-12B-it")?.responseShape;
  assert.equal(gemma?.measurement, "measured");
  assert.equal(gemma?.reasoningContentField, "absent");
  assert.equal(gemma?.minViableBudget?.lowestPassing, "16");
  assert.equal(gemma?.lane?.kind, "batch");
  // The fastest zero-reasoning model measured on Sail, answering in 2 tokens.
  const nvfp4 = verified.models.find(model => model.id === "nvidia/Gemma-4-31B-IT-NVFP4")?.responseShape;
  assert.equal(nvfp4?.reasoningContentField, "absent");
  assert.equal(nvfp4?.answerCompletionTokens?.max, "2");
  // A reasoning model: the budget is a bracket from what was actually tried.
  const qwen = verified.models.find(model => model.id === "Qwen/Qwen3.6-35B-A3B")?.responseShape;
  assert.deepEqual([qwen?.minViableBudget?.lowestPassing, qwen?.minViableBudget?.highestFailing], ["256", "64"]);
  assert.equal(qwen?.emptyContentObserved, "observed");
  assert.match(qwen?.note ?? "", /flex/);
  // An id nobody called is distinguishable from a measured one.
  const never = verified.models.find(model => model.id === "sail/never-called");
  assert.equal(never?.pricingState, "unknown");
  assert.equal(never?.responseShape?.measurement, "unmeasured");
  assert.equal(never?.responseShape?.minViableBudget, null);
  assert.equal(never?.responseShape?.latencyMs, null);

  const stale = await collect(Buffer.from("a repriced document"));
  assert.equal(stale.providers[0]?.requestParameters.pricingDigest, "stale");
  assert.equal(stale.providers[0]?.status, "partial");
  assert.equal(stale.providers[0]?.error, "PRICING_STALE");
  assert.equal(verified.providers[0]?.status, "available");
  assert.ok(stale.models.every(model => model.pricePoints.length === 0 && model.pricingState === "unknown"));
  assert.match(stale.models[0]?.pricingNote ?? "", /PRICES ARE STALE/);
});

test("Sail without a key is unavailable, not an empty or free catalogue", async () => {
  const previous = process.env.SAIL_API_KEY;
  delete process.env.SAIL_API_KEY;
  try {
    const result = await collectNativePriceCatalogue({ providers: ["sail"], fetchImpl: async () => { throw new Error("must not fetch without a key"); } });
    assert.equal(result.providers[0]?.error, "KEY_NOT_CONFIGURED");
  } finally {
    if (previous !== undefined) process.env.SAIL_API_KEY = previous;
  }
});

test("OpenRouter rows say unmeasured explicitly instead of omitting the response shape", async () => {
  const result = await collectNativePriceCatalogue({
    providers: ["openrouter"],
    fetchImpl: async () => Response.json({ data: [{ id: "openai/gpt-oss-120b", supported_parameters: ["reasoning", "max_tokens"], pricing: { prompt: "0.0000001", completion: "0.0000005" } }] }),
  });
  const shape = result.models[0]?.responseShape;
  assert.equal(shape?.measurement, "unmeasured");
  assert.equal(shape?.reasoningAdvertised, true);
  assert.equal(shape?.minViableBudget, null);
  assert.equal(shape?.lane, null);
});

test("generic sources carry an exact published context length, and nothing when none is published", async () => {
  const result = await collectNativePriceCatalogue({
    providers: ["openrouter"],
    fetchImpl: async () => Response.json({ data: [
      { id: "a/with-context", context_length: 131072, pricing: { prompt: "0.0000001", completion: "0.0000002" } },
      { id: "a/without", pricing: { prompt: "0.0000001", completion: "0.0000002" } },
    ] }),
  });
  assert.equal(result.models.find(m => m.id === "a/with-context")?.contextLength, 131072);
  assert.equal(result.models.find(m => m.id === "a/without")?.contextLength, undefined);
});

test("Sail context labels bind only within their own table row", async () => {
  const { parseSailContextLabels } = await import("../src/catalogue/native-price.js");
  const row = (context: string | null, id: string) => `<tr><td className="cap-cell cap-cell-model">${context ? `<span className="cap-expand-key">Context</span>
    <span className="cap-expand-val">${context}</span>` : ""}</td><td className="cap-cell cap-cell-slug"><code>${id}</code></td></tr>`;
  const doc = [
    row("1M", "zai-org/GLM-5.3"),
    // Documented but absent from /models: its label must not leak forward.
    row("128K", "unlisted/model"),
    row(null, "google/gemma-4-12B-it"),
    row("262K", "moonshotai/Kimi-K2.6"),
  ].join("\n");
  const labels = parseSailContextLabels(doc, new Set(["zai-org/GLM-5.3", "moonshotai/Kimi-K2.6", "google/gemma-4-12B-it"]));
  assert.equal(labels.get("zai-org/GLM-5.3"), "1M");
  assert.equal(labels.get("moonshotai/Kimi-K2.6"), "262K");
  assert.equal(labels.has("google/gemma-4-12B-it"), false);
  assert.equal(labels.has("unlisted/model"), false);
});

test("Nous rows are compared with OpenRouter's live price, not with Nous's own claimed original", async () => {
  const nousRows = [
    // Advertised as a deep discount, but the same price as OpenRouter.
    { id: "m/same", pricing: { prompt: "0.0000000180", completion: "0.0000000300", original: { prompt: "0.00000015", completion: "0.00000015" } } },
    { id: "m/cheaper", pricing: { prompt: "0.000000035", completion: "0.00000029", original: { prompt: "0.00000015", completion: "0.0000006" } } },
    { id: "m/dearer-output", pricing: { prompt: "0.00000022", completion: "0.0000018", original: { prompt: "0.000000975", completion: "0.000004875" } } },
    { id: "m/nous-only", pricing: { prompt: "0.000001", completion: "0.000002" } },
  ];
  const orRows = [
    { id: "m/same", pricing: { prompt: "0.000000018", completion: "0.00000003" } },
    { id: "m/cheaper", pricing: { prompt: "0.0000003", completion: "0.0000012" } },
    { id: "m/dearer-output", pricing: { prompt: "0.0000003", completion: "0.000001" } },
  ];
  const result = await collectNativePriceCatalogue({
    providers: ["nous"],
    now: () => new Date(observedAt),
    fetchImpl: async input => Response.json({ data: String(input) === NATIVE_PRICE_SOURCES.openrouter ? orRows : nousRows }),
  });
  const resale = (id: string) => result.models.find(m => m.id === id)?.resale;
  assert.equal(resale("m/same")?.versusOpenRouter, "identical");
  assert.deepEqual(resale("m/same")?.claimedOriginal, { input: "0.00000015", output: "0.00000015" });
  assert.equal(resale("m/cheaper")?.versusOpenRouter, "cheaper");
  assert.equal(resale("m/dearer-output")?.versusOpenRouter, "mixed");
  assert.equal(resale("m/nous-only")?.versusOpenRouter, "not_listed");
  assert.ok(result.models.every(m => m.resale?.correlatedWith === "openrouter"));
});

test("an unreadable OpenRouter leaves the Nous comparison unknown, never assumed", async () => {
  const result = await collectNativePriceCatalogue({
    providers: ["nous"],
    fetchImpl: async input => String(input) === NATIVE_PRICE_SOURCES.openrouter
      ? new Response("down", { status: 503 })
      : Response.json({ data: [{ id: "m/a", pricing: { prompt: "0.000001", completion: "0.000002" } }] }),
  });
  assert.equal(result.models[0]?.resale?.versusOpenRouter, "unknown");
  assert.equal(result.models[0]?.resale?.openRouterPrice, null);
});

test("a failed read of Sail's models page is reported as unavailable, not as no context published", async () => {
  const fs = await import("node:fs");
  const doc = fs.readFileSync("sail-pricing.md");
  const result = await collectNativePriceCatalogue({
    providers: ["sail"],
    apiKeys: { sail: "test-sail-key" },
    fetchImpl: async (input) => String(input) === NATIVE_PRICE_SOURCES.sail
      ? Response.json({ object: "list", data: [{ id: "zai-org/GLM-5.3" }] })
      : String(input).endsWith("/models.md") ? new Response("down", { status: 503 }) : new Response(new Uint8Array(doc)),
  });
  const params = result.providers[0]?.requestParameters;
  assert.equal(params?.contextSourceState, "unavailable");
  assert.equal(params?.contextSourceError, "HTTP_503");
  assert.equal(result.models[0]?.contextLengthLabel, undefined);
  // Prices were read independently and are unaffected.
  assert.equal(params?.pricingDigest, "verified");
});

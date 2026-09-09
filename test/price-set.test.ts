import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeDeepInfra,
} from "../src/catalogue/normalize.js";
import {
  normalizeSailPricingRows,
  pricePointCountsByProvider,
} from "../src/catalogue/price-set.js";

const sourceUrl = "https://example.test/pricing";
const readAt = "2026-09-08T15:00:00.000Z";

test("a token-priced model exposes sourced pricePoints and no scalar pricing alias", () => {
  const model = normalizeDeepInfra(
    {
      model_name: "vendor/model",
      type: "text-generation",
      pricing: {
        type: "tokens",
        cents_per_input_token: "0.0000075",
        cents_per_output_token: "0.00001",
      },
    },
    sourceUrl,
    readAt,
    0,
  ) as unknown as Record<string, unknown>;

  assert.deepEqual(
    (model.pricePoints as Array<Record<string, unknown>>).map((point) => [
      point.unit,
      point.amount,
      point.provenance,
    ]),
    [
      ["token_in", "0.000000075", "published"],
      ["token_out", "0.0000001", "published"],
    ],
  );
  assert.equal(model.pricingState, "published");
  assert.equal(Object.hasOwn(model, "pricing"), false);
});

test("Sail normalizes every latency window into conditioned points", () => {
  const points = normalizeSailPricingRows(
    "Gemma 4 31B IT",
    [
      { window: "Default (ASAP)", input: "0.40", cached: "0.06", output: "0.90" },
      { window: "Balanced", input: "0.20", cached: "0.04", output: "0.70" },
      { window: "Flex", input: "0.06", cached: "0.02", output: "0.50" },
    ],
    "https://docs.sailresearch.com/pricing",
    readAt,
  );

  assert.equal(points.length, 9);
  assert.deepEqual(
    points.filter((point) => point.unit === "token_in").map((point) => point.condition),
    [
      { kind: "latency_window", name: "ASAP" },
      { kind: "latency_window", name: "Balanced" },
      { kind: "latency_window", name: "Flex" },
    ],
  );
  assert.ok(points.every((point) => point.source.readAt === readAt));
});

test("point counts retain provider and model denominators", () => {
  const counts = pricePointCountsByProvider([
    {
      provider: "sail",
      id: "one",
      pricePoints: normalizeSailPricingRows(
        "one",
        [{ window: "Flex", input: "0.06", cached: "0.02", output: "0.50" }],
        sourceUrl,
        readAt,
      ),
    },
    { provider: "cerebras", id: "two", pricePoints: [] },
  ]);

  assert.deepEqual(counts, [
    { provider: "cerebras", models: 1, pricePoints: 0, modelsWithoutPrice: 1, unknownPricing: 0 },
    { provider: "sail", models: 1, pricePoints: 3, modelsWithoutPrice: 0, unknownPricing: 0 },
  ]);
});

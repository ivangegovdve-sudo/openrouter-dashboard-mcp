import assert from "node:assert/strict";
import test from "node:test";

import { PROVIDER_REGISTRY } from "../src/providers/registry.js";

test("Cerebras native pricing evidence is attached to exact catalogue identities", () => {
  const evidence = PROVIDER_REGISTRY.cerebras.catalogueEvidence;
  assert.ok(evidence);
  assert.equal(evidence.sources.find((source) => source.kind === "api")?.url, "https://api.cerebras.ai/v1/models");
  assert.equal(evidence.sources.find((source) => source.kind === "pricing_page")?.url, "https://www.cerebras.ai/pricing");
  assert.equal(evidence.sources.find((source) => source.kind === "pricing_page")?.observedAt, "2026-09-08");
  assert.deepEqual(evidence.models, [
    {
      modelId: "gemma-4-31b",
      status: "not_published",
      promptUsdPerMillion: null,
      completionUsdPerMillion: null,
      sourceUrl: "https://www.cerebras.ai/pricing",
      observedAt: "2026-09-08",
      reason: "Preview models are intended for evaluation purposes only.",
    },
    {
      modelId: "gpt-oss-120b",
      status: "priced",
      precision: "approximate",
      promptUsdPerMillion: "0.35",
      completionUsdPerMillion: "0.75",
      sourceUrl: "https://www.cerebras.ai/pricing",
      observedAt: "2026-09-08",
      reason: null,
    },
    {
      modelId: "qwen-3.8-27b",
      status: "priced",
      precision: "approximate",
      promptUsdPerMillion: "0.99",
      completionUsdPerMillion: "1.49",
      sourceUrl: "https://www.cerebras.ai/pricing",
      observedAt: "2026-09-08",
      reason: null,
    },
  ]);
});

test("Sail identifies its pinned document instead of an invented catalogue API", () => {
  assert.equal(PROVIDER_REGISTRY.sail.catalogueUrl, "https://docs.sailresearch.com/pricing.md");
  const evidence = PROVIDER_REGISTRY.sail.catalogueEvidence;
  assert.ok(evidence);
  assert.deepEqual(evidence.sources, [{
    kind: "pinned_document",
    url: "https://docs.sailresearch.com/pricing.md",
    observedAt: "2026-09-08",
    sha256: "32447697c3305a5bc8c5c40c9923e1b81aaefbc5ab8092ee59fb94dfdfd017e6",
  }]);
  assert.equal(evidence.models, undefined);
});

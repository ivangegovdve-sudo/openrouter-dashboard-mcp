import assert from "node:assert/strict";
import test from "node:test";

import { generationCostCellSummarySchema, generationCostObservationSchema } from "../src/generation-cost.js";

const base = {
  id: "generation-1",
  provider: "openrouter",
  upstreamProvider: "ExampleProvider",
  model: "example/model",
  observedAt: "2026-09-11T10:00:00.000Z",
  provenanceDate: "2026-09-11T10:00:00.000Z",
  workload: { name: "smoke generation", inputTokens: "10", outputTokens: "3", maxOutputTokens: "8" },
  vantagePoint: "Windows workstation / Sofia public internet",
  tokenCounts: { input: "10", output: "3", total: "13" },
  costUsd: "0.00000123",
  costState: "MEASURED" as const,
  provenance: "MEASURED" as const,
  balanceDeltaUsd: null,
  authoritativeField: "usage.cost",
  sourceUrl: "https://openrouter.ai/api/v1/chat/completions",
  latency: {
    ttftMs: "120",
    roundTripMs: "450",
    sustainedThroughputTps: "6.66",
    workload: { name: "smoke generation", inputTokens: "10", outputTokens: "3", maxOutputTokens: "8" },
    vantagePoint: "Windows workstation / Sofia public internet",
    tokenBudget: { inputTokens: "10", outputTokens: "8" },
    n: "1",
    percentileMethod: "single_observation" as const,
    observedAt: "2026-09-11T10:00:00.000Z",
  },
  note: "Captured from the provider response; no catalogue arithmetic used.",
};

test("accepts a measured authoritative per-generation cost", () => {
  assert.equal(generationCostObservationSchema.parse(base).costState, "MEASURED");
});

test("rejects a zero balance delta as a zero measured cost", () => {
  assert.throws(
    () => generationCostObservationSchema.parse({ ...base, costState: "LAG", costUsd: "0", provenance: "UNKNOWN", balanceDeltaUsd: "0", authoritativeField: null }),
    /lagging balance|LAG records|Measured cost/,
  );
});

test("blocked providers carry no numeric generation cost", () => {
  assert.throws(
    () => generationCostObservationSchema.parse({ ...base, provider: "nous", upstreamProvider: "nous", costState: "BLOCKED", costUsd: "0.072", provenance: "PUBLISHED", authoritativeField: null }),
    /Blocked cost/,
  );
});

test("a cell needs three observations before it can expose a measured range", () => {
  const baseSummary = {
    provider: "openrouter",
    model: "example/model",
    workload: base.workload,
    vantagePoint: base.vantagePoint,
    n: "2",
    upstreamProviderCount: "1",
    upstreamProviders: ["ExampleProvider"],
    minimumN: "3",
    minimumDistinctUpstreamProviders: "1",
    measurementState: "INSUFFICIENT_EVIDENCE" as const,
    provenance: "UNKNOWN" as const,
    rangeUsd: null,
    observedAt: base.observedAt,
    provenanceDate: base.provenanceDate,
    note: "INSUFFICIENT EVIDENCE: need at least 3 observations.",
  };
  assert.equal(generationCostCellSummarySchema.parse(baseSummary).measurementState, "INSUFFICIENT_EVIDENCE");
  assert.equal(generationCostCellSummarySchema.parse({
    ...baseSummary,
    n: "3",
    measurementState: "MEASURED_RANGE",
    provenance: "MEASURED" as const,
    rangeUsd: { min: "0.00000100", max: "0.00000400" },
    note: "Measured range across routed upstream providers; no single cost is representative.",
  }).measurementState, "MEASURED_RANGE");
});

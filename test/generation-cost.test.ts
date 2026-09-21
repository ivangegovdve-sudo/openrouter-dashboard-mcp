import assert from "node:assert/strict";
import test from "node:test";

import { generationCostCellSummarySchema, generationCostObservationSchema } from "../src/generation-cost.js";
import {
  appendGenerationCostObservation,
  buildMeasuredCostLedger,
  latestMeasuredGenerationCost,
  publicMeasuredCostsResponseSchema,
  recordGenerationCostOutcome,
} from "../src/measured-cost-ledger.js";

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
  measurementSource: "live_provider_read" as const,
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
  const parsed = generationCostObservationSchema.parse(base);
  assert.equal(parsed.costState, "MEASURED");
  assert.equal(parsed.measurementSource, "live_provider_read");
});

test("a missing measurement source remains explicitly unknown", () => {
  const { measurementSource: _measurementSource, ...legacy } = base;
  assert.equal(generationCostObservationSchema.parse(legacy).measurementSource, "unknown");
});

test("a measured cost records whether it came from a fixture or a live provider read", () => {
  const fixture = generationCostObservationSchema.parse({
    ...base,
    measurementSource: "fixture",
  });
  assert.equal(fixture.measurementSource, "fixture");
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

test("a real provider result appends a measured observation and refreshes its timestamp", () => {
  const { costState: _costState, provenance: _provenance, ...outcome } = base;
  const observation = recordGenerationCostOutcome(outcome);
  const ledger = appendGenerationCostObservation([], observation);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0]?.costState, "MEASURED");
  assert.equal(ledger[0]?.measurementSource, "live_provider_read");
  assert.equal(latestMeasuredGenerationCost(ledger, {
    now: "2026-09-11T10:00:01.000Z",
    freshnessTtlSeconds: 86_400,
  }).value, "0.00000123");
  const envelope = buildMeasuredCostLedger(ledger, {
    now: "2026-09-11T10:00:01.000Z",
    freshnessTtlSeconds: 86_400,
  });
  assert.equal(envelope.freshnessTtlSeconds, 86_400);
  assert.equal(envelope.observations[0]?.measurementSource, "live_provider_read");
});

test("a provider-reported zero charge is measurable, including local zero-cost models", () => {
  const { costState: _costState, provenance: _provenance, ...outcome } = base;
  const observation = recordGenerationCostOutcome({ ...outcome, id: "zero-cost", costUsd: "0" });
  assert.equal(observation.costState, "MEASURED");
  assert.equal(observation.costUsd, "0");
});

test("a zero balance delta remains LAG and cannot become a free generation", () => {
  const { costState: _costState, provenance: _provenance, ...outcome } = base;
  const observation = recordGenerationCostOutcome({
    ...outcome,
    id: "lagging",
    costUsd: null,
    balanceDeltaUsd: "0",
    authoritativeField: null,
  });
  assert.equal(observation.costState, "LAG");
  assert.equal(observation.costUsd, null);
  assert.equal(latestMeasuredGenerationCost([observation], {
    now: "2026-09-11T10:00:01.000Z",
    freshnessTtlSeconds: 86_400,
  }).state, "unknown");
});

test("measured cost expires explicitly instead of being reused", () => {
  const { costState: _costState, provenance: _provenance, ...outcome } = base;
  const observation = recordGenerationCostOutcome(outcome);
  assert.equal(latestMeasuredGenerationCost([observation], {
    now: "2026-09-12T10:00:01.000Z",
    freshnessTtlSeconds: 86_400,
  }).state, "expired");
});

test("the public measured-cost contract omits private usage fields", () => {
  const response = publicMeasuredCostsResponseSchema.parse({
    schemaVersion: "2.0",
    data: [{
      slug: "local/example",
      routedProvider: "local",
      measuredCostUsd: "0",
      observedAt: base.observedAt,
      method: "local process accounting",
      provenance: "MEASURED",
      measurementSource: "live_provider_read",
      freshnessTtlSeconds: 86_400,
      expiresAt: "2026-09-12T10:00:00.000Z",
      sourceUrl: "https://example.test/measurement",
    }],
    cursor: null,
    window: { start: "2026-09-11", end: "2026-09-11", timezone: "UTC", inclusive: true, basis: "observed" },
    completeness: { acquisitionComplete: true, populationCompleteness: "requested_slice", missingFields: [] },
    stale: false,
    rank: null,
    provenance: [],
  });
  assert.equal(response.data[0]?.measuredCostUsd, "0");
  assert.equal(response.data[0]?.measurementSource, "live_provider_read");
  assert.equal("balance" in response.data[0]!, false);
  assert.equal("tokenCounts" in response.data[0]!, false);
});

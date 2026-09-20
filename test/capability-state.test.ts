import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCapabilityState,
  capabilityStateOutputSchema,
  runCapabilityState,
} from "../src/tools/capability-state.js";
import { generationCostObservationSchema } from "../src/generation-cost.js";
import { liveModelFixture, manifestFixture, publicCompleteness, publicProvenance, publicWindow } from "./fixtures.js";

const observedAt = "2026-09-20T08:00:00.000Z";
const liveModelsEndpoint = "/api/public/v2/live-models";

function row(overrides: Record<string, unknown> = {}) {
  return {
    ...liveModelFixture,
    lastSeenAt: observedAt,
    lastConfirmedAt: observedAt,
    ...overrides,
  } as never;
}

function collection(data: unknown[], cursor: string | null = null) {
  return {
    schemaVersion: "2.0",
    data,
    cursor,
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  };
}

test("emits one explicit state row with evidence-shaped fields", () => {
  const state = buildCapabilityState({
    rows: [row()],
    sourceStale: false,
    observedAt,
    now: "2026-09-20T09:00:00.000Z",
    freshnessTtlSeconds: 86_400,
  });

  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.equal(parsed.rows.length, 1);
  assert.ok(parsed.providers.some((provider) => provider.id === "openrouter" && provider.directAdapter));
  const item = parsed.rows[0]!;
  assert.equal(item.key, "openrouter:example/very-large-model");
  assert.equal(item.contextWindow.state, "known");
  assert.equal(item.contextWindow.value, "90071992547409930001");
  assert.equal(item.toolCalling.state, "unknown");
  assert.equal(item.modelFamily.state, "unknown");
  assert.equal(item.costPerGeneration.state, "unknown");
  assert.equal(item.reachability.state, "unknown");
  assert.equal(item.functionality.resolves.state, "unknown");
  assert.equal(item.functionality.structuredOutputOk.state, "unknown");
  assert.equal(item.functionality.p50Latency.state, "unknown");
  assert.equal(item.functionality.p95Latency.state, "unknown");
  assert.equal(item.functionality.semanticQuality.state, "unknown");
  assert.equal(item.selection.publicCouncil.state, "unknown");
  assert.equal(item.selection.innerObserver.state, "unknown");
  assert.equal(parsed.queries.publicCouncil.decisionState, "blocked");
  assert.equal(parsed.queries.innerObserver.decisionState, "blocked");
  assert.ok(parsed.queries.publicCouncil.missingFields.includes("costPerGeneration"));
  assert.ok(parsed.queries.innerObserver.missingFields.includes("functionality.semanticQuality"));
});

test("marks retained observations expired instead of using them for selection", () => {
  const state = buildCapabilityState({
    rows: [row()],
    sourceStale: false,
    observedAt,
    now: "2026-09-22T09:00:00.000Z",
    freshnessTtlSeconds: 86_400,
  });

  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  const item = parsed.rows[0]!;
  assert.equal(item.contextWindow.state, "expired");
  assert.equal(item.catalogueAvailability.state, "expired");
  assert.equal(item.selection.publicCouncil.state, "unknown");
});

test("does not call catalogue prices real generation cost", () => {
  const state = buildCapabilityState({
    rows: [row()],
    sourceStale: false,
    observedAt,
    now: "2026-09-20T09:00:00.000Z",
    freshnessTtlSeconds: 86_400,
  });
  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  const item = parsed.rows[0]!;
  assert.equal(item.cataloguePrice.state, "known");
  assert.equal(item.costPerGeneration.state, "unknown");
});

test("public council ranks measured generation charges, never catalogue prices", () => {
  const measured = (id: string, costUsd: string) => generationCostObservationSchema.parse({
    id: `observation-${id}`,
    provider: "openrouter",
    upstreamProvider: "upstream",
    model: id,
    observedAt,
    provenanceDate: observedAt,
    workload: { name: "selection probe", inputTokens: "10", outputTokens: "5", maxOutputTokens: "8" },
    vantagePoint: "test workstation",
    tokenCounts: { input: "10", output: "5", total: "15" },
    costUsd,
    costState: "MEASURED",
    provenance: "MEASURED",
    httpStatus: 200,
    balanceDeltaUsd: null,
    authoritativeField: "usage.cost",
    sourceUrl: "https://provider.test/generation",
    latency: {
      ttftMs: "10",
      roundTripMs: "20",
      sustainedThroughputTps: "1",
      workload: { name: "selection probe", inputTokens: "10", outputTokens: "5", maxOutputTokens: "8" },
      vantagePoint: "test workstation",
      tokenBudget: { inputTokens: "10", outputTokens: "8" },
      n: "3",
      percentileMethod: "median",
      observedAt,
    },
    note: "Measured in the test fixture.",
  });
  const state = buildCapabilityState({
    rows: [
      row({ id: "expensive", generationCosts: [measured("expensive", "0.20")] }),
      row({ id: "cheap", generationCosts: [measured("cheap", "0.02")] }),
    ],
    sourceStale: false,
    observedAt,
    now: "2026-09-20T09:00:00.000Z",
    freshnessTtlSeconds: 86_400,
  });
  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.equal(parsed.queries.publicCouncil.decisionState, "decidable");
  assert.equal(parsed.queries.publicCouncil.selected?.id, "cheap");
});

test("the registered state read scans live rows and carries source evidence", async () => {
  const client = {
    async get(path: string, _query: URLSearchParams, schema: { parse: (value: unknown) => unknown }) {
      if (path === "/api/public/v2/manifest") return schema.parse(manifestFixture);
      assert.equal(path, liveModelsEndpoint);
      return schema.parse(collection([row()]));
    },
  } as never;
  const result = await runCapabilityState({}, { client, now: () => new Date("2026-09-20T09:00:00.000Z") });
  const parsed = capabilityStateOutputSchema.parse(result);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.deepEqual(parsed.evidence.map((entry) => entry.endpoint), ["/api/public/v2/manifest", liveModelsEndpoint]);
  assert.equal(parsed.pagination.capped, false);
});

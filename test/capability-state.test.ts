import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCapabilityState,
  capabilityStateOutputSchema,
} from "../src/tools/capability-state.js";
import { liveModelFixture } from "./fixtures.js";

const observedAt = "2026-09-20T08:00:00.000Z";

function row(overrides: Record<string, unknown> = {}) {
  return {
    ...liveModelFixture,
    lastSeenAt: observedAt,
    lastConfirmedAt: observedAt,
    ...overrides,
  } as never;
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

import assert from "node:assert/strict";
import test from "node:test";

import {
  CAPABILITY_STATE_MAX_ROWS,
  buildCapabilityState,
  capabilityStateInputSchema,
  capabilityStateOutputSchema,
  functionalityLedgerEntrySchema,
  modelCapabilityLedgerEntrySchema,
  modelLineageLedgerEntrySchema,
  runCapabilityState,
} from "../src/tools/capability-state.js";
import { generationCostObservationSchema } from "../src/generation-cost.js";
import { liveModelFixture, manifestFixture, publicCompleteness, publicProvenance, publicWindow } from "./fixtures.js";

const observedAt = "2026-09-20T08:00:00.000Z";
const checkedAt = "2026-09-20T09:00:00.000Z";
const liveModelsEndpoint = "/api/public/v2/live-models";

test("capability state defaults to the transport-safe 500-row bound", () => {
  assert.equal(CAPABILITY_STATE_MAX_ROWS, 500);
  assert.equal(capabilityStateInputSchema.parse({}).max_rows, 500);
  assert.throws(
    () => capabilityStateInputSchema.parse({ max_rows: 501 }),
    /too_big|less than or equal|500/i,
  );
});

function row(overrides: Record<string, unknown> = {}) {
  return {
    ...liveModelFixture,
    pricePoints: liveModelFixture.pricePoints.map((point) => ({
      ...point,
      source: { ...point.source, readAt: observedAt },
    })),
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

function measured(id: string, costUsd: string, extra: Record<string, unknown> = {}) {
  return generationCostObservationSchema.parse({
    id: "observation-" + id,
    provider: "openrouter",
    upstreamProvider: "routed-provider",
    model: id,
    observedAt,
    provenanceDate: observedAt,
    workload: {
      name: "selection probe",
      inputTokens: "10",
      outputTokens: "5",
      maxOutputTokens: "8",
    },
    vantagePoint: "test workstation",
    tokenCounts: { input: "10", output: "5", total: "15" },
    costUsd,
    costState: "MEASURED",
    provenance: "MEASURED",
    measurementSource: "fixture",
    httpStatus: null,
    errorBucket: null,
    balanceDeltaUsd: null,
    authoritativeField: "usage.cost",
    sourceUrl: "https://provider.test/generation",
    latency: {
      ttftMs: "10",
      roundTripMs: "20",
      sustainedThroughputTps: "1",
      workload: {
        name: "selection probe",
        inputTokens: "10",
        outputTokens: "5",
        maxOutputTokens: "8",
      },
      vantagePoint: "test workstation",
      tokenBudget: { inputTokens: "10", outputTokens: "8" },
      n: "3",
      percentileMethod: "median",
      observedAt,
    },
    note: "Measured in the test fixture.",
    ...extra,
  });
}

function fact<T>(value: T, source = "https://ledger.test/state") {
  return {
    state: "known" as const,
    value,
    observed_at: observedAt,
    checked_at: checkedAt,
    expires_at: "2026-09-21T08:00:00.000Z",
    age_seconds: 3_600,
    source,
    reason: null,
  };
}

function functionalityEntry(slug = liveModelFixture.id) {
  return functionalityLedgerEntrySchema.parse({
    slug,
    catalogue_provider: "openrouter",
    resolves: fact(true),
    structured_output_ok: fact(true),
    p50_latency: fact("25000"),
    p95_latency: fact("50000"),
    latency_bound_ms: fact("60000"),
    last_functionally_tested: fact(observedAt),
    semantic_quality: { ...fact("pass" as const), judge_hook: "reserved_for_external_semantic_judge" },
    probe_http_status: 200,
    probe_error_bucket: null,
    note: "Mechanical probe and external semantic judgment fixture.",
  });
}

function capabilityEntry(slug = liveModelFixture.id) {
  return modelCapabilityLedgerEntrySchema.parse({
    slug,
    catalogue_provider: "openrouter",
    supports_tool_calling: fact(true),
    input_modalities: fact(["text"]),
    note: "Explicit capability evidence fixture.",
  });
}

function lineageEntry(slug = liveModelFixture.id) {
  return modelLineageLedgerEntrySchema.parse({
    slug,
    catalogue_provider: "openrouter",
    model_family: fact("qwen3"),
    base_weights_lineage: fact("qwen3-base"),
    note: "Explicit lineage evidence fixture.",
  });
}

test("emits one explicit snake_case row and preserves the five empty adapters", () => {
  const state = buildCapabilityState({
    rows: [row()],
    sourceStale: false,
    observedAt,
    now: checkedAt,
    freshnessTtlSeconds: 86_400,
  });

  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.equal(parsed.schema_version, "1.1");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0]!.slug, "example/very-large-model");
  assert.equal(parsed.rows[0]!.catalogue_provider, "openrouter");
  assert.equal(parsed.rows[0]!.context_window.state, "known");
  assert.equal(parsed.rows[0]!.context_window.value, "90071992547409930001");
  assert.equal(parsed.rows[0]!.billing_class.value, "paid");
  assert.equal(parsed.rows[0]!.supports_tool_calling.state, "unknown");
  assert.equal(parsed.rows[0]!.input_modalities.state, "unknown");
  assert.equal(parsed.rows[0]!.model_family.state, "unknown");
  assert.equal(parsed.rows[0]!.base_weights_lineage.state, "unknown");
  assert.equal(parsed.rows[0]!.generation_cost.state, "unknown");
  assert.equal(parsed.rows[0]!.reachability.state, "unknown");
  assert.equal(parsed.rows[0]!.functionality.resolves.state, "unknown");
  assert.equal(parsed.rows[0]!.functionality.structured_output_ok.state, "unknown");
  assert.equal(parsed.rows[0]!.functionality.semantic_quality.state, "unknown");
  assert.equal(parsed.rows[0]!.selection.public_council.state, "unknown");
  assert.equal(parsed.rows[0]!.selection.private_council.state, "unknown");
  assert.equal(parsed.providers.find((item) => item.id === "openrouter")?.no_live_rows_reason, null);
  assert.equal(parsed.functionality_ledger.state, "unavailable");
  assert.equal(parsed.model_lineage_ledger.state, "unavailable");
  assert.equal(parsed.capability_ledger.state, "unavailable");
  assert.equal(parsed.measurement.version, "basket-v1");
  assert.equal(parsed.measurement.resultSnapshots.state, "BLOCKED");
  for (const provider of ["crazyrouter", "fal", "nous", "sail", "wavespeed"]) {
    assert.equal(parsed.providers.find((item) => item.id === provider)?.state, "no_live_rows");
  }
  assert.deepEqual(
    parsed.providers
      .filter((item) => ["crazyrouter", "fal", "nous", "sail", "wavespeed"].includes(item.id))
      .map((item) => [item.id, item.no_live_rows_reason]),
    [
      ["crazyrouter", "no_key"],
      ["fal", "endpoint_changed"],
      ["nous", "key_unentitled"],
      ["sail", "adapter_broken"],
      ["wavespeed", "genuinely_empty"],
    ],
  );
  assert.equal(parsed.queries.public_council.decision_state, "blocked");
  assert.equal(parsed.queries.private_council.decision_state, "blocked");
});

test("marks retained values expired and clears the expired value", () => {
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
  assert.equal(item.context_window.state, "expired");
  assert.equal(item.context_window.value, null);
  assert.equal(item.context_window.observed_at, observedAt);
  assert.equal(item.context_window.age_seconds, 176_400);
  assert.equal(item.catalogue_price.state, "expired");
  assert.equal(item.catalogue_price.value, null);
  assert.equal(item.selection.public_council.state, "unknown");
});

test("does not call catalogue prices real generation cost", () => {
  const publishedEstimate = generationCostObservationSchema.parse({
    id: "published-estimate",
    provider: "openrouter",
    upstreamProvider: "upstream",
    model: "example/very-large-model",
    observedAt,
    provenanceDate: observedAt,
    workload: { name: "catalogue estimate", inputTokens: "10", outputTokens: "5", maxOutputTokens: "8" },
    vantagePoint: "published rate card",
    tokenCounts: { input: "10", output: "5", total: "15" },
    costUsd: "0.02",
    costState: "PUBLISHED_ESTIMATE",
    provenance: "PUBLISHED",
    measurementSource: "unknown",
    balanceDeltaUsd: null,
    authoritativeField: null,
    sourceUrl: "https://provider.test/pricing",
    latency: {
      ttftMs: null,
      roundTripMs: null,
      sustainedThroughputTps: null,
      workload: { name: "catalogue estimate", inputTokens: "10", outputTokens: "5", maxOutputTokens: "8" },
      vantagePoint: "published rate card",
      tokenBudget: { inputTokens: "10", outputTokens: "8" },
      n: "0",
      percentileMethod: "published",
      observedAt,
    },
    note: "Published estimate; no inference charge was observed.",
  });
  const state = buildCapabilityState({
    rows: [row({ generationCosts: [publishedEstimate] })],
    sourceStale: false,
    observedAt,
    now: checkedAt,
    freshnessTtlSeconds: 86_400,
  });
  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.equal(parsed.rows[0]!.catalogue_price.state, "known");
  assert.equal(parsed.rows[0]!.generation_cost.state, "unknown");
  assert.equal(parsed.queries.public_council.decision_state, "blocked");
});

test("public council is literally cheapest paid and does not add a reachability criterion", () => {
  const cheap = measured("cheap", "0.02");
  const expensive = measured("expensive", "0.20");
  const state = buildCapabilityState({
    rows: [
      row({ id: "expensive", generationCosts: [expensive] }),
      row({ id: "cheap", generationCosts: [cheap] }),
    ],
    sourceStale: false,
    observedAt,
    now: checkedAt,
    freshnessTtlSeconds: 86_400,
  });
  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.equal(parsed.rows.find((item) => item.slug === "cheap")!.reachability.state, "unknown");
  assert.equal(parsed.queries.public_council.decision_state, "decidable");
  assert.equal(parsed.queries.public_council.selected?.slug, "cheap");
  assert.equal(parsed.queries.public_council.selected?.measured_cost_usd, "0.02");
  assert.equal(parsed.queries.public_council.selected?.measured_cost_source, "fixture");
  assert.equal(parsed.queries.private_council.decision_state, "blocked");
});

test("unknown measurement source stays visible and blocks a council decision", () => {
  const unknownSource = measured(liveModelFixture.id, "0.02", { measurementSource: "unknown" });
  const state = buildCapabilityState({
    rows: [row({ generationCosts: [unknownSource] })],
    sourceStale: false,
    observedAt,
    now: checkedAt,
    freshnessTtlSeconds: 86_400,
  });
  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.equal(parsed.rows[0]!.generation_cost.value?.[0]?.measurementSource, "unknown");
  assert.equal(parsed.queries.public_council.decision_state, "blocked");
  assert.ok(parsed.queries.public_council.elimination_breakdown.counts.generation_cost_source_unknown);
  assert.ok(parsed.queries.public_council.missing_fields.includes("generation_cost_source"));
});

test("measured cost has its own shorter freshness window", () => {
  const state = buildCapabilityState({
    rows: [row({ generationCosts: [measured(liveModelFixture.id, "0.02", { httpStatus: 200 })] })],
    sourceStale: false,
    observedAt,
    now: "2026-09-20T10:00:00.000Z",
    freshnessTtlSeconds: 7 * 24 * 60 * 60,
    generationCostTtlSeconds: 3_600,
  });
  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.equal(parsed.rows[0]!.generation_cost.state, "expired");
  assert.equal(parsed.rows[0]!.generation_cost.value, null);
  assert.equal(parsed.queries.public_council.decision_state, "blocked");
});

test("a numeric cost with unknown source cannot make the council decidable", () => {
  const state = buildCapabilityState({
    rows: [row({ generationCosts: [measured(liveModelFixture.id, "0.02", { measurementSource: "unknown" })] })],
    sourceStale: false,
    observedAt,
    now: checkedAt,
    freshnessTtlSeconds: 86_400,
  });
  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.equal(parsed.queries.public_council.decision_state, "blocked");
  assert.equal(parsed.queries.public_council.selected, null);
  assert.equal(
    parsed.queries.public_council.elimination_breakdown.counts.generation_cost_source_unknown,
    1,
  );
});

test("a measured cost from an older route cannot decide the current routed provider", () => {
  const olderMeasured = measured(liveModelFixture.id, "0.02", {
    upstreamProvider: "provider-a",
  });
  const newerLag = generationCostObservationSchema.parse({
    ...olderMeasured,
    id: "observation-provider-b-lag",
    upstreamProvider: "provider-b",
    observedAt: "2026-09-20T08:30:00.000Z",
    provenanceDate: "2026-09-20T08:30:00.000Z",
    costUsd: null,
    costState: "LAG",
    provenance: "UNKNOWN",
    measurementSource: "live_provider_read",
    balanceDeltaUsd: "0",
    authoritativeField: null,
  });
  const state = buildCapabilityState({
    rows: [row({ generationCosts: [olderMeasured, newerLag] })],
    sourceStale: false,
    observedAt,
    now: checkedAt,
    freshnessTtlSeconds: 86_400,
  });
  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.equal(parsed.rows[0]!.routed_provider.value, "provider-b");
  assert.equal(parsed.queries.public_council.decision_state, "blocked");
  assert.equal(parsed.queries.public_council.selected, null);
});

test("private council requires the full functionality and lineage/capability ledgers", () => {
  const state = buildCapabilityState({
    rows: [row({ generationCosts: [measured(liveModelFixture.id, "0.02", { httpStatus: 200 })] })],
    sourceStale: false,
    observedAt,
    now: checkedAt,
    freshnessTtlSeconds: 86_400,
    functionalityLedger: [functionalityEntry()],
    modelCapabilityLedger: [capabilityEntry()],
    modelLineageLedger: [lineageEntry()],
  });
  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  const item = parsed.rows[0]!;
  assert.equal(item.supports_tool_calling.value, true);
  assert.deepEqual(item.input_modalities.value, ["text"]);
  assert.equal(item.model_family.value, "qwen3");
  assert.equal(item.base_weights_lineage.value, "qwen3-base");
  assert.equal(item.reachability.state, "live");
  assert.equal(parsed.queries.private_council.decision_state, "decidable");
  assert.equal(parsed.queries.private_council.selected?.slug, liveModelFixture.id);
});

test("private council keeps UNKNOWN lineage out of an otherwise functional row", () => {
  const state = buildCapabilityState({
    rows: [row({ generationCosts: [measured(liveModelFixture.id, "0.02", { httpStatus: 200 })] })],
    sourceStale: false,
    observedAt,
    now: checkedAt,
    freshnessTtlSeconds: 86_400,
    functionalityLedger: [functionalityEntry()],
    modelCapabilityLedger: [capabilityEntry()],
  });
  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.equal(parsed.queries.private_council.decision_state, "blocked");
  assert.ok(parsed.queries.private_council.missing_fields.includes("model_family"));
  assert.ok(parsed.queries.private_council.missing_fields.includes("base_weights_lineage"));
});

test("dead or stale probes retain bucketed evidence without becoming live", () => {
  const deadProbe = generationCostObservationSchema.parse({
    ...measured("dead", "0.00"),
    id: "dead-probe",
    model: liveModelFixture.id,
    costUsd: null,
    costState: "UNKNOWN",
    provenance: "UNKNOWN",
    httpStatus: 404,
    errorBucket: "not_found",
    authoritativeField: null,
  });
  const state = buildCapabilityState({
    rows: [row({ generationCosts: [deadProbe] })],
    sourceStale: false,
    observedAt,
    now: checkedAt,
    freshnessTtlSeconds: 86_400,
  });
  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.equal(parsed.rows[0]!.reachability.state, "unknown");
  assert.equal(parsed.rows[0]!.reachability.http_status, 404);
  assert.equal(parsed.rows[0]!.reachability.error_bucket, "not_found");
  assert.equal(parsed.rows[0]!.generation_cost.state, "unknown");
});

test("functionality probe supplies reachability when no generation charge is readable", () => {
  const state = buildCapabilityState({
    rows: [row()],
    sourceStale: false,
    observedAt,
    now: checkedAt,
    freshnessTtlSeconds: 86_400,
    functionalityLedger: [{
      ...functionalityEntry(),
      probe_http_status: 429,
      probe_error_bucket: "rate_limit",
    }],
  });
  const parsed = capabilityStateOutputSchema.parse(state);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.equal(parsed.rows[0]!.generation_cost.state, "unknown");
  assert.equal(parsed.rows[0]!.reachability.state, "rate_limited");
  assert.equal(parsed.rows[0]!.reachability.http_status, 429);
  assert.equal(parsed.rows[0]!.reachability.error_bucket, "rate_limit");
});

test("the registered state reads a generation-cost source when the manifest advertises it", async () => {
  const cost = measured(liveModelFixture.id, "0.02");
  const client = {
    async get(path: string, _query: URLSearchParams, schema: { parse: (value: unknown) => unknown }) {
      if (path === "/api/public/v2/manifest") {
        return schema.parse({
          ...manifestFixture,
          routes: [...manifestFixture.routes, "/api/public/v2/generation-costs"],
        });
      }
      if (path === liveModelsEndpoint) return schema.parse(collection([row()]));
      assert.equal(path, "/api/public/v2/generation-costs");
      return schema.parse({
        ...collection([cost]),
        summaries: [],
        policies: [],
      });
    },
  } as never;
  const result = await runCapabilityState({}, {
    client,
    now: () => new Date(checkedAt),
  });
  const parsed = capabilityStateOutputSchema.parse(result);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.deepEqual(parsed.source_endpoints, [liveModelsEndpoint, "/api/public/v2/generation-costs"]);
  assert.equal(parsed.rows[0]!.generation_cost.value?.[0]?.costUsd, "0.02");
  assert.equal(parsed.rows[0]!.routed_provider.value, "routed-provider");
});

test("the registered state falls back to the privacy-safe published measured-cost ledger", async () => {
  const client = {
    async get(path: string, _query: URLSearchParams, schema: { parse: (value: unknown) => unknown }) {
      if (path === "/api/public/v2/manifest") {
        return schema.parse({
          ...manifestFixture,
          routes: [...manifestFixture.routes, "/api/public/v2/measured-costs"],
        });
      }
      if (path === liveModelsEndpoint) return schema.parse(collection([row()]));
      assert.equal(path, "/api/public/v2/measured-costs");
      return schema.parse({
        schemaVersion: "2.0",
        data: [{
          slug: liveModelFixture.id,
          routedProvider: "sail",
          measuredCostUsd: "0.00000357",
          observedAt: checkedAt,
          method: "provider settled usage breakdown",
          provenance: "MEASURED",
          measurementSource: "fixture",
          freshnessTtlSeconds: 86_400,
          expiresAt: "2026-09-21T09:00:00.000Z",
          sourceUrl: "https://api.sailresearch.com/v2/usage/breakdown",
        }],
        cursor: null,
        window: { start: "2026-09-20", end: "2026-09-20", timezone: "UTC", inclusive: true, basis: "observed" },
        completeness: { acquisitionComplete: true, populationCompleteness: "requested_slice", missingFields: [] },
        stale: false,
        rank: null,
        provenance: [],
      });
    },
  } as never;
  const result = await runCapabilityState({}, { client, now: () => new Date("2026-09-20T09:00:00.000Z") });
  const parsed = capabilityStateOutputSchema.parse(result);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.deepEqual(parsed.source_endpoints, [liveModelsEndpoint, "/api/public/v2/measured-costs"]);
  assert.equal(parsed.rows[0]!.generation_cost.value?.[0]?.costUsd, "0.00000357");
  assert.equal(parsed.rows[0]!.generation_cost.value?.[0]?.measurementSource, "fixture");
  assert.equal(parsed.queries.public_council.selected?.measured_cost_source, "fixture");
  assert.equal(parsed.rows[0]!.routed_provider.value, "sail");
  assert.equal(parsed.rows[0]!.generation_cost.value?.[0]?.tokenCounts.total, "0");
  assert.match(parsed.rows[0]!.generation_cost.value?.[0]?.note ?? "", /withholds token counts/);
});

test("the registered state scans live rows and carries source evidence", async () => {
  const client = {
    async get(path: string, _query: URLSearchParams, schema: { parse: (value: unknown) => unknown }) {
      if (path === "/api/public/v2/manifest") return schema.parse(manifestFixture);
      assert.equal(path, liveModelsEndpoint);
      return schema.parse(collection([row()]));
    },
  } as never;
  const result = await runCapabilityState({}, { client, now: () => new Date(checkedAt) });
  const parsed = capabilityStateOutputSchema.parse(result);
  assert.equal(parsed.status, "ok");
  if (parsed.status !== "ok") return;
  assert.deepEqual(parsed.evidence.map((entry) => entry.endpoint), ["/api/public/v2/manifest", liveModelsEndpoint]);
  assert.equal(parsed.pagination.capped, false);
});

test("the bounded default preserves full scans beneath its cap and reports explicit caps", async () => {
  const client = {
    async get(path: string, query: URLSearchParams, schema: { parse: (value: unknown) => unknown }) {
      if (path === "/api/public/v2/manifest") return schema.parse(manifestFixture);
      assert.equal(path, liveModelsEndpoint);
      return query.get("cursor") === null
        ? schema.parse(collection([row({ id: "first" })], "next-page"))
        : schema.parse(collection([row({ id: "second" })]));
    },
  } as never;

  const full = capabilityStateOutputSchema.parse(await runCapabilityState({}, {
    client,
    now: () => new Date(checkedAt),
  }));
  assert.equal(full.status, "ok");
  if (full.status !== "ok") return;
  assert.equal(full.pagination.pages_scanned, 2);
  assert.equal(full.pagination.rows_scanned, 2);
  assert.equal(full.pagination.live_rows_returned, 2);
  assert.equal(full.pagination.page_limit, null);
  assert.equal(full.pagination.capped, false);
  assert.equal(full.scope.completeness, "full");
  assert.equal(full.queries.public_council.considered_rows, 2);
  assert.equal(full.queries.public_council.candidate_rows, 0);
  assert.equal(full.queries.public_council.elimination_breakdown.counts.generation_cost_unknown_or_expired, 2);
  assert.deepEqual(full.queries.public_council.elimination_breakdown.not_evaluated, ["family_collision"]);

  const bounded = capabilityStateOutputSchema.parse(await runCapabilityState({ max_rows: 1 }, {
    client,
    now: () => new Date(checkedAt),
  }));
  assert.equal(bounded.status, "ok");
  if (bounded.status !== "ok") return;
  assert.equal(bounded.pagination.pages_scanned, 1);
  assert.equal(bounded.pagination.rows_scanned, 1);
  assert.equal(bounded.pagination.live_rows_returned, 1);
  assert.equal(bounded.pagination.capped, true);
  assert.equal(bounded.pagination.next_cursor, "next-page");
  assert.equal(bounded.scope.completeness, "partial_or_unknown");
  assert.match(bounded.warnings.join("\n"), /declared bound/);
});

test("the default scan stops at the transport-safe row bound", async () => {
  let liveRequests = 0;
  const firstPage = Array.from({ length: 500 }, (_unused, index) => row({ id: `row-${index}` }));
  const client = {
    async get(path: string, _query: URLSearchParams, schema: { parse: (value: unknown) => unknown }) {
      if (path === "/api/public/v2/manifest") return schema.parse(manifestFixture);
      assert.equal(path, liveModelsEndpoint);
      liveRequests += 1;
      return schema.parse(collection(firstPage, "next-page"));
    },
  } as never;

  const result = await runCapabilityState({}, { client, now: () => new Date(checkedAt) });
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(liveRequests, 1);
  assert.equal(result.pagination.live_rows_returned, 500);
  assert.equal(result.pagination.capped, true);
  assert.equal(result.pagination.next_cursor, "next-page");
  assert.equal(result.scope.completeness, "partial_or_unknown");
});

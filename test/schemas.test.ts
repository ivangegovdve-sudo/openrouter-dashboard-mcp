import assert from "node:assert/strict";
import test from "node:test";

import {
  exactDecimalStringSchema,
  exactIntegerStringSchema,
  publicErrorSchema,
} from "../src/dashboard/schemas/common.js";
import {
  publicEntityHistoryResponseSchema,
  publicOverviewHistoryResponseSchema,
} from "../src/dashboard/schemas/history.js";
import {
  publicGitHubHistoryResponseSchema,
  publicGitHubRankingResponseSchema,
} from "../src/dashboard/schemas/github.js";
import { liveModelsResponseSchema } from "../src/dashboard/schemas/live-models.js";
import {
  manifestSchema,
  benchmarksResponseSchema,
  publicAppModelMatrixResponseSchema,
  publicManifestResponseSchema,
} from "../src/dashboard/schemas/openrouter.js";
import {
  appModelMatrixAvailableFixture,
  appModelMatrixUnavailableFixture,
  githubHistoryFixture,
  githubRankingFixture,
  liveModelsFixture,
  manifestFixture,
  opaqueCursor,
  overviewHistoryAvailableFixture,
  overviewHistoryUnavailableFixture,
  publicCompleteness,
  publicProvenance,
  publicWindow,
} from "./fixtures.js";

test("preserves exact integer, decimal, and opaque cursor strings", () => {
  const parsed = liveModelsResponseSchema.parse(liveModelsFixture);

  assert.equal(parsed.data[0]?.contextLength, "90071992547409930001");
  assert.equal(parsed.data[0]?.pricePoints.find((point) => point.unit === "token_in")?.amount, "0.0000001250");
  assert.equal(parsed.data[0]?.performance?.throughputTps, "123.4500");
  assert.equal(parsed.cursor, opaqueCursor);
  assert.equal(exactIntegerStringSchema.safeParse("01").success, false);
  assert.equal(exactDecimalStringSchema.safeParse("1e-6").success, false);
});

test("validates the manifest as its own response family", () => {
  assert.deepEqual(manifestSchema.parse(manifestFixture), manifestFixture);
  assert.deepEqual(publicManifestResponseSchema.parse(manifestFixture), manifestFixture);
  assert.equal(
    manifestSchema.safeParse({ ...manifestFixture, cursor: null }).success,
    false,
  );
});

test("validates both overview-history status variants and entity history cursors", () => {
  assert.equal(
    publicOverviewHistoryResponseSchema.parse(overviewHistoryAvailableFixture)
      .status,
    "available",
  );
  assert.equal(
    publicOverviewHistoryResponseSchema.parse(overviewHistoryUnavailableFixture)
      .status,
    "unavailable",
  );

  const entity = publicEntityHistoryResponseSchema.parse({
    schemaVersion: "2.0",
    entityId: "example/very-large-model",
    factKind: "usage",
    data: [],
    cursor: opaqueCursor,
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    provenance: publicProvenance,
  });
  assert.equal(entity.cursor, opaqueCursor);
});

test("validates both available and unavailable app-model envelopes", () => {
  const available = publicAppModelMatrixResponseSchema.parse(
    appModelMatrixAvailableFixture,
  );
  const unavailable = publicAppModelMatrixResponseSchema.parse(
    appModelMatrixUnavailableFixture,
  );

  assert.equal(available.status, "available");
  assert.equal(available.cells[0]?.state, "observed");
  assert.equal(unavailable.status, "unavailable");
  assert.deepEqual(unavailable.cells, []);
});

test("validates the merged benchmark source and approval-pending matrix reason", () => {
  const benchmarks = benchmarksResponseSchema.parse({
    schemaVersion: "2.0",
    data: [{
      source: "openrouter",
      modelPermaslug: "vendor/model",
      displayName: "Model",
      matchStatus: "unmatched",
      pricing: { prompt: null, completion: null },
      citation: "OpenRouter",
      sourceUrl: null,
      benchmarkType: "gpqa_diamond",
      primaryMetric: null,
      primaryScore: null,
      accuracy: null,
      accuracyStddev: null,
      avgCostPerTask: null,
      avgLatencyPerTaskMs: null,
      totalTasks: null,
      lastRunTimestamp: null,
      searchEngine: null,
      searchSurface: null,
    }],
    cursor: null,
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  });
  assert.equal(benchmarks.data[0]?.source, "openrouter");

  const approvalPending = publicAppModelMatrixResponseSchema.parse({
    ...appModelMatrixUnavailableFixture,
    reason: "approval_incomplete",
  });
  assert.equal(approvalPending.reason, "approval_incomplete");
});

test("validates distinct GitHub ranking and history envelopes without numeric coercion", () => {
  const ranking = publicGitHubRankingResponseSchema.parse(githubRankingFixture);
  const history = publicGitHubHistoryResponseSchema.parse(githubHistoryFixture);

  assert.equal(ranking.data[0]?.stars, "90071992547409930001");
  assert.equal(ranking.page.nextCursor, opaqueCursor);
  assert.equal(history.data[0]?.forks, "90071992547409930000");
  assert.equal(history.page.nextCursor, opaqueCursor);
});

test("validates the separate public error envelope and rejects extra fields", () => {
  const payload = {
    schemaVersion: "2.0",
    error: {
      code: "SOURCE_UNAVAILABLE",
      message: "Source unavailable",
      correlationId: "22222222-2222-4222-8222-222222222222",
      retryable: true,
    },
  };

  assert.deepEqual(publicErrorSchema.parse(payload), payload);
  assert.equal(
    publicErrorSchema.safeParse({ ...payload, responseBody: "private" }).success,
    false,
  );
});

test("a migrated legacy price never invents the source it came from", async () => {
  // WAS A FABRICATION. The legacy-pricing preprocessor hardcoded
  // "https://dashboard.test/api/public/v2/live-models" -- a host that does not resolve --
  // as source.url on every migrated point, and substituted "2026-01-01T00:00:00.000Z"
  // for readAt whenever lastConfirmedAt was missing. Those are the two fields the 1.0
  // contract exists to make trustworthy.
  const { liveModelSchema } = await import("../src/dashboard/schemas/live-models.js");
  const { liveModelFixture } = await import("./fixtures.js");
  const { pricePoints: _points, pricingState: _state, lastConfirmedAt: _confirmed, ...base } = liveModelFixture as Record<string, unknown>;
  const legacy = (extra: Record<string, unknown>) => ({
    ...base,
    pricing: { promptUsdPerToken: "0.0000025", completionUsdPerToken: "0.00001" },
    ...extra,
  });

  const confirmed = liveModelSchema.parse(legacy({ lastConfirmedAt: "2026-08-19T06:00:00.000Z" })) as any;
  assert.equal(confirmed.pricePoints.length, 2);
  for (const point of confirmed.pricePoints) {
    assert.doesNotMatch(point.source.url, /dashboard\.test/, "the migrated URL must not name a nonexistent host");
    assert.equal(point.source.readAt, "2026-08-19T06:00:00.000Z", "readAt must be the record's own confirmed time");
  }

  // The invented "2026-01-01T00:00:00.000Z" readAt fallback was, on inspection,
  // UNREACHABLE: liveModelObjectSchema requires lastConfirmedAt, so a record lacking it
  // is rejected after preprocessing and the fabricated date never reaches a consumer.
  // Only the fabricated URL was ever live. That requirement is what makes the fallback
  // unnecessary, so it is asserted here rather than assumed -- if lastConfirmedAt ever
  // becomes optional, this test fails and the fabrication becomes reachable again.
  const { lastConfirmedAt: _drop, ...withoutConfirmation } = legacy({}) as Record<string, unknown>;
  assert.throws(() => liveModelSchema.parse(withoutConfirmation), /lastConfirmedAt/);
});

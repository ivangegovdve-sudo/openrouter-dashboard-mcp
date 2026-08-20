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
  assert.equal(parsed.data[0]?.pricing.promptUsdPerToken, "0.0000001250");
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

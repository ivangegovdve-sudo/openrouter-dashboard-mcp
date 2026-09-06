import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardClient } from "../src/dashboard/client.js";
import { DashboardRequestError } from "../src/dashboard/errors.js";
import { runBenchmarks } from "../src/tools/benchmarks.js";
import { publicCompleteness, publicProvenance, publicWindow } from "./fixtures.js";

const response = {
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
} as const;

test("reads benchmark observations with the merged source filter contract", async () => {
  let queryText = "";
  const client: DashboardClient = {
    async get(_path, query, schema) {
      queryText = query.toString();
      return schema.parse(response);
    },
  };
  const result = await runBenchmarks(
    { source: "openrouter", limit: 50 },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(queryText, "limit=50&source=openrouter");
  assert.equal(result.response.data[0]?.source, "openrouter");
  assert.deepEqual(result.cap, {
    requestedLimit: 50,
    returnedCount: 1,
    nextCursor: null,
    capped: false,
  });
});

test("keeps a benchmark HTTP failure explicit", async () => {
  const client: DashboardClient = {
    async get() {
      throw new DashboardRequestError(
        "http_error",
        "The dashboard catalogue returned HTTP 503.",
        { retryable: true, status: 503 },
      );
    },
  };
  const result = await runBenchmarks({}, { client });
  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.error.status, 503);
  assert.equal(result.response, null);
  assert.match(result.warnings[0] ?? "", /unavailable/i);
});

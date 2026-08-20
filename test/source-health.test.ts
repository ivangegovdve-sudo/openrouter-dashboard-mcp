import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardClient } from "../src/dashboard/client.js";
import { DashboardRequestError } from "../src/dashboard/errors.js";
import {
  runSourceHealth,
  SOURCE_STATUS_LIMIT,
} from "../src/tools/source-health.js";
import { sourceEvidence, toolResult } from "../src/tools/shared.js";
import {
  manifestFixture,
  publicCompleteness,
  publicProvenance,
  publicWindow,
  sourceStatusFixture,
} from "./fixtures.js";

const sourceStatuses = [
  { ...sourceStatusFixture, sourceId: "models_current" },
  { ...sourceStatusFixture, sourceId: "models_top_weekly" },
  { ...sourceStatusFixture, sourceId: "models_ranked_history" },
  { ...sourceStatusFixture, sourceId: "apps_ranked" },
  { ...sourceStatusFixture, sourceId: "task_classifications" },
  {
    ...sourceStatusFixture,
    sourceId: "benchmarks_current",
    stale: true,
    lastAttemptStatus: "failed" as const,
    lastAttemptErrorCode: "OPENROUTER_COLLECTOR_FAILED",
    lastAttemptAcquisitionComplete: false,
    lastAttemptPopulationCompleteness: "partial_or_unknown" as const,
  },
] as const;

const sourceStatusResponse = {
  schemaVersion: "2.0",
  data: sourceStatuses,
  cursor: null,
  window: publicWindow,
  completeness: publicCompleteness,
  stale: true,
  rank: null,
  provenance: publicProvenance,
} as const;

function sourceHealthClient(): {
  client: DashboardClient;
  sourceStatusStartedBeforeManifestSettled(): boolean;
  requests: Array<{ path: string; query: string }>;
} {
  let manifestSettled = false;
  let sourceStatusWasConcurrent = false;
  const requests: Array<{ path: string; query: string }> = [];

  const client: DashboardClient = {
    async get(path, query, schema) {
      requests.push({ path, query: query.toString() });

      if (path === "/api/public/v2/manifest") {
        await Promise.resolve();
        manifestSettled = true;
        return schema.parse({
          ...manifestFixture,
          routes: [
            "/api/public/v2/manifest",
            "/api/public/v2/source-status",
            "/api/public/v2/live-models",
          ],
          sources: [sourceStatusFixture],
        });
      }

      if (path === "/api/public/v2/source-status") {
        sourceStatusWasConcurrent = !manifestSettled;
        return schema.parse(sourceStatusResponse);
      }

      throw new Error(`Unexpected test path: ${path}`);
    },
  };

  return {
    client,
    requests,
    sourceStatusStartedBeforeManifestSettled: () => sourceStatusWasConcurrent,
  };
}

test("surfaces a stale failed collector in the response body", async () => {
  const deps = sourceHealthClient();

  const result = await runSourceHealth({}, { client: deps.client });

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  const benchmark = result.sources.find(
    (source) => source.sourceId === "benchmarks_current",
  );
  assert.equal(benchmark?.stale, true);
  assert.equal(
    benchmark?.lastAttemptErrorCode,
    "OPENROUTER_COLLECTOR_FAILED",
  );
  assert.match(result.summary, /stale/i);
  assert.match(result.summary, /failed/i);
});

test("fetches manifest and the six-source status view concurrently", async () => {
  const deps = sourceHealthClient();

  const result = await runSourceHealth({}, { client: deps.client });

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(deps.sourceStatusStartedBeforeManifestSettled(), true);
  assert.deepEqual(deps.requests, [
    { path: "/api/public/v2/manifest", query: "" },
    { path: "/api/public/v2/source-status", query: "" },
  ]);
  assert.equal(result.sources.length, SOURCE_STATUS_LIMIT);
  assert.deepEqual(result.routes, [
    "/api/public/v2/manifest",
    "/api/public/v2/source-status",
    "/api/public/v2/live-models",
  ]);
  assert.deepEqual(result.cap, {
    sourceLimit: SOURCE_STATUS_LIMIT,
    reached: true,
  });
});

test("returns a safe structured catalogue error instead of throwing", async () => {
  const client: DashboardClient = {
    async get() {
      throw new DashboardRequestError(
        "http_error",
        "The dashboard catalogue returned HTTP 503.",
        { retryable: true, status: 503 },
      );
    },
  };

  const result = await runSourceHealth({}, { client });

  assert.deepEqual(result, {
    status: "error",
    summary: "The dashboard catalogue returned HTTP 503.",
    error: {
      kind: "http_error",
      message: "The dashboard catalogue returned HTTP 503.",
      retryable: true,
      status: 503,
    },
  });
});

test("source evidence preserves endpoint metadata and a manifest watermark", () => {
  const evidence = sourceEvidence(
    "/api/public/v2/source-status",
    sourceStatusResponse,
  );
  assert.deepEqual(evidence, {
    endpoint: "/api/public/v2/source-status",
    window: publicWindow,
    completeness: publicCompleteness,
    stale: true,
    watermark: null,
    provenance: publicProvenance,
  });

  assert.equal(
    sourceEvidence("/api/public/v2/manifest", manifestFixture).watermark,
    manifestFixture.publishedAt,
  );
});

test("tool results contain identical structured content and JSON text", () => {
  const evidence = sourceEvidence(
    "/api/public/v2/source-status",
    sourceStatusResponse,
  );
  const output = { status: "ok", evidence } as const;
  const result = toolResult(output);
  assert.deepEqual(result.structuredContent, output);
  assert.equal(result.content.length, 1);
  assert.equal(result.content[0]?.type, "text");
  assert.deepEqual(
    JSON.parse(
      result.content[0]?.type === "text" ? result.content[0].text : "",
    ),
    output,
  );
});

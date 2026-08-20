import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardClient } from "../src/dashboard/client.js";
import { DashboardRequestError } from "../src/dashboard/errors.js";
import {
  MODEL_STATUS_LIVE_ITEM_LIMIT,
  MODEL_STATUS_LIVE_PAGE_LIMIT,
  runModelStatus,
} from "../src/tools/model-status.js";
import {
  liveModelFixture,
  manifestFixture,
  modelDetailFixture,
  opaqueCursor,
  publicCompleteness,
  publicProvenance,
  publicWindow,
} from "./fixtures.js";

const liveModelsEndpoint = "/api/public/v2/live-models";
const manifestEndpoint = "/api/public/v2/manifest";
const deprecationsEndpoint = "/api/public/v2/deprecations";
const expectedCapabilityMessage =
  "This tool needs /api/public/v2/live-models, which is not yet deployed. It ships with PR #24. Until then, ask about deprecations or history instead.";

function liveModelsResponse(
  data: readonly unknown[],
  cursor: string | null,
) {
  return {
    schemaVersion: "2.0",
    data,
    cursor,
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  } as const;
}

function deprecationsResponse(
  data: readonly unknown[] = [],
  cursor: string | null = null,
) {
  return {
    schemaVersion: "2.0",
    data,
    cursor,
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  } as const;
}

test("declines with the exact actionable message when live-models is absent", async () => {
  const requests: string[] = [];
  const client: DashboardClient = {
    async get(path, _query, schema) {
      requests.push(path);
      if (path !== manifestEndpoint) {
        throw new Error(`Unexpected test path: ${path}`);
      }
      return schema.parse({
        ...manifestFixture,
        routes: [manifestEndpoint, deprecationsEndpoint],
      });
    },
  };

  const result = await runModelStatus(
    { slug: "groq/retired-model" },
    { client },
  );

  assert.equal(result.status, "unavailable");
  if (result.status !== "unavailable") return;
  assert.equal(result.summary, expectedCapabilityMessage);
  assert.equal(result.message, expectedCapabilityMessage);
  assert.deepEqual(requests, [manifestEndpoint]);
  assert.equal(result.evidence[0]?.endpoint, manifestEndpoint);
});

test("explains positive observed absence using both timestamps", async () => {
  const retiredModel = {
    ...liveModelFixture,
    provider: "groq" as const,
    id: "groq/retired-model",
    displayName: "Retired Model",
    pricing: {
      promptUsdPerToken: null,
      completionUsdPerToken: null,
    },
    isFree: null,
    performance: null,
    availability: "disappeared" as const,
    lastSeenAt: "2026-08-03T06:00:00.000Z",
    lastConfirmedAt: "2026-08-19T06:00:00.000Z",
    disappearedAt: "2026-08-04T06:00:00.000Z",
    absenceStreak: "4",
  };
  const auxiliaryPaths: string[] = [];
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === manifestEndpoint) return schema.parse(manifestFixture);
      if (path === liveModelsEndpoint) {
        assert.equal(query.get("limit"), "500");
        return schema.parse(liveModelsResponse([retiredModel], null));
      }
      if (path === deprecationsEndpoint) {
        auxiliaryPaths.push(path);
        return schema.parse(deprecationsResponse());
      }
      auxiliaryPaths.push(path);
      throw new DashboardRequestError(
        "http_error",
        "The dashboard catalogue returned HTTP 404.",
        { retryable: false, status: 404 },
      );
    },
  };

  const result = await runModelStatus(
    { slug: "groq/retired-model" },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.match(
    result.verdict,
    /catalogue has been read completely 4 times since/i,
  );
  assert.equal(result.model.lastSeenAt, "2026-08-03T06:00:00.000Z");
  assert.equal(result.model.lastConfirmedAt, "2026-08-19T06:00:00.000Z");
  assert.equal(result.model.absenceStreak, "4");
  assert.equal(result.auxiliary.status, "partial");
  assert.equal(result.auxiliary.errors.length, 2);
  assert.equal(auxiliaryPaths.length, 3);
  assert.doesNotMatch(result.summary, /404/);
  assert.doesNotMatch(result.verdict, /404/);
});

test("returns bounded OpenRouter evidence without the long catalogue description", async () => {
  const historyResponse = {
    schemaVersion: "2.0",
    entityId: liveModelFixture.id,
    factKind: "usage",
    data: [
      {
        observedDate: "2026-08-19",
        complete: true,
        entityId: liveModelFixture.id,
        label: "Very Large Model",
        scope: null,
        rank: 1,
        value: "90071992547409930001",
        remainder: "0.1250",
        stars: null,
        forks: null,
      },
    ],
    cursor: opaqueCursor,
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    provenance: publicProvenance,
  } as const;
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === manifestEndpoint) return schema.parse(manifestFixture);
      if (path === liveModelsEndpoint) {
        return schema.parse(liveModelsResponse([liveModelFixture], null));
      }
      if (path === deprecationsEndpoint) {
        return schema.parse(deprecationsResponse());
      }
      if (path.endsWith("/history")) return schema.parse(historyResponse);
      if (path.startsWith("/api/public/v2/models/")) {
        return schema.parse(modelDetailFixture);
      }
      throw new Error(`Unexpected test path: ${path}`);
    },
  };

  const result = await runModelStatus(
    { slug: liveModelFixture.id },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(result.auxiliary.detail, {
    id: liveModelFixture.id,
    canonicalSlug: liveModelFixture.id,
    name: "Very Large Model",
    contextLength: "90071992547409930001",
    pricing: {
      prompt: "0.0000001250",
      completion: "0.0000005000",
    },
    expirationDate: null,
    lifecycleState: "no_announced_expiration",
    freeKind: "paid_or_unknown",
    weeklyRank: 1,
  });
  assert.equal(result.auxiliary.history?.cursor, opaqueCursor);
  assert.equal(
    result.auxiliary.history?.data[0]?.value,
    "90071992547409930001",
  );
});

test("requires an exact id and suggests at most twelve matches after a bounded scan", async () => {
  const firstPage = Array.from({ length: 500 }, (_, index) => ({
    ...liveModelFixture,
    id:
      index === 0
        ? "meta/llama-3.3-70b-instruct"
        : `provider/model-${index}`,
    displayName:
      index === 0 ? "Llama 3.3 70B Instruct" : `Model ${index}`,
  }));
  const secondPage = Array.from({ length: 500 }, (_, index) => ({
    ...liveModelFixture,
    provider: "groq" as const,
    id:
      index === 0
        ? "groq/llama-3.3-70b-versatile"
        : `groq/model-${index + 500}`,
    displayName:
      index === 0 ? "Llama 3.3 70B Versatile" : `Groq Model ${index + 500}`,
  }));
  const remainingCursor = "opaque+remaining/=cursor";
  const cursorsSeen: Array<string | null> = [];
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === manifestEndpoint) return schema.parse(manifestFixture);
      if (path !== liveModelsEndpoint) {
        throw new Error(`Unexpected test path: ${path}`);
      }
      assert.equal(query.get("limit"), "500");
      const cursor = query.get("cursor");
      cursorsSeen.push(cursor);
      return schema.parse(
        cursor === null
          ? liveModelsResponse(firstPage, opaqueCursor)
          : liveModelsResponse(secondPage, remainingCursor),
      );
    },
  };

  const result = await runModelStatus({ slug: "llama-3.3" }, { client });

  assert.equal(result.status, "not_found");
  if (result.status !== "not_found") return;
  assert.ok(result.suggestions.length > 0);
  assert.ok(result.suggestions.length <= 12);
  assert.ok(result.suggestions.includes("meta/llama-3.3-70b-instruct"));
  assert.doesNotMatch(result.summary, /404/);
  assert.deepEqual(cursorsSeen, [null, opaqueCursor]);
  assert.deepEqual(result.cap, {
    pageLimit: MODEL_STATUS_LIVE_PAGE_LIMIT,
    itemLimit: MODEL_STATUS_LIVE_ITEM_LIMIT,
    pagesScanned: 2,
    itemsScanned: 1000,
    reached: true,
    nextCursor: remainingCursor,
  });
});

test("returns a safe structured error when capability detection fails", async () => {
  const client: DashboardClient = {
    async get() {
      throw new DashboardRequestError(
        "http_error",
        "The dashboard catalogue returned HTTP 503.",
        { retryable: true, status: 503 },
      );
    },
  };

  const result = await runModelStatus(
    { slug: "openrouter/example" },
    { client },
  );

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

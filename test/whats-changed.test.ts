import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardClient } from "../src/dashboard/client.js";
import {
  DEPRECATION_ITEM_LIMIT,
  DEPRECATION_PAGE_LIMIT,
  runWhatsChanged,
} from "../src/tools/whats-changed.js";
import {
  liveModelFixture,
  manifestFixture,
  opaqueCursor,
  publicCompleteness,
  publicProvenance,
  publicWindow,
  runId,
} from "./fixtures.js";

const manifestEndpoint = "/api/public/v2/manifest";
const historyEndpoint = "/api/public/v2/history";
const deprecationsEndpoint = "/api/public/v2/deprecations";
const liveModelsEndpoint = "/api/public/v2/live-models";

type HistoryRow = {
  id: string;
  label: string;
  scope: string | null;
  rank: number | null;
  value: string | null;
  remainder: string | null;
  stars: string | null;
  forks: string | null;
};

function historyRow(
  id: string,
  rank: number,
  value: string,
): HistoryRow {
  return {
    id,
    label: id,
    scope: null,
    rank,
    value,
    remainder: null,
    stars: null,
    forks: null,
  };
}

function historyResponse(
  buckets: Array<{
    date: string;
    complete: boolean;
    rows: HistoryRow[];
  }>,
) {
  return {
    schemaVersion: "2.0",
    status: "available",
    data: { modelUsage: buckets, appRanks: [], githubRanks: [] },
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  } as const;
}

function collectionResponse(
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

test("defaults to the prior complete bucket and says when available comparisons found nothing", async () => {
  const history = historyResponse([
    {
      date: "2026-08-17",
      complete: true,
      rows: [historyRow("example/model", 1, "90071992547409930001")],
    },
    {
      date: "2026-08-18",
      complete: true,
      rows: [historyRow("example/model", 1, "90071992547409930001")],
    },
    {
      date: "2026-08-19",
      complete: true,
      rows: [historyRow("example/model", 1, "90071992547409930001")],
    },
  ]);
  const requests: Array<{ path: string; limit: string | null }> = [];
  const client: DashboardClient = {
    async get(path, query, schema) {
      requests.push({ path, limit: query.get("limit") });
      if (path === manifestEndpoint) {
        return schema.parse({
          ...manifestFixture,
          routes: [manifestEndpoint, historyEndpoint, deprecationsEndpoint],
        });
      }
      if (path === historyEndpoint) {
        assert.equal(query.get("window"), "365d");
        return schema.parse(history);
      }
      if (path === deprecationsEndpoint) {
        return schema.parse(collectionResponse());
      }
      throw new Error(`Unexpected test path: ${path}`);
    },
  };

  const result = await runWhatsChanged({}, { client });

  assert.notEqual(result.status, "error");
  if (result.status === "error") return;
  assert.equal(result.since, "2026-08-18");
  assert.equal(result.through, "2026-08-19");
  assert.equal(result.sinceSource, "previous_complete_history_bucket");
  assert.match(result.summary, /nothing changed/i);
  assert.equal(result.modelAppearances.status, "unavailable");
  assert.equal(result.modelDisappearances.status, "unavailable");
  assert.equal(result.rankMovements.status, "available");
  assert.equal(result.rankMovements.items.length, 0);
  assert.equal(result.newDeprecations.status, "available");
  assert.equal(result.newDeprecations.items.length, 0);
  assert.equal(result.priceChanges.status, "unsupported_by_public_api");
  assert.ok(requests.some((request) => request.path === historyEndpoint));
  assert.ok(requests.some((request) => request.path === deprecationsEndpoint));
});

test("keeps rank and deprecation changes functional without live-models", async () => {
  const history = historyResponse([
    {
      date: "2026-08-18",
      complete: true,
      rows: [historyRow("example/model", 2, "90071992547409930001")],
    },
    {
      date: "2026-08-19",
      complete: true,
      rows: [historyRow("example/model", 1, "90071992547409939999")],
    },
  ]);
  const notice = {
    modelId: "example/model",
    state: "scheduled_deprecation" as const,
    expirationDate: "2026-09-01",
    firstObservedAt: "2026-08-19T06:00:00.000Z",
    lastObservedAt: "2026-08-19T06:00:00.000Z",
    evidenceRunId: runId,
  };
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === manifestEndpoint) {
        return schema.parse({
          ...manifestFixture,
          routes: [manifestEndpoint, historyEndpoint, deprecationsEndpoint],
        });
      }
      if (path === historyEndpoint) return schema.parse(history);
      if (path === deprecationsEndpoint) {
        return schema.parse(collectionResponse([notice]));
      }
      throw new Error(`Unexpected test path: ${path}`);
    },
  };

  const result = await runWhatsChanged(
    { since: "2026-08-18", limit: 5 },
    { client },
  );

  assert.notEqual(result.status, "error");
  if (result.status === "error") return;
  assert.equal(result.status, "partial");
  assert.equal(result.rankMovements.status, "available");
  assert.deepEqual(result.rankMovements.items, [
    {
      modelId: "example/model",
      label: "example/model",
      previousRank: 2,
      currentRank: 1,
      direction: "up",
      previousValue: "90071992547409930001",
      currentValue: "90071992547409939999",
    },
  ]);
  assert.equal(result.newDeprecations.status, "available");
  assert.deepEqual(result.newDeprecations.items, [notice]);
  assert.equal(result.modelAppearances.status, "unavailable");
  assert.equal(result.modelDisappearances.status, "unavailable");
  assert.equal(result.priceChanges.status, "unsupported_by_public_api");
});

test("reports model appearances and disappearances when live-models exists", async () => {
  const history = historyResponse([
    { date: "2026-08-18", complete: true, rows: [] },
    { date: "2026-08-19", complete: true, rows: [] },
  ]);
  const appeared = {
    ...liveModelFixture,
    id: "example/new-model",
    firstSeenAt: "2026-08-19T06:00:00.000Z",
  };
  const disappeared = {
    ...liveModelFixture,
    provider: "groq" as const,
    id: "groq/retired-model",
    availability: "disappeared" as const,
    lastSeenAt: "2026-08-17T06:00:00.000Z",
    lastConfirmedAt: "2026-08-19T06:00:00.000Z",
    disappearedAt: "2026-08-19T06:00:00.000Z",
    absenceStreak: "2",
  };
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === manifestEndpoint) {
        return schema.parse({
          ...manifestFixture,
          routes: [
            manifestEndpoint,
            historyEndpoint,
            deprecationsEndpoint,
            liveModelsEndpoint,
          ],
        });
      }
      if (path === historyEndpoint) return schema.parse(history);
      if (path === deprecationsEndpoint) {
        return schema.parse(collectionResponse());
      }
      if (path === liveModelsEndpoint) {
        assert.equal(query.get("limit"), "500");
        return schema.parse(collectionResponse([appeared, disappeared]));
      }
      throw new Error(`Unexpected test path: ${path}`);
    },
  };

  const result = await runWhatsChanged(
    { since: "2026-08-18", limit: 10 },
    { client },
  );

  assert.notEqual(result.status, "error");
  if (result.status === "error") return;
  assert.equal(result.status, "ok");
  assert.equal(result.modelAppearances.status, "available");
  assert.deepEqual(
    result.modelAppearances.items.map((model) => model.id),
    ["example/new-model"],
  );
  assert.equal(result.modelDisappearances.status, "available");
  assert.deepEqual(
    result.modelDisappearances.items.map((model) => model.id),
    ["groq/retired-model"],
  );
  assert.equal(result.priceChanges.status, "unsupported_by_public_api");
});

test("paginates deprecations only to the declared bound and preserves cursors", async () => {
  const history = historyResponse([
    { date: "2026-08-18", complete: true, rows: [] },
    { date: "2026-08-19", complete: true, rows: [] },
  ]);
  const remainingCursor = "remaining+/=opaque cursor";
  const cursorsSeen: Array<string | null> = [];
  const notice = (modelId: string, firstObservedAt: string) => ({
    modelId,
    state: "scheduled_deprecation" as const,
    expirationDate: null,
    firstObservedAt,
    lastObservedAt: firstObservedAt,
    evidenceRunId: runId,
  });
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === manifestEndpoint) {
        return schema.parse({
          ...manifestFixture,
          routes: [manifestEndpoint, historyEndpoint, deprecationsEndpoint],
        });
      }
      if (path === historyEndpoint) return schema.parse(history);
      if (path === deprecationsEndpoint) {
        assert.equal(query.get("limit"), "200");
        const cursor = query.get("cursor");
        cursorsSeen.push(cursor);
        return schema.parse(
          cursor === null
            ? collectionResponse(
                [notice("example/first", "2026-08-18T06:00:00.000Z")],
                opaqueCursor,
              )
            : collectionResponse(
                [notice("example/second", "2026-08-19T06:00:00.000Z")],
                remainingCursor,
              ),
        );
      }
      throw new Error(`Unexpected test path: ${path}`);
    },
  };

  const result = await runWhatsChanged(
    { since: "2026-08-18", limit: 5 },
    { client },
  );

  assert.notEqual(result.status, "error");
  if (result.status === "error") return;
  assert.deepEqual(cursorsSeen, [null, opaqueCursor]);
  assert.deepEqual(result.caps.deprecations, {
    pageLimit: DEPRECATION_PAGE_LIMIT,
    itemLimit: DEPRECATION_ITEM_LIMIT,
    pagesScanned: 2,
    itemsScanned: 2,
    reached: true,
    nextCursor: remainingCursor,
  });
});

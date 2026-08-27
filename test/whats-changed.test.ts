import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardClient } from "../src/dashboard/client.js";
import { DashboardRequestError } from "../src/dashboard/errors.js";
import {
  DEPRECATION_ITEM_LIMIT,
  DEPRECATION_PAGE_LIMIT,
  runWhatsChanged,
  whatsChangedToolDescription,
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
  // The stub serves no /price-changes route, so the section reports that it
  // could not be read -- never an empty list, which would read as an all-clear.
  assert.equal(result.priceChanges.status, "unavailable");
  if (result.priceChanges.status === "unavailable") {
    assert.match(result.priceChanges.reason, /not evidence that nothing changed/);
  }
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
  // The stub serves no /price-changes route, so the section reports that it
  // could not be read -- never an empty list, which would read as an all-clear.
  assert.equal(result.priceChanges.status, "unavailable");
  if (result.priceChanges.status === "unavailable") {
    assert.match(result.priceChanges.reason, /not evidence that nothing changed/);
  }
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
  // Partial, not ok: this stub serves no /price-changes route, and a report that
  // could not read price movement has not established that nothing changed.
  assert.equal(result.status, "partial");
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
  // The stub serves no /price-changes route, so the section reports that it
  // could not be read -- never an empty list, which would read as an all-clear.
  assert.equal(result.priceChanges.status, "unavailable");
  if (result.priceChanges.status === "unavailable") {
    assert.match(result.priceChanges.reason, /not evidence that nothing changed/);
  }
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

test("does not claim the collection continued when an exact item cap ends with a null cursor", async () => {
  const history = historyResponse([
    { date: "2026-08-18", complete: true, rows: [] },
    { date: "2026-08-19", complete: true, rows: [] },
  ]);
  const notices = Array.from({ length: DEPRECATION_ITEM_LIMIT }, (_, index) => ({
    modelId: `example/model-${index}`,
    state: "scheduled_deprecation" as const,
    expirationDate: null,
    firstObservedAt: "2026-08-19T06:00:00.000Z",
    lastObservedAt: "2026-08-19T06:00:00.000Z",
    evidenceRunId: runId,
  }));
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
        return schema.parse(collectionResponse(notices, null));
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
  assert.equal(result.caps.deprecations?.reached, true);
  assert.equal(result.caps.deprecations?.nextCursor, null);
  assert.equal(
    result.warnings.includes(
      "The deprecation scan reached its declared bound before the collection ended.",
    ),
    false,
  );
});

test("uses explicit since for independent sections when history request fails", async () => {
  const notice = {
    modelId: "example/deprecated",
    state: "scheduled_deprecation" as const,
    expirationDate: null,
    firstObservedAt: "2026-08-19T06:00:00.000Z",
    lastObservedAt: "2026-08-19T06:00:00.000Z",
    evidenceRunId: runId,
  };
  const appeared = {
    ...liveModelFixture,
    id: "example/new-model",
    firstSeenAt: "2026-08-19T06:00:00.000Z",
  };
  const requested: string[] = [];
  const client: DashboardClient = {
    async get(path, _query, schema) {
      requested.push(path);
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
      if (path === historyEndpoint) {
        throw new DashboardRequestError(
          "http_error",
          "The dashboard catalogue returned HTTP 503.",
          { retryable: true, status: 503 },
        );
      }
      if (path === deprecationsEndpoint) {
        return schema.parse(collectionResponse([notice]));
      }
      if (path === liveModelsEndpoint) {
        return schema.parse(collectionResponse([appeared]));
      }
      throw new Error(`Unexpected test path: ${path}`);
    },
  };

  const result = await runWhatsChanged(
    { since: "2026-08-18", limit: 5 },
    { client },
  );

  assert.equal(result.status, "partial");
  if (result.status === "error" || result.since === null) return;
  assert.equal(result.since, "2026-08-18");
  assert.equal(result.through, "2026-08-19");
  assert.equal(result.rankMovements.status, "unavailable");
  assert.equal(result.modelAppearances.status, "available");
  assert.deepEqual(
    result.modelAppearances.items.map((model) => model.id),
    ["example/new-model"],
  );
  assert.equal(result.newDeprecations.status, "available");
  assert.deepEqual(
    result.newDeprecations.items.map((entry) => entry.modelId),
    ["example/deprecated"],
  );
  assert.ok(requested.includes(liveModelsEndpoint));
  assert.ok(requested.includes(deprecationsEndpoint));
});

test("marks capped live-model evidence incomplete without claiming nothing changed", async () => {
  const history = historyResponse([
    { date: "2026-08-18", complete: true, rows: [] },
    { date: "2026-08-19", complete: true, rows: [] },
  ]);
  const remainingCursor = "live-remaining+/=opaque";
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
        return schema.parse(
          query.get("cursor") === null
            ? collectionResponse([liveModelFixture], opaqueCursor)
            : collectionResponse([liveModelFixture], remainingCursor),
        );
      }
      throw new Error(`Unexpected test path: ${path}`);
    },
  };

  const result = await runWhatsChanged(
    { since: "2026-08-18", limit: 5 },
    { client },
  );

  assert.equal(result.status, "partial");
  if (result.status === "error" || result.since === null) return;
  assert.equal(result.modelAppearances.status, "partial");
  assert.equal(result.modelDisappearances.status, "partial");
  if (result.modelAppearances.status !== "partial") return;
  assert.equal(result.modelAppearances.omitted, null);
  assert.equal(result.modelAppearances.items.length, 0);
  assert.match(result.summary, /incomplete/i);
  assert.doesNotMatch(result.summary, /nothing changed/i);
});

test("marks capped deprecation evidence incomplete with an unknown omitted count", async () => {
  const history = historyResponse([
    { date: "2026-08-18", complete: true, rows: [] },
    { date: "2026-08-19", complete: true, rows: [] },
  ]);
  const oldNotice = (modelId: string) => ({
    modelId,
    state: "scheduled_deprecation" as const,
    expirationDate: null,
    firstObservedAt: "2026-08-17T06:00:00.000Z",
    lastObservedAt: "2026-08-17T06:00:00.000Z",
    evidenceRunId: runId,
  });
  const remainingCursor = "deprecation-remaining+/=opaque";
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
      if (path === liveModelsEndpoint) {
        return schema.parse(collectionResponse());
      }
      if (path === deprecationsEndpoint) {
        return schema.parse(
          query.get("cursor") === null
            ? collectionResponse([oldNotice("example/one")], opaqueCursor)
            : collectionResponse(
                [oldNotice("example/two")],
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

  assert.equal(result.status, "partial");
  if (result.status === "error" || result.since === null) return;
  assert.equal(result.newDeprecations.status, "partial");
  if (result.newDeprecations.status !== "partial") return;
  assert.equal(result.newDeprecations.omitted, null);
  assert.equal(result.newDeprecations.items.length, 0);
  assert.match(result.summary, /incomplete/i);
  assert.doesNotMatch(result.summary, /nothing changed/i);
});

test("uses one open-closed date window for event sections", async () => {
  const history = historyResponse([
    { date: "2026-08-18", complete: true, rows: [] },
    { date: "2026-08-19", complete: true, rows: [] },
  ]);
  const model = (
    id: string,
    firstSeenAt: string,
    disappearedAt: string | null = null,
  ) => ({
    ...liveModelFixture,
    id,
    availability:
      disappearedAt === null ? ("available" as const) : ("disappeared" as const),
    firstSeenAt,
    lastSeenAt:
      disappearedAt === null ? firstSeenAt : "2026-08-17T06:00:00.000Z",
    lastConfirmedAt:
      disappearedAt === null ? firstSeenAt : "2026-08-19T06:00:00.000Z",
    disappearedAt,
    absenceStreak: disappearedAt === null ? "0" : "2",
  });
  const notice = (modelId: string, firstObservedAt: string) => ({
    modelId,
    state: "scheduled_deprecation" as const,
    expirationDate: null,
    firstObservedAt,
    lastObservedAt: firstObservedAt,
    evidenceRunId: runId,
  });
  const client: DashboardClient = {
    async get(path, _query, schema) {
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
        return schema.parse(
          collectionResponse([
            notice("example/baseline-notice", "2026-08-18T06:00:00.000Z"),
            notice("example/window-notice", "2026-08-19T06:00:00.000Z"),
            notice("example/post-notice", "2026-08-20T06:00:00.000Z"),
          ]),
        );
      }
      if (path === liveModelsEndpoint) {
        return schema.parse(
          collectionResponse([
            model("example/baseline-appearance", "2026-08-18T06:00:00.000Z"),
            model("example/window-appearance", "2026-08-19T06:00:00.000Z"),
            model("example/post-appearance", "2026-08-20T06:00:00.000Z"),
            model(
              "example/baseline-disappearance",
              "2026-08-01T06:00:00.000Z",
              "2026-08-18T06:00:00.000Z",
            ),
            model(
              "example/window-disappearance",
              "2026-08-01T06:00:00.000Z",
              "2026-08-19T06:00:00.000Z",
            ),
            model(
              "example/post-disappearance",
              "2026-08-01T06:00:00.000Z",
              "2026-08-20T06:00:00.000Z",
            ),
          ]),
        );
      }
      throw new Error(`Unexpected test path: ${path}`);
    },
  };

  const result = await runWhatsChanged(
    { since: "2026-08-18", limit: 10 },
    { client },
  );

  assert.notEqual(result.status, "error");
  if (result.status === "error" || result.since === null) return;
  assert.equal(result.since, "2026-08-18");
  assert.equal(result.through, "2026-08-19");
  assert.equal(result.modelAppearances.status, "available");
  assert.deepEqual(
    result.modelAppearances.items.map((entry) => entry.id),
    ["example/window-appearance"],
  );
  assert.equal(result.modelDisappearances.status, "available");
  assert.deepEqual(
    result.modelDisappearances.items.map((entry) => entry.id),
    ["example/window-disappearance"],
  );
  assert.equal(result.newDeprecations.status, "available");
  assert.deepEqual(
    result.newDeprecations.items.map((entry) => entry.modelId),
    ["example/window-notice"],
  );
});

test("surfaces a model that left free, apart from every other price move", async () => {
  const priceChanges = {
    schemaVersion: "2.0",
    data: [
      {
        modelId: "vendor/was-free",
        transition: "became_paid",
        basePromptPrice: "0",
        baseCompletionPrice: "0",
        headPromptPrice: "0.0000004",
        headCompletionPrice: "0.0000012",
        wasFree: true,
        isFree: false,
      },
      {
        modelId: "vendor/got-cheaper",
        transition: "price_decreased",
        basePromptPrice: "0.000003",
        baseCompletionPrice: "0.000004",
        headPromptPrice: "0.000001",
        headCompletionPrice: "0.000002",
        wasFree: false,
        isFree: false,
      },
    ],
    cursor: null,
    comparison: { baseRunId: runId, headRunId: runId },
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  };

  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === "/api/public/v2/price-changes") return schema.parse(priceChanges);
      if (path === manifestEndpoint) {
        return schema.parse({ ...manifestFixture, routes: [manifestEndpoint] });
      }
      throw new DashboardRequestError("http_error", "unavailable", {
        retryable: true,
        status: 503,
      });
    },
  };

  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  assert.equal(result.priceChanges.status, "available");
  if (result.priceChanges.status !== "available") return;

  // The money question gets its own bucket rather than being one row among many.
  assert.deepEqual(
    result.priceChanges.becamePaid.map((row) => row.modelId),
    ["vendor/was-free"],
  );
  assert.deepEqual(
    result.priceChanges.otherChanges.map((row) => row.modelId),
    ["vendor/got-cheaper"],
  );
  // The note has to say why it goes unnoticed: the id never changed.
  assert.match(result.priceChanges.becamePaid[0]!.note, /was free and now charges/);
  assert.match(result.priceChanges.becamePaid[0]!.note, /pinned config keeps calling it/);
});

test("reports an unreadable price source as unknown, never as no change", async () => {
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === manifestEndpoint) {
        return schema.parse({ ...manifestFixture, routes: [manifestEndpoint] });
      }
      throw new DashboardRequestError("timeout", "timed out", { retryable: true });
    },
  };
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  assert.equal(result.priceChanges.status, "unavailable");
});

test("distinguishes a deployment without the route from a quiet one", async () => {
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === manifestEndpoint) {
        return schema.parse({ ...manifestFixture, routes: [manifestEndpoint] });
      }
      // 404 specifically means this deployment does not serve the route.
      throw new DashboardRequestError("http_error", "not found", {
        retryable: false,
        status: 404,
      });
    },
  };
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  assert.equal(result.priceChanges.status, "unsupported_by_public_api");
});

/**
 * Fixture builder for a price-changes response whose observed comparison window
 * is stated by the producer. The window matters more than the rows: an empty
 * list read against the wrong window is the most expensive wrong answer here.
 */
function priceChangesResponse(
  data: unknown[],
  window: { start: string | null; end: string | null } = {
    start: "2026-08-26",
    end: "2026-08-26",
  },
  cursor: string | null = null,
) {
  return {
    schemaVersion: "2.0",
    data,
    cursor,
    comparison: { baseRunId: runId, headRunId: runId },
    window: { ...publicWindow, ...window, basis: "derived" },
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  };
}

const becamePaidRow = {
  modelId: "vendor/was-free",
  transition: "became_paid",
  basePromptPrice: "0",
  baseCompletionPrice: "0",
  headPromptPrice: "0.0000004",
  headCompletionPrice: "0.0000012",
  wasFree: true,
  isFree: false,
};

function priceOnlyClient(response: unknown): DashboardClient {
  return {
    async get(path, _query, schema) {
      if (path === "/api/public/v2/price-changes") return schema.parse(response);
      if (path === manifestEndpoint) {
        return schema.parse({ ...manifestFixture, routes: [manifestEndpoint] });
      }
      throw new DashboardRequestError("http_error", "unavailable", {
        retryable: true,
        status: 503,
      });
    },
  };
}

test("never says nothing changed while a model started charging", async () => {
  const client = priceOnlyClient(priceChangesResponse([becamePaidRow]));
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");

  // The summary is the one line a model relays verbatim. It cannot report an
  // all-clear while the money bucket has an entry in it.
  assert.doesNotMatch(result.summary, /^Nothing changed/);
  assert.match(result.summary, /stopped being free/);
});

test("an unreadable price source degrades the whole report, never leaves it ok", async () => {
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === "/api/public/v2/price-changes") {
        throw new DashboardRequestError("timeout", "timed out", { retryable: true });
      }
      if (path === manifestEndpoint) {
        return schema.parse({ ...manifestFixture, routes: [manifestEndpoint] });
      }
      throw new DashboardRequestError("http_error", "unavailable", {
        retryable: true,
        status: 503,
      });
    },
  };
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  assert.equal(result.status, "partial");
  assert.match(result.summary, /not evidence|could not be read/i);
});

test("the tool description does not deny the capability it ships", () => {
  const description = whatsChangedToolDescription;
  assert.doesNotMatch(description, /price changes are explicitly unsupported/i);
  // The model selecting a tool has to be able to tell that this is where the
  // free-to-paid answer lives.
  assert.match(description, /free/i);
});

test("counts each comparison window separately instead of summing across them", async () => {
  // A price row and a rank movement are both changes, but they are not changes
  // over the same window. One total covering both states a number for a window
  // some of the counted items sit outside, so each count keeps its own window
  // -- and neither sentence may read as an all-clear while the other reports
  // movement.
  const history = historyResponse([
    { date: "2026-08-18", complete: true, rows: [historyRow("m/one", 2, "10")] },
    { date: "2026-08-19", complete: true, rows: [historyRow("m/one", 1, "20")] },
  ]);
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === "/api/public/v2/price-changes") {
        return schema.parse(priceChangesResponse([becamePaidRow]));
      }
      if (path === manifestEndpoint) {
        return schema.parse({
          ...manifestFixture,
          routes: [manifestEndpoint, historyEndpoint],
        });
      }
      if (path === historyEndpoint) return schema.parse(history);
      throw new Error(`Unexpected test path: ${path}`);
    },
  };
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  assert.match(
    result.summary,
    /1 model stopped being free in the comparison ending 2026-08-26/,
  );
  assert.match(result.summary, /1 other change found since 2026-08-18/);
  // No merged total: the two windows are never added together.
  assert.doesNotMatch(result.summary, /2 changes/);
});

test("an incomplete scan cannot report no changes while a price moved", async () => {
  // The incomplete branch had its own wording, and it was the one branch the
  // price count did not reach. A capped scan plus a real price move said
  // "No changes were found".
  const history = historyResponse([
    { date: "2026-08-18", complete: true, rows: [] },
    { date: "2026-08-19", complete: true, rows: [] },
  ]);
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === "/api/public/v2/price-changes") {
        return schema.parse(
          priceChangesResponse([
            {
              modelId: "vendor/cheaper",
              transition: "price_decreased",
              basePromptPrice: "0.000003",
              baseCompletionPrice: "0.000004",
              headPromptPrice: "0.000001",
              headCompletionPrice: "0.000002",
              wasFree: false,
              isFree: false,
            },
          ]),
        );
      }
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
      if (path === deprecationsEndpoint) return schema.parse(collectionResponse());
      if (path === liveModelsEndpoint) {
        return schema.parse(
          query.get("cursor") === null
            ? collectionResponse([liveModelFixture], opaqueCursor)
            : collectionResponse([liveModelFixture], "live-remaining+/=opaque"),
        );
      }
      throw new Error(`Unexpected test path: ${path}`);
    },
  };
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  // The price move is stated, and the window sentence says "no other changes"
  // rather than "no changes" -- which alongside a real price move would read as
  // an all-clear the evidence does not support.
  assert.match(result.summary, /1 price move in the comparison ending 2026-08-26/);
  assert.match(result.summary, /No other changes were found/);
  assert.doesNotMatch(result.summary, /(^|\. )No changes were found/);
});

test("a capped price page cannot state an exact free-to-paid count", async () => {
  // The rows are a first page of a mixed collection. Its length is a floor, not
  // a total, and the summary is the line that gets relayed verbatim.
  const client = priceOnlyClient(
    priceChangesResponse([becamePaidRow], undefined, "price-next+/=opaque"),
  );
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  if (result.priceChanges.status !== "available") assert.fail("expected prices");
  assert.equal(result.priceChanges.cap.capped, true);
  assert.match(result.summary, /at least 1 model/i);
  assert.match(result.summary, /at least/i);
  assert.doesNotMatch(result.summary, /^1 model stopped being free/);
});

test("a capped page cannot rule out a free-to-paid row it never read", async () => {
  // "At least N price moves" qualifies the count, but "none of them a model
  // leaving free" is a categorical zero over the exact transition this server
  // exists to catch -- asserted about rows the section never fetched.
  const client = priceOnlyClient(
    priceChangesResponse(
      [
        {
          modelId: "vendor/cheaper",
          transition: "price_decreased",
          basePromptPrice: "0.000003",
          baseCompletionPrice: "0.000004",
          headPromptPrice: "0.000001",
          headCompletionPrice: "0.000002",
          wasFree: false,
          isFree: false,
        },
      ],
      undefined,
      "price-next+/=opaque",
    ),
  );
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  assert.doesNotMatch(result.summary, /none of them a model leaving free/);
  assert.match(result.summary, /rows read/);
  assert.match(result.summary, /unread/);
});

test("an uncapped page may state the categorical zero, because it read everything", async () => {
  // The counterpart: without a cursor the section holds the whole collection,
  // so "none of them" is a claim it is entitled to make.
  const client = priceOnlyClient(
    priceChangesResponse([
      {
        modelId: "vendor/cheaper",
        transition: "price_decreased",
        basePromptPrice: "0.000003",
        baseCompletionPrice: "0.000004",
        headPromptPrice: "0.000001",
        headCompletionPrice: "0.000002",
        wasFree: false,
        isFree: false,
      },
    ]),
  );
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  assert.match(result.summary, /none of them a model leaving free/);
});

test("never claims complete coverage, because the base run's date is not published", async () => {
  // The envelope window is the HEAD publication date, not the compared span:
  // measured against production, start === end === the head run's date while
  // baseRunId !== headRunId on a daily cadence. So the early edge of the
  // comparison is unknowable from this response, and complete coverage is a
  // claim the payload cannot support.
  const client = priceOnlyClient(
    priceChangesResponse([], { start: "2026-08-26", end: "2026-08-26" }),
  );
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  if (result.priceChanges.status !== "available") assert.fail("expected prices");
  assert.equal(result.priceChanges.headPublishedOn, "2026-08-26");
  assert.equal(result.priceChanges.coverage.status, "indeterminate");
  assert.match(result.priceChanges.coverage.reason, /run id|not published/i);
});

test("a head run older than the report end is definitively incomplete", async () => {
  // One edge IS knowable. Nothing after the head run was examined, so a head
  // publication before `through` proves the tail of the window went unchecked.
  const history = historyResponse([
    { date: "2026-08-18", complete: true, rows: [] },
    { date: "2026-08-27", complete: true, rows: [] },
  ]);
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === "/api/public/v2/price-changes") {
        return schema.parse(
          priceChangesResponse([], { start: "2026-08-20", end: "2026-08-20" }),
        );
      }
      if (path === manifestEndpoint) {
        return schema.parse({
          ...manifestFixture,
          routes: [manifestEndpoint, historyEndpoint],
        });
      }
      if (path === historyEndpoint) return schema.parse(history);
      throw new DashboardRequestError("http_error", "unavailable", {
        retryable: true,
        status: 503,
      });
    },
  };
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  assert.equal(result.through, "2026-08-27");
  if (result.priceChanges.status !== "available") assert.fail("expected prices");
  assert.equal(result.priceChanges.coverage.status, "incomplete");
  assert.match(result.priceChanges.coverage.reason, /2026-08-27/);
  assert.ok(result.warnings.some((w) => /price/i.test(w) && /2026-08-20/.test(w)));
});

test("an undated head publication is indeterminate, never complete", async () => {
  const client = priceOnlyClient(
    priceChangesResponse([], { start: null, end: null }),
  );
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  if (result.priceChanges.status !== "available") assert.fail("expected prices");
  assert.equal(result.priceChanges.headPublishedOn, null);
  assert.equal(result.priceChanges.coverage.status, "indeterminate");
});

test("an inverted requested window is reported, not silently satisfied", async () => {
  // `since` is caller-supplied and `through` is derived, so a since after
  // through describes no interval at all. Every window-scoped section then
  // reports nothing, which must not read as nothing having happened.
  const history = historyResponse([
    { date: "2026-08-18", complete: true, rows: [] },
    { date: "2026-08-19", complete: true, rows: [] },
  ]);
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === "/api/public/v2/price-changes") {
        return schema.parse(priceChangesResponse([]));
      }
      if (path === manifestEndpoint) {
        return schema.parse({
          ...manifestFixture,
          routes: [manifestEndpoint, historyEndpoint],
        });
      }
      if (path === historyEndpoint) return schema.parse(history);
      throw new DashboardRequestError("http_error", "unavailable", {
        retryable: true,
        status: 503,
      });
    },
  };
  const result = await runWhatsChanged({ since: "2027-01-01", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  // A warning beside a normal summary is not a fix: the summary is the line
  // that gets relayed, and "Nothing changed since 2027-01-01" is an all-clear
  // for a question that was never askable.
  assert.doesNotMatch(result.summary, /Nothing changed/);
  assert.doesNotMatch(result.summary, /No changes were found/);
  assert.match(result.summary, /inverted/i);
  assert.equal(result.status, "partial");
  assert.equal(result.since, null);
  assert.equal(result.through, null);
  assert.equal(result.sinceSource, "unavailable");
  assert.equal(result.modelAppearances.status, "unavailable");
  assert.equal(result.rankMovements.status, "unavailable");
  assert.equal(result.newDeprecations.status, "unavailable");
  // Price movement is independent of the requested window, so it survives.
  if (result.priceChanges.status !== "available") assert.fail("expected prices");
  assert.equal(result.priceChanges.coverage.status, "indeterminate");
});

test("an empty price comparison of unestablished coverage is never an all-clear", async () => {
  // Coverage can never be `complete`, so an empty becamePaid never establishes
  // that nothing started charging in the caller's window. A summary saying
  // "Nothing changed" and a status of "ok" both claim otherwise.
  const history = historyResponse([
    { date: "2026-08-18", complete: true, rows: [historyRow("m/one", 1, "10")] },
    { date: "2026-08-19", complete: true, rows: [historyRow("m/one", 1, "10")] },
  ]);
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === "/api/public/v2/price-changes") {
        return schema.parse(priceChangesResponse([]));
      }
      if (path === manifestEndpoint) {
        return schema.parse({
          ...manifestFixture,
          routes: [manifestEndpoint, historyEndpoint],
        });
      }
      if (path === historyEndpoint) return schema.parse(history);
      throw new DashboardRequestError("http_error", "unavailable", {
        retryable: true,
        status: 503,
      });
    },
  };
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  assert.notEqual(result.status, "ok");
  assert.doesNotMatch(result.summary, /Nothing changed/);
  assert.match(result.summary, /price movement|could not be shown/i);
});

test("the coverage disclosure reaches warnings on every return path", async () => {
  // Two early returns annotated coverage and then never surfaced it, leaving a
  // field as the only disclosure on exactly the paths a caller is most likely
  // to be reading in a hurry.
  const invertedHistory = historyResponse([
    { date: "2026-08-18", complete: true, rows: [] },
    { date: "2026-08-19", complete: true, rows: [] },
  ]);
  function clientWith(history: unknown, routes: string[]): DashboardClient {
    return {
      async get(path, _query, schema) {
        if (path === "/api/public/v2/price-changes") {
          return schema.parse(priceChangesResponse([]));
        }
        if (path === manifestEndpoint) {
          return schema.parse({ ...manifestFixture, routes });
        }
        if (path === historyEndpoint && history !== null) {
          return schema.parse(history);
        }
        throw new DashboardRequestError("http_error", "unavailable", {
          retryable: true,
          status: 503,
        });
      },
    };
  }

  // Path 1: the window cannot be determined at all.
  const noWindow = await runWhatsChanged(
    { limit: 5 },
    { client: clientWith(null, [manifestEndpoint]) },
  );
  if (noWindow.status === "error") assert.fail("expected a report");
  assert.equal(noWindow.since, null);
  assert.ok(
    noWindow.warnings.some((w) => /price movement coverage/i.test(w)),
    "coverage must be warned about when the window is undeterminable",
  );

  // Path 2: the requested window is inverted.
  const inverted = await runWhatsChanged(
    { since: "2027-01-01", limit: 5 },
    { client: clientWith(invertedHistory, [manifestEndpoint, historyEndpoint]) },
  );
  if (inverted.status === "error") assert.fail("expected a report");
  assert.equal(inverted.since, null);
  assert.ok(
    inverted.warnings.some((w) => /price movement coverage/i.test(w)),
    "coverage must be warned about on the inverted-window path too",
  );
});

test("ok is documented as unreachable, and is in fact unreachable", async () => {
  // The README and the tool description both tell a consumer not to wait for
  // `ok`. This holds the code to that: the cleanest possible report -- every
  // section available, nothing capped, prices readable -- is still partial.
  const history = historyResponse([
    { date: "2026-08-18", complete: true, rows: [historyRow("m/one", 1, "10")] },
    { date: "2026-08-19", complete: true, rows: [historyRow("m/one", 1, "10")] },
  ]);
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === "/api/public/v2/price-changes") {
        return schema.parse(priceChangesResponse([]));
      }
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
      if (path === deprecationsEndpoint) return schema.parse(collectionResponse());
      if (path === liveModelsEndpoint) return schema.parse(collectionResponse());
      throw new Error(`Unexpected test path: ${path}`);
    },
  };
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  assert.equal(result.modelAppearances.status, "available");
  assert.equal(result.newDeprecations.status, "available");
  assert.equal(result.rankMovements.status, "available");
  assert.equal(result.priceChanges.status, "available");
  // Every section clean, and still not ok.
  assert.equal(result.status, "partial");
});

test("the tool description warns a caller off the ok branch", () => {
  assert.match(whatsChangedToolDescription, /always partial rather than ok/i);
  assert.match(whatsChangedToolDescription, /cannot be established/i);
});

test("both counts are floors on a capped mixed page, not just the paid one", async () => {
  // "At least 1 model stopped being free, alongside 1 other price move" binds
  // the floor to the first number only; the second reads as exact. Unread rows
  // can be either kind.
  const client = priceOnlyClient(
    priceChangesResponse(
      [
        becamePaidRow,
        {
          modelId: "vendor/cheaper",
          transition: "price_decreased",
          basePromptPrice: "0.000003",
          baseCompletionPrice: "0.000004",
          headPromptPrice: "0.000001",
          headCompletionPrice: "0.000002",
          wasFree: false,
          isFree: false,
        },
      ],
      undefined,
      "price-next+/=opaque",
    ),
  );
  const result = await runWhatsChanged({ since: "2026-08-18", limit: 5 }, { client });
  if (result.status === "error") assert.fail("expected a report");
  assert.match(result.summary, /At least 1 model stopped being free/);
  assert.match(result.summary, /at least 1 other price move/);
});

import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardClient } from "../src/dashboard/client.js";
import { DashboardRequestError } from "../src/dashboard/errors.js";
import {
  runUsageLeaders,
  USAGE_HISTORY_CANDIDATE_LIMIT,
  USAGE_LEADERS_DEFAULT_LIMIT,
  USAGE_LEADERS_DEFAULT_WINDOW_DAYS,
  USAGE_LEADERS_MAX_LIMIT,
  USAGE_LEADERS_MAX_WINDOW_DAYS,
  usageLeadersInputSchema,
  usageLeadersOutputSchema,
} from "../src/tools/usage-leaders.js";
import {
  opaqueCursor,
  publicCompleteness,
  publicProvenance,
} from "./fixtures.js";

const historyEndpoint = "/api/public/v2/history";
const appsEndpoint = "/api/public/v2/apps";
const matrixEndpoint = "/api/public/v2/app-model-matrix";

type Request = { path: string; query: string };

const requestedSliceCompleteness = {
  ...publicCompleteness,
  populationCompleteness: "top_n_plus_other" as const,
};

function historyRow(
  id: string,
  label: string,
  value: string | null,
  rank: number | null,
) {
  return {
    id,
    label,
    scope: null,
    rank,
    value,
    remainder: id === "other" ? value : null,
    stars: null,
    forks: null,
  };
}

function historyBucket(
  date: string,
  complete: boolean,
  rows: ReturnType<typeof historyRow>[],
) {
  return { date, complete, rows };
}

function historyResponse(
  modelUsage: ReturnType<typeof historyBucket>[],
  end = "2026-08-04",
) {
  return {
    schemaVersion: "2.0",
    status: "available",
    data: {
      modelUsage,
      appRanks: [
        historyBucket("2026-08-03", true, []),
        historyBucket("2026-08-04", true, []),
      ],
      githubRanks: [
        historyBucket("2026-08-03", true, []),
        historyBucket("2026-08-04", true, []),
      ],
    },
    window: {
      start: "2026-07-06",
      end,
      timezone: "UTC",
      inclusive: true,
      basis: "derived",
    },
    completeness: requestedSliceCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  } as const;
}

function appsResponse(cursor: string | null = null) {
  return {
    schemaVersion: "2.0",
    data: [
      {
        appId: "101",
        appName: "Alpha App",
        rank: 1,
        totalTokens: "90071992547409939999",
        totalRequests: "1001",
      },
      {
        appId: "202",
        appName: "Beta App",
        rank: 2,
        totalTokens: "800",
        totalRequests: "50",
      },
    ],
    cursor,
    window: {
      start: "2026-07-06",
      end: "2026-08-04",
      timezone: "UTC",
      inclusive: true,
      basis: "source_meta",
    },
    completeness: {
      ...publicCompleteness,
      populationCompleteness: "requested_slice" as const,
    },
    stale: false,
    rank: {
      metric: "tokens",
      unit: "tokens",
      direction: "desc",
      rankMethod: "source_published",
      baseline: null,
      eligiblePopulation: null,
      ruleVersion: "apps-popular-v1",
      taxonomyVersion: null,
    },
    provenance: publicProvenance,
    requestSlice: {
      period: "30d",
      sort: "popular",
      category: null,
      subcategory: null,
      limit: 2,
    },
  } as const;
}

function appModelsResponse(appId: "101" | "202") {
  const appName = appId === "101" ? "Alpha App" : "Beta App";
  const modelId = appId === "101" ? "model/a" : "model/b";
  return {
    schemaVersion: "2.0",
    status: "available",
    watermark: "app-model:2026-08-03",
    lastSuccessAt: "2026-08-04T06:00:00.000Z",
    stale: false,
    staleAfterSeconds: 172_800,
    completeness: {
      acquisitionComplete: true,
      populationCompleteness: "partial_or_unknown",
      missingFields: [],
    },
    appId,
    appName,
    resolvedPeriod: {
      start: "2026-08-03",
      end: "2026-08-03",
      unit: "day",
      inclusive: true,
    },
    data: [
      {
        modelId,
        sourcePermaslug: modelId,
        resolvedModelId: modelId,
        matchMethod: "source_model_id",
        rank: 1,
        rankMethod: "locally_calculated",
        totalTokens: appId === "101" ? "700" : "600",
        metricSemantics: "observed_daily_total_tokens",
        evidenceUrl: `https://catalogue.test/apps/${appId}/models`,
        period: {
          start: "2026-08-03",
          end: "2026-08-03",
          unit: "day",
          inclusive: true,
        },
      },
    ],
    cursor: null,
    coverage: {
      observedModels: 1,
      mappedModels: 1,
      unmappedModels: 0,
      populationCompleteness: "partial_or_unknown",
    },
    provenance: publicProvenance,
  } as const;
}

function unavailableAppModels(appId: "101" | "202") {
  return {
    schemaVersion: "2.0",
    status: "unavailable",
    reason: "collection_disabled",
    lastSuccessAt: null,
    stale: false,
    staleAfterSeconds: 172_800,
    completeness: {
      acquisitionComplete: false,
      populationCompleteness: "partial_or_unknown",
      missingFields: ["app_model_observations"],
    },
    provenance: publicProvenance,
    appId,
    data: [],
    cursor: null,
  } as const;
}

function matrixResponse() {
  return {
    schemaVersion: "2.0",
    status: "available",
    watermark: "matrix:2026-08-03",
    lastSuccessAt: "2026-08-04T06:00:00.000Z",
    stale: false,
    staleAfterSeconds: 172_800,
    completeness: {
      acquisitionComplete: true,
      populationCompleteness: "partial_or_unknown",
      missingFields: [],
    },
    resolvedPeriod: {
      start: "2026-08-03",
      end: "2026-08-03",
      unit: "day",
      inclusive: true,
    },
    apps: [{ appId: "999", appName: "Producer Top App" }],
    models: [{ modelId: "model/z", modelName: "Producer Top Model" }],
    appIds: ["999"],
    modelIds: ["model/z"],
    cells: [
      {
        state: "unknown",
        appId: "999",
        modelId: "model/z",
        reason: "not_observed",
      },
    ],
    missingAliases: ["404"],
    unmappedModels: [
      {
        appId: "999",
        sourcePermaslug: "unmapped/source-model",
        totalTokens: "12",
        rankWithinPeriod: 2,
        reason: "unmapped_model",
      },
    ],
    coverage: {
      observedCells: 0,
      possibleCells: 1,
      unmappedObservations: 1,
      populationCompleteness: "partial_or_unknown",
    },
    provenance: publicProvenance,
  } as const;
}

function unavailableMatrix() {
  return {
    schemaVersion: "2.0",
    status: "unavailable",
    reason: "collection_disabled",
    lastSuccessAt: null,
    stale: false,
    staleAfterSeconds: 172_800,
    completeness: {
      acquisitionComplete: false,
      populationCompleteness: "partial_or_unknown",
      missingFields: ["app_model_observations"],
    },
    provenance: publicProvenance,
    appIds: [],
    modelIds: [],
    cells: [],
  } as const;
}

function completeUsageHistory() {
  return historyResponse([
    historyBucket("2026-08-01", true, [
      historyRow("model/a", "Model A", "90071992547409930001", 2),
      historyRow("model/b", "Model B", "2", 1),
      historyRow("other", "Other", "10", null),
    ]),
    historyBucket("2026-08-02", true, [
      historyRow("model/a", "Model A", "0", 2),
      historyRow("model/b", "Model B", "90071992547409930000", 1),
      historyRow("other", "Other", "20", null),
    ]),
    historyBucket("2026-08-03", true, [
      historyRow("model/a", "Model A", "90071992547409930003", 1),
      historyRow("model/b", "Model B", "1", 2),
      historyRow("other", "Other", "30", null),
    ]),
    historyBucket("2026-08-04", true, [
      historyRow("model/a", "Model A", "0", 1),
      historyRow("model/b", "Model B", "90071992547409930000", 2),
      historyRow("other", "Other", "40", null),
    ]),
  ]);
}

function successfulClient(requests: Request[]): DashboardClient {
  return {
    async get(path, query, schema) {
      requests.push({ path, query: query.toString() });
      if (path === historyEndpoint) return schema.parse(completeUsageHistory());
      if (path === appsEndpoint) return schema.parse(appsResponse(opaqueCursor));
      if (path === matrixEndpoint) return schema.parse(matrixResponse());
      if (path === `${appsEndpoint}/101/models`) {
        return schema.parse(appModelsResponse("101"));
      }
      if (path === `${appsEndpoint}/202/models`) {
        return schema.parse(appModelsResponse("202"));
      }
      throw new Error(`Unexpected test request: ${path}?${query.toString()}`);
    },
  };
}

test("defaults and bounds usage inputs to two comparable producer-supported periods", () => {
  assert.deepEqual(usageLeadersInputSchema.parse({}), {
    windowDays: USAGE_LEADERS_DEFAULT_WINDOW_DAYS,
    limit: USAGE_LEADERS_DEFAULT_LIMIT,
  });
  assert.equal(USAGE_LEADERS_DEFAULT_WINDOW_DAYS, 30);
  assert.equal(USAGE_LEADERS_MAX_WINDOW_DAYS, 182);
  assert.equal(USAGE_LEADERS_DEFAULT_LIMIT, 5);
  assert.equal(USAGE_LEADERS_MAX_LIMIT, 10);
  assert.equal(USAGE_HISTORY_CANDIDATE_LIMIT, 25);
  assert.throws(() => usageLeadersInputSchema.parse({ windowDays: 0 }));
  assert.throws(() => usageLeadersInputSchema.parse({ windowDays: 183 }));
  assert.throws(() => usageLeadersInputSchema.parse({ limit: 0 }));
  assert.throws(() => usageLeadersInputSchema.parse({ limit: 11 }));
  assert.throws(() => usageLeadersInputSchema.parse({ extra: true }));
});

test("aggregates exact public slice volume, excludes other from named leaders, and keeps all periods separate", async () => {
  const requests: Request[] = [];

  const result = await runUsageLeaders(
    { windowDays: 2, limit: 2 },
    { client: successfulClient(requests) },
  );

  assert.equal(result.status, "ok");
  if (result.status === "error") return;
  usageLeadersOutputSchema.parse(result);
  assert.deepEqual(result.query, { windowDays: 2, limit: 2 });
  assert.equal(result.modelRequestedWindow.status, "available");
  if (result.modelRequestedWindow.status === "unavailable") return;
  assert.equal(
    result.modelRequestedWindow.periodSemantics,
    "requested_calendar_window",
  );
  assert.equal(
    result.modelRequestedWindow.populationScope,
    "named_models_observed_in_published_daily_top_25_slice",
  );
  assert.equal(
    result.modelRequestedWindow.observedSliceValueSemantics,
    "sum_of_published_daily_values_only_absence_not_zero",
  );
  assert.equal(result.modelRequestedWindow.upstreamHistoryWindow, "30d");
  assert.deepEqual(result.modelRequestedWindow.currentInterval, {
    start: "2026-08-03",
    end: "2026-08-04",
    expectedDays: 2,
    observedCompleteDays: 2,
    missingDates: [],
    incompleteDates: [],
    evidenceGaps: [],
    evidenceComplete: true,
  });
  assert.deepEqual(result.modelRequestedWindow.previousInterval, {
    start: "2026-08-01",
    end: "2026-08-02",
    expectedDays: 2,
    observedCompleteDays: 2,
    missingDates: [],
    incompleteDates: [],
    evidenceGaps: [],
    evidenceComplete: true,
  });
  assert.deepEqual(result.modelRequestedWindow.leaders, [
    {
      modelId: "model/a",
      label: "Model A",
      currentRank: 1,
      previousRank: 2,
      rankMovement: 1,
      ecosystemTokenVolume: "90071992547409930003",
      previousEcosystemTokenVolume: "90071992547409930001",
    },
    {
      modelId: "model/b",
      label: "Model B",
      currentRank: 2,
      previousRank: 1,
      rankMovement: -1,
      ecosystemTokenVolume: "90071992547409930001",
      previousEcosystemTokenVolume: "90071992547409930002",
    },
  ]);
  assert.deepEqual(result.modelRequestedWindow.unidentifiedLongTail, {
    modelId: "other",
    label: "Other",
    ecosystemTokenVolume: "70",
    previousEcosystemTokenVolume: "30",
  });
  assert.deepEqual(result.modelRequestedWindow.cap, {
    historyCandidateLimit: 25,
    outputLimit: 2,
    namedCandidatesObserved: 2,
  });

  assert.equal(result.appsRolling30Day.status, "available");
  if (result.appsRolling30Day.status === "available") {
    assert.equal(result.appsRolling30Day.periodSemantics, "rolling_30_day");
    assert.deepEqual(result.appsRolling30Day.leaders[0], {
      appId: "101",
      appName: "Alpha App",
      publishedRank: 1,
      rolling30DayEcosystemTokenVolume: "90071992547409939999",
      rolling30DayRequestCount: "1001",
      ecosystemTokenVolumeMovement: null,
    });
    assert.deepEqual(result.appsRolling30Day.cap, {
      requestedLimit: 2,
      returnedCount: 2,
      nextCursor: opaqueCursor,
      capped: true,
    });
  }
  assert.equal(
    result.appLatestDayModels.periodSemantics,
    "latest_observed_day",
  );
  assert.deepEqual(
    result.appLatestDayModels.items.map((item) => [
      item.appId,
      item.status,
      item.response?.status,
    ]),
    [
      ["101", "available", "available"],
      ["202", "available", "available"],
    ],
  );
  assert.equal(
    result.appLatestDayModels.items[0]?.response?.status === "available"
      ? result.appLatestDayModels.items[0].response.metricSemantics
      : null,
    undefined,
  );
  assert.equal(
    result.appLatestDayModels.items[0]?.response?.status === "available"
      ? result.appLatestDayModels.items[0].response.data[0]?.metricSemantics
      : null,
    "observed_daily_total_tokens",
  );
  assert.equal(
    result.producerSelectedTopAxisMatrix.selectionSemantics,
    "producer_selected_top_10_axes_not_caller_selected_ids",
  );
  assert.equal(result.producerSelectedTopAxisMatrix.status, "available");
  assert.deepEqual(
    result.producerSelectedTopAxisMatrix.response?.appIds,
    ["999"],
  );
  assert.deepEqual(
    result.producerSelectedTopAxisMatrix.response?.modelIds,
    ["model/z"],
  );
  assert.equal(
    result.producerSelectedTopAxisMatrix.response?.status === "available"
      ? result.producerSelectedTopAxisMatrix.response.cells[0]?.state
      : null,
    "unknown",
  );
  assert.deepEqual(
    result.producerSelectedTopAxisMatrix.response?.status === "available"
      ? result.producerSelectedTopAxisMatrix.response.missingAliases
      : [],
    ["404"],
  );
  assert.deepEqual(
    result.producerSelectedTopAxisMatrix.response?.status === "available"
      ? result.producerSelectedTopAxisMatrix.response.unmappedModels.map(
          (row) => row.sourcePermaslug,
        )
      : [],
    ["unmapped/source-model"],
  );

  const serialized = JSON.stringify(result).toLowerCase();
  assert.match(serialized, /ecosystemtokenvolume/);
  assert.match(serialized, /public openrouter-wide/);
  assert.doesNotMatch(
    serialized,
    /your spend|personal spend|your cost|personal cost|your budget|api key usage/,
  );
  assert.deepEqual(requests, [
    { path: historyEndpoint, query: "window=30d&limit=25" },
    { path: appsEndpoint, query: "period=30d&sort=popular&limit=2" },
    { path: `${appsEndpoint}/101/models`, query: "limit=100" },
    { path: `${appsEndpoint}/202/models`, query: "limit=100" },
    {
      path: matrixEndpoint,
      query: "appLimit=10&modelLimit=10&window=latest-complete",
    },
  ]);
});

test("anchors on response.window.end without sliding and treats missing, incomplete, and decimal rows as evidence gaps", async () => {
  const gapHistory = historyResponse([
    historyBucket("2026-07-31", true, [
      historyRow("model/a", "Model A", "999999", 1),
      historyRow("other", "Other", "999999", null),
    ]),
    historyBucket("2026-08-01", false, [
      historyRow("model/a", "Model A", "888888", 1),
      historyRow("other", "Other", "888888", null),
    ]),
    historyBucket("2026-08-03", true, [
      historyRow("model/a", "Model A", "1.5", 1),
      historyRow("model/b", "Model B", "4", 2),
      historyRow("other", "Other", "6", null),
    ]),
    historyBucket("2026-08-04", true, [
      historyRow("model/a", "Model A", "10", 1),
      historyRow("model/b", "Model B", "3", 2),
      historyRow("other", "Other", "7", null),
    ]),
  ]);
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === historyEndpoint) return schema.parse(gapHistory);
      if (path === appsEndpoint) return schema.parse(appsResponse());
      if (path === matrixEndpoint) return schema.parse(matrixResponse());
      if (path === `${appsEndpoint}/101/models`) {
        return schema.parse(appModelsResponse("101"));
      }
      return schema.parse(appModelsResponse("202"));
    },
  };

  const result = await runUsageLeaders({ windowDays: 2, limit: 2 }, { client });

  assert.equal(result.status, "partial");
  if (result.status === "error") return;
  assert.equal(result.modelRequestedWindow.status, "partial");
  if (result.modelRequestedWindow.status === "unavailable") return;
  assert.deepEqual(result.modelRequestedWindow.currentInterval, {
    start: "2026-08-03",
    end: "2026-08-04",
    expectedDays: 2,
    observedCompleteDays: 2,
    missingDates: [],
    incompleteDates: [],
    evidenceGaps: [
      {
        date: "2026-08-03",
        modelId: "model/a",
        reason: "non_integer_value",
      },
    ],
    evidenceComplete: false,
  });
  assert.deepEqual(result.modelRequestedWindow.previousInterval, {
    start: "2026-08-01",
    end: "2026-08-02",
    expectedDays: 2,
    observedCompleteDays: 0,
    missingDates: ["2026-08-02"],
    incompleteDates: ["2026-08-01"],
    evidenceGaps: [],
    evidenceComplete: false,
  });
  assert.deepEqual(
    result.modelRequestedWindow.leaders.map((leader) => ({
      modelId: leader.modelId,
      ecosystemTokenVolume: leader.ecosystemTokenVolume,
      previousRank: leader.previousRank,
      rankMovement: leader.rankMovement,
    })),
    [
      {
        modelId: "model/a",
        ecosystemTokenVolume: "10",
        previousRank: null,
        rankMovement: null,
      },
      {
        modelId: "model/b",
        ecosystemTokenVolume: "7",
        previousRank: null,
        rankMovement: null,
      },
    ],
  );
  assert.deepEqual(result.modelRequestedWindow.unidentifiedLongTail, {
    modelId: "other",
    label: "Other",
    ecosystemTokenVolume: "13",
    previousEcosystemTokenVolume: null,
  });
  assert.ok(
    result.modelRequestedWindow.warnings.some((warning) =>
      warning.includes("rank movement is unknown"),
    ),
  );
  assert.doesNotMatch(JSON.stringify(result), /999999|888888/);
});

test("keeps core leaders when latest-day joins are disabled or one independent auxiliary fails", async () => {
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === historyEndpoint) return schema.parse(completeUsageHistory());
      if (path === appsEndpoint) return schema.parse(appsResponse());
      if (path === `${appsEndpoint}/101/models`) {
        throw new DashboardRequestError(
          "http_error",
          "The dashboard catalogue returned HTTP 503.",
          { retryable: true, status: 503 },
        );
      }
      if (path === `${appsEndpoint}/202/models`) {
        return schema.parse(unavailableAppModels("202"));
      }
      if (path === matrixEndpoint) return schema.parse(unavailableMatrix());
      throw new Error(`Unexpected test path: ${path}`);
    },
  };

  const result = await runUsageLeaders({ windowDays: 2, limit: 2 }, { client });

  assert.equal(result.status, "partial");
  if (result.status === "error") return;
  assert.equal(result.modelRequestedWindow.status, "available");
  assert.equal(result.appsRolling30Day.status, "available");
  assert.deepEqual(
    result.appLatestDayModels.items.map((item) => [
      item.appId,
      item.status,
      item.response?.status ?? null,
      item.error?.status ?? null,
    ]),
    [
      ["101", "error", null, 503],
      ["202", "unavailable", "unavailable", null],
    ],
  );
  assert.equal(
    result.appLatestDayModels.items[1]?.response?.status === "unavailable"
      ? result.appLatestDayModels.items[1].response.reason
      : null,
    "collection_disabled",
  );
  assert.equal(result.producerSelectedTopAxisMatrix.status, "unavailable");
  assert.equal(
    result.producerSelectedTopAxisMatrix.response?.status === "unavailable"
      ? result.producerSelectedTopAxisMatrix.response.reason
      : null,
    "collection_disabled",
  );
  assert.ok(result.warnings.some((warning) => warning.includes("HTTP 503")));
  assert.ok(
    result.warnings.some((warning) => warning.includes("collection_disabled")),
  );
});

test("preserves an available app slice when model history itself is unavailable", async () => {
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === historyEndpoint) {
        throw new DashboardRequestError(
          "http_error",
          "The dashboard catalogue returned HTTP 503.",
          { retryable: true, status: 503 },
        );
      }
      if (path === appsEndpoint) return schema.parse(appsResponse());
      if (path === `${appsEndpoint}/101/models`) {
        return schema.parse(appModelsResponse("101"));
      }
      if (path === `${appsEndpoint}/202/models`) {
        return schema.parse(appModelsResponse("202"));
      }
      return schema.parse(matrixResponse());
    },
  };

  const result = await runUsageLeaders({ windowDays: 2, limit: 2 }, { client });

  assert.equal(result.status, "partial");
  if (result.status === "error") return;
  assert.equal(result.modelRequestedWindow.status, "unavailable");
  if (result.modelRequestedWindow.status === "unavailable") {
    assert.equal(result.modelRequestedWindow.error?.status, 503);
  }
  assert.equal(result.appsRolling30Day.status, "available");
  assert.equal(result.appsRolling30Day.leaders.length, 2);
});

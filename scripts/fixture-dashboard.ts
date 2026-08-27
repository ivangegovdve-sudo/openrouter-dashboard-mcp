import { createServer, type Server, type ServerResponse } from "node:http";
import { connect, type Socket } from "node:net";

import {
  appModelMatrixAvailableFixture,
  githubProvenance,
  liveModelFixture,
  manifestFixture,
  modelFixture,
  publicCompleteness,
  publicProvenance,
  publicWindow,
  sourceStatusFixture,
} from "../test/fixtures.js";

export type FixtureMode = "fixture" | "html";

export type FixtureRequest = {
  method: string;
  path: string;
  query: string;
};

export type FixtureDashboard = {
  baseUrl: string;
  requests: FixtureRequest[];
  close(): Promise<void>;
};

const LOOPBACK = "127.0.0.1";
const CLOSE_TIMEOUT_MS = 3_000;
const REFUSAL_TIMEOUT_MS = 1_000;

const ROUTES = [
  "/api/public/v2/manifest",
  "/api/public/v2/live-models",
  "/api/public/v2/models",
  "/api/public/v2/models/{id}/providers",
  "/api/public/v2/free-models",
  "/api/public/v2/free-frontiers",
  "/api/public/v2/history",
  "/api/public/v2/deprecations",
  "/api/public/v2/source-status",
  "/api/public/v2/apps",
  "/api/public/v2/app-model-matrix",
  "/api/public/v2/github/rankings",
  "/api/public/v2/github/repositories",
] as const;

const knownFreeModel = {
  ...liveModelFixture,
  provider: "openrouter" as const,
  id: "fixture/free-text",
  displayName: "Fixture Free Text",
  contextLength: "90071992547409930001",
  pricing: {
    promptUsdPerToken: "0",
    completionUsdPerToken: "0",
  },
  isFree: true,
  freeKind: "concrete_free" as const,
  outputModalities: ["text"],
  availability: "available" as const,
};

const unknownModel = {
  ...liveModelFixture,
  provider: "openrouter" as const,
  id: "fixture/unknown-model",
  displayName: "Fixture Unknown Model",
  contextLength: null,
  pricing: {
    promptUsdPerToken: null,
    completionUsdPerToken: null,
  },
  isFree: null,
  freeKind: "paid_or_unknown" as const,
  providerActive: null,
  outputModalities: ["text"],
  performance: null,
  missingFields: ["contextLength", "pricing", "isFree"],
};

const disappearedModel = {
  ...knownFreeModel,
  id: "fixture/disappeared-model",
  displayName: "Fixture Disappeared Model",
  contextLength: "90071992547409930003",
  availability: "disappeared" as const,
  lastSeenAt: "2026-08-16T06:00:00.000Z",
  disappearedAt: "2026-08-17T06:00:00.000Z",
  absenceStreak: "3",
};

const freeCatalogueModel = {
  ...modelFixture,
  id: "fixture/free-text",
  canonicalSlug: "fixture/free-text",
  name: "Fixture Free Text",
  pricing: { prompt: "0", completion: "0" },
  freeKind: "concrete_free" as const,
};

/**
 * A discounted paid model, so the fixture can prove the economics tool reports a
 * published discount with its provider named and no invented expiry.
 */
const discountedCatalogueModel = {
  ...modelFixture,
  id: "fixture/discounted",
  canonicalSlug: "fixture/discounted",
  name: "Fixture Discounted",
  contextLength: "128000",
  pricing: { prompt: "0.0000001250", completion: "0.0000005000" },
  freeKind: "paid_or_unknown" as const,
  supportedParameters: ["temperature", "tools"],
};

const fixtureProviderRow = {
  modelId: discountedCatalogueModel.id,
  provider: "FixtureProvider",
  endpoint: "FixtureProvider | fixture/discounted",
  quantization: "unknown",
  contextLength: "128000",
  promptPrice: "0.0000001250",
  completionPrice: "0.0000005000",
  discount: "0.432000000",
  uptime: "99.000000000",
  latency: "400.000000",
  throughput: "100.000000",
  status: "0",
  sourceUrl: "https://openrouter.ai/fixture/discounted/providers",
  fetchedAt: "2026-08-27T06:00:00.000Z",
};

function collection<T>(data: readonly T[]) {
  return {
    schemaVersion: "2.0",
    data: [...data],
    cursor: null,
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  } as const;
}

function manifestResponse() {
  return {
    ...manifestFixture,
    routes: [...ROUTES],
    sources: [
      sourceStatusFixture,
      {
        ...sourceStatusFixture,
        sourceId: "benchmarks_current",
        stale: true,
        lastAttemptStatus: "failed" as const,
        lastAttemptErrorCode: "BENCHMARK_COLLECTION_DELAYED",
        lastAttemptAcquisitionComplete: false,
        lastAttemptPopulationCompleteness: "partial_or_unknown" as const,
      },
    ],
  } as const;
}

function sourceStatusResponse() {
  return {
    ...collection(manifestResponse().sources),
    stale: true,
  } as const;
}

function freeModelsResponse() {
  return {
    ...collection([freeCatalogueModel]),
    router: null,
    concreteFreeCount: "1",
  } as const;
}

function frontierResponse(
  x: "benchmarkQuality" | "contextLength",
  y: "medianThroughput" | "weeklyPopularityRank",
) {
  return collection([
    {
      ruleVersion: "openrouter-free-pareto-v1",
      dimensions: {
        x,
        y,
        xDirection: "max",
        yDirection: y === "weeklyPopularityRank" ? "min" : "max",
      },
      members: [{ modelId: knownFreeModel.id, x: "80", y: "100" }],
      excluded: [
        { modelId: unknownModel.id, reason: `missing_${x}` },
      ],
    },
  ]);
}

function historyRow(
  id: string,
  label: string,
  value: string,
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
  } as const;
}

function overviewHistoryResponse() {
  const dates = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 7, 6 + index));
    return date.toISOString().slice(0, 10);
  });
  const buckets = dates.map((date, index) => ({
    date,
    complete: true,
    rows: [
      historyRow(
        knownFreeModel.id,
        knownFreeModel.displayName ?? knownFreeModel.id,
        String(1_000 + index * 100),
        1,
      ),
      historyRow("other", "Other", "10", null),
    ],
  }));
  return {
    schemaVersion: "2.0",
    status: "available",
    data: {
      modelUsage: buckets,
      appRanks: [],
      githubRanks: [],
    },
    window: {
      start: dates[0],
      end: dates.at(-1),
      timezone: "UTC",
      inclusive: true,
      basis: "derived",
    },
    completeness: {
      ...publicCompleteness,
      populationCompleteness: "top_n_plus_other" as const,
    },
    stale: false,
    rank: null,
    provenance: publicProvenance,
  } as const;
}

function deprecationsResponse() {
  return collection([]);
}

function appsResponse(limit: number) {
  const appId = "90071992547409930001";
  return {
    schemaVersion: "2.0",
    data: [
      {
        appId,
        appName: "Fixture App",
        rank: 1,
        totalTokens: "90071992547409939999",
        totalRequests: "1001",
      },
    ],
    cursor: null,
    window: {
      start: "2026-07-21",
      end: "2026-08-19",
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
      limit,
    },
  } as const;
}

function appModelsResponse(appId: string) {
  return {
    schemaVersion: "2.0",
    status: "available",
    watermark: "app-model:2026-08-18",
    lastSuccessAt: "2026-08-19T06:01:00.000Z",
    stale: false,
    staleAfterSeconds: 172_800,
    completeness: {
      acquisitionComplete: true,
      populationCompleteness: "partial_or_unknown",
      missingFields: [],
    },
    appId,
    appName: "Fixture App",
    resolvedPeriod: {
      start: "2026-08-18",
      end: "2026-08-18",
      unit: "day",
      inclusive: true,
    },
    data: [
      {
        modelId: knownFreeModel.id,
        sourcePermaslug: knownFreeModel.id,
        resolvedModelId: knownFreeModel.id,
        matchMethod: "source_model_id",
        rank: 1,
        rankMethod: "locally_calculated",
        totalTokens: "700",
        metricSemantics: "observed_daily_total_tokens",
        evidenceUrl: "https://catalogue.test/apps/fixture/models",
        period: {
          start: "2026-08-18",
          end: "2026-08-18",
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

function matrixResponse() {
  return {
    ...appModelMatrixAvailableFixture,
    watermark: "matrix:2026-08-18",
    apps: [
      { appId: "90071992547409930001", appName: "Fixture App" },
    ],
    models: [
      { modelId: knownFreeModel.id, modelName: knownFreeModel.displayName },
    ],
    appIds: ["90071992547409930001"],
    modelIds: [knownFreeModel.id],
    cells: [
      {
        ...appModelMatrixAvailableFixture.cells[0],
        appId: "90071992547409930001",
        modelId: knownFreeModel.id,
      },
    ],
  } as const;
}

function githubCoverage(resolvedAsOf: string) {
  return {
    resolvedAsOf,
    acquisitionComplete: true,
    populationCompleteness: "full" as const,
    missingFields: [],
    stale: false,
    lastSuccessAt: `${resolvedAsOf}T06:01:00.000Z`,
    staleAfterSeconds: 172_800,
  } as const;
}

function githubRankingResponse(options: {
  resolvedAsOf: string;
  baselineDate: string;
  pageLimit: number;
  rank: number;
}) {
  const repositoryId = "9007199254740993";
  return {
    schemaVersion: "2.0",
    watermark: `github:mcp:${options.resolvedAsOf}`,
    coverage: githubCoverage(options.resolvedAsOf),
    ranking: {
      metric: "momentum",
      rankMethod: "locally_calculated",
      definition: "Seven-day public GitHub momentum.",
      unit: "momentum_score",
      direction: "higher_is_better",
      ruleVersion: "github-ranking-v1",
      taxonomyVersion: "github-ai-v1",
      category: "mcp",
      entityLevel: "project-family",
      eligiblePopulation: 1,
      coverageExcluded: 0,
      windowDays: 7,
      baselineDate: options.baselineDate,
    },
    data: [
      {
        entityId: "example-family",
        familyId: "example-family",
        repositoryId,
        memberRepositoryIds: [repositoryId],
        fullName: "example/repository",
        stars: "90071992547409930001",
        forks: "90071992547409930000",
        rank: options.rank,
        score: "123.000000",
        maintenanceEvidence: null,
      },
    ],
    metricEvidence: [
      {
        repositoryId,
        baselineStars: "90071992547409930000",
        starDelta: "1",
        forkDelta: "-1",
        relativeGrowth: "0.000001",
        defaultBranchCommittedAt: "2026-08-18T12:00:00.000Z",
        latestStableReleaseAt: null,
        stableReleaseCount90d: 0,
      },
    ],
    page: { limit: options.pageLimit, nextCursor: null },
    provenance: githubProvenance,
  } as const;
}

function repositoryResponse() {
  const repositoryId = "9007199254740993";
  return {
    schemaVersion: "2.0",
    watermark: "github-repositories:2026-08-19",
    coverage: githubCoverage("2026-08-19"),
    data: [
      {
        repositoryId,
        familyId: "example-family",
        isCanonical: true,
        fullName: "example/repository",
        url: "https://github.com/example/repository",
        primaryCategory: "mcp",
        roles: ["server"],
        lifecycle: "active",
        license: "MIT",
        language: "TypeScript",
        stars: "90071992547409930001",
        forks: "90071992547409930000",
      },
    ],
    page: { limit: 100, nextCursor: null },
    provenance: githubProvenance,
  } as const;
}

function repositoryHistoryResponse() {
  const repositoryId = "9007199254740993";
  return {
    schemaVersion: "2.0",
    repositoryId,
    requestFactKind: "snapshot",
    coverage: githubCoverage("2026-08-19"),
    data: [
      {
        observedDate: "2026-08-12",
        stars: "90071992547409930000",
        forks: "90071992547409930001",
        openIssues: "10",
        defaultBranchCommittedAt: "2026-08-11T12:00:00.000Z",
        latestStableReleaseAt: null,
        stableReleaseCount90d: 0,
        lifecycle: "active",
      },
      {
        observedDate: "2026-08-19",
        stars: "90071992547409930001",
        forks: "90071992547409930000",
        openIssues: "9",
        defaultBranchCommittedAt: "2026-08-18T12:00:00.000Z",
        latestStableReleaseAt: null,
        stableReleaseCount90d: 0,
        lifecycle: "active",
      },
    ],
    page: { limit: 8, nextCursor: null },
    provenance: githubProvenance,
  } as const;
}

function repositoryEnrichmentResponse() {
  const repositoryId = "9007199254740993";
  return {
    schemaVersion: "2.0",
    repositoryId,
    requestRange: { from: "2026-08-12", to: "2026-08-19" },
    releaseCadence: {
      latestStableReleaseAt: null,
      stableReleaseCount90d: null,
      medianStableReleaseIntervalDays365d: null,
      coverageStart: null,
      coverageEnd: null,
      coverageComplete: false,
    },
    starBuckets: [
      {
        start: "2026-08-12",
        end: "2026-08-19",
        count: "1",
        populationCompleteness: "partial_or_unknown",
      },
    ],
    provenance: [
      {
        id: "github-enrichment",
        sourceUrl: "https://api.github.com/repositories/9007199254740993",
        fetchedAt: "2026-08-19T06:01:00.000Z",
      },
    ],
  } as const;
}

function assertOnlyKeys(query: URLSearchParams, allowed: readonly string[]): void {
  for (const key of query.keys()) {
    if (!allowed.includes(key)) throw new Error("unexpected fixture query key");
  }
}

function assertExactQuery(
  query: URLSearchParams,
  expected: Record<string, string>,
): void {
  assertOnlyKeys(query, Object.keys(expected));
  if (query.size !== Object.keys(expected).length) {
    throw new Error("incomplete fixture query");
  }
  for (const [key, value] of Object.entries(expected)) {
    if (query.get(key) !== value) throw new Error("unexpected fixture query");
  }
}

function fixtureBody(path: string, query: URLSearchParams): unknown {
  if (path === "/api/public/v2/manifest") {
    assertExactQuery(query, {});
    return manifestResponse();
  }
  if (path === "/api/public/v2/live-models") {
    assertOnlyKeys(query, [
      "availability",
      "free",
      "minContext",
      "outputModality",
      "limit",
      "sort",
      "cursor",
    ]);
    if (query.get("cursor") !== null) throw new Error("unexpected live cursor");
    if (query.get("limit") === null) throw new Error("missing live limit");
    return collection([knownFreeModel, unknownModel, disappearedModel]);
  }
  if (path === "/api/public/v2/models") {
    assertOnlyKeys(query, ["limit", "cursor"]);
    if (query.get("limit") === null) throw new Error("missing catalogue limit");
    if (query.get("cursor") !== null) throw new Error("unexpected catalogue cursor");
    return collection([discountedCatalogueModel, freeCatalogueModel]);
  }
  if (path === `/api/public/v2/models/${encodeURIComponent(discountedCatalogueModel.id)}/providers`) {
    assertExactQuery(query, {});
    return collection([fixtureProviderRow]);
  }
  if (/^\/api\/public\/v2\/models\/.+\/providers$/.test(path)) {
    // Every other model is unobserved upstream, which the tool must report as
    // unknown rather than as full price. The fixture answers 500, matching how
    // the deployed dashboard behaves for a model it holds no observation for.
    throw new Error("fixture provider observation unavailable");
  }
  if (path === "/api/public/v2/free-models") {
    assertExactQuery(query, { modality: "text", limit: "5" });
    return freeModelsResponse();
  }
  if (path === "/api/public/v2/free-frontiers") {
    const x = query.get("x");
    const y = query.get("y");
    assertExactQuery(query, {
      x: x ?? "",
      y: y ?? "",
      limit: "200",
    });
    if (
      !(
        (x === "benchmarkQuality" && y === "medianThroughput") ||
        (x === "contextLength" && y === "weeklyPopularityRank")
      )
    ) {
      throw new Error("unexpected frontier dimensions");
    }
    return frontierResponse(x, y);
  }
  if (path === "/api/public/v2/history") {
    const isUsage = query.get("window") === "30d";
    assertExactQuery(
      query,
      isUsage
        ? { window: "30d", limit: "25" }
        : { window: "365d", limit: "5" },
    );
    return overviewHistoryResponse();
  }
  if (path === "/api/public/v2/deprecations") {
    assertExactQuery(query, { limit: "500" });
    return deprecationsResponse();
  }
  if (path === "/api/public/v2/source-status") {
    assertExactQuery(query, {});
    return sourceStatusResponse();
  }
  if (path === "/api/public/v2/apps") {
    const limit = query.get("limit");
    if (limit !== "3" && limit !== "5") throw new Error("unexpected app limit");
    assertExactQuery(query, { period: "30d", sort: "popular", limit });
    return appsResponse(Number(limit));
  }
  const appModelsMatch = path.match(
    /^\/api\/public\/v2\/apps\/(90071992547409930001)\/models$/,
  );
  if (appModelsMatch !== null) {
    assertExactQuery(query, { limit: "100" });
    return appModelsResponse(appModelsMatch[1] ?? "");
  }
  if (path === "/api/public/v2/app-model-matrix") {
    assertExactQuery(query, {
      appLimit: "10",
      modelLimit: "10",
      window: "latest-complete",
    });
    return matrixResponse();
  }
  if (path === "/api/public/v2/github/rankings") {
    const asOf = query.get("as_of");
    if (asOf === null) {
      const limit = query.get("limit");
      if (limit !== "3" && limit !== "5") {
        throw new Error("unexpected GitHub current limit");
      }
      assertExactQuery(query, {
        metric: "momentum",
        window: "7",
        category: "mcp",
        entity_level: "project-family",
        limit,
      });
      return githubRankingResponse({
        resolvedAsOf: "2026-08-19",
        baselineDate: "2026-08-12",
        pageLimit: Number(limit),
        rank: 1,
      });
    }
    assertExactQuery(query, {
      metric: "momentum",
      window: "7",
      category: "mcp",
      entity_level: "project-family",
      limit: "100",
      as_of: "2026-08-12",
    });
    return githubRankingResponse({
      resolvedAsOf: "2026-08-12",
      baselineDate: "2026-08-05",
      pageLimit: 100,
      rank: 2,
    });
  }
  if (path === "/api/public/v2/github/repositories") {
    assertExactQuery(query, {
      taxonomy_version: "github-ai-v1",
      family_id: "example-family",
      as_of: "2026-08-19",
      limit: "100",
    });
    return repositoryResponse();
  }
  if (
    path ===
    "/api/public/v2/github/repositories/9007199254740993/history"
  ) {
    assertExactQuery(query, {
      from: "2026-08-12",
      to: "2026-08-19",
      fact_kind: "snapshot",
      limit: "8",
    });
    return repositoryHistoryResponse();
  }
  if (
    path ===
    "/api/public/v2/github/repositories/9007199254740993/enrichment"
  ) {
    assertExactQuery(query, { from: "2026-08-12", to: "2026-08-19" });
    return repositoryEnrichmentResponse();
  }
  throw new Error("unexpected fixture route");
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function deadline<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`fixture lifecycle exceeded ${timeoutMs}ms`)),
      timeoutMs,
    );
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function listen(server: Server): Promise<number> {
  return deadline(
    new Promise<number>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, LOOPBACK, () => {
        server.removeListener("error", reject);
        const address = server.address();
        if (address === null || typeof address === "string") {
          reject(new Error("fixture did not bind a TCP port"));
          return;
        }
        resolve(address.port);
      });
    }),
    CLOSE_TIMEOUT_MS,
  );
}

function closeServer(server: Server): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error !== undefined) reject(error);
      else resolve();
    });
  });
}

export async function startFixtureDashboard(
  options: { mode: FixtureMode },
): Promise<FixtureDashboard> {
  const requests: FixtureRequest[] = [];
  const sockets = new Set<Socket>();
  const hungResponses = new Set<ServerResponse>();
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://${LOOPBACK}`);
    requests.push({
      method: request.method ?? "",
      path: url.pathname,
      query: url.searchParams.toString(),
    });

    if (request.method !== "GET") {
      sendJson(response, 500, { status: "fixture_error" });
      return;
    }
    if (url.pathname === "/__self-test/valid") {
      sendJson(response, 200, { status: "ok" });
      return;
    }
    if (url.pathname === "/__self-test/500") {
      sendJson(response, 500, { status: "fixture_error" });
      return;
    }
    if (url.pathname === "/__self-test/html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<p>fixture-html-body</p>");
      return;
    }
    if (url.pathname === "/__self-test/hang") {
      hungResponses.add(response);
      response.once("close", () => hungResponses.delete(response));
      return;
    }
    if (options.mode === "html") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end("<p>fixture-html-body</p>");
      return;
    }

    try {
      sendJson(response, 200, fixtureBody(url.pathname, url.searchParams));
    } catch {
      sendJson(response, 500, { status: "fixture_error" });
    }
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  const port = await listen(server);
  let closePromise: Promise<void> | undefined;

  return {
    baseUrl: `http://${LOOPBACK}:${port}/`,
    requests,
    close() {
      if (closePromise !== undefined) return closePromise;
      const closing = closeServer(server);
      for (const response of hungResponses) response.destroy();
      for (const socket of sockets) socket.destroy();
      server.closeAllConnections?.();
      closePromise = deadline(closing, CLOSE_TIMEOUT_MS);
      return closePromise;
    },
  };
}

async function assertPortRefusesConnections(port: number): Promise<void> {
  await deadline(
    new Promise<void>((resolve, reject) => {
      const socket = connect(port, LOOPBACK);
      socket.once("connect", () => {
        socket.destroy();
        reject(new Error("allocated offline port unexpectedly accepted a connection"));
      });
      socket.once("error", () => resolve());
    }),
    REFUSAL_TIMEOUT_MS,
  );
}

export async function allocateDeadDashboardUrl(): Promise<string> {
  const server = createServer();
  const port = await listen(server);
  await deadline(closeServer(server), CLOSE_TIMEOUT_MS);
  await assertPortRefusesConnections(port);
  return `http://${LOOPBACK}:${port}/`;
}

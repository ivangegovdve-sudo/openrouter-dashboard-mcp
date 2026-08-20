import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardClient } from "../src/dashboard/client.js";
import { DashboardRequestError } from "../src/dashboard/errors.js";
import {
  GITHUB_BASELINE_PAGE_LIMIT,
  GITHUB_BASELINE_PAGE_SIZE,
  GITHUB_MOVER_CATEGORIES,
  GITHUB_MOVERS_DEFAULT_LIMIT,
  GITHUB_MOVERS_DEFAULT_WINDOW_DAYS,
  GITHUB_MOVERS_MAX_LIMIT,
  githubMoversInputSchema,
  githubMoversOutputSchema,
  runGithubMovers,
} from "../src/tools/github-movers.js";
import { opaqueCursor } from "./fixtures.js";

const rankingsEndpoint = "/api/public/v2/github/rankings";
const repositoriesEndpoint = "/api/public/v2/github/repositories";

type Category = (typeof GITHUB_MOVER_CATEGORIES)[number];
type Request = { path: string; query: string };

const githubProvenance = [
  {
    id: "github-snapshot",
    sourceUrl: "https://api.github.com/repositories/101",
    fetchedAt: "2026-08-20T06:01:00.000Z",
    payloadSha256: "a".repeat(64),
  },
] as const;

function githubCoverage(
  resolvedAsOf: string,
  populationCompleteness:
    | "full"
    | "requested_slice"
    | "top_n_plus_other"
    | "partial_or_unknown" = "full",
) {
  return {
    resolvedAsOf,
    acquisitionComplete: true,
    populationCompleteness,
    missingFields: [],
    stale: false,
    lastSuccessAt: `${resolvedAsOf}T06:01:00.000Z`,
    staleAfterSeconds: 172_800,
  } as const;
}

function rankingRow(
  suffix: "a" | "b" | "c",
  repositoryId: "101" | "202" | "303",
  rank: number,
) {
  return {
    entityId: `family-${suffix}`,
    familyId: `family-${suffix}`,
    repositoryId,
    memberRepositoryIds: [repositoryId],
    fullName: `example/repository-${suffix}`,
    stars: suffix === "a" ? "90071992547409930001" : String(1000 - rank),
    forks: suffix === "a" ? "90071992547409930000" : String(100 - rank),
    rank,
    score: `${100 - rank}.000000`,
    maintenanceEvidence: null,
  } as const;
}

function metricEvidence(
  repositoryId: "101" | "202" | "303",
  baselineStars: string | null,
  starDelta: string | null,
  forkDelta: string | null,
) {
  return {
    repositoryId,
    baselineStars,
    starDelta,
    forkDelta,
    relativeGrowth: starDelta === null ? null : "0.010000",
    defaultBranchCommittedAt: "2026-08-19T12:00:00.000Z",
    latestStableReleaseAt: null,
    stableReleaseCount90d: 0,
  } as const;
}

type RankingRow = ReturnType<typeof rankingRow>;
type MetricEvidence = ReturnType<typeof metricEvidence>;

function rankingResponse(options: {
  category?: Category;
  windowDays?: 7 | 30 | 90;
  resolvedAsOf?: string;
  baselineDate?: string;
  rows?: readonly RankingRow[];
  evidence?: readonly MetricEvidence[];
  nextCursor?: string | null;
  pageLimit?: number;
  ruleVersion?: string;
  taxonomyVersion?: string;
  populationCompleteness?:
    | "full"
    | "requested_slice"
    | "top_n_plus_other"
    | "partial_or_unknown";
}) {
  const category = options.category ?? "mcp";
  const windowDays = options.windowDays ?? 7;
  const resolvedAsOf = options.resolvedAsOf ?? "2026-08-20";
  const baselineDate = options.baselineDate ?? "2026-08-13";
  return {
    schemaVersion: "2.0",
    watermark: `github:${category}:${resolvedAsOf}`,
    coverage: githubCoverage(
      resolvedAsOf,
      options.populationCompleteness ?? "full",
    ),
    ranking: {
      metric: "momentum",
      rankMethod: "locally_calculated",
      definition: `${windowDays}-day public GitHub momentum.`,
      unit: "momentum_score",
      direction: "higher_is_better",
      ruleVersion: options.ruleVersion ?? "github-ranking-v1",
      taxonomyVersion: options.taxonomyVersion ?? "github-ai-v1",
      category,
      entityLevel: "project-family",
      eligiblePopulation: 250,
      coverageExcluded: 3,
      windowDays,
      baselineDate,
    },
    data: [...(options.rows ?? [])],
    metricEvidence: [...(options.evidence ?? [])],
    page: {
      limit: options.pageLimit ?? 10,
      nextCursor: options.nextCursor ?? null,
    },
    provenance: githubProvenance,
  } as const;
}

function repositoryResponse(
  familyId: "family-a" | "family-b" | "family-c",
  repositoryId: "101" | "202" | "303",
) {
  const suffix = familyId.at(-1) as "a" | "b" | "c";
  return {
    schemaVersion: "2.0",
    watermark: "github-repositories:2026-08-20",
    coverage: githubCoverage("2026-08-20"),
    data: [
      {
        repositoryId,
        familyId,
        isCanonical: true,
        fullName: `example/repository-${suffix}`,
        url: `https://github.com/example/repository-${suffix}`,
        primaryCategory: "mcp",
        roles: ["server"],
        lifecycle: "active",
        license: "MIT",
        language: "TypeScript",
        stars: "1000",
        forks: "100",
      },
    ],
    page: { limit: 100, nextCursor: null },
    provenance: githubProvenance,
  } as const;
}

function historyResponse(repositoryId: "101" | "202" | "303") {
  return {
    schemaVersion: "2.0",
    repositoryId,
    requestFactKind: "snapshot",
    coverage: githubCoverage("2026-08-20"),
    data: [
      {
        observedDate: "2026-08-13",
        stars: "900",
        forks: "90",
        openIssues: "10",
        defaultBranchCommittedAt: "2026-08-12T12:00:00.000Z",
        latestStableReleaseAt: null,
        stableReleaseCount90d: 0,
        lifecycle: "active",
      },
      {
        observedDate: "2026-08-20",
        stars: "1000",
        forks: "100",
        openIssues: "9",
        defaultBranchCommittedAt: "2026-08-19T12:00:00.000Z",
        latestStableReleaseAt: null,
        stableReleaseCount90d: 0,
        lifecycle: "active",
      },
    ],
    page: { limit: 8, nextCursor: null },
    provenance: githubProvenance,
  } as const;
}

function enrichmentResponse(repositoryId: "101" | "202" | "303") {
  return {
    schemaVersion: "2.0",
    repositoryId,
    requestRange: { from: "2026-08-13", to: "2026-08-20" },
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
        start: "2026-08-13",
        end: "2026-08-20",
        count: "100",
        populationCompleteness: "partial_or_unknown",
      },
    ],
    provenance: [
      {
        id: "github-enrichment",
        sourceUrl: `https://api.github.com/repositories/${repositoryId}`,
        fetchedAt: "2026-08-20T06:01:00.000Z",
      },
    ],
  } as const;
}

function auxiliaryResponse(path: string, query: URLSearchParams, schema: any) {
  if (path === repositoriesEndpoint) {
    const familyId = query.get("family_id") as
      | "family-a"
      | "family-b"
      | "family-c";
    const repositoryId =
      familyId === "family-a" ? "101" : familyId === "family-b" ? "202" : "303";
    return schema.parse(repositoryResponse(familyId, repositoryId));
  }
  const match = path.match(/\/repositories\/(101|202|303)\/(history|enrichment)$/);
  if (match === null) throw new Error(`Unexpected auxiliary path: ${path}`);
  const repositoryId = match[1] as "101" | "202" | "303";
  return match[2] === "history"
    ? schema.parse(historyResponse(repositoryId))
    : schema.parse(enrichmentResponse(repositoryId));
}

test("defaults to bounded project-family momentum slices and rejects unsupported inputs", () => {
  assert.deepEqual(githubMoversInputSchema.parse({}), {
    windowDays: GITHUB_MOVERS_DEFAULT_WINDOW_DAYS,
    limit: GITHUB_MOVERS_DEFAULT_LIMIT,
  });
  assert.equal(GITHUB_MOVERS_DEFAULT_WINDOW_DAYS, 7);
  assert.equal(GITHUB_MOVERS_DEFAULT_LIMIT, 5);
  assert.equal(GITHUB_MOVERS_MAX_LIMIT, 10);
  assert.equal(GITHUB_BASELINE_PAGE_LIMIT, 2);
  assert.equal(GITHUB_BASELINE_PAGE_SIZE, 100);
  assert.deepEqual(GITHUB_MOVER_CATEGORIES, [
    "ai-harnesses",
    "inference",
    "ai-skills",
    "mcp",
    "connectors",
    "a2a",
    "agent-frameworks",
    "ai-orchestration",
  ]);
  assert.deepEqual(
    githubMoversInputSchema.parse({ category: "mcp", windowDays: 90, limit: 10 }),
    { category: "mcp", windowDays: 90, limit: 10 },
  );
  assert.throws(() => githubMoversInputSchema.parse({ windowDays: 14 }));
  assert.throws(() => githubMoversInputSchema.parse({ category: "all" }));
  assert.throws(() => githubMoversInputSchema.parse({ limit: 11 }));
  assert.throws(() => githubMoversInputSchema.parse({ extra: true }));
});

test("compares two exact publications, proves exhausted absence, and enriches only final leaders", async () => {
  const requests: Request[] = [];
  const current = rankingResponse({
    rows: [
      rankingRow("a", "101", 1),
      rankingRow("b", "202", 2),
      rankingRow("c", "303", 3),
    ],
    evidence: [
      metricEvidence("101", "90071992547409929901", "100", "-2"),
      metricEvidence("202", "900", "99", "4"),
      metricEvidence("303", "700", "297", "8"),
    ],
    pageLimit: 2,
    nextCursor: opaqueCursor,
  });
  const baselinePageOne = rankingResponse({
    resolvedAsOf: "2026-08-13",
    baselineDate: "2026-08-06",
    rows: [rankingRow("a", "101", 3), rankingRow("c", "303", 1)],
    evidence: [
      metricEvidence("101", "800", "100", "1"),
      metricEvidence("303", "600", "100", "1"),
    ],
    pageLimit: 100,
    nextCursor: opaqueCursor,
  });
  const baselinePageTwo = rankingResponse({
    resolvedAsOf: "2026-08-13",
    baselineDate: "2026-08-06",
    rows: [],
    evidence: [],
    pageLimit: 100,
    nextCursor: null,
  });
  const client: DashboardClient = {
    async get(path, query, schema) {
      requests.push({ path, query: query.toString() });
      if (path === rankingsEndpoint && query.get("as_of") === null) {
        return schema.parse(current);
      }
      if (path === rankingsEndpoint && query.get("cursor") === null) {
        return schema.parse(baselinePageOne);
      }
      if (path === rankingsEndpoint) return schema.parse(baselinePageTwo);
      return auxiliaryResponse(path, query, schema);
    },
  };

  const result = await runGithubMovers(
    { category: "mcp", windowDays: 7, limit: 2 },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status === "error") return;
  githubMoversOutputSchema.parse(result);
  assert.deepEqual(result.query, {
    category: "mcp",
    windowDays: 7,
    limit: 2,
    metric: "momentum",
    entityLevel: "project-family",
  });
  assert.deepEqual(result.fanout, {
    categoryLimit: 8,
    categoriesRequested: ["mcp"],
    omittedCategories: [],
  });
  assert.equal(result.categories.length, 1);
  const section = result.categories[0];
  assert.ok(section && section.status === "available");
  if (section === undefined || section.status === "unavailable") return;
  assert.equal(section.category, "mcp");
  assert.deepEqual(section.rankingEvidence.ranking, current.ranking);
  assert.equal(section.rankingEvidence.page.nextCursor, opaqueCursor);
  assert.deepEqual(section.baselineComparison, {
    status: "matched",
    requestedAsOf: "2026-08-13",
    pagesScanned: 2,
    cap: {
      pageLimit: 2,
      pageSize: 100,
      nextCursor: null,
      capped: false,
    },
    evidence: [
      {
        endpoint: rankingsEndpoint,
        watermark: "github:mcp:2026-08-13",
        coverage: baselinePageOne.coverage,
        ranking: baselinePageOne.ranking,
        page: baselinePageOne.page,
        provenance: baselinePageOne.provenance,
      },
      {
        endpoint: rankingsEndpoint,
        watermark: "github:mcp:2026-08-13",
        coverage: baselinePageTwo.coverage,
        ranking: baselinePageTwo.ranking,
        page: baselinePageTwo.page,
        provenance: baselinePageTwo.provenance,
      },
    ],
    warnings: [],
  });
  assert.deepEqual(
    section.leaders.map((leader) => ({
      entityId: leader.entityId,
      currentRank: leader.currentRank,
      previousRank: leader.previousRank,
      rankMovement: leader.rankMovement,
      newEntrant: leader.newEntrant,
      starDelta: leader.starDelta,
      forkDelta: leader.forkDelta,
    })),
    [
      {
        entityId: "family-a",
        currentRank: 1,
        previousRank: 3,
        rankMovement: 2,
        newEntrant: false,
        starDelta: "100",
        forkDelta: "-2",
      },
      {
        entityId: "family-b",
        currentRank: 2,
        previousRank: null,
        rankMovement: null,
        newEntrant: true,
        starDelta: "99",
        forkDelta: "4",
      },
    ],
  );
  for (const leader of section.leaders) {
    assert.equal(
      leader.canonicalRepositoryEvidence.scope,
      "canonical_repository_only_not_project_family",
    );
    assert.equal(leader.canonicalRepositoryEvidence.metadata.status, "available");
    assert.equal(leader.canonicalRepositoryEvidence.history.status, "available");
    assert.equal(leader.canonicalRepositoryEvidence.enrichment.status, "available");
  }
  assert.deepEqual(
    section.leaders[0]?.canonicalRepositoryEvidence.history.response
      ?.requestFactKind,
    "snapshot",
  );
  assert.deepEqual(
    section.leaders[0]?.canonicalRepositoryEvidence.enrichment.response
      ?.requestRange,
    { from: "2026-08-13", to: "2026-08-20" },
  );
  assert.deepEqual(requests.slice(0, 3), [
    {
      path: rankingsEndpoint,
      query:
        "metric=momentum&window=7&category=mcp&entity_level=project-family&limit=2",
    },
    {
      path: rankingsEndpoint,
      query:
        "metric=momentum&window=7&category=mcp&entity_level=project-family&limit=100&as_of=2026-08-13",
    },
    {
      path: rankingsEndpoint,
      query:
        `metric=momentum&window=7&category=mcp&entity_level=project-family&limit=100&as_of=2026-08-13&cursor=${encodeURIComponent(opaqueCursor)}`,
    },
  ]);
  const auxiliaryRequests = requests.slice(3);
  assert.equal(auxiliaryRequests.length, 6);
  assert.ok(
    auxiliaryRequests.some(
      (request) =>
        request.path === repositoriesEndpoint &&
        request.query ===
          "taxonomy_version=github-ai-v1&family_id=family-a&as_of=2026-08-20&limit=100",
    ),
  );
  assert.ok(
    auxiliaryRequests.some(
      (request) =>
        request.path === `${repositoriesEndpoint}/101/history` &&
        request.query ===
          "from=2026-08-13&to=2026-08-20&fact_kind=snapshot&limit=8",
    ),
  );
  assert.ok(
    auxiliaryRequests.some(
      (request) =>
        request.path === `${repositoriesEndpoint}/101/enrichment` &&
        request.query === "from=2026-08-13&to=2026-08-20",
    ),
  );
  assert.equal(
    auxiliaryRequests.some(
      (request) =>
        request.path.includes("303") || request.query.includes("family-c"),
    ),
    false,
  );
});

test("keeps capped or missing baseline evidence unknown instead of declaring favourable movement", async () => {
  const current = rankingResponse({
    rows: [rankingRow("a", "101", 1), rankingRow("b", "202", 2)],
    evidence: [
      metricEvidence("101", "900", "100", "5"),
      metricEvidence("202", null, "99", "4"),
    ],
    pageLimit: 2,
  });
  let baselinePages = 0;
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === rankingsEndpoint && query.get("as_of") === null) {
        return schema.parse(current);
      }
      if (path === rankingsEndpoint) {
        baselinePages += 1;
        return schema.parse(
          rankingResponse({
            resolvedAsOf: "2026-08-13",
            baselineDate: "2026-08-06",
            rows: [],
            evidence: [],
            pageLimit: 100,
            nextCursor: baselinePages === 1 ? opaqueCursor : "still-capped",
          }),
        );
      }
      return auxiliaryResponse(path, query, schema);
    },
  };

  const result = await runGithubMovers(
    { category: "mcp", windowDays: 7, limit: 2 },
    { client },
  );

  assert.equal(result.status, "partial");
  if (result.status === "error") return;
  const section = result.categories[0];
  assert.ok(section && section.status !== "unavailable");
  if (section === undefined || section.status === "unavailable") return;
  assert.equal(section.baselineComparison.status, "partial");
  assert.deepEqual(section.baselineComparison.cap, {
    pageLimit: 2,
    pageSize: 100,
    nextCursor: "still-capped",
    capped: true,
  });
  assert.equal(baselinePages, 2);
  assert.deepEqual(
    section.leaders.map((leader) => ({
      previousRank: leader.previousRank,
      rankMovement: leader.rankMovement,
      newEntrant: leader.newEntrant,
    })),
    [
      { previousRank: null, rankMovement: null, newEntrant: null },
      { previousRank: null, rankMovement: null, newEntrant: null },
    ],
  );
});

test("does not query a baseline publication when every final leader lacks baseline-star evidence", async () => {
  const current = rankingResponse({
    rows: [rankingRow("a", "101", 1)],
    evidence: [],
  });
  let rankingCalls = 0;
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === rankingsEndpoint) {
        rankingCalls += 1;
        if (query.get("as_of") !== null) {
          throw new Error("baseline lookup must not run without baseline-star evidence");
        }
        return schema.parse(current);
      }
      return auxiliaryResponse(path, query, schema);
    },
  };

  const result = await runGithubMovers(
    { category: "mcp", windowDays: 7, limit: 1 },
    { client },
  );

  assert.equal(result.status, "partial");
  if (result.status === "error") return;
  const section = result.categories[0];
  assert.ok(section && section.status !== "unavailable");
  if (section === undefined || section.status === "unavailable") return;
  assert.equal(rankingCalls, 1);
  assert.equal(section.baselineComparison.status, "not_required");
  assert.deepEqual(
    {
      previousRank: section.leaders[0]?.previousRank,
      rankMovement: section.leaders[0]?.rankMovement,
      newEntrant: section.leaders[0]?.newEntrant,
    },
    { previousRank: null, rankMovement: null, newEntrant: null },
  );
});

test("rejects a mismatched baseline publication and never treats its rows as comparable", async () => {
  const current = rankingResponse({
    rows: [rankingRow("a", "101", 1)],
    evidence: [metricEvidence("101", "900", "100", "5")],
  });
  const mismatchedBaseline = rankingResponse({
    category: "connectors",
    resolvedAsOf: "2026-08-13",
    baselineDate: "2026-08-06",
    rows: [rankingRow("a", "101", 9)],
    evidence: [metricEvidence("101", "800", "100", "1")],
    pageLimit: 100,
  });
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === rankingsEndpoint && query.get("as_of") === null) {
        return schema.parse(current);
      }
      if (path === rankingsEndpoint) return schema.parse(mismatchedBaseline);
      return auxiliaryResponse(path, query, schema);
    },
  };

  const result = await runGithubMovers(
    { category: "mcp", windowDays: 7, limit: 1 },
    { client },
  );

  assert.equal(result.status, "partial");
  if (result.status === "error") return;
  const section = result.categories[0];
  assert.ok(section && section.status !== "unavailable");
  if (section === undefined || section.status === "unavailable") return;
  assert.equal(section.baselineComparison.status, "mismatched");
  assert.deepEqual(
    {
      previousRank: section.leaders[0]?.previousRank,
      rankMovement: section.leaders[0]?.rankMovement,
      newEntrant: section.leaders[0]?.newEntrant,
    },
    { previousRank: null, rankMovement: null, newEntrant: null },
  );
});

test("does not substitute adoption when supported 30 or 90 day momentum is unavailable", async () => {
  for (const windowDays of [30, 90] as const) {
    const requests: Request[] = [];
    const client: DashboardClient = {
      async get(path, query) {
        requests.push({ path, query: query.toString() });
        throw new DashboardRequestError(
          "http_error",
          "The dashboard catalogue returned HTTP 503.",
          { retryable: true, status: 503 },
        );
      },
    };

    const result = await runGithubMovers(
      { category: "mcp", windowDays, limit: 5 },
      { client },
    );

    assert.equal(result.status, "partial");
    if (result.status === "error") continue;
    assert.equal(result.categories[0]?.status, "unavailable");
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.path, rankingsEndpoint);
    assert.equal(
      requests[0]?.query,
      `metric=momentum&window=${windowDays}&category=mcp&entity_level=project-family&limit=5`,
    );
    assert.doesNotMatch(requests[0]?.query ?? "", /adoption/);
  }
});

test("fans out over exactly the fixed eight categories and preserves separate category sections", async () => {
  const requests: Request[] = [];
  const client: DashboardClient = {
    async get(path, query, schema) {
      requests.push({ path, query: query.toString() });
      const category = query.get("category") as Category;
      return schema.parse(
        rankingResponse({
          category,
          windowDays: 7,
          rows: [],
          evidence: [],
          pageLimit: 5,
        }),
      );
    },
  };

  const result = await runGithubMovers({}, { client });

  assert.equal(result.status, "ok");
  if (result.status === "error") return;
  assert.deepEqual(result.fanout, {
    categoryLimit: 8,
    categoriesRequested: [...GITHUB_MOVER_CATEGORIES],
    omittedCategories: [],
  });
  assert.deepEqual(
    result.categories.map((section) => section.category),
    [...GITHUB_MOVER_CATEGORIES],
  );
  assert.equal(requests.length, 8);
  assert.deepEqual(
    requests.map((request) => request.path),
    Array(8).fill(rankingsEndpoint),
  );
  assert.ok(
    requests.every(
      (request) =>
        request.query.includes("metric=momentum") &&
        request.query.includes("window=7") &&
        request.query.includes("entity_level=project-family") &&
        request.query.includes("limit=5"),
    ),
  );
});

test("isolates canonical repository auxiliary failures without erasing core family momentum", async () => {
  const current = rankingResponse({
    rows: [rankingRow("a", "101", 1)],
    evidence: [metricEvidence("101", "900", "100", "5")],
  });
  const baseline = rankingResponse({
    resolvedAsOf: "2026-08-13",
    baselineDate: "2026-08-06",
    rows: [rankingRow("a", "101", 2)],
    evidence: [metricEvidence("101", "800", "100", "2")],
    pageLimit: 100,
  });
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === rankingsEndpoint && query.get("as_of") === null) {
        return schema.parse(current);
      }
      if (path === rankingsEndpoint) return schema.parse(baseline);
      if (path.endsWith("/history")) {
        throw new DashboardRequestError(
          "http_error",
          "The dashboard catalogue returned HTTP 503.",
          { retryable: true, status: 503 },
        );
      }
      return auxiliaryResponse(path, query, schema);
    },
  };

  const result = await runGithubMovers(
    { category: "mcp", windowDays: 7, limit: 1 },
    { client },
  );

  assert.equal(result.status, "partial");
  if (result.status === "error") return;
  const section = result.categories[0];
  assert.ok(section && section.status !== "unavailable");
  if (section === undefined || section.status === "unavailable") return;
  assert.deepEqual(
    {
      entityId: section.leaders[0]?.entityId,
      previousRank: section.leaders[0]?.previousRank,
      rankMovement: section.leaders[0]?.rankMovement,
      starDelta: section.leaders[0]?.starDelta,
      forkDelta: section.leaders[0]?.forkDelta,
    },
    {
      entityId: "family-a",
      previousRank: 2,
      rankMovement: 1,
      starDelta: "100",
      forkDelta: "5",
    },
  );
  assert.equal(
    section.leaders[0]?.canonicalRepositoryEvidence.metadata.status,
    "available",
  );
  assert.equal(
    section.leaders[0]?.canonicalRepositoryEvidence.history.status,
    "unavailable",
  );
  assert.equal(
    section.leaders[0]?.canonicalRepositoryEvidence.history.error?.status,
    503,
  );
  assert.equal(
    section.leaders[0]?.canonicalRepositoryEvidence.enrichment.status,
    "available",
  );
  assert.ok(section.warnings.some((warning) => warning.includes("HTTP 503")));
});

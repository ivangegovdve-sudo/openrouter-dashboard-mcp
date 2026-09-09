export const runId = "11111111-1111-4111-8111-111111111111";

export const publicWindow = {
  start: "2026-08-19",
  end: "2026-08-19",
  timezone: "UTC",
  inclusive: true,
  basis: "observed",
} as const;

export const publicCompleteness = {
  acquisitionComplete: true,
  populationCompleteness: "full",
  missingFields: [],
} as const;

export const publicProvenance = [
  {
    sourceId: "models_current",
    sourceTier: "stable",
    runId,
    fetchedAt: "2026-08-19T06:01:00.000Z",
    sourceAsOf: "2026-08-19T06:00:00.000Z",
    transformVersion: "public-v2-test",
    citation: "https://catalogue.test/source",
  },
] as const;

export const sourceStatusFixture = {
  sourceId: "models_current",
  sourceTier: "stable",
  cadenceSeconds: 86_400,
  staleAfterSeconds: 172_800,
  publishedRunId: runId,
  publishedAt: "2026-08-19T06:01:00.000Z",
  nextScheduledAt: "2026-08-20T06:00:00.000Z",
  stale: false,
  transformVersion: "public-v2-test",
  citationUrl: "https://catalogue.test/source",
  lastAttemptRunId: runId,
  lastAttemptStatus: "published",
  lastAttemptStartedAt: "2026-08-19T06:00:00.000Z",
  lastAttemptFinishedAt: "2026-08-19T06:01:00.000Z",
  lastAttemptErrorCode: null,
  lastAttemptAcquisitionComplete: true,
  lastAttemptPopulationCompleteness: "full",
} as const;

export const manifestFixture = {
  schemaVersion: "2.0",
  publishedAt: "2026-08-19T06:01:00.000Z",
  routes: [
    "/api/public/v2/manifest",
    "/api/public/v2/live-models",
  ],
  sources: [sourceStatusFixture],
  provenance: publicProvenance,
  window: publicWindow,
} as const;

export const opaqueCursor = "eyJpZCI6Im1vZGVsKysvPSIsInYiOiJhIGIifQ==";

export const liveModelFixture = {
  provider: "openrouter",
  id: "example/very-large-model",
  displayName: "Very Large Model",
  ownedBy: "example",
  contextLength: "90071992547409930001",
  pricePoints: [
    { id: "openrouter:example/very-large-model:token_in", amount: "0.0000001250", unit: "token_in", condition: null, source: { url: "https://catalogue.test/source", readAt: "2026-08-19T06:00:00.000Z" }, provenance: "published" },
    { id: "openrouter:example/very-large-model:token_out", amount: "0.0000005000", unit: "token_out", condition: null, source: { url: "https://catalogue.test/source", readAt: "2026-08-19T06:00:00.000Z" }, provenance: "published" },
  ],
  pricingState: "published",
  isFree: false,
  freeKind: "paid_or_unknown",
  providerActive: null,
  reasoningEfforts: ["high", "low"],
  outputModalities: ["text"],
  performance: {
    throughputTps: "123.4500",
    latencyMsP50: "98.7500",
    fastestProvider: "example-provider",
    observedAt: "2026-08-19T05:45:00.000Z",
  },
  availability: "available",
  firstSeenAt: "2026-08-01T06:00:00.000Z",
  lastSeenAt: "2026-08-19T06:00:00.000Z",
  lastConfirmedAt: "2026-08-19T06:00:00.000Z",
  disappearedAt: null,
  absenceStreak: "0",
  missingFields: [],
} as const;

export const liveModelsFixture = {
  schemaVersion: "2.0",
  data: [liveModelFixture],
  cursor: opaqueCursor,
  window: publicWindow,
  completeness: publicCompleteness,
  stale: false,
  rank: null,
  provenance: publicProvenance,
} as const;

export const modelFixture = {
  id: "example/very-large-model",
  canonicalSlug: "example/very-large-model",
  name: "Very Large Model",
  description: "Untrusted catalogue description.",
  contentTrust: "untrusted-source",
  createdUnix: "90071992547409930001",
  contextLength: "90071992547409930001",
  architecture: { modality: "text->text" },
  pricing: { prompt: "0.0000001250", completion: "0.0000005000" },
  supportedParameters: ["temperature"],
  expirationDate: null,
  lifecycleState: "no_announced_expiration",
  freeKind: "paid_or_unknown",
  weeklyRank: 1,
  rankMethod: "response_order",
} as const;

export const modelDetailFixture = {
  schemaVersion: "2.0",
  data: modelFixture,
  window: publicWindow,
  completeness: publicCompleteness,
  stale: false,
  provenance: publicProvenance,
} as const;

export const freeModelsFixture = {
  schemaVersion: "2.0",
  data: [modelFixture],
  cursor: opaqueCursor,
  window: publicWindow,
  completeness: publicCompleteness,
  stale: false,
  rank: null,
  provenance: publicProvenance,
  router: null,
  concreteFreeCount: "90071992547409930001",
} as const;

export const overviewHistoryAvailableFixture = {
  schemaVersion: "2.0",
  status: "available",
  data: {
    modelUsage: [
      {
        date: "2026-08-19",
        complete: true,
        rows: [
          {
            id: "example/very-large-model",
            label: "Very Large Model",
            scope: null,
            rank: 1,
            value: "90071992547409930001",
            remainder: "0.1250",
            stars: null,
            forks: null,
          },
        ],
      },
    ],
    appRanks: [],
    githubRanks: [],
  },
  window: publicWindow,
  completeness: publicCompleteness,
  stale: false,
  rank: null,
  provenance: publicProvenance,
} as const;

export const overviewHistoryUnavailableFixture = {
  schemaVersion: "2.0",
  status: "unavailable",
  reason: "insufficient_history",
  lastSuccessAt: null,
} as const;

export const appModelMatrixAvailableFixture = {
  schemaVersion: "2.0",
  status: "available",
  watermark: "2026-08-19",
  lastSuccessAt: "2026-08-19T06:01:00.000Z",
  stale: false,
  staleAfterSeconds: 172_800,
  completeness: {
    acquisitionComplete: true,
    populationCompleteness: "partial_or_unknown",
    missingFields: [],
  },
  resolvedPeriod: {
    start: "2026-08-18",
    end: "2026-08-18",
    unit: "day",
    inclusive: true,
  },
  apps: [{ appId: "90071992547409930001", appName: "Example App" }],
  models: [
    { modelId: "example/very-large-model", modelName: "Very Large Model" },
  ],
  appIds: ["90071992547409930001"],
  modelIds: ["example/very-large-model"],
  cells: [
    {
      state: "observed",
      appId: "90071992547409930001",
      modelId: "example/very-large-model",
      totalTokens: "90071992547409930001",
      rankWithinPeriod: 1,
      period: {
        start: "2026-08-18",
        end: "2026-08-18",
        unit: "day",
        inclusive: true,
      },
      metricSemantics: "observed_daily_total_tokens",
      evidenceUrl: "https://catalogue.test/evidence",
    },
  ],
  missingAliases: [],
  unmappedModels: [],
  coverage: {
    observedCells: 1,
    possibleCells: 1,
    unmappedObservations: 0,
    populationCompleteness: "partial_or_unknown",
  },
  provenance: publicProvenance,
} as const;

export const appModelMatrixUnavailableFixture = {
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
  appIds: ["90071992547409930001"],
  modelIds: ["example/very-large-model"],
  cells: [],
} as const;

export const githubProvenance = [
  {
    id: "github-snapshot",
    sourceUrl: "https://api.github.com/repositories/9007199254740993",
    fetchedAt: "2026-08-19T06:01:00.000Z",
    payloadSha256: "a".repeat(64),
  },
] as const;

export const githubCoverage = {
  resolvedAsOf: "2026-08-19",
  acquisitionComplete: true,
  populationCompleteness: "full",
  missingFields: [],
  stale: false,
  lastSuccessAt: "2026-08-19T06:01:00.000Z",
  staleAfterSeconds: 172_800,
} as const;

export const githubRankingFixture = {
  schemaVersion: "2.0",
  watermark: "github-watermark:opaque+/=",
  coverage: githubCoverage,
  ranking: {
    metric: "momentum",
    rankMethod: "locally_calculated",
    definition: "Thirty-day star growth.",
    unit: "stars",
    direction: "higher_is_better",
    ruleVersion: "github-ranking-v1",
    taxonomyVersion: "github-ai-v1",
    category: "mcp",
    entityLevel: "project-family",
    eligiblePopulation: 1,
    coverageExcluded: 0,
    windowDays: 30,
    baselineDate: "2026-07-20",
  },
  data: [
    {
      entityId: "example-family",
      familyId: "example-family",
      repositoryId: "9007199254740993",
      memberRepositoryIds: ["9007199254740993"],
      fullName: "example/repository",
      stars: "90071992547409930001",
      forks: "90071992547409930000",
      rank: 1,
      score: "123.000000",
      maintenanceEvidence: null,
    },
  ],
  metricEvidence: [
    {
      repositoryId: "9007199254740993",
      baselineStars: "90071992547409930000",
      starDelta: "1",
      forkDelta: "-1",
      relativeGrowth: "0.000001",
      defaultBranchCommittedAt: "2026-08-18T12:00:00.000Z",
      latestStableReleaseAt: null,
      stableReleaseCount90d: 0,
    },
  ],
  page: { limit: 10, nextCursor: opaqueCursor },
  provenance: githubProvenance,
} as const;

export const githubHistoryFixture = {
  schemaVersion: "2.0",
  repositoryId: "9007199254740993",
  requestFactKind: "snapshot",
  coverage: githubCoverage,
  data: [
    {
      observedDate: "2026-08-19",
      stars: "90071992547409930001",
      forks: "90071992547409930000",
      openIssues: "0",
      defaultBranchCommittedAt: "2026-08-18T12:00:00.000Z",
      latestStableReleaseAt: null,
      stableReleaseCount90d: 0,
      lifecycle: "active",
    },
  ],
  page: { limit: 90, nextCursor: opaqueCursor },
  provenance: githubProvenance,
} as const;

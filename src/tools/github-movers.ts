import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import {
  publicGitHubHistoryResponseSchema,
  publicGitHubMetricEvidenceSchema,
  publicGitHubRankingResponseSchema,
  publicGitHubRepositoryEnrichmentResponseSchema,
  publicGitHubRepositoryResponseSchema,
  publicGitHubRepositoryRowSchema,
} from "../dashboard/schemas/github.js";
import {
  READ_ONLY_TOOL_ANNOTATIONS,
  safeDashboardError,
  safeDashboardErrorSchema,
  toolResult,
} from "./shared.js";

const RANKINGS_ENDPOINT = "/api/public/v2/github/rankings";
const REPOSITORIES_ENDPOINT = "/api/public/v2/github/repositories";

export const GITHUB_MOVER_CATEGORIES = [
  "ai-harnesses",
  "inference",
  "ai-skills",
  "mcp",
  "connectors",
  "a2a",
  "agent-frameworks",
  "ai-orchestration",
] as const;
export const GITHUB_MOVERS_DEFAULT_WINDOW_DAYS = 7;
export const GITHUB_MOVERS_DEFAULT_LIMIT = 5;
export const GITHUB_MOVERS_MAX_LIMIT = 10;
export const GITHUB_BASELINE_PAGE_LIMIT = 2;
export const GITHUB_BASELINE_PAGE_SIZE = 100;
export const GITHUB_REPOSITORY_LOOKUP_LIMIT = 100;
export const GITHUB_ENTITY_LEVEL = "project-family" as const;

const githubCategorySchema = z.enum(GITHUB_MOVER_CATEGORIES);

export const githubMoversInputSchema = z
  .object({
    category: githubCategorySchema.optional(),
    windowDays: z
      .union([z.literal(7), z.literal(30), z.literal(90)])
      .default(GITHUB_MOVERS_DEFAULT_WINDOW_DAYS),
    limit: z
      .number()
      .int()
      .min(1)
      .max(GITHUB_MOVERS_MAX_LIMIT)
      .default(GITHUB_MOVERS_DEFAULT_LIMIT),
  })
  .strict();

const githubRankingEvidenceSchema = publicGitHubRankingResponseSchema
  .pick({
    watermark: true,
    coverage: true,
    ranking: true,
    page: true,
    provenance: true,
  })
  .extend({ endpoint: z.literal(RANKINGS_ENDPOINT) })
  .strict();

const baselineCapSchema = z
  .object({
    pageLimit: z.literal(GITHUB_BASELINE_PAGE_LIMIT),
    pageSize: z.literal(GITHUB_BASELINE_PAGE_SIZE),
    nextCursor: z.string().nullable(),
    capped: z.boolean(),
  })
  .strict();

const baselineComparisonSchema = z
  .object({
    status: z.enum([
      "matched",
      "partial",
      "mismatched",
      "unavailable",
      "not_required",
    ]),
    requestedAsOf: z.string().date(),
    pagesScanned: z
      .number()
      .int()
      .min(0)
      .max(GITHUB_BASELINE_PAGE_LIMIT),
    cap: baselineCapSchema,
    evidence: z.array(githubRankingEvidenceSchema).max(GITHUB_BASELINE_PAGE_LIMIT),
    warnings: z.array(z.string()),
    error: safeDashboardErrorSchema.optional(),
  })
  .strict();

const repositoryMetadataAuxiliarySchema = z
  .object({
    status: z.enum(["available", "unavailable"]),
    endpoint: z.literal(REPOSITORIES_ENDPOINT),
    response: publicGitHubRepositoryResponseSchema.nullable(),
    canonicalRepository: publicGitHubRepositoryRowSchema.nullable(),
    error: safeDashboardErrorSchema.nullable(),
    warnings: z.array(z.string()),
  })
  .strict();

const historyAuxiliarySchema = z
  .object({
    status: z.enum(["available", "unavailable"]),
    endpoint: z.string().startsWith(`${REPOSITORIES_ENDPOINT}/`).endsWith("/history"),
    response: publicGitHubHistoryResponseSchema.nullable(),
    error: safeDashboardErrorSchema.nullable(),
    warnings: z.array(z.string()),
  })
  .strict();

const enrichmentAuxiliarySchema = z
  .object({
    status: z.enum(["available", "unavailable"]),
    endpoint: z
      .string()
      .startsWith(`${REPOSITORIES_ENDPOINT}/`)
      .endsWith("/enrichment"),
    response: publicGitHubRepositoryEnrichmentResponseSchema.nullable(),
    error: safeDashboardErrorSchema.nullable(),
    warnings: z.array(z.string()),
  })
  .strict();

const canonicalRepositoryEvidenceSchema = z
  .object({
    scope: z.literal("canonical_repository_only_not_project_family"),
    metadata: repositoryMetadataAuxiliarySchema,
    history: historyAuxiliarySchema,
    enrichment: enrichmentAuxiliarySchema,
    warnings: z.array(z.string()),
  })
  .strict();

const githubMoverLeaderSchema = z
  .object({
    entityId: z.string().min(1),
    familyId: z.string().min(1).nullable(),
    canonicalRepositoryId: z.string().regex(/^[1-9]\d*$/),
    memberRepositoryIds: z.array(z.string().regex(/^[1-9]\d*$/)).min(1),
    fullName: z.string(),
    currentRank: z.number().int().positive(),
    previousRank: z.number().int().positive().nullable(),
    rankMovement: z.number().int().nullable(),
    newEntrant: z.boolean().nullable(),
    momentumScore: z.string().nullable(),
    stars: z.string().regex(/^(?:0|[1-9]\d*)$/),
    forks: z.string().regex(/^(?:0|[1-9]\d*)$/),
    baselineStars: z.string().regex(/^(?:0|[1-9]\d*)$/).nullable(),
    starDelta: z.string().regex(/^(?:0|[1-9]\d*|-[1-9]\d*)$/).nullable(),
    forkDelta: z.string().regex(/^(?:0|[1-9]\d*|-[1-9]\d*)$/).nullable(),
    metricEvidence: publicGitHubMetricEvidenceSchema.nullable(),
    canonicalRepositoryEvidence: canonicalRepositoryEvidenceSchema,
  })
  .strict();

const availableCategorySectionSchema = z
  .object({
    status: z.enum(["available", "partial"]),
    category: githubCategorySchema,
    endpoint: z.literal(RANKINGS_ENDPOINT),
    rankingEvidence: githubRankingEvidenceSchema,
    baselineComparison: baselineComparisonSchema,
    leaders: z.array(githubMoverLeaderSchema).max(GITHUB_MOVERS_MAX_LIMIT),
    warnings: z.array(z.string()),
    cap: z
      .object({
        outputLimit: z.number().int().min(1).max(GITHUB_MOVERS_MAX_LIMIT),
        returnedLeaders: z.number().int().nonnegative(),
        currentNextCursor: z.string().nullable(),
        currentPageCapped: z.boolean(),
      })
      .strict(),
  })
  .strict();

const unavailableCategorySectionSchema = z
  .object({
    status: z.literal("unavailable"),
    category: githubCategorySchema,
    endpoint: z.literal(RANKINGS_ENDPOINT),
    reason: z.string(),
    rankingEvidence: githubRankingEvidenceSchema.nullable(),
    error: safeDashboardErrorSchema.nullable(),
    warnings: z.array(z.string()),
  })
  .strict();

const categorySectionSchema = z.discriminatedUnion("status", [
  availableCategorySectionSchema,
  unavailableCategorySectionSchema,
]);

const githubMoversSuccessSchema = z
  .object({
    status: z.enum(["ok", "partial"]),
    schemaVersion: z.literal("2.0"),
    summary: z.string(),
    query: z
      .object({
        category: githubCategorySchema.nullable(),
        windowDays: z.union([z.literal(7), z.literal(30), z.literal(90)]),
        limit: z.number().int().min(1).max(GITHUB_MOVERS_MAX_LIMIT),
        metric: z.literal("momentum"),
        entityLevel: z.literal(GITHUB_ENTITY_LEVEL),
      })
      .strict(),
    fanout: z
      .object({
        categoryLimit: z.literal(GITHUB_MOVER_CATEGORIES.length),
        categoriesRequested: z.array(githubCategorySchema).max(
          GITHUB_MOVER_CATEGORIES.length,
        ),
        omittedCategories: z.array(githubCategorySchema),
      })
      .strict(),
    categories: z.array(categorySectionSchema).max(GITHUB_MOVER_CATEGORIES.length),
    warnings: z.array(z.string()),
  })
  .strict();

const githubMoversErrorSchema = z
  .object({
    status: z.literal("error"),
    summary: z.string(),
    error: safeDashboardErrorSchema,
  })
  .strict();

export const githubMoversOutputSchema = z.discriminatedUnion("status", [
  githubMoversSuccessSchema,
  githubMoversErrorSchema,
]);

export type GithubMoversInput = z.input<typeof githubMoversInputSchema>;
export type GithubMoversOutput = z.infer<typeof githubMoversOutputSchema>;
export type GithubMoversDependencies = { client: DashboardClient };

type GithubCategory = z.infer<typeof githubCategorySchema>;
type RankingResponse = z.infer<typeof publicGitHubRankingResponseSchema>;
type RankingRow = RankingResponse["data"][number];
type MetricEvidence = RankingResponse["metricEvidence"][number];
type RankingEvidence = z.infer<typeof githubRankingEvidenceSchema>;
type BaselineComparison = z.infer<typeof baselineComparisonSchema>;
type CategorySection = z.infer<typeof categorySectionSchema>;
type CanonicalRepositoryEvidence = z.infer<
  typeof canonicalRepositoryEvidenceSchema
>;

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function rankingEvidence(response: RankingResponse): RankingEvidence {
  return {
    endpoint: RANKINGS_ENDPOINT,
    watermark: response.watermark,
    coverage: response.coverage,
    ranking: response.ranking,
    page: response.page,
    provenance: response.provenance,
  };
}

function rankingsQuery(
  category: GithubCategory,
  windowDays: 7 | 30 | 90,
  limit: number,
  asOf?: string,
  cursor?: string,
): URLSearchParams {
  const query = new URLSearchParams({
    metric: "momentum",
    window: String(windowDays),
    category,
    entity_level: GITHUB_ENTITY_LEVEL,
    limit: String(limit),
  });
  if (asOf !== undefined) query.set("as_of", asOf);
  if (cursor !== undefined) query.set("cursor", cursor);
  return query;
}

function rankingSliceMatches(
  response: RankingResponse,
  category: GithubCategory,
  windowDays: 7 | 30 | 90,
): boolean {
  return (
    response.ranking.metric === "momentum" &&
    response.ranking.windowDays === windowDays &&
    response.ranking.category === category &&
    response.ranking.entityLevel === GITHUB_ENTITY_LEVEL
  );
}

function baselineSliceMatches(
  response: RankingResponse,
  current: RankingResponse,
): boolean {
  return (
    current.ranking.baselineDate !== null &&
    response.coverage.resolvedAsOf === current.ranking.baselineDate &&
    response.ranking.metric === current.ranking.metric &&
    response.ranking.windowDays === current.ranking.windowDays &&
    response.ranking.category === current.ranking.category &&
    response.ranking.entityLevel === current.ranking.entityLevel &&
    response.ranking.ruleVersion === current.ranking.ruleVersion &&
    response.ranking.taxonomyVersion === current.ranking.taxonomyVersion &&
    response.page.limit === GITHUB_BASELINE_PAGE_SIZE
  );
}

function completeCoverage(response: RankingResponse): boolean {
  return (
    response.coverage.acquisitionComplete &&
    response.coverage.populationCompleteness === "full" &&
    response.coverage.missingFields.length === 0
  );
}

type BaselineScan = {
  comparison: BaselineComparison;
  ranks: Map<string, number>;
};

function notRequiredBaseline(asOf: string): BaselineScan {
  return {
    comparison: {
      status: "not_required",
      requestedAsOf: asOf,
      pagesScanned: 0,
      cap: {
        pageLimit: GITHUB_BASELINE_PAGE_LIMIT,
        pageSize: GITHUB_BASELINE_PAGE_SIZE,
        nextCursor: null,
        capped: false,
      },
      evidence: [],
      warnings: [],
    },
    ranks: new Map(),
  };
}

async function scanBaseline(
  client: DashboardClient,
  current: RankingResponse,
  category: GithubCategory,
  windowDays: 7 | 30 | 90,
  selectedEvidence: readonly (MetricEvidence | null)[],
): Promise<BaselineScan> {
  const asOf = current.ranking.baselineDate;
  if (asOf === null) {
    return notRequiredBaseline(current.coverage.resolvedAsOf);
  }
  if (
    !selectedEvidence.some(
      (entry) => entry !== null && entry.baselineStars !== null,
    )
  ) {
    return notRequiredBaseline(asOf);
  }

  const evidence: RankingEvidence[] = [];
  const ranks = new Map<string, number>();
  let cursor: string | null = null;
  let pagesScanned = 0;
  let coverageComplete = completeCoverage(current);

  while (pagesScanned < GITHUB_BASELINE_PAGE_LIMIT) {
    try {
      const response: RankingResponse = await client.get(
        RANKINGS_ENDPOINT,
        rankingsQuery(
          category,
          windowDays,
          GITHUB_BASELINE_PAGE_SIZE,
          asOf,
          cursor ?? undefined,
        ),
        publicGitHubRankingResponseSchema,
      );
      pagesScanned += 1;
      evidence.push(rankingEvidence(response));
      cursor = response.page.nextCursor;
      if (!baselineSliceMatches(response, current)) {
        const warning =
          "The exact baseline publication does not match the current momentum slice.";
        return {
          comparison: {
            status: "mismatched",
            requestedAsOf: asOf,
            pagesScanned,
            cap: {
              pageLimit: GITHUB_BASELINE_PAGE_LIMIT,
              pageSize: GITHUB_BASELINE_PAGE_SIZE,
              nextCursor: cursor,
              capped: cursor !== null,
            },
            evidence,
            warnings: [warning],
          },
          ranks: new Map(),
        };
      }
      coverageComplete = coverageComplete && completeCoverage(response);
      for (const row of response.data) {
        if (!ranks.has(row.entityId)) ranks.set(row.entityId, row.rank);
      }
      if (cursor === null) break;
    } catch (error) {
      const safeError = safeDashboardError(error);
      return {
        comparison: {
          status: "unavailable",
          requestedAsOf: asOf,
          pagesScanned,
          cap: {
            pageLimit: GITHUB_BASELINE_PAGE_LIMIT,
            pageSize: GITHUB_BASELINE_PAGE_SIZE,
            nextCursor: cursor,
            capped: cursor !== null,
          },
          evidence,
          warnings: [
            `The exact baseline momentum publication is unavailable: ${safeError.message}`,
          ],
          error: safeError,
        },
        ranks: new Map(),
      };
    }
  }

  if (cursor !== null || !coverageComplete) {
    return {
      comparison: {
        status: "partial",
        requestedAsOf: asOf,
        pagesScanned,
        cap: {
          pageLimit: GITHUB_BASELINE_PAGE_LIMIT,
          pageSize: GITHUB_BASELINE_PAGE_SIZE,
          nextCursor: cursor,
          capped: cursor !== null,
        },
        evidence,
        warnings: [
          cursor !== null
            ? "The exact baseline ranking remains capped after two pages; movement and entrant status are unknown."
            : "The exact baseline ranking has partial evidence; movement and entrant status are unknown.",
        ],
      },
      ranks: new Map(),
    };
  }

  return {
    comparison: {
      status: "matched",
      requestedAsOf: asOf,
      pagesScanned,
      cap: {
        pageLimit: GITHUB_BASELINE_PAGE_LIMIT,
        pageSize: GITHUB_BASELINE_PAGE_SIZE,
        nextCursor: null,
        capped: false,
      },
      evidence,
      warnings: [],
    },
    ranks,
  };
}

function unavailableMetadata(
  response: RankingResponse,
  reason: string,
): z.infer<typeof repositoryMetadataAuxiliarySchema> {
  return {
    status: "unavailable",
    endpoint: REPOSITORIES_ENDPOINT,
    response: null,
    canonicalRepository: null,
    error: null,
    warnings: [reason],
  };
}

async function canonicalRepositoryEvidence(
  client: DashboardClient,
  current: RankingResponse,
  row: RankingRow,
): Promise<CanonicalRepositoryEvidence> {
  const baselineDate = current.ranking.baselineDate;
  const resolvedAsOf = current.coverage.resolvedAsOf;
  const repositoryId = row.repositoryId;
  const historyEndpoint = `${REPOSITORIES_ENDPOINT}/${encodeURIComponent(repositoryId)}/history`;
  const enrichmentEndpoint = `${REPOSITORIES_ENDPOINT}/${encodeURIComponent(repositoryId)}/enrichment`;

  const metadataPromise =
    row.familyId === null
      ? Promise.resolve(null)
      : client.get(
          REPOSITORIES_ENDPOINT,
          new URLSearchParams({
            taxonomy_version: current.ranking.taxonomyVersion,
            family_id: row.familyId,
            as_of: resolvedAsOf,
            limit: String(GITHUB_REPOSITORY_LOOKUP_LIMIT),
          }),
          publicGitHubRepositoryResponseSchema,
        );
  const historyPromise =
    baselineDate === null
      ? Promise.resolve(null)
      : client.get(
          historyEndpoint,
          new URLSearchParams({
            from: baselineDate,
            to: resolvedAsOf,
            fact_kind: "snapshot",
            limit: String((current.ranking.windowDays ?? 0) + 1),
          }),
          publicGitHubHistoryResponseSchema,
        );
  const enrichmentPromise =
    baselineDate === null
      ? Promise.resolve(null)
      : client.get(
          enrichmentEndpoint,
          new URLSearchParams({ from: baselineDate, to: resolvedAsOf }),
          publicGitHubRepositoryEnrichmentResponseSchema,
        );

  const [metadataResult, historyResult, enrichmentResult] =
    await Promise.allSettled([
      metadataPromise,
      historyPromise,
      enrichmentPromise,
    ]);

  let metadata: z.infer<typeof repositoryMetadataAuxiliarySchema>;
  if (metadataResult.status === "rejected") {
    const safeError = safeDashboardError(metadataResult.reason);
    metadata = {
      status: "unavailable",
      endpoint: REPOSITORIES_ENDPOINT,
      response: null,
      canonicalRepository: null,
      error: safeError,
      warnings: [
        `Canonical repository metadata is unavailable: ${safeError.message}`,
      ],
    };
  } else if (metadataResult.value === null) {
    metadata = unavailableMetadata(
      current,
      "Canonical repository metadata is unavailable because the project family id is missing.",
    );
  } else {
    const response = metadataResult.value;
    const canonicalRepository =
      response.data.find(
        (candidate) =>
          candidate.repositoryId === repositoryId && candidate.isCanonical,
      ) ?? null;
    const warnings = [
      ...(response.coverage.stale
        ? ["Canonical repository metadata is stale."]
        : []),
      ...(response.page.nextCursor === null
        ? []
        : [
            "The project-family repository lookup has additional rows beyond its bounded page.",
          ]),
      ...(canonicalRepository === null
        ? ["The canonical repository was not found in the bounded family lookup."]
        : []),
    ];
    metadata = {
      status: canonicalRepository === null ? "unavailable" : "available",
      endpoint: REPOSITORIES_ENDPOINT,
      response,
      canonicalRepository,
      error: null,
      warnings,
    };
  }

  let history: z.infer<typeof historyAuxiliarySchema>;
  if (historyResult.status === "rejected") {
    const safeError = safeDashboardError(historyResult.reason);
    history = {
      status: "unavailable",
      endpoint: historyEndpoint,
      response: null,
      error: safeError,
      warnings: [
        `Canonical repository snapshot history is unavailable: ${safeError.message}`,
      ],
    };
  } else if (historyResult.value === null) {
    history = {
      status: "unavailable",
      endpoint: historyEndpoint,
      response: null,
      error: null,
      warnings: [
        "Canonical repository snapshot history is unavailable because the momentum baseline date is missing.",
      ],
    };
  } else {
    const response = historyResult.value;
    const warnings = [
      ...(response.coverage.stale
        ? ["Canonical repository snapshot history is stale."]
        : []),
      ...(response.page.nextCursor === null
        ? []
        : [
            "Canonical repository snapshot history has additional rows beyond its bounded page.",
          ]),
      ...(response.coverage.populationCompleteness === "full"
        ? []
        : ["Canonical repository snapshot history has partial coverage."]),
    ];
    history = {
      status: "available",
      endpoint: historyEndpoint,
      response,
      error: null,
      warnings,
    };
  }

  let enrichment: z.infer<typeof enrichmentAuxiliarySchema>;
  if (enrichmentResult.status === "rejected") {
    const safeError = safeDashboardError(enrichmentResult.reason);
    enrichment = {
      status: "unavailable",
      endpoint: enrichmentEndpoint,
      response: null,
      error: safeError,
      warnings: [
        `Canonical repository enrichment is unavailable: ${safeError.message}`,
      ],
    };
  } else if (enrichmentResult.value === null) {
    enrichment = {
      status: "unavailable",
      endpoint: enrichmentEndpoint,
      response: null,
      error: null,
      warnings: [
        "Canonical repository enrichment is unavailable because the momentum baseline date is missing.",
      ],
    };
  } else {
    const response = enrichmentResult.value;
    const warnings = response.starBuckets.some(
      (bucket) => bucket.populationCompleteness !== "full",
    )
      ? [
          "Canonical repository star enrichment contains partial buckets; missing dates are not zero.",
        ]
      : [];
    enrichment = {
      status: "available",
      endpoint: enrichmentEndpoint,
      response,
      error: null,
      warnings,
    };
  }

  const warnings = uniqueStrings([
    ...metadata.warnings,
    ...history.warnings,
    ...enrichment.warnings,
  ]);
  return {
    scope: "canonical_repository_only_not_project_family",
    metadata,
    history,
    enrichment,
    warnings,
  };
}

function unavailableCategory(
  category: GithubCategory,
  reason: string,
  error: ReturnType<typeof safeDashboardError> | null,
  evidence: RankingEvidence | null = null,
): z.infer<typeof unavailableCategorySectionSchema> {
  return {
    status: "unavailable",
    category,
    endpoint: RANKINGS_ENDPOINT,
    reason,
    rankingEvidence: evidence,
    error,
    warnings: [reason],
  };
}

async function runCategory(
  client: DashboardClient,
  category: GithubCategory,
  windowDays: 7 | 30 | 90,
  limit: number,
): Promise<CategorySection> {
  let current: RankingResponse;
  try {
    current = await client.get(
      RANKINGS_ENDPOINT,
      rankingsQuery(category, windowDays, limit),
      publicGitHubRankingResponseSchema,
    );
  } catch (error) {
    const safeError = safeDashboardError(error);
    return unavailableCategory(
      category,
      `The ${windowDays}-day ${category} momentum slice is unavailable: ${safeError.message}`,
      safeError,
    );
  }

  const currentEvidence = rankingEvidence(current);
  if (!rankingSliceMatches(current, category, windowDays)) {
    return unavailableCategory(
      category,
      "The current GitHub response does not match the requested momentum/category/window/project-family slice.",
      null,
      currentEvidence,
    );
  }
  if (current.ranking.baselineDate === null) {
    return unavailableCategory(
      category,
      "The current momentum slice does not publish its observation baseline date.",
      null,
      currentEvidence,
    );
  }

  const selectedRows = [...current.data]
    .sort((left, right) =>
      left.rank === right.rank
        ? left.entityId.localeCompare(right.entityId)
        : left.rank - right.rank,
    )
    .slice(0, limit);
  const evidenceByRepository = new Map(
    current.metricEvidence.map((entry) => [entry.repositoryId, entry]),
  );
  const selectedEvidence = selectedRows.map(
    (row) => evidenceByRepository.get(row.repositoryId) ?? null,
  );
  const baseline = await scanBaseline(
    client,
    current,
    category,
    windowDays,
    selectedEvidence,
  );
  const comparable = baseline.comparison.status === "matched";

  const leaders = await Promise.all(
    selectedRows.map(async (row, index) => {
      const metric = selectedEvidence[index] ?? null;
      const hasBaselineStars = metric?.baselineStars !== null && metric !== null;
      const previousRank =
        comparable && hasBaselineStars
          ? baseline.ranks.get(row.entityId) ?? null
          : null;
      const positivelyAbsent =
        comparable && hasBaselineStars && !baseline.ranks.has(row.entityId);
      const repositoryEvidence = await canonicalRepositoryEvidence(
        client,
        current,
        row,
      );
      return {
        entityId: row.entityId,
        familyId: row.familyId,
        canonicalRepositoryId: row.repositoryId,
        memberRepositoryIds: row.memberRepositoryIds,
        fullName: row.fullName,
        currentRank: row.rank,
        previousRank,
        rankMovement:
          previousRank === null ? null : previousRank - row.rank,
        newEntrant:
          !comparable || !hasBaselineStars
            ? null
            : positivelyAbsent
              ? true
              : false,
        momentumScore: row.score,
        stars: row.stars,
        forks: row.forks,
        baselineStars: metric?.baselineStars ?? null,
        starDelta: metric?.starDelta ?? null,
        forkDelta: metric?.forkDelta ?? null,
        metricEvidence: metric,
        canonicalRepositoryEvidence: repositoryEvidence,
      };
    }),
  );

  const missingMetricEvidence = leaders.some(
    (leader) => leader.metricEvidence?.baselineStars == null,
  );
  const auxiliaryPartial = leaders.some(
    (leader) =>
      leader.canonicalRepositoryEvidence.metadata.status !== "available" ||
      leader.canonicalRepositoryEvidence.history.status !== "available" ||
      leader.canonicalRepositoryEvidence.enrichment.status !== "available",
  );
  const warnings = uniqueStrings([
    ...(current.coverage.stale
      ? [`The current ${category} momentum slice is stale.`]
      : []),
    ...baseline.comparison.warnings,
    ...(missingMetricEvidence
      ? [
          "At least one final leader lacks baseline-star evidence; its movement and entrant status are unknown.",
        ]
      : []),
    ...leaders.flatMap(
      (leader) => leader.canonicalRepositoryEvidence.warnings,
    ),
  ]);
  const baselinePartial =
    selectedRows.length > 0 &&
    baseline.comparison.status !== "matched";

  return {
    status:
      baselinePartial || missingMetricEvidence || auxiliaryPartial
        ? "partial"
        : "available",
    category,
    endpoint: RANKINGS_ENDPOINT,
    rankingEvidence: currentEvidence,
    baselineComparison: baseline.comparison,
    leaders,
    warnings,
    cap: {
      outputLimit: limit,
      returnedLeaders: leaders.length,
      currentNextCursor: current.page.nextCursor,
      currentPageCapped: current.page.nextCursor !== null,
    },
  };
}

async function runGithubMoversUnsafe(
  rawInput: GithubMoversInput,
  { client }: GithubMoversDependencies,
): Promise<GithubMoversOutput> {
  const input = githubMoversInputSchema.parse(rawInput);
  const categories: GithubCategory[] =
    input.category === undefined
      ? [...GITHUB_MOVER_CATEGORIES]
      : [input.category];
  const sections = await Promise.all(
    categories.map((category) =>
      runCategory(client, category, input.windowDays, input.limit),
    ),
  );
  const warnings = uniqueStrings(sections.flatMap((section) => section.warnings));
  const partial = sections.some((section) => section.status !== "available");
  const leaderCount = sections.reduce(
    (count, section) =>
      count + (section.status === "unavailable" ? 0 : section.leaders.length),
    0,
  );

  return {
    status: partial ? "partial" : "ok",
    schemaVersion: "2.0",
    summary: `${leaderCount} public GitHub project-family momentum leader${leaderCount === 1 ? "" : "s"} across ${sections.length} category slice${sections.length === 1 ? "" : "s"}; ranks remain category-scoped.`,
    query: {
      category: input.category ?? null,
      windowDays: input.windowDays,
      limit: input.limit,
      metric: "momentum",
      entityLevel: GITHUB_ENTITY_LEVEL,
    },
    fanout: {
      categoryLimit: GITHUB_MOVER_CATEGORIES.length,
      categoriesRequested: categories,
      omittedCategories: [],
    },
    categories: sections,
    warnings,
  };
}

export async function runGithubMovers(
  rawInput: GithubMoversInput,
  dependencies: GithubMoversDependencies,
): Promise<GithubMoversOutput> {
  try {
    const output = await runGithubMoversUnsafe(rawInput, dependencies);
    return githubMoversOutputSchema.parse(output);
  } catch (error) {
    const safeError = safeDashboardError(error);
    return {
      status: "error",
      summary: safeError.message,
      error: safeError,
    };
  }
}

export function registerGithubMovers(
  server: McpServer,
  dependencies: GithubMoversDependencies,
): void {
  server.registerTool(
    "dashboard_github_movers",
    {
      title: "Dashboard public GitHub momentum movers",
      description:
        "Return bounded public GitHub momentum leaders as separate category-scoped project-family slices for 7, 30, or 90 days. Rank movement uses only an exact matching baseline publication; canonical repository metadata, history, and enrichment remain explicitly repository-scoped auxiliary evidence.",
      inputSchema: githubMoversInputSchema,
      outputSchema: githubMoversOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runGithubMovers(input, dependencies)),
  );
}

import { z } from "zod";

const exactCount = z.string().regex(/^(?:0|[1-9]\d*)$/);
const signedInteger = z.string().regex(/^(?:0|[1-9]\d*|-[1-9]\d*)$/);

export const publicGitHubRepositoryIdSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .refine((value) => BigInt(value) <= BigInt("9223372036854775807"));

export const publicGitHubProvenanceSchema = z
  .object({
    id: z.string(),
    sourceUrl: z.string().url(),
    fetchedAt: z.string().datetime(),
    payloadSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const coverageSchema = z
  .object({
    resolvedAsOf: z.string().date(),
    acquisitionComplete: z.boolean(),
    populationCompleteness: z.enum([
      "full",
      "requested_slice",
      "top_n_plus_other",
      "partial_or_unknown",
    ]),
    missingFields: z.array(z.string()),
    stale: z.boolean(),
    lastSuccessAt: z.string().datetime(),
    staleAfterSeconds: z.number().int().positive(),
  })
  .strict();

export const publicGitHubRankingRowSchemaBase = z
  .object({
    entityId: z.string().min(1),
    familyId: z.string().min(1).nullable(),
    repositoryId: publicGitHubRepositoryIdSchema,
    memberRepositoryIds: z.array(publicGitHubRepositoryIdSchema).min(1),
    fullName: z.string(),
    stars: exactCount,
    forks: exactCount,
    rank: z.number().int().positive(),
    score: z.string().nullable(),
  })
  .strict();

export const publicReleaseCadenceSchema = z
  .object({
    latestStableReleaseAt: z.string().datetime().nullable(),
    stableReleaseCount90d: exactCount.nullable(),
    medianStableReleaseIntervalDays365d: z
      .string()
      .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/)
      .nullable(),
    coverageStart: z.string().date().nullable(),
    coverageEnd: z.string().date().nullable(),
    coverageComplete: z.boolean(),
  })
  .strict();

export const publicStarBucketSchema = z
  .object({
    start: z.string().date(),
    end: z.string().date(),
    count: exactCount,
    populationCompleteness: z.enum(["full", "partial_or_unknown"]),
  })
  .strict();

const publicGitHubEnrichmentRequestRangeSchema = z
  .object({
    from: z.string().date(),
    to: z.string().date(),
  })
  .strict()
  .superRefine((query, context) => {
    const days =
      Math.floor(
        (Date.parse(`${query.to}T00:00:00Z`) -
          Date.parse(`${query.from}T00:00:00Z`)) /
          86_400_000,
      ) + 1;
    if (days < 1 || days > 366) {
      context.addIssue({
        code: "custom",
        message: "enrichment range must contain 1 to 366 inclusive UTC dates",
      });
    }
  });

export const publicGitHubRepositoryEnrichmentResponseSchema = z
  .object({
    schemaVersion: z.literal("2.0"),
    repositoryId: publicGitHubRepositoryIdSchema,
    requestRange: publicGitHubEnrichmentRequestRangeSchema,
    releaseCadence: publicReleaseCadenceSchema,
    starBuckets: z.array(publicStarBucketSchema).max(366),
    provenance: z.array(
      z
        .object({
          id: z.string(),
          sourceUrl: z.string().url(),
          fetchedAt: z.string().datetime(),
        })
        .strict(),
    ),
  })
  .strict()
  .superRefine((response, context) => {
    response.starBuckets.forEach((bucket, index) => {
      if (bucket.start > bucket.end) {
        context.addIssue({
          code: "custom",
          path: ["starBuckets", index, "end"],
          message: "star bucket start must not be after end",
        });
      }
      if (
        bucket.start < response.requestRange.from ||
        bucket.end > response.requestRange.to
      ) {
        context.addIssue({
          code: "custom",
          path: ["starBuckets", index],
          message: "star bucket must be contained in requestRange",
        });
      }
    });
  });

export const publicGitHubRankingRowSchema = publicGitHubRankingRowSchemaBase
  .extend({ maintenanceEvidence: publicReleaseCadenceSchema.nullable() })
  .strict();

export const publicGitHubMetricEvidenceSchema = z
  .object({
    repositoryId: publicGitHubRepositoryIdSchema,
    baselineStars: exactCount.nullable(),
    starDelta: signedInteger.nullable(),
    forkDelta: signedInteger.nullable(),
    relativeGrowth: z.string().regex(/^-?\d+\.\d{6}$/).nullable(),
    defaultBranchCommittedAt: z.string().datetime().nullable(),
    latestStableReleaseAt: z.string().datetime().nullable(),
    stableReleaseCount90d: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const publicGitHubRankingResponseSchema = z
  .object({
    schemaVersion: z.literal("2.0"),
    watermark: z.string(),
    coverage: coverageSchema,
    ranking: z
      .object({
        metric: z.enum(["adoption", "momentum", "maintenance"]),
        rankMethod: z.literal("locally_calculated"),
        definition: z.string(),
        unit: z.string(),
        direction: z.literal("higher_is_better"),
        ruleVersion: z.string(),
        taxonomyVersion: z.string(),
        category: z.string(),
        entityLevel: z.enum(["project-family", "repository"]),
        eligiblePopulation: z.number().int().nonnegative(),
        coverageExcluded: z.number().int().nonnegative(),
        windowDays: z
          .union([z.literal(7), z.literal(30), z.literal(90)])
          .nullable(),
        baselineDate: z.string().date().nullable(),
      })
      .strict(),
    data: z.array(publicGitHubRankingRowSchema),
    metricEvidence: z.array(publicGitHubMetricEvidenceSchema),
    page: z.object({
      limit: z.number().int().positive(),
      nextCursor: z.string().nullable(),
    }),
    provenance: z.array(publicGitHubProvenanceSchema),
  })
  .strict();

export const publicGitHubRepositoryRowSchema = z
  .object({
    repositoryId: publicGitHubRepositoryIdSchema,
    familyId: z.string().min(1),
    isCanonical: z.boolean(),
    fullName: z.string(),
    url: z.string().url(),
    primaryCategory: z.string(),
    roles: z.array(z.string()),
    lifecycle: z.string(),
    license: z.string(),
    language: z.string().nullable(),
    stars: exactCount.nullable(),
    forks: exactCount.nullable(),
  })
  .strict();

export const publicGitHubRepositoryResponseSchema = z
  .object({
    schemaVersion: z.literal("2.0"),
    watermark: z.string(),
    coverage: coverageSchema,
    data: z.array(publicGitHubRepositoryRowSchema),
    page: z.object({
      limit: z.number().int().positive(),
      nextCursor: z.string().nullable(),
    }),
    provenance: z.array(publicGitHubProvenanceSchema),
  })
  .strict();

export const publicGitHubHistoryRowSchema = z
  .object({
    observedDate: z.string().date(),
    stars: exactCount.nullable(),
    forks: exactCount.nullable(),
    openIssues: exactCount.nullable(),
    defaultBranchCommittedAt: z.string().datetime().nullable(),
    latestStableReleaseAt: z.string().datetime().nullable(),
    stableReleaseCount90d: z.number().int().nonnegative().nullable(),
    lifecycle: z.string(),
  })
  .strict();

export const publicGitHubHistoryResponseSchema = z
  .object({
    schemaVersion: z.literal("2.0"),
    repositoryId: publicGitHubRepositoryIdSchema,
    requestFactKind: z.enum([
      "snapshot",
      "stars",
      "forks",
      "issues",
      "activity",
      "lifecycle",
    ]),
    coverage: coverageSchema,
    data: z.array(publicGitHubHistoryRowSchema),
    page: z.object({
      limit: z.number().int().positive(),
      nextCursor: z.string().nullable(),
    }),
    provenance: z.array(publicGitHubProvenanceSchema),
  })
  .strict();

export const githubRankingResponseSchema = publicGitHubRankingResponseSchema;
export const githubRepositoryResponseSchema =
  publicGitHubRepositoryResponseSchema;
export const githubHistoryResponseSchema = publicGitHubHistoryResponseSchema;
export const githubRepositoryEnrichmentResponseSchema =
  publicGitHubRepositoryEnrichmentResponseSchema;

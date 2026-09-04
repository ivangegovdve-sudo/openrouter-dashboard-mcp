import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import {
  trendingRepoSchema,
  trendingResponseSchema,
  trendingSinceSchema,
} from "../dashboard/schemas/trending.js";
import {
  READ_ONLY_TOOL_ANNOTATIONS,
  safeDashboardError,
  safeDashboardErrorSchema,
  sourceEvidence,
  sourceEvidenceSchema,
  toolResult,
} from "./shared.js";

const TRENDING_ENDPOINT = "/api/public/v2/github/trending";

export const GITHUB_TRENDING_DEFAULT_LIMIT = 10;
export const GITHUB_TRENDING_MAX_LIMIT = 25;

/**
 * How stale a list may be before the tool says so unprompted.
 *
 * GitHub's trending page turns over through the day, so a list from yesterday is
 * a different answer rather than a slightly older one. Six hours is well inside
 * one turnover and well outside the upstream cache window, so it flags genuine
 * staleness without crying about a normal cache hit.
 */
export const GITHUB_TRENDING_STALE_AFTER_HOURS = 6;

export const githubTrendingInputSchema = z
  .object({
    since: trendingSinceSchema.default("daily"),
    /**
     * A GitHub language filter. Omit for all languages, which is the slice the
     * dashboard actually exercises.
     */
    language: z.string().min(1).max(64).optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(GITHUB_TRENDING_MAX_LIMIT)
      .default(GITHUB_TRENDING_DEFAULT_LIMIT),
  })
  .strict();

const githubTrendingSuccessSchema = z
  .object({
    status: z.literal("ok"),
    summary: z.string(),
    repositories: z.array(trendingRepoSchema),
    /**
     * The collection time travels with the answer, never inferred by the reader
     * and never the time this tool happened to run.
     */
    collectedAt: z.string().datetime({ offset: true }),
    ageHours: z.number(),
    stale: z.boolean(),
    since: trendingSinceSchema,
    language: z.string().nullable(),
    source: z.enum(["direct", "firecrawl"]),
    fallbackReason: z.string().nullable(),
    evidence: z.array(sourceEvidenceSchema),
    warnings: z.array(z.string()),
    cap: z
      .object({
        limit: z.number().int(),
        reached: z.boolean(),
      })
      .strict(),
  })
  .strict();

const githubTrendingErrorSchema = z
  .object({
    status: z.literal("error"),
    summary: z.string(),
    error: safeDashboardErrorSchema,
  })
  .strict();

export const githubTrendingOutputSchema = z.discriminatedUnion("status", [
  githubTrendingSuccessSchema,
  githubTrendingErrorSchema,
]);

export type GitHubTrendingInput = z.infer<typeof githubTrendingInputSchema>;
export type GitHubTrendingOutput = z.infer<typeof githubTrendingOutputSchema>;

export type GitHubTrendingDependencies = {
  client: DashboardClient;
  now?: () => Date;
};

export async function runGitHubTrending(
  input: GitHubTrendingInput,
  { client, now = () => new Date() }: GitHubTrendingDependencies,
): Promise<GitHubTrendingOutput> {
  try {
    const params = new URLSearchParams({ since: input.since });
    if (input.language) params.set("language", input.language);

    const response = await client.get(TRENDING_ENDPOINT, params, trendingResponseSchema);

    const collectedMs = Date.parse(response.collectedAt);
    const ageHours = Number.isFinite(collectedMs)
      ? Math.max(0, (now().getTime() - collectedMs) / 3_600_000)
      : Number.POSITIVE_INFINITY;
    const stale = ageHours >= GITHUB_TRENDING_STALE_AFTER_HOURS;

    const warnings: string[] = [];
    if (stale) {
      warnings.push(
        `This list was collected ${ageHours.toFixed(1)} hours ago, past the ${GITHUB_TRENDING_STALE_AFTER_HOURS}-hour freshness window. GitHub trending turns over through the day, so treat it as a snapshot rather than the current board.`,
      );
    }
    if (response.source === "firecrawl") {
      // A fallback nobody is told about is how you end up running on the paid
      // backup for months without knowing the primary died.
      warnings.push(
        `Served by the paid Firecrawl fallback rather than the direct scrape${
          response.fallbackReason ? `: ${response.fallbackReason}` : ""
        }.`,
      );
    }
    if (response.data.length === 0) {
      warnings.push("The upstream page returned no rows for this slice.");
    }

    const repositories = response.data.slice(0, input.limit);

    return {
      status: "ok",
      summary: `${repositories.length} trending repositories (${input.since}, ${
        response.language ?? "all languages"
      }) collected ${response.collectedAt} via the ${response.source} path.`,
      repositories,
      collectedAt: response.collectedAt,
      ageHours: Number(ageHours.toFixed(2)),
      stale,
      since: response.since,
      language: response.language,
      source: response.source,
      fallbackReason: response.fallbackReason,
      evidence: [
        // Trending carries no archive envelope — no window, completeness or
        // provenance, because nothing published it. What it does have is the
        // collection time and our own staleness verdict, so those are what the
        // evidence records rather than a row of nulls dressed up as provenance.
        sourceEvidence(TRENDING_ENDPOINT, {
          publishedAt: response.collectedAt,
          stale,
        }),
      ],
      warnings,
      cap: {
        limit: input.limit,
        reached: response.data.length > input.limit,
      },
    };
  } catch (error) {
    const safeError = safeDashboardError(error);
    return {
      status: "error",
      summary: safeError.message,
      error: safeError,
    };
  }
}

export function registerGitHubTrending(
  server: McpServer,
  dependencies: GitHubTrendingDependencies,
): void {
  server.registerTool(
    "dashboard_github_trending",
    {
      title: "GitHub trending repositories",
      description:
        "List GitHub trending repositories with the timestamp they were collected at, which path served them, and whether the list is stale.",
      inputSchema: githubTrendingInputSchema,
      outputSchema: githubTrendingOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runGitHubTrending(input, dependencies)),
  );
}

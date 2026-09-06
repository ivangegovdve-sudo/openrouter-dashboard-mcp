import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import { benchmarksResponseSchema } from "../dashboard/schemas/openrouter.js";
import {
  READ_ONLY_TOOL_ANNOTATIONS,
  safeDashboardError,
  safeDashboardErrorSchema,
  sourceEvidence,
  sourceEvidenceSchema,
  toolResult,
} from "./shared.js";

const BENCHMARKS_ENDPOINT = "/api/public/v2/benchmarks";
export const BENCHMARKS_DEFAULT_LIMIT = 50;
export const BENCHMARKS_MAX_LIMIT = 100;

export const benchmarksInputSchema = z
  .object({
    source: z.enum(["artificial-analysis", "design-arena", "openrouter"]).optional(),
    model: z.string().min(1).max(256).optional(),
    limit: z.number().int().min(50).max(BENCHMARKS_MAX_LIMIT).default(BENCHMARKS_DEFAULT_LIMIT),
    cursor: z.string().optional(),
  })
  .strict();

const benchmarksSuccessSchema = z
  .object({
    status: z.literal("ok"),
    endpoint: z.literal(BENCHMARKS_ENDPOINT),
    response: benchmarksResponseSchema,
    evidence: sourceEvidenceSchema,
    warnings: z.array(z.string()),
    cap: z
      .object({
        requestedLimit: z.number().int().min(50).max(BENCHMARKS_MAX_LIMIT),
        returnedCount: z.number().int().nonnegative(),
        nextCursor: z.string().nullable(),
        capped: z.boolean(),
      })
      .strict(),
  })
  .strict();

const benchmarksErrorSchema = z
  .object({
    status: z.literal("error"),
    endpoint: z.literal(BENCHMARKS_ENDPOINT),
    response: z.null(),
    evidence: z.null(),
    warnings: z.array(z.string()),
    error: safeDashboardErrorSchema,
  })
  .strict();

export const benchmarksOutputSchema = z.discriminatedUnion("status", [
  benchmarksSuccessSchema,
  benchmarksErrorSchema,
]);

export type BenchmarksInput = z.infer<typeof benchmarksInputSchema>;
export type BenchmarksOutput = z.infer<typeof benchmarksOutputSchema>;

export type BenchmarksDependencies = { client: DashboardClient };

export async function runBenchmarks(
  rawInput: BenchmarksInput,
  { client }: BenchmarksDependencies,
): Promise<BenchmarksOutput> {
  try {
    const input = benchmarksInputSchema.parse(rawInput);
    const query = new URLSearchParams({ limit: String(input.limit) });
    if (input.source) query.set("source", input.source);
    if (input.model) query.set("model", input.model);
    if (input.cursor) query.set("cursor", input.cursor);
    const response = await client.get(BENCHMARKS_ENDPOINT, query, benchmarksResponseSchema);
    const warnings = [
      ...(response.stale ? [`Data from ${BENCHMARKS_ENDPOINT} is stale.`] : []),
      ...(response.cursor !== null ? ["More benchmark observations are available via the returned cursor."] : []),
    ];
    return {
      status: "ok",
      endpoint: BENCHMARKS_ENDPOINT,
      response,
      evidence: sourceEvidence(BENCHMARKS_ENDPOINT, response),
      warnings,
      cap: {
        requestedLimit: input.limit,
        returnedCount: response.data.length,
        nextCursor: response.cursor,
        capped: response.cursor !== null,
      },
    };
  } catch (error) {
    const safeError = safeDashboardError(error);
    return {
      status: "error",
      endpoint: BENCHMARKS_ENDPOINT,
      response: null,
      evidence: null,
      warnings: [`${BENCHMARKS_ENDPOINT} is unavailable: ${safeError.message}`],
      error: safeError,
    };
  }
}

export function registerBenchmarks(
  server: McpServer,
  dependencies: BenchmarksDependencies,
): void {
  server.registerTool(
    "dashboard_benchmarks",
    {
      title: "Dashboard benchmark observations",
      description:
        "Read the published OpenRouter benchmark observations, including Artificial Analysis, Design Arena and OpenRouter's own benchmark variant. Upstream unavailability remains an explicit structured error.",
      inputSchema: benchmarksInputSchema,
      outputSchema: benchmarksOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runBenchmarks(input, dependencies)),
  );
}

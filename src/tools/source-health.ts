import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import {
  manifestSchema,
  publicSourceStatusSchema,
  sourceStatusResponseSchema,
} from "../dashboard/schemas/openrouter.js";
import {
  READ_ONLY_TOOL_ANNOTATIONS,
  safeDashboardError,
  safeDashboardErrorSchema,
  sourceEvidence,
  sourceEvidenceSchema,
  toolResult,
} from "./shared.js";

const MANIFEST_ENDPOINT = "/api/public/v2/manifest";
const SOURCE_STATUS_ENDPOINT = "/api/public/v2/source-status";

/**
 * Six OpenRouter sources plus Groq and Cerebras. The two provider sources are
 * published on /source-status so a collector that stops refreshing is visible;
 * without them two of the three provider catalogues had no health surface.
 */
export const SOURCE_STATUS_LIMIT = 8;

export const sourceHealthInputSchema = z.object({}).strict();

const sourceHealthSuccessSchema = z
  .object({
    status: z.literal("ok"),
    summary: z.string(),
    routes: z.array(z.string().startsWith("/api/public/v2/")),
    sources: z.array(publicSourceStatusSchema),
    evidence: z.array(sourceEvidenceSchema),
    warnings: z.array(z.string()),
    cap: z
      .object({
        sourceLimit: z.literal(SOURCE_STATUS_LIMIT),
        reached: z.boolean(),
      })
      .strict(),
  })
  .strict();

const sourceHealthErrorSchema = z
  .object({
    status: z.literal("error"),
    summary: z.string(),
    error: safeDashboardErrorSchema,
  })
  .strict();

export const sourceHealthOutputSchema = z.discriminatedUnion("status", [
  sourceHealthSuccessSchema,
  sourceHealthErrorSchema,
]);

export type SourceHealthInput = z.infer<typeof sourceHealthInputSchema>;
export type SourceHealthOutput = z.infer<typeof sourceHealthOutputSchema>;

export type SourceHealthDependencies = {
  client: DashboardClient;
};

export async function runSourceHealth(
  _input: SourceHealthInput,
  { client }: SourceHealthDependencies,
): Promise<SourceHealthOutput> {
  try {
    const [manifest, sourceStatus] = await Promise.all([
      client.get(
        MANIFEST_ENDPOINT,
        new URLSearchParams(),
        manifestSchema,
      ),
      client.get(
        SOURCE_STATUS_ENDPOINT,
        new URLSearchParams(),
        sourceStatusResponseSchema,
      ),
    ]);

    const staleCount = sourceStatus.data.filter((source) => source.stale).length;
    const failedCount = sourceStatus.data.filter(
      (source) => source.lastAttemptStatus === "failed",
    ).length;
    const warnings: string[] = [];
    if (staleCount > 0) {
      warnings.push(`${staleCount} source${staleCount === 1 ? " is" : "s are"} stale.`);
    }
    if (failedCount > 0) {
      warnings.push(
        `${failedCount} source${failedCount === 1 ? " has" : "s have"} a failed latest attempt.`,
      );
    }

    return {
      status: "ok",
      summary: `${sourceStatus.data.length} sources checked; ${staleCount} stale; ${failedCount} failed latest attempts.`,
      routes: manifest.routes,
      sources: sourceStatus.data,
      evidence: [
        sourceEvidence(MANIFEST_ENDPOINT, manifest),
        sourceEvidence(SOURCE_STATUS_ENDPOINT, sourceStatus),
      ],
      warnings,
      cap: {
        sourceLimit: SOURCE_STATUS_LIMIT,
        reached:
          sourceStatus.data.length >= SOURCE_STATUS_LIMIT ||
          sourceStatus.cursor !== null,
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

export function registerSourceHealth(
  server: McpServer,
  dependencies: SourceHealthDependencies,
): void {
  server.registerTool(
    "dashboard_source_health",
    {
      title: "Dashboard source health",
      description:
        "Report dashboard source freshness, collector failures, and available public routes.",
      inputSchema: sourceHealthInputSchema,
      outputSchema: sourceHealthOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runSourceHealth(input, dependencies)),
  );
}

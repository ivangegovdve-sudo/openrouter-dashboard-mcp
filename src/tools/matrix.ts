import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import { appModelMatrixResponseSchema } from "../dashboard/schemas/openrouter.js";
import {
  READ_ONLY_TOOL_ANNOTATIONS,
  safeDashboardError,
  safeDashboardErrorSchema,
  sourceEvidence,
  sourceEvidenceSchema,
  toolResult,
} from "./shared.js";

const MATRIX_ENDPOINT = "/api/public/v2/app-model-matrix";
export const MATRIX_AXIS_LIMIT = 10;

export const matrixInputSchema = z
  .object({
    appLimit: z.number().int().min(1).max(MATRIX_AXIS_LIMIT).default(MATRIX_AXIS_LIMIT),
    modelLimit: z.number().int().min(1).max(MATRIX_AXIS_LIMIT).default(MATRIX_AXIS_LIMIT),
    window: z.literal("latest-complete").default("latest-complete"),
  })
  .strict();

const matrixAvailableSchema = z
  .object({
    status: z.literal("available"),
    endpoint: z.literal(MATRIX_ENDPOINT),
    response: appModelMatrixResponseSchema,
    evidence: sourceEvidenceSchema,
    warnings: z.array(z.string()),
    cap: z.object({ appLimit: z.literal(10), modelLimit: z.literal(10), cellLimit: z.literal(100) }).strict(),
    error: z.null(),
  })
  .strict();

const matrixUnavailableSchema = z
  .object({
    status: z.literal("unavailable"),
    endpoint: z.literal(MATRIX_ENDPOINT),
    response: appModelMatrixResponseSchema,
    evidence: sourceEvidenceSchema,
    warnings: z.array(z.string()),
    cap: z.object({ appLimit: z.literal(10), modelLimit: z.literal(10), cellLimit: z.literal(100) }).strict(),
    error: z.null(),
  })
  .strict();

const matrixErrorSchema = z
  .object({
    status: z.literal("error"),
    endpoint: z.literal(MATRIX_ENDPOINT),
    response: z.null(),
    evidence: z.null(),
    warnings: z.array(z.string()),
    cap: z.object({ appLimit: z.literal(10), modelLimit: z.literal(10), cellLimit: z.literal(100) }).strict(),
    error: safeDashboardErrorSchema,
  })
  .strict();

export const matrixOutputSchema = z.discriminatedUnion("status", [
  matrixAvailableSchema,
  matrixUnavailableSchema,
  matrixErrorSchema,
]);

export type MatrixInput = z.infer<typeof matrixInputSchema>;
export type MatrixOutput = z.infer<typeof matrixOutputSchema>;

export type MatrixDependencies = { client: DashboardClient };

function matrixWarning(reason: string): string {
  if (reason === "approval_incomplete") return "Collection is quiet while the required approvals are pending.";
  if (reason === "collection_disabled") return "Collection is disabled by configuration.";
  return `${MATRIX_ENDPOINT} is unavailable: ${reason}.`;
}

export async function runMatrix(
  rawInput: MatrixInput,
  { client }: MatrixDependencies,
): Promise<MatrixOutput> {
  const cap = { appLimit: 10 as const, modelLimit: 10 as const, cellLimit: 100 as const };
  try {
    const input = matrixInputSchema.parse(rawInput);
    const response = await client.get(
      MATRIX_ENDPOINT,
      new URLSearchParams({ appLimit: String(input.appLimit), modelLimit: String(input.modelLimit), window: input.window }),
      appModelMatrixResponseSchema,
    );
    const warnings = response.status === "unavailable"
      ? [matrixWarning(response.reason)]
      : [
          ...(response.stale ? [`Data from ${MATRIX_ENDPOINT} is stale.`] : []),
          ...(response.cells.some((cell) => cell.state === "unknown") ? ["Unknown cells are not zero."] : []),
        ];
    if (response.status === "unavailable") {
      return { status: "unavailable", endpoint: MATRIX_ENDPOINT, response, evidence: sourceEvidence(MATRIX_ENDPOINT, response), warnings, cap, error: null };
    }
    return { status: "available", endpoint: MATRIX_ENDPOINT, response, evidence: sourceEvidence(MATRIX_ENDPOINT, response), warnings, cap, error: null };
  } catch (error) {
    const safeError = safeDashboardError(error);
    return { status: "error", endpoint: MATRIX_ENDPOINT, response: null, evidence: null, warnings: [`${MATRIX_ENDPOINT} is unavailable: ${safeError.message}`], cap, error: safeError };
  }
}

export function registerMatrix(
  server: McpServer,
  dependencies: MatrixDependencies,
): void {
  server.registerTool(
    "dashboard_matrix",
    {
      title: "Dashboard app-model matrix",
      description:
        "Read the published app-to-model usage matrix. Approval-pending and collection-disabled states remain distinct and no consent gate is bypassed.",
      inputSchema: matrixInputSchema,
      outputSchema: matrixOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runMatrix(input, dependencies)),
  );
}

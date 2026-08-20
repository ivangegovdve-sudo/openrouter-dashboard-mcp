import type {
  CallToolResult,
  ToolAnnotations,
} from "@modelcontextprotocol/server";
import { z } from "zod";

import { DashboardRequestError } from "../dashboard/errors.js";
import {
  publicCompletenessSchema,
  publicProvenanceSchema,
  publicWindowSchema,
} from "../dashboard/schemas/common.js";

export const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
} as const satisfies ToolAnnotations;

export const sourceEvidenceSchema = z
  .object({
    endpoint: z.string().min(1),
    window: publicWindowSchema.nullable(),
    completeness: publicCompletenessSchema.nullable(),
    stale: z.boolean().nullable(),
    watermark: z.string().nullable(),
    provenance: z.array(publicProvenanceSchema),
  })
  .strict();

export type SourceEvidence = z.infer<typeof sourceEvidenceSchema>;

type EvidenceUpstream = {
  window?: unknown;
  completeness?: unknown;
  stale?: unknown;
  watermark?: unknown;
  publishedAt?: unknown;
  provenance?: unknown;
};

export function sourceEvidence(
  endpoint: string,
  upstream: EvidenceUpstream,
): SourceEvidence {
  return sourceEvidenceSchema.parse({
    endpoint,
    window: upstream.window ?? null,
    completeness: upstream.completeness ?? null,
    stale: typeof upstream.stale === "boolean" ? upstream.stale : null,
    watermark:
      typeof upstream.watermark === "string"
        ? upstream.watermark
        : typeof upstream.publishedAt === "string"
          ? upstream.publishedAt
          : null,
    provenance: Array.isArray(upstream.provenance) ? upstream.provenance : [],
  });
}

export const safeDashboardErrorSchema = z
  .object({
    kind: z.enum([
      "unreachable",
      "timeout",
      "http_error",
      "non_json",
      "invalid_payload",
      "configuration_error",
    ]),
    message: z.string(),
    retryable: z.boolean(),
    status: z.number().int().optional(),
  })
  .strict();

export type SafeDashboardError = z.infer<typeof safeDashboardErrorSchema>;

export function safeDashboardError(error: unknown): SafeDashboardError {
  if (error instanceof DashboardRequestError) return error.toJSON();
  return {
    kind: "unreachable",
    message: "Cannot reach the dashboard catalogue right now.",
    retryable: true,
  };
}

export function toolResult<T extends object>(output: T): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(output) }],
    structuredContent: output as Record<string, unknown>,
  };
}

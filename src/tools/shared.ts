import type {
  CallToolResult,
  ToolAnnotations,
} from "@modelcontextprotocol/server";
import { z } from "zod";

import { freshnessOf } from "../dashboard/cache.js";
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

/**
 * How old this source read is, carried in the answer rather than left for the
 * caller to ask about. `expired` means upstream could not be reached and the
 * value is last-known, with the time it was last known -- it is never presented
 * as current.
 */
export const freshnessSchema = z
  .object({
    state: z.enum(["live", "cached", "expired"]),
    fetchedAt: z.string(),
    ageSeconds: z.number().int().nonnegative(),
    expiresAt: z.string(),
    note: z.string().optional(),
  })
  .strict();

export const sourceEvidenceSchema = z
  .object({
    endpoint: z.string().min(1),
    window: publicWindowSchema.nullable(),
    completeness: publicCompletenessSchema.nullable(),
    stale: z.boolean().nullable(),
    watermark: z.string().nullable(),
    provenance: z.array(publicProvenanceSchema),
    /** Null only when the read did not pass through the cache at all. */
    freshness: freshnessSchema.nullable(),
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
    // Read off the response object itself, so two clients in one process cannot
    // pick up each other's metadata.
    freshness: freshnessOf(upstream),
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

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { historicalMeasuredSpeed, publishedSpeed, speedObservationSchema, speedProtocolSchema, unknownSpeed } from "../speed.js";
import { READ_ONLY_TOOL_ANNOTATIONS, toolResult } from "./shared.js";

export const speedInputSchema = z.object({ provider: z.string().min(1).optional(), model: z.string().min(1).optional() }).strict();
export const speedOutputSchema = z.object({
  status: z.literal("ok"),
  observedAt: z.string().datetime({ offset: true }),
  protocol: speedProtocolSchema,
  observations: z.array(speedObservationSchema),
  note: z.string(),
}).strict();

export function runSpeed(rawInput: z.input<typeof speedInputSchema>): z.infer<typeof speedOutputSchema> {
  const input = speedInputSchema.parse(rawInput);
  const observedAt = new Date().toISOString();
  const observations = [
    publishedSpeed({ provider: "cerebras", model: "gpt-oss-120b", sustainedTps: "3000", sourceUrl: "https://www.cerebras.ai/pricing", observedAt, attribution: "Cerebras Developer Tier Pricing", note: "Published approximate throughput claim; not measured by this package." }),
    historicalMeasuredSpeed(),
    publishedSpeed({ provider: "groq", model: "gpt-oss-120b", sustainedTps: "8000", sourceUrl: "https://groq.com/", observedAt, attribution: "Groq published limit", note: "Published ceiling; not a measurement and not a caller quota." }),
  ];
  if (input.provider !== undefined) {
    const filtered = observations.filter((row) => row.provider === input.provider && (input.model === undefined || row.model === input.model));
    if (filtered.length === 0) filtered.push(unknownSpeed(input.provider, input.model ?? "unknown", observedAt, "No published or measured observation is retained for this provider/model."));
    return speedOutputSchema.parse({ status: "ok", observedAt, protocol: { prompt: "fixed prompt supplied to the probe runner", maxTokens: 700, stream: true, requestedRuns: 4, discardedRuns: 1, retainedRuns: 3, statistics: "median_and_range_of_remaining_three" }, observations: filtered, note: "No live inference call is made by this metadata tool. Run probeSpeed with provider credentials to add measured observations; absent measurements remain unknown." });
  }
  return speedOutputSchema.parse({ status: "ok", observedAt, protocol: { prompt: "fixed prompt supplied to the probe runner", maxTokens: 700, stream: true, requestedRuns: 4, discardedRuns: 1, retainedRuns: 3, statistics: "median_and_range_of_remaining_three" }, observations, note: "No live inference call is made by this metadata tool. Run probeSpeed with provider credentials to add measured observations; absent measurements remain unknown." });
}

export function registerSpeed(server: McpServer): void {
  server.registerTool("dashboard_speed", { title: "Provider speed claims and probe protocol", description: "Show attributed published speed claims and the exact four-run streaming probe protocol. Published values are not measurements; a live probe must record TTFT, sustained tokens per second, prompt hash, token count, timestamp and fixed vantage point. Unknown stays unknown.", inputSchema: speedInputSchema, outputSchema: speedOutputSchema, annotations: READ_ONLY_TOOL_ANNOTATIONS }, async (input) => toolResult(runSpeed(input)));
}

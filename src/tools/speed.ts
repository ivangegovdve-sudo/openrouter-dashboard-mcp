import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { historicalMeasuredSpeed, speedObservationSchema, speedProtocolSchema, unknownSpeed } from "../speed.js";
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
    // WAS A PUBLISHED CLAIM OF 3000 TOKENS/SECOND, ATTRIBUTED TO A PAGE THAT DOES NOT
    // CARRY IT. https://www.cerebras.ai/pricing was re-read on 2026-09-09: it states
    // "Up to 30x faster inference than GPU systems" and publishes no per-model
    // tokens/second figure at all. Attributing a specific rate to a named vendor from a
    // source that does not state it is a fabrication, so the rate is withdrawn rather
    // than re-dated. Unknown stays unknown, which is what this tool's own description
    // promises.
    unknownSpeed("cerebras", "gpt-oss-120b", "unknown", "No published tokens-per-second figure was established for this model. https://www.cerebras.ai/pricing, read 2026-09-09, carries only the general claim \"Up to 30x faster inference than GPU systems\" and no per-model rate. A previous release published 3000 tokens/second against this URL; the page does not support it and it has been withdrawn."),
    historicalMeasuredSpeed(),
    // WAS 8000 TOKENS/SECOND. THAT NUMBER IS GROQ'S 8,000 TOKENS-PER-MINUTE FREE-PLAN
    // QUOTA READ AS A THROUGHPUT -- a 60x overstatement attributed to Groq by name.
    // src/providers/evidence.ts stores the same figure correctly as
    // `unit: "tokens/minute"` with the scope text "this is not tokens per second or an
    // inference-speed ceiling", and docs/provider-evidence-2026-09-08.md records that
    // the checked pages establish no such ceiling and that Groq's own model page states
    // 500 tokens/second. This file contradicted both.
    unknownSpeed("groq", "gpt-oss-120b", "unknown", "No published tokens-per-second ceiling was established for this model. The 8000 figure carried by an earlier build is Groq's free-plan quota of 8,000 tokens per MINUTE (see the rate_limit caveat in the provider registry), not a speed; https://console.groq.com/docs/models separately reports 500 tokens/second. Neither establishes a platform throughput ceiling, so none is published."),
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

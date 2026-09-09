import { createHash } from "node:crypto";
import { z } from "zod";

const decimalMeasurement = z.object({
  median: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/),
  min: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/),
  max: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/),
}).strict();

export const speedObservationSchema = z.object({
  state: z.enum(["measured", "published", "unknown"]),
  provider: z.string().min(1),
  model: z.string().min(1),
  observedAt: z.union([z.string().datetime({ offset: true }), z.literal("unknown")]),
  vantagePoint: z.string().min(1),
  promptHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  tokenCount: z.number().int().positive().nullable(),
  requestedRuns: z.literal(4),
  discardedRuns: z.literal(1),
  retainedRuns: z.literal(3),
  ttft_ms: decimalMeasurement.nullable(),
  sustained_tps: decimalMeasurement.nullable(),
  /**
   * Which tokens sustained_tps counted. Required, never optional: an
   * optional basis is omitted by exactly the producers who do not know it.
   * visible_output counts only tokens that reached content; billed_total
   * counts everything the provider charged for, including reasoning the
   * caller never sees. For a reasoning model the two differ by multiples.
   */
  token_basis: z.enum(["visible_output", "billed_total", "unknown"]),
  attribution: z.string().nullable(),
  sourceUrl: z.string().url().nullable(),
  note: z.string().nullable(),
}).strict().superRefine((value, context) => {
  if (value.state === "published" && value.attribution === null) context.addIssue({ code: "custom", message: "Published speed claims require attribution", path: ["attribution"] });
  if (value.state === "measured" && value.sourceUrl !== null) context.addIssue({ code: "custom", message: "Measured speed is ours and does not use a publisher source URL", path: ["sourceUrl"] });
  if (value.state === "unknown" && (value.ttft_ms !== null || value.sustained_tps !== null)) context.addIssue({ code: "custom", message: "Unknown speed cannot carry a numeric measurement", path: ["state"] });
  // A vendor claim may honestly have an unstated basis; that is the disclosure.
  // Our own measurement counted the tokens, so publishing the rate without
  // saying which ones is the defect this field exists to close.
  if (value.state === "measured" && value.sustained_tps !== null && value.token_basis === "unknown") context.addIssue({ code: "custom", message: "A measured rate must name the tokens it counted; we computed it, so the basis is known", path: ["token_basis"] });
});

export type SpeedObservation = z.infer<typeof speedObservationSchema>;

export const speedProtocolSchema = z.object({
  prompt: z.string().min(1),
  maxTokens: z.literal(700),
  stream: z.literal(true),
  requestedRuns: z.literal(4),
  discardedRuns: z.literal(1),
  retainedRuns: z.literal(3),
  statistics: z.literal("median_and_range_of_remaining_three"),
}).strict();

export function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt, "utf8").digest("hex");
}

function statistic(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return { median: String(sorted[1]!), min: String(sorted[0]!), max: String(sorted[2]!) };
}

export type SpeedRun = { ttftMs: number; outputTokens: number; elapsedMs: number };
export type SpeedInvoker = (request: { prompt: string; maxTokens: 700; stream: true }) => Promise<SpeedRun>;

export async function probeSpeed(args: {
  provider: string;
  model: string;
  prompt: string;
  vantagePoint: string;
  observedAt: string;
  invoke: SpeedInvoker;
}): Promise<SpeedObservation> {
  const runs: SpeedRun[] = [];
  for (let index = 0; index < 4; index += 1) runs.push(await args.invoke({ prompt: args.prompt, maxTokens: 700, stream: true }));
  const retained = runs.slice(1);
  return speedObservationSchema.parse({
    state: "measured", provider: args.provider, model: args.model, observedAt: args.observedAt,
    vantagePoint: args.vantagePoint, promptHash: promptHash(args.prompt), tokenCount: retained[1]!.outputTokens,
    token_basis: "visible_output",
    requestedRuns: 4, discardedRuns: 1, retainedRuns: 3,
    ttft_ms: statistic(retained.map((run) => run.ttftMs)),
    sustained_tps: statistic(retained.map((run) => run.outputTokens * 1000 / run.elapsedMs)),
    attribution: null, sourceUrl: null, note: "Streaming probe; the first run was discarded before calculating median and range.",
  });
}

export function unknownSpeed(provider: string, model: string, observedAt: string, note: string): SpeedObservation {
  return speedObservationSchema.parse({ state: "unknown", provider, model, observedAt, vantagePoint: "unknown", promptHash: null, tokenCount: null, token_basis: "unknown", requestedRuns: 4, discardedRuns: 1, retainedRuns: 3, ttft_ms: null, sustained_tps: null, attribution: null, sourceUrl: null, note });
}

export function publishedSpeed(args: {
  provider: string; model: string; sustainedTps: string; sourceUrl: string; observedAt: string; attribution: string; note: string;
}): SpeedObservation {
  return speedObservationSchema.parse({ state: "published", provider: args.provider, model: args.model, observedAt: args.observedAt, vantagePoint: "provider-published", promptHash: null, tokenCount: null, token_basis: "unknown", requestedRuns: 4, discardedRuns: 1, retainedRuns: 3, ttft_ms: null, sustained_tps: { median: args.sustainedTps, min: args.sustainedTps, max: args.sustainedTps }, attribution: args.attribution, sourceUrl: args.sourceUrl, note: args.note });
}

/**
 * Historical evidence retained from a 2026-08-28 real-call record. The record
 * gives three sustained rates but did not retain the exact timestamp, vantage
 * point, or prompt hash, so those fields stay explicitly unknown/null. It must
 * not be mistaken for a protocol-complete probe from this package.
 */
export function historicalMeasuredSpeed(): SpeedObservation {
  return speedObservationSchema.parse({
    state: "measured",
    provider: "cerebras",
    model: "gpt-oss-120b",
    observedAt: "unknown",
    vantagePoint: "unknown",
    promptHash: null,
    tokenCount: 700,
    requestedRuns: 4,
    discardedRuns: 1,
    retainedRuns: 3,
    ttft_ms: null,
    // The record's three rates were 867 / 1022 / 1108, but which tokens they
    // counted was never retained. A rate whose basis is unknown is not a
    // publishable rate, so it is not offered as one; the figures stay in the
    // note as history rather than being read as a measurement.
    sustained_tps: null,
    token_basis: "unknown",
    attribution: null,
    sourceUrl: null,
    note: "Historical real-call evidence dated 2026-08-28 recorded 867 / 1022 / 1108 sustained tokens per second. Exact time, vantage point, prompt hash and token basis were not retained, so no rate is published: for a reasoning model a visible-output rate and a billed-total rate differ by multiples, and which was measured is unknown. Not a protocol-complete probe from this package.",
  });
}

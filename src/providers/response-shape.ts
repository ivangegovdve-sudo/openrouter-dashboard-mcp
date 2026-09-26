import { z } from "zod";

/**
 * Where a chat model puts its words, as observed from real calls.
 *
 * A reasoning model on an OpenAI-compatible endpoint writes its thinking into
 * `message.reasoning_content` and its answer into `message.content`. With a
 * small `max_tokens` the whole budget can be spent thinking: the call returns
 * HTTP 200, bills every token, and `content` is an empty string (Sail's
 * Qwen3.6 returned null). On these providers `max_tokens` is therefore a
 * CORRECTNESS parameter, not a safety cap: too small and the answer is silently
 * missing, which a caller reading only `content` mistakes for a dead key.
 *
 * Measured on AkashML 2026-09-25: five of six models did this at
 * max_tokens=16, and GLM-5.3 spent a 6000-token budget on reasoning alone. The
 * same model answered a one-word prompt in 3 tokens earlier, so this module
 * reports every observation rather than a verdict.
 *
 * A catalogue flag saying a model "supports reasoning" is the provider's claim;
 * an observation is what a call returned. They are kept apart, and a model
 * nobody has called reports `measurement: "unmeasured"` with nulls, never a
 * default that reads as measured.
 */

/** A full timestamp for this build's own calls; a date alone for an operator report that gave none. */
const observedAtSchema = z.union([z.string().datetime({ offset: true }), z.iso.date()]);
const integerStringSchema = z.string().regex(/^(0|[1-9]\d*)$/);

export const responseShapeObservationSchema = z.object({
  observedAt: observedAtSchema,
  /** Absent means this build made the call. `operator_report` rows were measured by the operator and carry only what was reported. */
  origin: z.enum(["this_build", "operator_report"]).optional(),
  /**
   * short-answer: "Reply with exactly READY." one-word: "Reply with exactly one
   * word: ready" at temperature 0. long-essay: a ~2500-word technical history.
   */
  workload: z.enum(["short-answer", "one-word", "long-essay"]),
  temperature: z.string().optional(),
  /** Sail only: "default" when no completion window was sent, else the window named. */
  completionWindow: z.string().optional(),
  maxTokens: integerStringSchema,
  finishReason: z.string().nullable(),
  /** Characters of trimmed `message.content`; 0 is the silent-empty failure. */
  contentChars: z.number().int().nonnegative(),
  /** Null when the observation did not report it. */
  reasoningChars: z.number().int().nonnegative().nullable(),
  completionTokens: integerStringSchema,
  /** Wall-clock milliseconds for the whole request, from one vantage point (Bulgaria desktop). */
  latencyMs: integerStringSchema.optional(),
  /** Message fields present in the response, excluding role. */
  fields: z.array(z.string()).optional(),
}).strict();
export type ResponseShapeObservation = z.infer<typeof responseShapeObservationSchema>;

const laneSchema = z.object({
  kind: z.enum(["interactive", "batch"]),
  /** Provider-level latency reported by the operator, seconds. */
  providerLatencySeconds: z.object({ min: z.string(), max: z.string() }).strict(),
  basis: z.string().min(1),
}).strict();

export const responseShapeSchema = z.object({
  /** "unmeasured" when no call to this model has been observed; every derived field is then null or "unknown". */
  measurement: z.enum(["measured", "unmeasured"]),
  /** The provider's own catalogue flag, or null when it publishes none. */
  reasoningAdvertised: z.boolean().nullable(),
  /** The field reasoning text was observed in; null = observed calls carried none; "unknown" = never called. */
  reasoningField: z.union([z.literal("message.reasoning_content"), z.literal("unknown")]).nullable(),
  /**
   * Whether responses carry a `reasoning_content` field at all. "absent" means
   * every observation reported its fields and none had it: no reasoning tax.
   */
  reasoningContentField: z.enum(["present", "absent", "unknown"]),
  /** "unknown" until a call has been observed returning a non-empty answer there. */
  answerField: z.enum(["message.content", "unknown"]),
  /** Whether a billed 200 response with an empty answer has been observed for this model. */
  emptyContentObserved: z.enum(["observed", "not_observed", "unknown"]),
  /**
   * The smallest tested max_tokens that produced a complete short answer, and
   * the largest that did not. The true minimum lies between them: a bracket
   * from the budgets actually tried, not a guess. Null when unmeasured.
   */
  minViableBudget: z.object({
    lowestPassing: integerStringSchema.nullable(),
    highestFailing: integerStringSchema.nullable(),
    testedBudgets: z.array(integerStringSchema),
  }).strict().nullable(),
  observations: z.array(responseShapeObservationSchema),
  /**
   * Completion tokens spent on short calls that finished with an answer: the
   * budget the model actually needed, as an observed range. It varies per call
   * -- io.net GLM-5.3-Flash used 95, 218 and 217 on identical calls -- so set
   * max_tokens above max, with headroom, never at one global floor.
   */
  answerCompletionTokens: z.object({
    min: integerStringSchema,
    max: integerStringSchema,
    samples: z.number().int().positive(),
    workload: z.enum(["short-answer", "one-word"]),
  }).strict().nullable(),
  /** Observed request latency for this model, milliseconds; null when no timed call exists. */
  latencyMs: z.object({ min: integerStringSchema, max: integerStringSchema, samples: z.number().int().positive() }).strict().nullable(),
  /** Routing lane for the provider, or null where none has been established. */
  lane: laneSchema.nullable(),
  note: z.string().min(1),
}).strict();
export type ResponseShape = z.infer<typeof responseShapeSchema>;

/**
 * Provider latency lanes from the operator's 2026-09-26 measurements. Sail is
 * the cheap, slow lane: right for batch work nobody waits on (PR solver,
 * extraction, overnight sweeps), wrong for anything interactive.
 */
const LANES: Record<string, z.infer<typeof laneSchema>> = {
  sail: {
    kind: "batch",
    providerLatencySeconds: { min: "0.95", max: "2.37" },
    basis: "Operator-measured 2026-09-26: Sail 0.95-2.37 s against 0.57-0.91 s on AkashML and io.net. Per model it varies: this build saw 0.38-0.45 s for Gemma-4-31B-IT-NVFP4 and 1.8-2.4 s for DeepSeek-V4-Pro in the default window, and 8.3-9.4 s for Qwen3.6-35B-A3B, which accepts only the flex window. Route interactive calls elsewhere unless a model's own latencyMs says otherwise.",
  },
  akashml: {
    kind: "interactive",
    providerLatencySeconds: { min: "0.57", max: "0.90" },
    basis: "Operator-measured 2026-09-26 on short calls. Long generations take far longer.",
  },
  ionet: {
    kind: "interactive",
    providerLatencySeconds: { min: "0.64", max: "0.91" },
    basis: "Operator-measured 2026-09-26 on short calls. Long generations take far longer.",
  },
};

/** Per-model call requirements a caller must honour, from observed errors. */
const CALL_NOTES: Record<string, Record<string, string>> = {
  sail: {
    "Qwen/Qwen3.6-35B-A3B": "Sail rejects synchronous calls to this model with HTTP 400 unless metadata.completion_window is \"flex\" (measured 2026-09-26); with flex it answered in 8.3-9.4 s and returned content null, not \"\", when the budget ran out.",
  },
};

const AKASHML_OBSERVATIONS: Record<string, ResponseShapeObservation[]> = {
  "openai/gpt-oss-120b": [
    { observedAt: "2026-09-25T23:48:13.514Z", workload: "short-answer", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 55, completionTokens: "16" },
    { observedAt: "2026-09-25T23:48:18.126Z", workload: "short-answer", maxTokens: "2048", finishReason: "stop", contentChars: 5, reasoningChars: 119, completionTokens: "36" },
    { observedAt: "2026-09-25T23:34:50.862Z", workload: "long-essay", maxTokens: "6000", finishReason: "stop", contentChars: 25028, reasoningChars: 1053, completionTokens: "5249" },
  ],
  "zai-org/GLM-5.3": [
    { observedAt: "2026-09-25T23:48:14.484Z", workload: "short-answer", maxTokens: "16", finishReason: "stop", contentChars: 5, reasoningChars: 0, completionTokens: "3" },
    { observedAt: "2026-09-25T23:48:19.490Z", workload: "short-answer", maxTokens: "2048", finishReason: "stop", contentChars: 5, reasoningChars: 0, completionTokens: "3" },
    { observedAt: "2026-09-25T23:36:10.168Z", workload: "long-essay", maxTokens: "6000", finishReason: "length", contentChars: 0, reasoningChars: 23007, completionTokens: "6000" },
  ],
  "Qwen/Qwen3.8-27B": [
    { observedAt: "2026-09-25T23:48:14.936Z", workload: "short-answer", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 69, completionTokens: "16" },
    { observedAt: "2026-09-25T23:48:19.950Z", workload: "short-answer", maxTokens: "2048", finishReason: "stop", contentChars: 5, reasoningChars: 87, completionTokens: "24" },
    { observedAt: "2026-09-25T23:36:57.029Z", workload: "long-essay", maxTokens: "6000", finishReason: "stop", contentChars: 15221, reasoningChars: 1316, completionTokens: "3506" },
  ],
  "Qwen/Qwen3.6-35B-A3B": [
    { observedAt: "2026-09-25T23:48:15.534Z", workload: "short-answer", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 55, completionTokens: "16" },
    { observedAt: "2026-09-25T23:48:20.847Z", workload: "short-answer", maxTokens: "2048", finishReason: "stop", contentChars: 5, reasoningChars: 867, completionTokens: "222" },
    { observedAt: "2026-09-25T23:38:31.462Z", workload: "long-essay", maxTokens: "6000", finishReason: "length", contentChars: 8031, reasoningChars: 22215, completionTokens: "6000" },
  ],
  "openai/gpt-oss-20b": [
    { observedAt: "2026-09-25T23:48:15.914Z", workload: "short-answer", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 56, completionTokens: "16" },
    { observedAt: "2026-09-25T23:48:21.901Z", workload: "short-answer", maxTokens: "2048", finishReason: "stop", contentChars: 5, reasoningChars: 38, completionTokens: "19" },
    { observedAt: "2026-09-25T23:39:17.480Z", workload: "long-essay", maxTokens: "6000", finishReason: "stop", contentChars: 20561, reasoningChars: 1904, completionTokens: "4328" },
  ],
  "meta-llama/Llama-3.3-70B-Instruct": [
    { observedAt: "2026-09-25T23:48:17.217Z", workload: "short-answer", maxTokens: "16", finishReason: "stop", contentChars: 5, reasoningChars: 0, completionTokens: "2" },
    { observedAt: "2026-09-25T23:48:22.843Z", workload: "short-answer", maxTokens: "2048", finishReason: "stop", contentChars: 5, reasoningChars: 0, completionTokens: "2" },
    { observedAt: "2026-09-25T23:41:33.566Z", workload: "long-essay", maxTokens: "6000", finishReason: "stop", contentChars: 6581, reasoningChars: 0, completionTokens: "1283" },
  ],
};

/** Measured 2026-09-26 with a key; every message carried content, reasoning_content and refusal. */
const IONET_OBSERVATIONS: Record<string, ResponseShapeObservation[]> = {
  "zai-org/GLM-5.3-Flash": [
    { observedAt: "2026-09-26T07:10:07.017Z", workload: "short-answer", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 72, completionTokens: "16" },
    { observedAt: "2026-09-26T07:10:17.833Z", workload: "short-answer", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 425, completionTokens: "95" },
    { observedAt: "2026-09-26T07:10:26.874Z", workload: "short-answer", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 1060, completionTokens: "218" },
    { observedAt: "2026-09-26T07:10:31.576Z", workload: "short-answer", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 1010, completionTokens: "217" },
    { observedAt: "2026-09-26T07:12:21.890Z", workload: "short-answer", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 69, completionTokens: "16" },
    { observedAt: "2026-09-26T07:12:25.894Z", workload: "short-answer", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 73, completionTokens: "16" },
  ],
  "deepseek-ai/DeepSeek-V4.1-Flash": [
    { observedAt: "2026-09-26T07:10:08.606Z", workload: "short-answer", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 65, completionTokens: "16" },
    { observedAt: "2026-09-26T07:10:25.510Z", workload: "short-answer", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 136, completionTokens: "35" },
    { observedAt: "2026-09-26T07:10:30.127Z", workload: "short-answer", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 51, completionTokens: "16" },
    { observedAt: "2026-09-26T07:10:39.477Z", workload: "short-answer", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 124, completionTokens: "32" },
    { observedAt: "2026-09-26T07:12:22.642Z", workload: "short-answer", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 75, completionTokens: "16" },
    { observedAt: "2026-09-26T07:12:26.744Z", workload: "short-answer", maxTokens: "16", finishReason: "length", contentChars: 5, reasoningChars: 52, completionTokens: "16" },
  ],
  "Qwen/Qwen3.8-27B": [
    { observedAt: "2026-09-26T07:10:09.251Z", workload: "short-answer", maxTokens: "16", finishReason: "length", contentChars: 6, reasoningChars: 53, completionTokens: "16" },
    { observedAt: "2026-09-26T07:10:26.085Z", workload: "short-answer", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 88, completionTokens: "25" },
    { observedAt: "2026-09-26T07:10:30.637Z", workload: "short-answer", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 93, completionTokens: "26" },
    { observedAt: "2026-09-26T07:10:40.115Z", workload: "short-answer", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 97, completionTokens: "27" },
    { observedAt: "2026-09-26T07:12:23.440Z", workload: "short-answer", maxTokens: "16", finishReason: "length", contentChars: 6, reasoningChars: 53, completionTokens: "16" },
    { observedAt: "2026-09-26T07:12:27.274Z", workload: "short-answer", maxTokens: "16", finishReason: "stop", contentChars: 5, reasoningChars: 37, completionTokens: "13" },
  ],
};

/**
 * Sail, 2026-09-26. operator_report rows are the operator's probe (date only,
 * reasoning length not reported); this_build rows are this build's calls from
 * one Bulgarian vantage point, default completion window unless named.
 */
const SAIL_OBSERVATIONS: Record<string, ResponseShapeObservation[]> = {
  "moonshotai/Kimi-K2.6": [
    { observedAt: "2026-09-26T09:53:19.914Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 67, completionTokens: "16", latencyMs: "1290", fields: ["content","reasoning_content","refusal"] },
    { observedAt: "2026-09-26T09:53:21.206Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "64", finishReason: "stop", contentChars: 5, reasoningChars: 144, completionTokens: "37", latencyMs: "1177", fields: ["content","reasoning_content","refusal"] },
    { observedAt: "2026-09-26T09:53:22.383Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 141, completionTokens: "34", latencyMs: "1121", fields: ["content","reasoning_content","refusal"] },
  ],
  "moonshotai/Kimi-K3": [
    { observedAt: "2026-09-26T09:53:23.504Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 66, completionTokens: "16", latencyMs: "926", fields: ["content","reasoning_content","refusal"] },
    { observedAt: "2026-09-26T09:53:24.430Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "64", finishReason: "stop", contentChars: 5, reasoningChars: 148, completionTokens: "48", latencyMs: "1522", fields: ["content","reasoning_content","refusal"] },
    { observedAt: "2026-09-26T09:53:25.952Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 148, completionTokens: "48", latencyMs: "1902", fields: ["content","reasoning_content","refusal"] },
  ],
  "zai-org/GLM-5.3": [
    { observedAt: "2026-09-26T09:53:27.854Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 66, completionTokens: "16", latencyMs: "529", fields: ["content","reasoning_content","refusal"] },
    { observedAt: "2026-09-26T09:53:28.384Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "64", finishReason: "stop", contentChars: 5, reasoningChars: 157, completionTokens: "38", latencyMs: "668", fields: ["content","reasoning_content","refusal"] },
    { observedAt: "2026-09-26T09:53:29.052Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 157, completionTokens: "38", latencyMs: "730", fields: ["content","reasoning_content","refusal"] },
  ],
  "zai-org/GLM-5.3-Flash": [
    { observedAt: "2026-09-26", origin: "operator_report", workload: "one-word", temperature: "0", maxTokens: "16", finishReason: null, contentChars: 0, reasoningChars: null, completionTokens: "16", fields: ["content","reasoning_content","refusal"] },
    { observedAt: "2026-09-26", origin: "operator_report", workload: "one-word", temperature: "0", maxTokens: "256", finishReason: null, contentChars: 5, reasoningChars: null, completionTokens: "36", fields: ["content","reasoning_content","refusal"] },
  ],
  "deepseek-ai/DeepSeek-V4-Flash-0731": [
    { observedAt: "2026-09-26T09:53:29.782Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 59, completionTokens: "16", latencyMs: "722", fields: ["content","reasoning_content","refusal"] },
    { observedAt: "2026-09-26T09:53:30.504Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "64", finishReason: "stop", contentChars: 5, reasoningChars: 144, completionTokens: "42", latencyMs: "1176", fields: ["content","reasoning_content","refusal"] },
    { observedAt: "2026-09-26T09:53:31.680Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 153, completionTokens: "44", latencyMs: "1083", fields: ["content","reasoning_content","refusal"] },
  ],
  "deepseek-ai/DeepSeek-V4.1-Flash": [
    { observedAt: "2026-09-26", origin: "operator_report", workload: "one-word", temperature: "0", maxTokens: "16", finishReason: null, contentChars: 5, reasoningChars: null, completionTokens: "15", fields: ["content","reasoning_content","refusal"] },
  ],
  "deepseek-ai/DeepSeek-V4-Pro-0813": [
    { observedAt: "2026-09-26T09:53:32.763Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "16", finishReason: "stop", contentChars: 5, reasoningChars: 0, completionTokens: "2", latencyMs: "1814", fields: ["content","refusal"] },
    { observedAt: "2026-09-26T09:53:34.577Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "64", finishReason: "stop", contentChars: 5, reasoningChars: 0, completionTokens: "2", latencyMs: "2400", fields: ["content","refusal"] },
    { observedAt: "2026-09-26T09:53:36.977Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 0, completionTokens: "2", latencyMs: "1957", fields: ["content","refusal"] },
  ],
  "openai/gpt-oss-120b": [
    { observedAt: "2026-09-26", origin: "operator_report", workload: "one-word", temperature: "0", maxTokens: "16", finishReason: null, contentChars: 0, reasoningChars: null, completionTokens: "16", fields: ["content","reasoning_content","refusal"] },
    { observedAt: "2026-09-26", origin: "operator_report", workload: "one-word", temperature: "0", maxTokens: "256", finishReason: null, contentChars: 5, reasoningChars: null, completionTokens: "46", fields: ["content","reasoning_content","refusal"] },
  ],
  "google/gemma-4-31B-it": [
    { observedAt: "2026-09-26T09:53:38.934Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "16", finishReason: "stop", contentChars: 5, reasoningChars: 0, completionTokens: "2", latencyMs: "897", fields: ["content","refusal"] },
    { observedAt: "2026-09-26T09:53:39.832Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "64", finishReason: "stop", contentChars: 5, reasoningChars: 0, completionTokens: "2", latencyMs: "583", fields: ["content","refusal"] },
    { observedAt: "2026-09-26T09:53:40.415Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 0, completionTokens: "2", latencyMs: "569", fields: ["content","refusal"] },
  ],
  "google/gemma-4-12B-it": [
    { observedAt: "2026-09-26", origin: "operator_report", workload: "one-word", temperature: "0", maxTokens: "16", finishReason: null, contentChars: 5, reasoningChars: null, completionTokens: "2", fields: ["content","refusal"] },
  ],
  "nvidia/Gemma-4-31B-IT-NVFP4": [
    { observedAt: "2026-09-26T09:53:40.984Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "16", finishReason: "stop", contentChars: 5, reasoningChars: 0, completionTokens: "2", latencyMs: "450", fields: ["content","refusal"] },
    { observedAt: "2026-09-26T09:53:41.434Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "64", finishReason: "stop", contentChars: 5, reasoningChars: 0, completionTokens: "2", latencyMs: "442", fields: ["content","refusal"] },
    { observedAt: "2026-09-26T09:53:41.876Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "default", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 0, completionTokens: "2", latencyMs: "376", fields: ["content","refusal"] },
  ],
  "Qwen/Qwen3.6-35B-A3B": [
    { observedAt: "2026-09-26T09:55:28.463Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "flex", maxTokens: "16", finishReason: "length", contentChars: 0, reasoningChars: 55, completionTokens: "16", latencyMs: "8753", fields: ["content","reasoning_content","refusal"] },
    { observedAt: "2026-09-26T09:55:37.218Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "flex", maxTokens: "64", finishReason: "length", contentChars: 0, reasoningChars: 242, completionTokens: "64", latencyMs: "8545", fields: ["content","reasoning_content","refusal"] },
    { observedAt: "2026-09-26T09:55:45.763Z", origin: "this_build", workload: "one-word", temperature: "0", completionWindow: "flex", maxTokens: "256", finishReason: "stop", contentChars: 5, reasoningChars: 545, completionTokens: "144", latencyMs: "8269", fields: ["content","reasoning_content","refusal"] },
  ],
};

const OBSERVATIONS: Record<string, Record<string, ResponseShapeObservation[]>> = {
  akashml: AKASHML_OBSERVATIONS,
  ionet: IONET_OBSERVATIONS,
  sail: SAIL_OBSERVATIONS,
};

const SHORT_WORKLOADS = new Set(["short-answer", "one-word"]);

function range(values: bigint[]): { min: string; max: string; samples: number } | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return { min: String(sorted[0]), max: String(sorted[sorted.length - 1]), samples: sorted.length };
}

/** A complete answer: non-empty content, and not cut off by the budget. */
function answered(item: ResponseShapeObservation): boolean {
  return item.contentChars > 0 && item.finishReason !== "length";
}

function answerCompletionTokens(observations: ResponseShapeObservation[]): ResponseShape["answerCompletionTokens"] {
  const short = observations.filter((item) => SHORT_WORKLOADS.has(item.workload) && answered(item));
  const r = range(short.map((item) => BigInt(item.completionTokens)));
  if (!r) return null;
  return { ...r, workload: short.some((item) => item.workload === "one-word") ? "one-word" : "short-answer" };
}

function minViableBudget(observations: ResponseShapeObservation[]): ResponseShape["minViableBudget"] {
  const short = observations.filter((item) => SHORT_WORKLOADS.has(item.workload));
  if (short.length === 0) return null;
  const budgets = [...new Set(short.map((item) => BigInt(item.maxTokens)))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  // A budget passes only if every call at it answered: one empty call at a
  // budget means that budget is not safe, whatever the other calls did.
  const passing = budgets.filter((budget) => short.filter((item) => BigInt(item.maxTokens) === budget).every(answered));
  const failing = budgets.filter((budget) => !passing.includes(budget));
  const lowestPassing = passing.find((budget) => !failing.some((fail) => fail > budget)) ?? null;
  return {
    lowestPassing: lowestPassing === null ? null : String(lowestPassing),
    highestFailing: failing.length ? String(failing[failing.length - 1]) : null,
    testedBudgets: budgets.map(String),
  };
}

function reasoningContentField(observations: ResponseShapeObservation[]): ResponseShape["reasoningContentField"] {
  if (observations.some((item) => item.fields?.includes("reasoning_content") || (item.reasoningChars ?? 0) > 0)) return "present";
  if (observations.length > 0 && observations.every((item) => item.fields !== undefined)) return "absent";
  return "unknown";
}

/**
 * The response shape for one catalogue row. `reasoningAdvertised` comes from
 * the live catalogue; everything else from dated observations in this build.
 */
export function responseShapeFor(provider: string, modelId: string, reasoningAdvertised: boolean | null): ResponseShape {
  const observations = OBSERVATIONS[provider]?.[modelId] ?? [];
  const lane = LANES[provider] ?? null;
  const callNote = CALL_NOTES[provider]?.[modelId];
  if (observations.length === 0) {
    return responseShapeSchema.parse({
      measurement: "unmeasured",
      reasoningAdvertised,
      reasoningField: "unknown",
      reasoningContentField: "unknown",
      answerField: "unknown",
      emptyContentObserved: "unknown",
      minViableBudget: null,
      observations: [],
      answerCompletionTokens: null,
      latencyMs: null,
      lane,
      note: reasoningAdvertised
        ? "The provider advertises reasoning for this model, and no call has been observed by this build. A reasoning model can spend a small max_tokens budget entirely on reasoning and return an empty message.content while billing every token; size max_tokens with headroom and check content, not the HTTP status."
        : "No call to this model has been observed by this build, so where it writes its answer, and the budget it needs, are unknown.",
    });
  }
  const reasoned = observations.some((item) => (item.reasoningChars ?? 0) > 0 || item.fields?.includes("reasoning_content"));
  const empty = observations.some((item) => item.contentChars === 0);
  const budget = answerCompletionTokens(observations);
  const timed = observations.filter((item) => item.latencyMs !== undefined).map((item) => BigInt(item.latencyMs!));
  const fieldState = reasoningContentField(observations);
  const baseNote = empty
    ? `Observed returning HTTP 200 with an empty message.content while billing tokens: reasoning text went to message.reasoning_content and the max_tokens budget ran out before an answer. ${budget ? `A short answer took ${budget.min} to ${budget.max} completion tokens across ${budget.samples} observed calls when it did arrive.` : "No observed call produced an answer."} max_tokens is a correctness parameter here: give this model headroom above that and treat empty content as a failed call.`
    : fieldState === "absent"
      ? "No reasoning_content field in any observed response, and the answer arrived in the first few tokens: no reasoning tax on short calls. A small sample, not a guarantee."
      : reasoned
        ? "Reasoning text was observed in message.reasoning_content alongside a non-empty answer in every observed call. That is a small sample, not a guarantee."
        : "Every observed call answered in message.content with no reasoning text. That is a small sample, not a guarantee.";
  return responseShapeSchema.parse({
    measurement: "measured",
    reasoningAdvertised,
    reasoningField: reasoned ? "message.reasoning_content" : null,
    reasoningContentField: fieldState,
    answerField: observations.some((item) => item.contentChars > 0) ? "message.content" : "unknown",
    emptyContentObserved: empty ? "observed" : "not_observed",
    minViableBudget: minViableBudget(observations),
    observations,
    answerCompletionTokens: budget,
    latencyMs: range(timed),
    lane,
    note: callNote ? `${baseNote} ${callNote}` : baseNote,
  });
}

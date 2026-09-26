import { z } from "zod";

/**
 * Where a chat model puts its words, as observed from real calls.
 *
 * A reasoning model on an OpenAI-compatible endpoint writes its thinking into
 * `message.reasoning_content` and its answer into `message.content`. With a
 * small `max_tokens` the whole budget can be spent thinking: the call returns
 * HTTP 200, bills every token, and `content` is an empty string. Measured on
 * AkashML 2026-09-25: five of six models did exactly that at max_tokens=16,
 * and GLM-5.3 spent a 6000-token budget on reasoning alone -- the dearest call
 * of the run, with nothing usable in it.
 *
 * The same model is not consistent about it. GLM-5.3 answered a one-word
 * prompt in 3 tokens with no reasoning twice, then reasoned for 6000 tokens on
 * an essay. So this module reports every observation rather than a verdict: a
 * clean short probe does not certify a model as safe on a long task.
 *
 * A catalogue flag saying a model "supports reasoning" is the provider's claim;
 * an observation is what a call returned. They are kept apart.
 */

const observedAtSchema = z.string().datetime({ offset: true });
const integerStringSchema = z.string().regex(/^(0|[1-9]\d*)$/);

export const responseShapeObservationSchema = z.object({
  observedAt: observedAtSchema,
  /** short-answer: "Reply with exactly READY."; long-essay: a ~2500-word technical history. */
  workload: z.enum(["short-answer", "long-essay"]),
  maxTokens: integerStringSchema,
  finishReason: z.string().nullable(),
  /** Characters of trimmed `message.content`; 0 is the silent-empty failure. */
  contentChars: z.number().int().nonnegative(),
  reasoningChars: z.number().int().nonnegative(),
  completionTokens: integerStringSchema,
}).strict();
export type ResponseShapeObservation = z.infer<typeof responseShapeObservationSchema>;

export const responseShapeSchema = z.object({
  /** The provider's own catalogue flag, or null when it publishes none. */
  reasoningAdvertised: z.boolean().nullable(),
  /** The field reasoning text was observed in; null = observed calls carried none; "unknown" = never called. */
  reasoningField: z.union([z.literal("message.reasoning_content"), z.literal("unknown")]).nullable(),
  /** "unknown" until a call has been observed returning a non-empty answer there. */
  answerField: z.enum(["message.content", "unknown"]),
  /** Whether a billed 200 response with an empty answer has been observed for this model. */
  emptyContentObserved: z.enum(["observed", "not_observed", "unknown"]),
  observations: z.array(responseShapeObservationSchema),
  /**
   * Completion tokens spent on short-answer calls that finished with an answer:
   * the budget the model actually needed, as an observed range. It varies per
   * call -- io.net GLM-5.3-Flash used 95, 218 and 217 on identical calls -- so
   * set max_tokens above max, with headroom, never at one global floor. Null
   * when no such call has been observed.
   */
  answerCompletionTokens: z.object({
    min: integerStringSchema,
    max: integerStringSchema,
    samples: z.number().int().positive(),
    workload: z.literal("short-answer"),
  }).strict().nullable(),
  note: z.string().min(1),
}).strict();
export type ResponseShape = z.infer<typeof responseShapeSchema>;

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

const OBSERVATIONS: Record<string, Record<string, ResponseShapeObservation[]>> = {
  akashml: AKASHML_OBSERVATIONS,
  ionet: IONET_OBSERVATIONS,
};

function answerCompletionTokens(observations: ResponseShapeObservation[]): ResponseShape["answerCompletionTokens"] {
  const answered = observations
    .filter((item) => item.workload === "short-answer" && item.finishReason === "stop" && item.contentChars > 0)
    .map((item) => BigInt(item.completionTokens))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (answered.length === 0) return null;
  return { min: String(answered[0]), max: String(answered[answered.length - 1]), samples: answered.length, workload: "short-answer" };
}

/**
 * The response shape for one catalogue row. `reasoningAdvertised` comes from
 * the live catalogue; everything else from dated observations in this build.
 */
export function responseShapeFor(provider: string, modelId: string, reasoningAdvertised: boolean | null): ResponseShape {
  const observations = OBSERVATIONS[provider]?.[modelId] ?? [];
  if (observations.length === 0) {
    return responseShapeSchema.parse({
      reasoningAdvertised,
      reasoningField: "unknown",
      answerField: "unknown",
      emptyContentObserved: "unknown",
      observations: [],
      answerCompletionTokens: null,
      note: reasoningAdvertised
        ? "The provider advertises reasoning for this model, and no call has been observed by this build. A reasoning model can spend a small max_tokens budget entirely on reasoning and return an empty message.content while billing every token; size max_tokens with headroom and check content, not the HTTP status."
        : "No call to this model has been observed by this build, so where it writes its answer is unknown.",
    });
  }
  const reasoned = observations.some((item) => item.reasoningChars > 0);
  const empty = observations.some((item) => item.contentChars === 0);
  const budget = answerCompletionTokens(observations);
  return responseShapeSchema.parse({
    reasoningAdvertised,
    reasoningField: reasoned ? "message.reasoning_content" : null,
    answerField: observations.some((item) => item.contentChars > 0) ? "message.content" : "unknown",
    emptyContentObserved: empty ? "observed" : "not_observed",
    observations,
    answerCompletionTokens: budget,
    note: empty
      ? `Observed returning HTTP 200 with an empty message.content while billing tokens: reasoning text went to message.reasoning_content and the max_tokens budget ran out before an answer. ${budget ? `A one-word answer took ${budget.min} to ${budget.max} completion tokens across ${budget.samples} observed calls when it did arrive.` : "No observed call produced an answer."} Give reasoning models generous max_tokens and treat empty content as a failed call.`
      : reasoned
        ? "Reasoning text was observed in message.reasoning_content alongside a non-empty answer in every observed call. That is a small sample, not a guarantee."
        : "Every observed call answered in message.content with no reasoning text. That is a small sample, not a guarantee.",
  });
}

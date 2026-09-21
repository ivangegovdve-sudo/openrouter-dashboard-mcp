import { z } from "zod";

const dateTime = z.string().datetime({ offset: true });
const integerString = z.string().regex(/^(0|[1-9]\d*)$/);
const decimalString = z.string().regex(/^(0|[1-9]\d*)(?:\.\d+)?$/);

const basketEntrySchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    modality: z.enum(["text", "image", "video", "audio", "unknown"]),
    liveCheck: z
      .object({
        state: z.enum(["observed", "unknown"]),
        observedAt: dateTime,
        source: z.string().url(),
        note: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const workloadSchema = z
  .object({
    id: z.literal("short-answer-v1"),
    prompt: z.string().min(1),
    promptHash: z.string().regex(/^[a-f0-9]{64}$/),
    requestedOutputTokens: integerString,
    inputTokens: integerString.nullable(),
    maxOutputTokens: integerString,
    sampleSize: z.literal(8),
    metrics: z.array(z.enum(["ttft_ms", "round_trip_ms"])).min(1),
    tailPolicy: z.literal("max_of_n"),
    p95Policy: z.literal("withheld_at_n_8"),
    note: z.string().min(1),
  })
  .strict();

const vantagePointSchema = z
  .object({
    id: z.enum(["bulgaria-desktop", "kvm2-europe", "oracle-us"]),
    label: z.string().min(1),
    region: z.string().min(1),
    state: z.enum(["ready", "blocked"]),
    note: z.string().min(1),
  })
  .strict();

const costPlanSchema = z
  .object({
    state: z.literal("PUBLISHED_ESTIMATE"),
    estimateUsd: decimalString,
    coverage: z.enum(["lower_bound", "complete"]),
    callsPerWeek: z.number().int().positive(),
    pricedBasketRows: z.number().int().nonnegative(),
    unknownBasketRows: z.number().int().nonnegative(),
    basis: z.string().min(1),
    measuredReplacement: z.string().min(1),
  })
  .strict();

const snapshotPlanSchema = z
  .object({
    state: z.literal("BLOCKED"),
    format: z.literal("signed-json"),
    requiredFields: z.array(z.string().min(1)).min(1),
    reason: z.string().min(1),
  })
  .strict();

export const measurementManifestSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    id: z.literal("open-dashboard-weekly-measurements"),
    version: z.literal("basket-v1"),
    status: z.literal("locked"),
    lockedAt: dateTime,
    basket: z.array(basketEntrySchema).length(8),
    workload: workloadSchema,
    vantagePoints: z.array(vantagePointSchema).length(3),
    weeklyCost: costPlanSchema,
    resultSnapshots: snapshotPlanSchema,
    notes: z.array(z.string().min(1)),
  })
  .strict();

export type MeasurementManifest = z.infer<typeof measurementManifestSchema>;

const LIVE_MODELS_SOURCE = "https://openrouter-github-dashboard.vercel.app/api/public/v2/live-models";
const LOCKED_CHECKED_AT = "2026-09-17T06:10:56.623Z";

/**
 * The basket is deliberately versioned and boring. A retired ID requires a
 * new version; refreshing the catalogue must never silently rewrite a trend.
 * The live-check timestamp is from the dated catalogue snapshot used by the
 * explorer and does not claim that inference was exercised.
 */
export const WEEKLY_MEASUREMENT_MANIFEST: MeasurementManifest = measurementManifestSchema.parse({
  schemaVersion: "1.0",
  id: "open-dashboard-weekly-measurements",
  version: "basket-v1",
  status: "locked",
  lockedAt: "2026-09-20T00:00:00.000Z",
  basket: [
    ["openrouter", "openai/gpt-oss-120b", "text"],
    ["groq", "openai/gpt-oss-120b", "text"],
    ["cerebras", "gpt-oss-120b", "text"],
    ["deepinfra", "openai/gpt-oss-120b", "text"],
    ["novita", "openai/gpt-oss-120b", "text"],
    ["sambanova", "gpt-oss-120b", "text"],
    ["qwencloud", "deepseek-v3.2", "text"],
    ["chutes", "Qwen/Qwen3-32B-TEE", "text"],
  ].map(([provider, model, modality]) => ({
    provider,
    model,
    modality,
    liveCheck: {
      state: "observed",
      observedAt: LOCKED_CHECKED_AT,
      source: LIVE_MODELS_SOURCE,
      note: "The ID was present in the dated live-model snapshot; this is catalogue evidence, not an inference result.",
    },
  })),
  workload: {
    id: "short-answer-v1",
    prompt: "Reply with exactly READY.",
    promptHash: "85c84eca54af29002c1fe79488bdfefe2b43e6f051bc6e951354a5e86be259cd",
    requestedOutputTokens: "8",
    inputTokens: null,
    maxOutputTokens: "8",
    sampleSize: 8,
    metrics: ["ttft_ms", "round_trip_ms"],
    tailPolicy: "max_of_n",
    p95Policy: "withheld_at_n_8",
    note: "n=8 is retained for a nearly-free weekly check. Report p50 and max-of-8; do not label the maximum as p95.",
  },
  vantagePoints: [
    {
      id: "bulgaria-desktop",
      label: "Ivan desktop in Bulgaria",
      region: "Bulgaria",
      state: "blocked",
      note: "Waiting for a signed result snapshot produced on this machine; a Vercel cron cannot claim this vantage point.",
    },
    {
      id: "kvm2-europe",
      label: "KVM2 in Europe",
      region: "Europe",
      state: "blocked",
      note: "Waiting for a signed result snapshot produced on this machine; no pooled regional average is allowed.",
    },
    {
      id: "oracle-us",
      label: "Oracle in the US",
      region: "United States",
      state: "blocked",
      note: "Waiting for a signed result snapshot produced on this machine; no pooled regional average is allowed.",
    },
  ],
  weeklyCost: {
    state: "PUBLISHED_ESTIMATE",
    estimateUsd: "0.000493392",
    coverage: "lower_bound",
    callsPerWeek: 192,
    pricedBasketRows: 6,
    unknownBasketRows: 2,
    basis: "Published catalogue arithmetic for 8 models × 3 vantage points × n=8, with a 5-token input and 8-token output budget. Two basket rows have no readable catalogue token pair, so the estimate is a lower bound and the ceiling is UNKNOWN.",
    measuredReplacement: "After the first signed run, replace this estimate with the measured provider charge and label it MEASURED.",
  },
  resultSnapshots: {
    state: "BLOCKED",
    format: "signed-json",
    requiredFields: [
      "manifestVersion",
      "runId",
      "observedAt",
      "vantagePoint",
      "workload",
      "rows",
      "payloadSha256",
      "signature",
    ],
    reason: "No signed weekly result snapshot has been produced yet. Until each vantage point publishes one, latency and measured cost remain UNKNOWN.",
  },
  notes: [
    "This manifest measures a fixed text workload; it does not claim that a catalogue row is callable.",
    "The separate Nous catalogue is read-only. Inference through Nous is unverified and no Nous generation cost is included.",
    "Existing published observations remain provenance-labelled; a catalogue rate never becomes a measured charge.",
  ],
});

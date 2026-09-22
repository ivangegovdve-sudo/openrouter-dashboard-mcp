import { z } from "zod";

const observedDateSchema = z.iso.date();
const sourceUrlSchema = z.url().refine((url) => url.startsWith("https://"), "Evidence requires HTTPS");
const oneLineSchema = z.string().min(1).refine((value) => !/[\r\n]/.test(value), "Use one verbatim line");

export const providerPitchSchema = z.object({
  text: oneLineSchema,
  attribution: z.string().min(1),
  sourceUrl: sourceUrlSchema,
  observedAt: observedDateSchema,
}).strict();

/** Publication observed on a provider page; this does not claim a benchmark run. */
export const providerCaveatSchema = z.object({
  kind: z.enum(["rate_limit", "concurrency_limit", "context_limit", "output_limit", "request_size_limit", "trial_expiry", "other_measured_limit"]),
  value: z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, "Use an exact nonnegative decimal, not a float or exponent"),
  unit: z.string().min(1),
  scope: z.string().min(1),
  sourceUrl: sourceUrlSchema,
  observedAt: observedDateSchema,
  basis: z.literal("provider_published"),
}).strict();

const checkedResearchShape = {
  checkedSources: z.array(sourceUrlSchema).min(1),
  observedAt: observedDateSchema,
  scope: z.string().min(1),
};

/** Failing to find a fact in checked pages is not proof that it is unpublished. */
export const providerResearchSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("not_researched") }).strict(),
  z.object({ status: z.literal("published"), ...checkedResearchShape }).strict(),
  z.object({ status: z.literal("not_found_in_checked_sources"), ...checkedResearchShape }).strict(),
  z.object({
    status: z.literal("not_published"),
    ...checkedResearchShape,
    // Reserve this stronger state for an explicit provider statement of absence.
    providerStatement: providerPitchSchema,
  }).strict(),
]);

export const providerEvidenceShape = {
  caveats: z.array(providerCaveatSchema).min(1).optional(),
  caveatResearch: providerResearchSchema,
  pitch: providerPitchSchema.optional(),
  pitchResearch: providerResearchSchema,
};

export const providerEvidenceSchema = z.object(providerEvidenceShape).strict().superRefine((value, ctx) => {
  for (const [fact, research] of [["pitch", "pitchResearch"], ["caveats", "caveatResearch"]] as const) {
    if ((value[fact] !== undefined) !== (value[research].status === "published")) {
      ctx.addIssue({ code: "custom", path: [fact], message: "Published evidence must be present; absent or unresearched evidence must be omitted" });
    }
  }
});

export type ProviderEvidence = z.infer<typeof providerEvidenceSchema>;
export type ProviderCaveat = z.infer<typeof providerCaveatSchema>;
export type ProviderPitch = z.infer<typeof providerPitchSchema>;

const observedAt = "2026-09-08";
const quotes: Record<string, { text: string; attribution: string; sourceUrl: string }> = {
  openrouter: { text: "The Unified Interface For Every Model", attribution: "OpenRouter", sourceUrl: "https://openrouter.ai/" },
  groq: { text: "Groq makes inference work at scale.", attribution: "Groq", sourceUrl: "https://groq.com/" },
  cerebras: { text: "Build Products that Others Can't", attribution: "Cerebras", sourceUrl: "https://www.cerebras.ai/" },
  sail: { text: "Sail is the most cost-efficient API for the best open-source models.", attribution: "Sail Research", sourceUrl: "https://www.sailresearch.com/" },
  nous: { text: "Published API rate: $0.072/M", attribution: "Nous Research published pricing claim", sourceUrl: "https://nousresearch.com/" },
  qwencloud: { text: "Foundation for AI Innovation", attribution: "Alibaba Cloud Model Studio", sourceUrl: "https://modelstudio.alibabacloud.com/" },
  deepinfra: { text: "Accelerate your AI with developer-friendly APIs designed for performance and cost-efficiency.", attribution: "DeepInfra", sourceUrl: "https://deepinfra.com/" },
  novita: { text: "Run models, scale GPUs, and build AI agents, all on one platform.", attribution: "Novita AI", sourceUrl: "https://novita.ai/" },
  sambanova: { text: "The fastest AI inference on the largest models", attribution: "SambaNova, SambaCloud", sourceUrl: "https://sambanova.ai/products/sambacloud" },
  chutes: { text: "Breakthrough Serverless Compute for AI, at Scale.", attribution: "Chutes", sourceUrl: "https://chutes.ai/" },
  wavespeed: { text: "WaveSpeedAI is the ultimate AI media generation platform — easy to use, affordable, scalable, and fast.", attribution: "WaveSpeedAI", sourceUrl: "https://wavespeed.ai/" },
  fal: { text: "The generative media platform powering the world’s top AI apps.", attribution: "fal", sourceUrl: "https://fal.ai/docs/documentation" },
  crazyrouter: { text: "Same OpenAI-style workflow. More models. Lower pricing. Easier experimentation.", attribution: "Crazyrouter", sourceUrl: "https://crazyrouter.com/tools/" },
  higgsfield: { text: "Pricing plans for Higgsfield's image, video and audio tools.", attribution: "Higgsfield public pricing page", sourceUrl: "https://higgsfield.ai/pricing" },
};

const numericCaveats: Record<string, ProviderCaveat[]> = {
  openrouter: [{
    kind: "rate_limit", value: "20", unit: "requests/minute",
    scope: "Free model variants (IDs ending in :free), regardless of account status; paid variants are outside this limit. This is the published platform quota, not the caller's remaining allowance.",
    sourceUrl: "https://openrouter.ai/docs/api_reference/limits", observedAt, basis: "provider_published",
  }],
  groq: [{
    kind: "rate_limit", value: "8000", unit: "tokens/minute",
    scope: "Free Plan summary, openai/gpt-oss-120b, organization-level combined token quota. Cached tokens are excluded. Exact organization limits can differ; this is not tokens per second or an inference-speed ceiling.",
    sourceUrl: "https://console.groq.com/docs/rate-limits", observedAt, basis: "provider_published",
  }],
  cerebras: [{
    kind: "trial_expiry", value: "30", unit: "days",
    scope: "Free Trial credits expire 30 days after they are granted. This is the published trial policy, not this caller's credit balance or expiry date.",
    sourceUrl: "https://inference-docs.cerebras.ai/support/rate-limits", observedAt, basis: "provider_published",
  }],
  deepinfra: [{
    kind: "concurrency_limit", value: "200", unit: "concurrent_requests",
    scope: "Default account limit per model; not requests per minute. An account can request a higher limit, and a busy model can still return 429 below the default.",
    sourceUrl: "https://docs.deepinfra.com/account/rate-limits", observedAt, basis: "provider_published",
  }],
};

export function providerEvidence(id: string): ProviderEvidence {
  const quote = Object.hasOwn(quotes, id) ? quotes[id] : undefined;
  if (!quote) return { caveatResearch: { status: "not_researched" }, pitchResearch: { status: "not_researched" } };
  const caveats = numericCaveats[id];
  const evidenceObservedAt = id === "nous" ? "2026-09-11" : observedAt;
  return providerEvidenceSchema.parse({
    pitch: { ...quote, observedAt: evidenceObservedAt },
    pitchResearch: {
      status: "published", observedAt: evidenceObservedAt, checkedSources: [quote.sourceUrl],
      scope: "Provider-owned platform marketing copy; quoted as a provider claim, not endorsed as a comparison result.",
    },
    ...(caveats ? { caveats } : {}),
    caveatResearch: {
      status: caveats ? "published" : "not_found_in_checked_sources",
      observedAt: evidenceObservedAt,
      checkedSources: caveats ? [...new Set(caveats.map((caveat) => caveat.sourceUrl))] : [quote.sourceUrl],
      scope: caveats
        ? "Only the numeric policies listed in caveats were checked. No inference benchmark or account-specific limit was measured."
        : "No numeric operating limit was established from this checked platform page. This limited check does not establish that the provider publishes none elsewhere.",
    },
  });
}

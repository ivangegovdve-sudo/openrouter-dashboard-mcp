import { z } from "zod";
import { providerEvidence, providerEvidenceShape } from "./evidence.js";
import type { CostState } from "../generation-cost.js";

/**
 * The provider layer of the Open Dashboard.
 *
 * OpenRouter ships its own MCP server, and it is single-vendor by construction —
 * which makes it unable to answer the only question worth asking here: of the
 * providers I actually hold keys with, which is the cheapest capable option right
 * now. Answering that means putting three catalogues that disagree about almost
 * everything into one comparable shape.
 *
 * The catalogues are not equally forthcoming, and pretending otherwise is the
 * failure mode this module exists to prevent. Measured 2026-08-27 against the
 * deployed dashboard:
 *
 *   openrouter  500+ models  495 priced  500 with context  500 with modality
 *   groq         13 models     8 priced   13 with context   13 with modality
 *   cerebras      2 models     0 priced    0 with context    0 with modality
 *
 * A ranking that silently drops the unpriced rows answers a narrower question
 * than the caller asked. So every capability a provider does not publish is
 * declared here, once, and the tools cite this registry when they report a null.
 * A null price then identifies the limits of the collected source rather than
 * implying that the provider publishes nothing elsewhere or that the model is free.
 *
 * Adding a provider is a new entry in PROVIDER_REGISTRY plus its id in
 * providerIdSchema. Nothing else in this server enumerates providers.
 *
 * ⚠ THIS LIST IS NOT THE SERVER'S CONTRACT WITH THE API. The dashboard can add
 * a provider at any time, and on 2026-09-08 it did: five arrived at once and
 * every live-model response stopped parsing, because the RESPONSE schema was a
 * closed enum too. A client that fails closed on an unrecognised provider
 * breaks the moment the server it talks to gets newer than it. So the response
 * schema accepts any provider id, and this registry describes the ones it
 * knows -- see `describeProvider`, which answers honestly for the rest.
 */

export const providerIdSchema = z.enum([
  "openrouter",
  "groq",
  "cerebras",
  "sail",
  "nous",
  "qwencloud",
  "deepinfra",
  "novita",
  "sambanova",
  "chutes",
  "wavespeed",
  "fal",
  "crazyrouter",
  "akashml",
  "ionet",
  "kie",
  "higgsfield",
]);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const GENERATION_COST_POLICY: Record<ProviderId, { state: CostState; note: string }> = {
  openrouter: { state: "MEASURED", note: "OpenRouter exposes an authoritative per-generation cost field in the response usage object." },
  sail: { state: "BLOCKED", note: "Sail exposes no per-generation cost endpoint; balance divided by runs is DERIVED, not a call cost." },
  nous: { state: "BLOCKED", note: "Nous has no reachable balance, credits, usage, or per-generation cost endpoint; its published rate is unverifiable." },
  groq: { state: "UNKNOWN", note: "No authoritative per-generation cost field is collected by this integration." },
  cerebras: { state: "UNKNOWN", note: "No authoritative per-generation cost field is collected by this integration." },
  qwencloud: { state: "UNKNOWN", note: "No authoritative per-generation cost field is collected by this integration." },
  deepinfra: { state: "UNKNOWN", note: "No authoritative per-generation cost field is collected by this integration." },
  novita: { state: "UNKNOWN", note: "No authoritative per-generation cost field is collected by this integration." },
  sambanova: { state: "UNKNOWN", note: "No authoritative per-generation cost field is collected by this integration." },
  chutes: { state: "UNKNOWN", note: "No authoritative per-generation cost field is collected by this integration." },
  wavespeed: { state: "UNKNOWN", note: "No authoritative per-generation cost field is collected by this integration." },
  fal: { state: "UNKNOWN", note: "No authoritative per-generation cost field is collected by this integration." },
  crazyrouter: { state: "UNKNOWN", note: "No authoritative per-generation cost field is collected by this integration." },
  akashml: { state: "UNKNOWN", note: "AkashML's chat response usage object carries token counts and no cost field (measured 2026-09-25); per-call charges appear only in its web console, which this integration does not read." },
  ionet: { state: "UNKNOWN", note: "No authoritative per-generation cost field is collected by this integration." },
  kie: { state: "UNKNOWN", note: "KIE bills in credits; this integration reads only its public price table, not per-task credit charges." },
  higgsfield: { state: "UNKNOWN", note: "Higgsfield publishes web-plan credit rates; this integration does not observe a settled price paid per generation." },
};

export const publicationSchema = z.enum([
  /** The provider publishes this for every model it lists. */
  "always",
  /** The provider publishes this for some models and omits it for others. */
  "partial",
  /** This metadata is absent from the source used by the current connector. */
  "never",
  /**
   * THIS BUILD DOES NOT KNOW. Only ever produced for a provider the dashboard
   * reports and this package has never heard of.
   *
   * Distinct from "never" on purpose, and the distinction was got wrong first:
   * the unknown-provider fallback originally returned "never" for everything,
   * which made `unpricedReason` assert "X publishes no prices for any model"
   * about a provider that may well publish them. Silence we have observed and
   * silence we have not looked for are different claims.
   */
  "unknown",
]);

export const spendVisibilitySchema = z.enum([
  /** Spend visibility has not been established by this build's integrations. */
  "unknown",
  /** A documented API returns this key's usage and ceiling. */
  "api",
  /**
   * No documented endpoint returns per-key spend. Spend for this provider is not
   * merely unread — it is unreadable, and must be reported as such rather than
   * left as an empty field that reads like zero.
   */
  "no_billing_api",
]);

export const providerDescriptorSchema = z
  .object({
    id: providerIdSchema,
    ...providerEvidenceShape,
    displayName: z.string(),
    /** Declared product role; omitted when this build has not established it. */
    providerKind: z.enum(["aggregator", "media", "model_provider"]).optional(),
    /**
     * Another provider this one shares upstream supply with. Two correlated
     * providers are not independent for failover: an outage or a withdrawn model
     * upstream can take both down at once.
     */
    correlatedWith: z.enum(["openrouter"]).optional(),
    /** Where the dashboard's catalogue for this provider comes from. */
    catalogueUrl: z.string(),
    citationUrl: z.string(),
    publishes: z
      .object({
        pricing: publicationSchema,
        contextLength: publicationSchema,
        outputModalities: publicationSchema,
        reasoningEfforts: publicationSchema,
        activeFlag: publicationSchema,
        /** A published discount off list price. */
        discounts: publicationSchema,
        /** An end date for a published discount. */
        discountExpiry: publicationSchema,
        /** A machine-readable deprecation or retirement signal. */
        lifecycle: publicationSchema,
      })
      .strict(),
    spendVisibility: spendVisibilitySchema,
    /**
     * Stated in the tool output whenever this provider contributes a null, so the
     * caller reads a fact about the provider rather than a gap in the data.
     */
    comparabilityNote: z.string(),
  })
  .strict();

export type ProviderDescriptor = z.infer<typeof providerDescriptorSchema>;

export const PROVIDER_REGISTRY: Record<ProviderId, ProviderDescriptor> = {
  openrouter: {
    id: "openrouter",
    ...providerEvidence("openrouter"),
    displayName: "OpenRouter",
    providerKind: "aggregator",
    catalogueUrl: "https://openrouter.ai/api/v1/models",
    citationUrl: "https://openrouter.ai/docs/api/api-reference/models/get-models",
    publishes: {
      pricing: "partial",
      contextLength: "always",
      outputModalities: "always",
      reasoningEfforts: "partial",
      activeFlag: "never",
      // Not on the model: OpenRouter attaches `discount` to a provider ENDPOINT.
      // Measured 2026-08-19, 0 of 550 models carry the key and 272 of 272
      // endpoints do. Reading /models and concluding "no discounts" is the trap.
      discounts: "partial",
      discountExpiry: "never",
      lifecycle: "always",
    },
    spendVisibility: "api",
    comparabilityNote:
      "OpenRouter publishes prices for nearly every model, plus lifecycle and deprecation state. Discounts are a provider-endpoint fact rather than a model fact and are collected under a daily request budget, so most of the catalogue is unobserved for discounts at any moment. No discount expiry is published anywhere.",
  },
  groq: {
    id: "groq",
    ...providerEvidence("groq"),
    displayName: "Groq",
    catalogueUrl: "https://api.groq.com/openai/v1/models",
    citationUrl: "https://console.groq.com/docs/api-reference#models-list",
    publishes: {
      // Observed 2026-08-19 and unchanged 2026-08-27: 13 models, 8 with pricing.
      pricing: "partial",
      contextLength: "always",
      outputModalities: "always",
      reasoningEfforts: "never",
      activeFlag: "always",
      discounts: "never",
      discountExpiry: "never",
      lifecycle: "never",
    },
    spendVisibility: "no_billing_api",
    comparabilityNote:
      "Groq lists a small catalogue with context length, modality and an active flag, and publishes prices for only some of it. It exposes no deprecation signal, so a Groq model disappearing from the list is the only retirement notice there is. It exposes no billing API, so per-key spend cannot be read.",
  },
  cerebras: {
    id: "cerebras",
    ...providerEvidence("cerebras"),
    displayName: "Cerebras",
    catalogueUrl: "https://api.cerebras.ai/v1/models",
    citationUrl: "https://inference-docs.cerebras.ai/api-reference/models",
    publishes: {
      // The model API has no prices; the public pricing page is the source.
      pricing: "partial",
      contextLength: "never",
      outputModalities: "never",
      reasoningEfforts: "never",
      activeFlag: "never",
      discounts: "never",
      discountExpiry: "never",
      lifecycle: "never",
    },
    spendVisibility: "no_billing_api",
    comparabilityNote:
      "Cerebras's /v1/models connector supplies only model identity and owner; pricing is read separately from the JS-rendered public pricing page. That source publishes prices for the listed developer-tier models, while a model absent from the table remains not_published. Context and modality are still not published by this connector.",
  },
  sail: {
    id: "sail",
    ...providerEvidence("sail"),
    displayName: "Sail",
    catalogueUrl: "https://api.sailresearch.com/v1/models",
    citationUrl: "https://docs.sailresearch.com/pricing.md",
    publishes: {
      // Public documents publish both, but this connector only reads pinned prices.
      pricing: "partial",
      contextLength: "partial",
      outputModalities: "never",
      reasoningEfforts: "never",
      activeFlag: "never",
      discounts: "never",
      discountExpiry: "never",
      lifecycle: "never",
    },
    spendVisibility: "unknown",
    comparabilityNote:
      "Sail publishes prices and context information in public documents. Its keyed /models (SAIL_API_KEY) lists identities only; this MCP prices them solely from its pinned, digest-verified pricing document and carries the completion window with each price. Context sizes are read live from docs.sailresearch.com/models.md as the published rounded labels (contextLengthLabel, e.g. \"262K\"), not converted to integers; a failed read is reported as contextSourceState unavailable. Sail is the batch lane: slower per call than AkashML or io.net (operator-measured 0.95-2.37 s against 0.57-0.91 s) and cheaper on most shared models, so it suits work nobody waits on. Per-model response shapes, minimum viable budgets and latencies are measured (2026-09-26); Qwen3.6-35B-A3B accepts synchronous calls only in the flex window. The billing routes at https://docs.sailresearch.com/usage-endpoints.md are documented but not probed or read by this integration, so spend visibility is unknown here.",
  },
  nous: {
    id: "nous",
    ...providerEvidence("nous"),
    displayName: "Nous Research",
    providerKind: "model_provider",
    correlatedWith: "openrouter",
    catalogueUrl: "https://nousresearch.com/",
    citationUrl: "https://nousresearch.com/",
    publishes: {
      pricing: "partial",
      contextLength: "unknown",
      outputModalities: "unknown",
      reasoningEfforts: "unknown",
      activeFlag: "unknown",
      discounts: "unknown",
      discountExpiry: "unknown",
      lifecycle: "unknown",
    },
    spendVisibility: "unknown",
    comparabilityNote:
      "Nous Research resells OpenRouter's catalogue: 372 of its 417 model ids are OpenRouter ids and none are Hermes models (measured 2026-09-26), so it is correlated with OpenRouter and must not be counted as an independent failover path. Its public /v1/models carries the prices Nous charges, including promotions, plus a pricing.original list price on discounted models; the portal page shows the same numbers. Nous's advertised discount is measured against its own original, which is often above OpenRouter's price, so each row also compares Nous's charged price with OpenRouter's live price for the same id (resale.versusOpenRouter): many 'up to 88% off' models cost the same as on OpenRouter, a few are genuinely cheaper, and some are dearer. No authenticated balance, usage or per-generation charge is established here, so generation cost remains BLOCKED, not zero.",
  },
  qwencloud: {
    id: "qwencloud",
    ...providerEvidence("qwencloud"),
    displayName: "QwenCloud",
    catalogueUrl: "https://dashscope-intl.aliyuncs.com/api/v1/models",
    citationUrl:
      "https://dashscope-intl.aliyuncs.com/api/v1/models",
    publishes: {
      // Measured 2026-09-08: 249 native models; 242 with price blocks (306 blocks).
      // Six compatibility-only ids supplement these; 59 comparable price pairs,
      // 134 usable context values and 247 nonempty response-modality lists.
      pricing: "partial",
      contextLength: "partial",
      outputModalities: "partial",
      // 72 explicit Reasoning capabilities become [] (support, no named efforts).
      // Numeric reasoning limits stay in the raw archive, not invented effort labels.
      reasoningEfforts: "partial",
      activeFlag: "never",
      discounts: "never",
      discountExpiry: "never",
      lifecycle: "never",
    },
    spendVisibility: "no_billing_api",
    comparabilityNote:
      "QwenCloud has price blocks on 242 of 249 native models: 306 outer price blocks contain 893 price entries (measured 2026-09-08). The archive retains 255 identities: 249 native plus 6 compatibility-only ids, preventing false disappearance when changing endpoints (159 of 165 compatibility ids overlap). Native metadata supplies 59 comparable prompt/completion pairs, 134 usable context values and 247 nonempty response-modality lists. The 893 entries include 738 token entries and 155 non-token price entries excluded from token comparisons: 94 per second, 38 per image, 20 per 10,000 characters and 3 per voice. All native prices, ranges and time bands remain in the raw archive; the current API does not publish bands. Flat rates requiring a selection are withheld on 39 models: 37 with multiple ranges and 2 with distinct peak/offpeak bands. Only unambiguous default general input/output rates are quoted. The 72 explicit Reasoning capabilities become empty effort lists without invented effort levels; numeric reasoning limits stay raw. Media-only models, the 7 native models without price blocks and the 6 identity-only supplements remain paid or unknown.",
  },
  deepinfra: {
    id: "deepinfra",
    ...providerEvidence("deepinfra"),
    displayName: "DeepInfra",
    catalogueUrl: "https://api.deepinfra.com/models/list",
    citationUrl: "https://deepinfra.com/models",
    publishes: {
      // Measured 2026-09-08: 372 models on 8 different pricing axes. Only the
      // 219 with pricing.type="tokens" are collected here; the other 153 bill
      // per second, per image, per character or per frame and cannot share a
      // per-token column. Every one of the 218 carries a price.
      pricing: "always",
      // 217 of 218 carry max_tokens.
      contextLength: "partial",
      outputModalities: "never",
      reasoningEfforts: "never",
      // `deprecated` is a UNIX TIMESTAMP, not a flag: 114 of 218 carry a
      // retirement date and 104 carry null, which is silence rather than health.
      activeFlag: "partial",
      // The pricing object carries `discount` and `discount_ends_at` fields,
      // and BOTH WERE NULL ON ALL 218 MODELS when measured 2026-09-08. The
      // field existing is not the provider publishing a discount, so this is
      // "never" -- the honest reading of what was observed. Written as
      // "partial" first, on the strength of the field's existence rather than
      // any value in it; a test caught the difference.
      discounts: "never",
      discountExpiry: "never",
      // The only provider here with a real retirement signal: a deprecation
      // date AND a `replaced_by` naming the successor model.
      lifecycle: "partial",
    },
    spendVisibility: "no_billing_api",
    comparabilityNote:
      "DeepInfra's legacy token connector observed 219 token-priced models out of 372 on 2026-09-08, with 114 carrying a retirement date and 153 further models using second, image, character or frame billing. Its publication flags describe that token connector. The media catalogue separately reads the public model list, retains other billing axes and reports its own acquired population and price coverage. Native prices and conversion conditions accompany comparable rates; catalogue presence alone does not establish that a model is current or its price comparable.",
  },
  novita: {
    id: "novita",
    ...providerEvidence("novita"),
    displayName: "Novita",
    catalogueUrl: "https://api.novita.ai/v3/openai/models",
    citationUrl: "https://novita.ai/docs/api-reference/model-apis-llm-list-models",
    publishes: {
      // Measured 2026-09-08: 156 chat models, 143 carrying a pricing object.
      // The other 13 carry no pricing object while reporting a flat zero, which
      // is an absent fact and is never read as free.
      pricing: "partial",
      contextLength: "always",
      outputModalities: "always",
      reasoningEfforts: "never",
      // `status` is an undocumented integer: 115 models report 1 and 41 report
      // 4. Only 1 is treated as live; anything else is unknown, not retired.
      activeFlag: "partial",
      // Prices carry both an origin price and a discounted effective price.
      discounts: "partial",
      discountExpiry: "never",
      lifecycle: "never",
    },
    spendVisibility: "no_billing_api",
    comparabilityNote:
      "Novita publishes prices, context length and modalities with no credential. Its flat price field is NOT a reliable single rate: five models are tiered, and the flat value is the cheapest band on one model and the dearest on another, while two tiered models publish no flat price at all. Prices reported here are the first tier — what a normal-length call costs — with the full bands retained, so a long-context call can be priced honestly rather than understated.",
  },
  sambanova: {
    id: "sambanova",
    ...providerEvidence("sambanova"),
    displayName: "SambaNova",
    catalogueUrl: "https://api.sambanova.ai/v1/models",
    citationUrl: "https://docs.sambanova.ai/cloud/api-reference/endpoints/models",
    publishes: {
      // Measured 2026-09-08: 7 models, all priced, all with context length.
      pricing: "always",
      contextLength: "always",
      outputModalities: "never",
      reasoningEfforts: "never",
      activeFlag: "never",
      discounts: "never",
      discountExpiry: "never",
      lifecycle: "never",
    },
    spendVisibility: "no_billing_api",
    comparabilityNote:
      "SambaNova lists a very small catalogue — 7 models — and publishes USD-per-token prices in exactly the encoding this server already uses, so nothing is rescaled or inferred. It publishes no modality, no active flag and no retirement signal, so a model vanishing from the list is the only notice there is.",
  },
  chutes: {
    id: "chutes",
    ...providerEvidence("chutes"),
    displayName: "Chutes",
    catalogueUrl: "https://llm.chutes.ai/v1/models",
    citationUrl: "https://chutes.ai/app/api",
    publishes: {
      // Measured 2026-09-08: 14 models on the LLM endpoint, all priced, all
      // with context length and output modalities.
      pricing: "always",
      contextLength: "always",
      outputModalities: "always",
      reasoningEfforts: "never",
      activeFlag: "never",
      discounts: "never",
      discountExpiry: "never",
      lifecycle: "never",
    },
    spendVisibility: "no_billing_api",
    comparabilityNote:
      "Chutes's legacy LLM connector observed 14 models on 2026-09-08 and rescales USD-per-million-token prices once at ingest. Its publication flags describe those LLM rows. The media catalogue separately reads the broader public chute inventory, retains other model types and reports its own denominator. USD prices are used only where their output unit is established; TAO values and GPU-time prices are not converted into a guessed USD price per image or second of generated video.",
  },
  wavespeed: {
    id: "wavespeed",
    ...providerEvidence("wavespeed"),
    displayName: "WaveSpeedAI",
    providerKind: "media",
    catalogueUrl: "https://wavespeed.ai/api/models",
    citationUrl: "https://wavespeed.ai/",
    publishes: {
      pricing: "partial", contextLength: "never", outputModalities: "partial",
      reasoningEfforts: "never", activeFlag: "never", discounts: "never",
      discountExpiry: "never", lifecycle: "never",
    },
    spendVisibility: "unknown",
    comparabilityNote:
      "WaveSpeedAI's public catalogue includes media models and native prices. The media collector retains every listed model, converts only prices with explicit supported units and required parameters, and records native values and arithmetic. Other rates are reported as unavailable for comparison; missing prices are not evidence that a model is free. Account spend is not read by this integration.",
  },
  fal: {
    id: "fal",
    ...providerEvidence("fal"),
    displayName: "fal",
    providerKind: "media",
    catalogueUrl: "https://api.fal.ai/v1/models",
    citationUrl: "https://fal.ai/docs/documentation",
    publishes: {
      pricing: "partial", contextLength: "never", outputModalities: "partial",
      reasoningEfforts: "never", activeFlag: "never", discounts: "never",
      discountExpiry: "never", lifecycle: "never",
    },
    spendVisibility: "unknown",
    comparabilityNote:
      "fal is a media generation platform. With FAL_API_KEY, the collector reads its full key-visible catalogue and bounded authenticated pricing batches; account-specific rates can apply. Without a key it reads the public catalogue and summary pricing table. Every acquired identity is retained. Only explicit supported output units become USD/image or USD/video-second; compute time, unobserved batches and unsupported prices remain unavailable with distinct reasons. Catalogue coverage and price coverage are reported separately. Account spend is not read by this integration.",
  },
  kie: {
    id: "kie",
    ...providerEvidence("kie"),
    displayName: "KIE",
    providerKind: "aggregator",
    catalogueUrl: "https://api.kie.ai/client/v1/model-pricing/page",
    citationUrl: "https://kie.ai/pricing",
    publishes: {
      // Measured 2026-09-29: 509 priced rows (image 110, video 269, music 31,
      // chat 99), no context length, modality only as a coarse interface type.
      pricing: "always", contextLength: "never", outputModalities: "partial",
      reasoningEfforts: "never", activeFlag: "never", discounts: "partial",
      discountExpiry: "never", lifecycle: "never",
    },
    spendVisibility: "unknown",
    comparabilityNote:
      "KIE resells image, video, music and chat models and publishes one public price table, read without a key. Each row is one priced variant (resolution, duration, input/output leg) and is kept as its own identity. KIE bills in credits at a stated $0.005 per credit; USD prices are used only where KIE's listed USD equals that conversion and the unit label is exact. Bonus credits on larger top-ups can make the effective rate lower. Its 'provider' column is a model-family label and is not always right, so it is kept natively and not trusted. Account spend is not read by this integration.",
  },
  higgsfield: {
    id: "higgsfield",
    ...providerEvidence("higgsfield"),
    displayName: "Higgsfield",
    providerKind: "media",
    catalogueUrl: "https://fnf-api-gw.higgsfield.ai/fnf/subscriptions/v2/compare?plan_set_key=ps_a3&billing_period=monthly&with_localization=true",
    citationUrl: "https://higgsfield.ai/pricing",
    publishes: {
      pricing: "partial", contextLength: "never", outputModalities: "partial",
      reasoningEfforts: "never", activeFlag: "never", discounts: "never",
      discountExpiry: "never", lifecycle: "never",
    },
    spendVisibility: "unknown",
    comparabilityNote:
      "Higgsfield's public comparison source publishes native web-plan credit rates for video, image and lipsync features. Credits are retained in their native units; no USD/EUR conversion or price-paid claim is made, and web-plan access does not establish MCP or CLI inference availability.",
  },
  crazyrouter: {
    id: "crazyrouter",
    ...providerEvidence("crazyrouter"),
    displayName: "Crazyrouter",
    providerKind: "aggregator",
    catalogueUrl: "https://api.crazyrouter.com/v1/models",
    citationUrl: "https://docs.crazyrouter.com/en/chat/openai/models",
    publishes: {
      pricing: "partial", contextLength: "unknown", outputModalities: "partial",
      reasoningEfforts: "unknown", activeFlag: "unknown", discounts: "partial",
      discountExpiry: "unknown", lifecycle: "unknown",
    },
    spendVisibility: "unknown",
    comparabilityNote:
      "Crazyrouter is a multi-provider aggregator. With CRAZYROUTER_API_KEY the catalogue contains every model visible to that key; without it only public pricing identities are observed and the platform denominator is unknown. The separate comparison tool joins exact model aliases using explicit native author evidence to OpenRouter quotes and available dated direct-provider references. The exact GPT-4o, GPT-4o mini and GPT-4.1 default-group figures that equal 0.65x OpenAI list prices are marked derived with their source and observed multiplier, and are excluded from competition claims. Public default-group rates do not establish the caller's billing group or settled charges. Tiered or unsupported native billing remains unpriced for comparison. The vendor's dated discount claim is assessed against collected independently comparable quotes rather than assumed true; immutable model snapshot equivalence and account spend are not established.",
  },
  akashml: {
    id: "akashml",
    ...providerEvidence("akashml"),
    displayName: "AkashML",
    catalogueUrl: "https://api.akashml.com/v1/models",
    citationUrl: "https://akashml.com/docs/platform/models",
    publishes: {
      // Measured 2026-09-25 with a key: 6 models, all priced, all with context
      // length and input/output modalities. /models is keyed (401 without).
      pricing: "always",
      contextLength: "always",
      outputModalities: "always",
      // supported_features says "reasoning" but names no effort levels.
      reasoningEfforts: "never",
      activeFlag: "never",
      discounts: "never",
      discountExpiry: "never",
      lifecycle: "never",
    },
    spendVisibility: "no_billing_api",
    comparabilityNote:
      "AkashML is Akash Network's managed inference service. Its keyed /models publishes USD-per-token rates per model, and they differ about 44x on output (gpt-oss-20b $0.10/M to GLM-5.3 $4.40/M, measured 2026-09-25), so it is priced per model, never as one provider rate. Its homepage claim of pricing 'starting from $0.15/M tokens' matches none of those rates, and billed charges observed in its console agreed with the per-model rates rather than the headline. Five of its six models are reasoning models that write thinking to message.reasoning_content and can return an empty message.content while billing tokens when max_tokens is small; each catalogue row carries dated response-shape observations. No billing API is documented, so per-key spend is not readable here. The catalogue needs AKASHML_API_KEY.",
  },
  ionet: {
    id: "ionet",
    ...providerEvidence("ionet"),
    displayName: "io.net",
    catalogueUrl: "https://api.intelligence.io.solutions/api/v1/models",
    citationUrl: "https://io.net/docs/reference/ai-models/get-started-with-io-intelligence-api.md",
    publishes: {
      // Measured 2026-09-26 without a key: 37 models, all priced per token,
      // all with a context window and modalities, 31 flagged supports_reasoning.
      pricing: "always",
      contextLength: "always",
      outputModalities: "always",
      reasoningEfforts: "never",
      activeFlag: "never",
      discounts: "never",
      discountExpiry: "never",
      lifecycle: "never",
    },
    spendVisibility: "unknown",
    comparabilityNote:
      "io.net sells both GPU rental (IO Cloud) and per-token inference (IO Intelligence); only the inference catalogue is collected. Its public /models publishes per-token USD prices as JSON numbers, converted exactly from their decimal text. 31 of 37 models (measured 2026-09-26) require an access tier above the free one (min_access_tier is retained in nativePricing), so a listed price is not proof a free key can call the model. GPU hourly rates on io.net's own pages disagree with each other and are not collected. Measured with a key on 2026-09-26, all 37 listed models were reachable, and three reasoning models (GLM-5.3-Flash, DeepSeek-V4.1-Flash, Qwen3.8-27B) wrote message.reasoning_content beside content and refusal; at max_tokens 16 GLM-5.3-Flash returned an empty answer 3 of 3 times and DeepSeek-V4.1-Flash 2 of 3, while billing; Qwen3.8-27B answered or was truncated in this build's 3 calls, though an operator probe the same day saw it return empty, and the tokens a one-word answer needed ranged from 16 to 218 depending on model and call. Other io.net models are not observed. io.net sits behind Cloudflare: a request can get 403 'error code: 1010' on a valid key depending on client and User-Agent, which is reported as EDGE_BLOCKED, not a credential failure.",
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDER_REGISTRY) as ProviderId[];

export function providerDescriptor(id: ProviderId): ProviderDescriptor {
  return PROVIDER_REGISTRY[id];
}

/** Is this a provider this build knows how to describe? */
export function isKnownProvider(id: string): id is ProviderId {
  return Object.hasOwn(PROVIDER_REGISTRY, id);
}

/**
 * A descriptor for ANY provider the API reports, including one this build has
 * never heard of.
 *
 * An unknown provider is a fact about THIS CLIENT being older than the server,
 * and saying so is more useful than either crashing or silently dropping the
 * rows. Everything it publishes is reported as unknown, because that is the
 * truthful answer: nothing is known about it.
 */
export function describeProvider(id: string): ProviderDescriptor {
  if (isKnownProvider(id)) return PROVIDER_REGISTRY[id];
  return {
    id: id as ProviderId,
    ...providerEvidence(id),
    displayName: id,
    catalogueUrl: "",
    citationUrl: "",
    publishes: {
      pricing: "unknown",
      contextLength: "unknown",
      outputModalities: "unknown",
      reasoningEfforts: "unknown",
      activeFlag: "unknown",
      discounts: "unknown",
      discountExpiry: "unknown",
      lifecycle: "unknown",
    },
    spendVisibility: "unknown",
    comparabilityNote: `The dashboard reported a provider this build does not know about (${id}). Its rows are passed through unchanged, and nothing is claimed about what it publishes -- not that it publishes nothing, which would be a different and unearned claim. Upgrade open-dashboard-mcp to describe it.`,
  };
}

/**
 * Why a model could not be ranked on price, without treating a connector gap
 * or an excluded price axis as provider-wide silence.
 */
export function unpricedReason(id: string): string {
  const descriptor = describeProvider(id);
  switch (descriptor.publishes.pricing) {
    case "never":
      return `The current ${descriptor.displayName} catalogue connector supplies no prices, so cost is unknown — not free.`;
    case "partial":
      if (id === "cerebras") {
        return `The current Cerebras catalogue connector supplies model ids but no price fields; cost is unknown — not free. The separate pricing-page read did not establish a price for this model.`;
      }
      return `No comparable token price in the collected data for this ${descriptor.displayName} model, so cost is unknown — not free. A published price may require a different unit, token range or time band.`;
    case "always":
      return `${descriptor.displayName} normally publishes a price for every model; its absence here is a gap in the upstream record.`;
    case "unknown":
      return `${descriptor.displayName} is not a provider this build of open-dashboard-mcp knows, so whether it publishes prices is unknown. The price is absent here; that is all that can be said.`;
  }
}

export const providerBlockKindSchema = z.enum([
  /**
   * A Cloudflare edge block, identified by code 1010 in the body. It means the
   * request was rejected before reaching the provider — most often for sending
   * no User-Agent — and says nothing about whether the key is valid. This has
   * been misdiagnosed as a dead key before, which is why it is a distinct value.
   */
  "edge_blocked",
  /** The provider itself rejected the credential. The key is wrong or revoked. */
  "provider_rejected",
]);

export type ProviderBlockKind = z.infer<typeof providerBlockKindSchema>;

/**
 * Tell an edge block apart from a credential rejection.
 *
 * Both arrive as 401/403, so the status alone cannot distinguish them and reading
 * it as "dead key" is wrong roughly whenever a proxy is involved. Verified
 * 2026-08-27 from a Windows host: Groq answers 401 `invalid_api_key` and Cerebras
 * 403 `Not authenticated`, with and without a User-Agent — ordinary credential
 * errors, no 1010. The 1010 case is real but host-specific, so it is detected
 * from the body rather than assumed from the status.
 */
export function classifyProviderBlock(
  status: number,
  body: string,
  headers?: { get(name: string): string | null },
): ProviderBlockKind | null {
  if (status !== 401 && status !== 403) return null;

  // A bare "error code: 1010" body carries no Cloudflare marker of its own; the
  // edge identifies itself in the response headers instead. Reported 2026-09-26
  // on io.net: a good key got 403 "error code: 1010" until a User-Agent was sent.
  // The provider's own auth errors pass through Cloudflare too (io.net answers
  // 401 {"detail":"Invalid API Key"} with server: cloudflare), so a header marker
  // only counts together with an explicit Cloudflare error code in the body.
  const edgeHeaders =
    /cloudflare/i.test(headers?.get("server") ?? "") || Boolean(headers?.get("cf-ray"));
  if (edgeHeaders && /error code:\s*1\d{3}/i.test(body)) return "edge_blocked";

  // Every edge verdict requires a Cloudflare marker. Matching a bare
  // "error code: 1xxx" would be worse than the bug it replaced: a provider that
  // numbers its own auth errors ("invalid API key; error code: 1001") would be
  // reported maybe-alive, and a genuinely dead key that reads as maybe-alive is
  // the more dangerous of the two mistakes.
  const cloudflare =
    /cloudflare/i.test(body) || /cf-ray/i.test(body) || /__cf_/i.test(body);
  if (!cloudflare) return "provider_rejected";

  // The 1xxx access-denied family, not just 1010. Error 1020 is a plain
  // firewall-rule denial and is at least as common.
  if (/error code:\s*1\d{3}/i.test(body)) return "edge_blocked";
  if (/\b1\d{3}\b/.test(body)) return "edge_blocked";
  // The interstitial does not always carry a numeric code.
  if (/(attention required|access denied|blocked)/i.test(body)) {
    return "edge_blocked";
  }
  return "provider_rejected";
}

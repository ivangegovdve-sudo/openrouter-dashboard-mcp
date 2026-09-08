import { z } from "zod";
import { catalogueEvidenceSchema, providerEvidence, providerEvidenceShape } from "./evidence.js";

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
  "qwencloud",
  "deepinfra",
  "novita",
  "sambanova",
  "chutes",
  "wavespeed",
  "fal",
  "crazyrouter",
]);
export type ProviderId = z.infer<typeof providerIdSchema>;

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
    /** Where the dashboard's catalogue for this provider comes from. */
    catalogueUrl: z.string(),
    citationUrl: z.string(),
    /** Additional native source evidence beyond the connector response. */
    catalogueEvidence: catalogueEvidenceSchema.optional(),
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
    catalogueEvidence: {
      sources: [
        { kind: "api", url: "https://api.cerebras.ai/v1/models", observedAt: "2026-09-08", sha256: null },
        { kind: "pricing_page", url: "https://www.cerebras.ai/pricing", observedAt: "2026-09-08", sha256: null },
      ],
      models: [
        {
          modelId: "gemma-4-31b",
          status: "not_published",
          promptUsdPerMillion: null,
          completionUsdPerMillion: null,
          sourceUrl: "https://www.cerebras.ai/pricing",
          observedAt: "2026-09-08",
          reason: "Preview models are intended for evaluation purposes only.",
        },
        {
          modelId: "gpt-oss-120b",
          status: "priced",
          precision: "approximate",
          promptUsdPerMillion: "0.35",
          completionUsdPerMillion: "0.75",
          sourceUrl: "https://www.cerebras.ai/pricing",
          observedAt: "2026-09-08",
          reason: null,
        },
        {
          modelId: "qwen-3.8-27b",
          status: "priced",
          precision: "approximate",
          promptUsdPerMillion: "0.99",
          completionUsdPerMillion: "1.49",
          sourceUrl: "https://www.cerebras.ai/pricing",
          observedAt: "2026-09-08",
          reason: null,
        },
      ],
    },
    publishes: {
      // These values describe the current /v1/models connector only.
      // A richer public native source was found on 2026-09-08; integration is pending.
      pricing: "never",
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
      "Cerebras's current /v1/models connector supplies only a model id and owner, so those collected rows cannot be ranked on cost or filtered on capability. This is a connector limitation: a separate public native source returned richer metadata for 3 of 3 models on 2026-09-08. Its collector integration is pending; those values are not yet available here.",
  },
  sail: {
    id: "sail",
    ...providerEvidence("sail"),
    displayName: "Sail",
    catalogueUrl: "https://docs.sailresearch.com/pricing.md",
    citationUrl: "https://docs.sailresearch.com/pricing.md",
    catalogueEvidence: {
      sources: [{
        kind: "pinned_document",
        url: "https://docs.sailresearch.com/pricing.md",
        observedAt: "2026-09-08",
        sha256: "32447697c3305a5bc8c5c40c9923e1b81aaefbc5ab8092ee59fb94dfdfd017e6",
      }],
    },
    publishes: {
      // Public documents publish both; the current MCP quotes only pinned prices.
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
      "Sail publishes prices and context information in public documents. This MCP quotes prices only after checking its pinned pricing document and carries the chosen completion window; it does not yet collect the documented context values. The billing routes at https://docs.sailresearch.com/usage-endpoints.md are documented but not probed or read by this integration, so spend visibility is unknown here.",
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
      // Measured 2026-09-08: 371 models on 8 different pricing axes. Only the
      // 218 with pricing.type="tokens" are collected here; the other 153 bill
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
      "DeepInfra's legacy token connector observed 218 token-priced models out of 371 on 2026-09-08, with 114 carrying a retirement date and 153 further models using second, image, character or frame billing. Its publication flags describe that token connector. The media catalogue separately reads the public model list, retains other billing axes and reports its own acquired population and price coverage. Native prices and conversion conditions accompany comparable rates; catalogue presence alone does not establish that a model is current or its price comparable.",
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
      "Crazyrouter is a multi-provider aggregator. With CRAZYROUTER_API_KEY the catalogue contains every model visible to that key; without it only public pricing identities are observed and the platform denominator is unknown. The separate comparison tool joins exact model aliases using explicit native author evidence to OpenRouter quotes and available dated direct-provider references. Public default-group rates do not establish the caller's billing group or settled charges. Tiered or unsupported native billing remains unpriced for comparison. The vendor's dated discount claim is assessed against collected comparable quotes rather than assumed true; immutable model snapshot equivalence and account spend are not established.",
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
): ProviderBlockKind | null {
  if (status !== 401 && status !== 403) return null;

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

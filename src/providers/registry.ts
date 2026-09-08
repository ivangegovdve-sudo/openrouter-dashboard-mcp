import { z } from "zod";

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
 * A null price then reads as "Cerebras publishes no prices" rather than as a
 * mystery or, far worse, as free.
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
]);
export type ProviderId = z.infer<typeof providerIdSchema>;

export const publicationSchema = z.enum([
  /** The provider publishes this for every model it lists. */
  "always",
  /** The provider publishes this for some models and omits it for others. */
  "partial",
  /** The provider never publishes this. A null here is the provider's silence. */
  "never",
]);

export const spendVisibilitySchema = z.enum([
  /** A documented API returns this key's usage and ceiling. */
  "api",
  /**
   * No documented endpoint returns per-key spend. Spend for this provider is not
   * merely unread — it is unreadable, and must be reported as such rather than
   * left as an empty field that reads like zero.
   */
  "no_billing_api",
]);

const providerDescriptorSchema = z
  .object({
    id: providerIdSchema,
    displayName: z.string(),
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
    displayName: "OpenRouter",
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
    displayName: "Cerebras",
    catalogueUrl: "https://api.cerebras.ai/v1/models",
    citationUrl: "https://inference-docs.cerebras.ai/api-reference/models",
    publishes: {
      // Observed 2026-08-19 and unchanged 2026-08-27: the listing carries only
      // {id, object, created, owned_by}. Everything else is absent.
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
      "Cerebras publishes only a model id and owner — no price, no context length, no modality. Its models therefore cannot be ranked on cost or filtered on capability from catalogue data alone, and are reported as unrankable rather than dropped. It exposes no billing API, so per-key spend cannot be read.",
  },
  sail: {
    id: "sail",
    displayName: "Sail",
    catalogueUrl: "https://api.sailresearch.com/v1/models",
    citationUrl: "https://docs.sailresearch.com/pricing.md",
    publishes: {
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
      "Sail models expose no programmatic price endpoint and are parsed periodically from a markdown document. Prices are strictly per-completion window; an optional availability source is absent.",
  },
  qwencloud: {
    id: "qwencloud",
    displayName: "QwenCloud",
    catalogueUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/models",
    citationUrl:
      "https://www.alibabacloud.com/help/en/model-studio/compatibility-of-openai-with-dashscope",
    publishes: {
      // Measured 2026-09-08: 165 models, every one carrying only
      // {id, object, created, owned_by}. Nothing else at all.
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
      "QwenCloud is a front end onto Alibaba Model Studio's DashScope international plane, and its catalogue lists 165 models with nothing but an id and an owner — no price, no context length, no modality. Cheap Qwen figures quoted elsewhere come from OpenRouter's catalogue, and a relayed price is a fact about the relay, so they are not reported here as QwenCloud prices. Its value is that it lists models OpenRouter does not relay at all.",
  },
  deepinfra: {
    id: "deepinfra",
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
      "DeepInfra publishes prices with no credential, in cents per token, and is the only provider here that says when a model retires and what replaces it. Two cautions: more than half its token-priced catalogue (114 of 218) already carries a retirement date, so a cheap price is often a price on a model being withdrawn; and 153 further models are billed per second, image, character or frame and are deliberately absent from per-token comparisons rather than converted.",
  },
  novita: {
    id: "novita",
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
      "Chutes publishes prices in USD per MILLION tokens as bare numbers, which look identical in shape to this server's per-token strings and are a million times larger; they are rescaled once at ingest. It also quotes every price in Bittensor's TAO alongside USD — that figure is deliberately ignored here, because it floats against the dollar and would turn a price comparison into a currency bet. Its broader catalogue reports 495 entries including image and video models; only the 14 chat models are collected today.",
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
    displayName: id,
    catalogueUrl: "",
    citationUrl: "",
    publishes: {
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
    comparabilityNote: `The dashboard reported a provider this build does not know about (${id}). Its rows are passed through unchanged, but nothing is claimed about what it publishes. Upgrade open-dashboard-mcp to describe it.`,
  };
}

/**
 * Why a model could not be ranked on price, phrased as a fact about the provider
 * rather than as a missing value.
 */
export function unpricedReason(id: string): string {
  const descriptor = describeProvider(id);
  switch (descriptor.publishes.pricing) {
    case "never":
      return `${descriptor.displayName} publishes no prices for any model, so cost is unknown — not free.`;
    case "partial":
      return `${descriptor.displayName} publishes prices for only part of its catalogue and omits them for this model, so cost is unknown — not free.`;
    case "always":
      return `${descriptor.displayName} normally publishes a price for every model; its absence here is a gap in the upstream record.`;
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

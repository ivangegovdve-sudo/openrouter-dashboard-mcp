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
 * Adding a fourth provider is a new entry in PROVIDER_REGISTRY plus its id in
 * providerIdSchema. Nothing else in this server enumerates providers.
 */

export const providerIdSchema = z.enum(["openrouter", "groq", "cerebras"]);
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
};

export const PROVIDER_IDS = Object.keys(PROVIDER_REGISTRY) as ProviderId[];

export function providerDescriptor(id: ProviderId): ProviderDescriptor {
  return PROVIDER_REGISTRY[id];
}

/**
 * Why a model could not be ranked on price, phrased as a fact about the provider
 * rather than as a missing value.
 */
export function unpricedReason(id: ProviderId): string {
  const descriptor = PROVIDER_REGISTRY[id];
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
  // Cloudflare's whole 1xxx access-denied family, not just 1010. Error 1020 is a
  // plain firewall-rule denial and is at least as common; classifying it as a
  // credential rejection is exactly what makes someone rotate a working key.
  if (/error code:\s*1\d{3}/i.test(body)) return "edge_blocked";
  if (/\b1\d{3}\b/.test(body) && /cloudflare/i.test(body)) return "edge_blocked";
  // The interstitial does not always carry a numeric code.
  if (
    /cloudflare/i.test(body) &&
    /(attention required|access denied|blocked)/i.test(body)
  ) {
    return "edge_blocked";
  }
  return "provider_rejected";
}

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  classifyProviderBlock,
  PROVIDER_REGISTRY,
  providerIdSchema,
  type ProviderId,
} from "../providers/registry.js";
import { READ_ONLY_TOOL_ANNOTATIONS, toolResult } from "./shared.js";

/**
 * Key inventory is the only tool in this server that touches a credential, and it
 * is opt-in.
 *
 * Everything else reads the zero-credential public dashboard, which is what lets
 * the server ship inside a distributed desktop app. Requiring a key at startup
 * would destroy that property for every other tool, so this one stays dormant
 * unless a host explicitly configures it. An unconfigured inventory is a normal
 * outcome, not an error.
 *
 * Read-only by construction: this module issues GET requests and contains no code
 * path that can mint, modify, or revoke a key. Provisioning belongs to whatever
 * privileged key an operator uses for it, and deliberately not to this server.
 *
 * Spend is NOT uniformly readable. OpenRouter exposes per-key usage and ceiling.
 * Groq and Cerebras expose no billing API at all, so their spend is unreadable
 * rather than merely unread — reported as `no_billing_api` with the reason stated,
 * because a blank money field reads as zero and zero is a different claim.
 */

const KEY_REQUEST_TIMEOUT_MS = 10_000;
const KEY_MAX_RESPONSE_BYTES = 64 * 1024;

/**
 * Always sent. A request with no User-Agent can be rejected at a Cloudflare edge
 * with code 1010 before it ever reaches the provider, which looks exactly like a
 * dead key and has been misdiagnosed as one.
 */
const USER_AGENT = "open-dashboard-mcp/0.2 (+read-only key inventory)";

/**
 * `provider:secretName=ENV_VAR` triples, comma separated. The Secret Manager name
 * is what gets reported; the environment variable is only ever read, never echoed.
 */
export const KEY_SOURCES_ENV = "OPEN_DASHBOARD_KEY_SOURCES";

/**
 * Anything that looks like key material, in any field this tool echoes back.
 *
 * The operator writes the `secretName` half of each triple, so it is not under
 * this server's control. A prefix, a suffix, or "just the last four to confirm
 * it loaded" is still key material, so a match replaces the whole value rather
 * than trimming it.
 *
 * The provider-supplied key `label` is not returned at all. OpenRouter documents
 * it as a masked key fingerprint — the prefix, an ellipsis, and the last few
 * characters — which is partial key material by construction, and no heuristic
 * can promise to recognise every format a provider might put there. Dropping the
 * field removes the question instead of answering it badly.
 *
 * Fails closed: on any match the whole value is dropped, because a value that
 * contains a key is not made safe by returning the rest of it.
 */
const KEY_SHAPED = [
  // NOT anchored with \b: JavaScript counts `_` as a word character, so \b would
  // let `key_sk-abc12345` through. A negative lookbehind for the alphanumerics
  // only is the boundary that is actually wanted -- it still refuses to fire
  // mid-word inside an ordinary label, but an underscore-prefixed credential
  // does not slip past.
  /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{8,}/i,
  /(?<![A-Za-z0-9])gsk[_-][A-Za-z0-9]{8,}/i,
  /(?<![A-Za-z0-9])csk-[A-Za-z0-9]{8,}/i,
  /(?<![A-Za-z0-9])Bearer\s+\S+/i,
  /(?<![A-Za-z0-9])AIza[A-Za-z0-9_-]{10,}/,
  /(?<![A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{10,}/,
  /(?<![A-Za-z0-9])npm_[A-Za-z0-9]{16,}/,
  /(?<![A-Za-z0-9])xox[baprs]-[A-Za-z0-9-]{10,}/,
  /(?<![A-Za-z0-9])AKIA[0-9A-Z]{12,}/,
  // A JSON Web Token: three base64url segments.
  /(?<![A-Za-z0-9])eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  // A masked fingerprint: any key-ish prefix with an ellipsis in the middle.
  /[A-Za-z0-9_-]{6,}\.{3}[A-Za-z0-9_-]{3,}/,
  // A UUID, which several providers use verbatim as a key.
  /(?<![A-Za-z0-9])[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
];

/**
 * A long opaque run of no recognised family.
 *
 * The named patterns above are a denylist, and a denylist cannot know about a
 * credential family that did not exist when it was written. This is the
 * catch-all, and it deliberately looks at RUNS rather than whitespace-delimited
 * tokens, so that punctuation around a secret (`token:abc…`, `"abc…"`) cannot
 * smuggle it past.
 *
 * A run of 20+ characters from the credential alphabet is treated as a secret
 * unless it reads like words. Hex counts even with no digits in it -- an
 * all-`a`-`f` token is still a token.
 */
function looksLikeOpaqueToken(value: string): boolean {
  // The dot is IN the run alphabet. Leaving it out was a real hole: a run scanner
  // that breaks on dots never sees `deadbeef.deadbeef.deadbeef.deadbeef` as one
  // token, and a dotted credential walks straight through.
  for (const run of value.match(/[A-Za-z0-9+/=_.-]{20,}/g) ?? []) {
    const alphanumeric = run.replace(/[^A-Za-z0-9]/g, "");
    if (alphanumeric.length < 20) continue;

    // Long hex is a secret whether or not it happens to contain a digit, and
    // whatever separators it is broken up by. This is what catches both a raw
    // 32-character hex token and a UUID.
    if (/^[0-9a-f]+$/i.test(alphanumeric)) return true;

    // A name is made of words. Two or more separator-delimited segments that are
    // plain lowercase letters reads as `openrouter-primary-key-2026`, not as a
    // credential -- and destroying those was the over-redaction complaint.
    const wordSegments = run
      .split(/[-_.]+/)
      .filter((segment) => /^[a-z]{4,}$/.test(segment));
    if (wordSegments.length >= 2) continue;

    // Otherwise require the character-class mixing that random tokens have.
    const hasDigit = /[0-9]/.test(alphanumeric);
    const mixedCase = /[a-z]/.test(alphanumeric) && /[A-Z]/.test(alphanumeric);
    if (!hasDigit && !mixedCase) continue;
    return true;
  }
  return false;
}

/**
 * Fails closed on anything key-shaped. The whole value is dropped rather than
 * trimmed, because a value that contains a key is not made safe by returning
 * the rest of it.
 */
export function redactKeyShaped(value: string | null): string | null {
  if (value === null) return null;
  for (const pattern of KEY_SHAPED) {
    if (pattern.test(value)) return "[redacted: looked like key material]";
  }
  if (looksLikeOpaqueToken(value)) {
    return "[redacted: looked like key material]";
  }
  return value;
}

/**
 * What a Secret Manager resource name actually looks like.
 *
 * This is the half of the guarantee that heuristics cannot give. `secretName` is
 * operator-supplied config, and rather than trying to recognise every credential
 * that could be pasted there, this states positively what a NAME is: short,
 * word-like, no long opaque runs. Anything else is refused and reported as
 * refused, so an accident fails closed instead of being echoed back.
 */
export function isPlausibleSecretName(value: string): boolean {
  // 255 is the ceiling both AWS and Google Secret Manager allow; a shorter cap
  // here would reject names people legitimately use.
  if (value.length === 0 || value.length > 255) return false;
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value)) return false;
  // No unbroken alphanumeric run longer than a real word.
  if (/[A-Za-z0-9]{20,}/.test(value)) return false;
  return redactKeyShaped(value) === value;
}

export const OMITTED_SECRET_NAME = "[omitted: not a valid secret name]";

/** Where each provider answers "is this key alive, and what has it spent". */
const KEY_PROBE: Record<ProviderId, { url: string; readsSpend: boolean }> = {
  openrouter: { url: "https://openrouter.ai/api/v1/key", readsSpend: true },
  groq: { url: "https://api.groq.com/openai/v1/models", readsSpend: false },
  cerebras: { url: "https://api.cerebras.ai/v1/models", readsSpend: false },
};

export const keySourceSchema = z
  .object({
    provider: providerIdSchema,
    /** Secret Manager resource name. A name, never a value. */
    secretName: z.string().min(1),
    envVar: z.string().min(1),
  })
  .strict();

export type KeySource = z.infer<typeof keySourceSchema>;

export function parseKeySources(raw: string | undefined): KeySource[] {
  if (raw === undefined || raw.trim() === "") return [];
  const sources: KeySource[] = [];
  const seen = new Set<string>();
  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (trimmed === "") continue;
    const colon = trimmed.indexOf(":");
    const equals = trimmed.indexOf("=");
    if (colon <= 0 || equals <= colon + 1) continue;
    const provider = trimmed.slice(0, colon).trim();
    const secretName = trimmed.slice(colon + 1, equals).trim();
    const envVar = trimmed.slice(equals + 1).trim();
    if (secretName === "" || envVar === "") continue;
    const parsed = providerIdSchema.safeParse(provider);
    if (!parsed.success) continue;
    const dedupeKey = `${provider}:${secretName}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    // The operator writes this half. Rather than trying to recognise every
    // credential that could be pasted here, require it to look like a name; if
    // it does not, refuse it and say so rather than echoing it back.
    sources.push({
      provider: parsed.data,
      secretName: isPlausibleSecretName(secretName)
        ? secretName
        : OMITTED_SECRET_NAME,
      envVar,
    });
  }
  return sources;
}

/**
 * Only the two documented fields. The upstream object is read loosely because
 * providers add fields, but the OUTPUT is narrowed to these two so an unexpected
 * upstream addition cannot ride through this tool into a caller's context.
 */
const rateLimitSchema = z
  .object({
    requests: z.number().nullable().optional(),
    interval: z.string().nullable().optional(),
  })
  .strict()
  .nullable();

const upstreamRateLimitSchema = z
  .object({
    requests: z.number().nullable().optional(),
    interval: z.string().nullable().optional(),
  })
  .loose()
  .nullable();

function narrowRateLimit(
  value: z.infer<typeof upstreamRateLimitSchema> | undefined,
): z.infer<typeof rateLimitSchema> | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return { requests: value.requests ?? null, interval: value.interval ?? null };
}

const openRouterKeyResponseSchema = z
  .object({
    data: z
      .object({
        usage: z.number().nullable().optional(),
        limit: z.number().nullable().optional(),
        limit_remaining: z.number().nullable().optional(),
        is_free_tier: z.boolean().nullable().optional(),
        rate_limit: upstreamRateLimitSchema.optional(),
      })
      .loose(),
  })
  .loose();

export const keyStateSchema = z.enum([
  /** The key answered successfully. */
  "active",
  /** The provider itself rejected the credential — revoked, expired, or wrong. */
  "rejected",
  /**
   * Rejected at a Cloudflare edge with code 1010 before reaching the provider.
   * Says nothing about whether the key is valid; usually means the request carried
   * no User-Agent, or the calling host is blocked. Distinct from `rejected`
   * because treating it as a dead key has caused wrong rotations before.
   */
  "edge_blocked",
  /** Configured but the named environment variable held nothing. */
  "missing_from_environment",
  /** Upstream could not be reached. State unknown, not absent. */
  "unreachable",
]);

export const spendReadabilitySchema = z.enum([
  /** Spend was read from a documented billing API. */
  "read",
  /**
   * This provider exposes no billing API, so per-key spend cannot be read by any
   * means. Not a gap in this tool.
   */
  "no_billing_api",
  /** The provider has a billing API but it could not be read on this attempt. */
  "unread",
]);

const keyReportSchema = z
  .object({
    provider: providerIdSchema,
    /**
     * The Secret Manager name this key is stored under. The key value itself is
     * never returned, logged, or written to evidence — only its name.
     */
    secretName: z.string(),
    state: keyStateSchema,
    /** Whether the key authenticated, independent of whether spend is readable. */
    alive: z.boolean().nullable(),
    spendReadability: spendReadabilitySchema,
    usdSpent: z.number().nullable(),
    /**
     * The spend ceiling in USD, or null for no ceiling. Null is the finding, not a
     * missing value: an uncapped key can spend without bound if it leaks.
     */
    usdLimit: z.number().nullable(),
    usdRemaining: z.number().nullable(),
    /** True when this key has no spend ceiling. Null when spend is unreadable. */
    uncapped: z.boolean().nullable(),
    isFreeTier: z.boolean().nullable(),
    rateLimit: rateLimitSchema.optional(),
    /** Why a field is null, in words. Never contains key material. */
    note: z.string().nullable(),
  })
  .strict();

export const keyInventoryInputSchema = z
  .object({
    providers: z.array(providerIdSchema).min(1).optional(),
  })
  .strict();

const keyInventoryReportedSchema = z
  .object({
    status: z.enum(["ok", "partial"]),
    summary: z.string(),
    checkedAt: z.string(),
    keys: z.array(keyReportSchema),
    providers: z.array(
      z
        .object({
          provider: providerIdSchema,
          displayName: z.string(),
          keysConfigured: z.number().int().min(0),
          keysAlive: z.number().int().min(0),
          spendVisibility: z.enum(["api", "no_billing_api"]),
          note: z.string(),
        })
        .strict(),
    ),
    totals: z
      .object({
        configured: z.number().int().min(0),
        alive: z.number().int().min(0),
        /** Alive keys with no spend ceiling, among those whose spend is readable. */
        uncapped: z.number().int().min(0),
        capped: z.number().int().min(0),
        /** Alive keys whose spend cannot be read at all. */
        spendUnreadable: z.number().int().min(0),
        unresolved: z.number().int().min(0),
        usdSpentWhereReadable: z.number(),
      })
      .strict(),
    warnings: z.array(z.string()),
  })
  .strict();

const keyInventoryUnconfiguredSchema = z
  .object({
    status: z.literal("unconfigured"),
    summary: z.string(),
    howToEnable: z.string(),
  })
  .strict();

export const keyInventoryOutputSchema = z.discriminatedUnion("status", [
  keyInventoryReportedSchema,
  keyInventoryUnconfiguredSchema,
]);

export type KeyInventoryInput = z.input<typeof keyInventoryInputSchema>;
export type KeyInventoryOutput = z.infer<typeof keyInventoryOutputSchema>;

export type KeyInventoryDependencies = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

type KeyReport = z.infer<typeof keyReportSchema>;

function baseReport(source: KeySource): KeyReport {
  const readsSpend = KEY_PROBE[source.provider].readsSpend;
  return {
    provider: source.provider,
    secretName: source.secretName,
    state: "unreachable",
    alive: null,
    spendReadability: readsSpend ? "unread" : "no_billing_api",
    usdSpent: null,
    usdLimit: null,
    usdRemaining: null,
    uncapped: null,
    isFreeTier: null,
    note: null,
  };
}

function noBillingNote(provider: ProviderId): string {
  return `${PROVIDER_REGISTRY[provider].displayName} exposes no billing API, so this key's spend cannot be read by any means. Unknown, not zero.`;
}

async function readKey(
  source: KeySource,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<KeyReport> {
  const report = baseReport(source);
  const secret = env[source.envVar];
  if (secret === undefined || secret.trim() === "") {
    return {
      ...report,
      state: "missing_from_environment",
      alive: null,
      note: `No value was present in the configured environment variable for ${source.secretName}.`,
    };
  }

  const probe = KEY_PROBE[source.provider];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KEY_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(probe.url, {
      method: "GET",
      headers: {
        // Constructed here and never stored, logged, or returned.
        authorization: `Bearer ${secret}`,
        accept: "application/json",
        "user-agent": USER_AGENT,
      },
      signal: controller.signal,
      redirect: "error",
    });

    const text = await response.text();

    if (response.status === 401 || response.status === 403) {
      const kind = classifyProviderBlock(response.status, text);
      if (kind === "edge_blocked") {
        return {
          ...report,
          state: "edge_blocked",
          alive: null,
          note: `The request for ${source.secretName} was rejected at a Cloudflare edge before reaching ${PROVIDER_REGISTRY[source.provider].displayName}. This says nothing about whether the key is valid — do not rotate it on this signal.`,
        };
      }
      return {
        ...report,
        state: "rejected",
        alive: false,
        note: `The key stored as ${source.secretName} was rejected by ${PROVIDER_REGISTRY[source.provider].displayName} (HTTP ${response.status}). It is revoked, expired, or wrong.`,
      };
    }

    if (!response.ok) {
      return {
        ...report,
        state: "unreachable",
        alive: null,
        note: `Upstream returned HTTP ${response.status} for ${source.secretName}; its state is unknown, not absent.`,
      };
    }

    if (text.length > KEY_MAX_RESPONSE_BYTES) {
      return {
        ...report,
        state: "unreachable",
        alive: null,
        note: `Upstream returned an oversized payload for ${source.secretName}.`,
      };
    }

    // The key authenticated. Whether spend is knowable is a separate question.
    if (!probe.readsSpend) {
      return {
        ...report,
        state: "active",
        alive: true,
        spendReadability: "no_billing_api",
        note: noBillingNote(source.provider),
      };
    }

    const parsed = openRouterKeyResponseSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return {
        ...report,
        state: "active",
        alive: true,
        spendReadability: "unread",
        note: `The key stored as ${source.secretName} authenticated, but the billing payload was unrecognised, so its spend is unknown.`,
      };
    }

    const data = parsed.data.data;
    const usdLimit = data.limit ?? null;
    return {
      provider: source.provider,
      secretName: source.secretName,
      state: "active",
      alive: true,
      spendReadability: "read",
      usdSpent: data.usage ?? null,
      usdLimit,
      usdRemaining: data.limit_remaining ?? null,
      uncapped: usdLimit === null,
      isFreeTier: data.is_free_tier ?? null,
      rateLimit: narrowRateLimit(data.rate_limit) ?? null,
      note: null,
    };
  } catch {
    return {
      ...report,
      state: "unreachable",
      alive: null,
      note: `Could not reach ${PROVIDER_REGISTRY[source.provider].displayName} to check ${source.secretName}; its state is unknown, not absent.`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runKeyInventory(
  rawInput: KeyInventoryInput,
  {
    env = process.env,
    fetchImpl = fetch,
    now = () => new Date(),
  }: KeyInventoryDependencies = {},
): Promise<KeyInventoryOutput> {
  const input = keyInventoryInputSchema.parse(rawInput);
  const all = parseKeySources(env[KEY_SOURCES_ENV]);
  const sources =
    input.providers === undefined
      ? all
      : all.filter((source) => input.providers?.includes(source.provider));

  if (sources.length === 0) {
    return {
      status: "unconfigured",
      summary:
        "No provider keys are configured for inventory, so no spend or liveness can be reported. This is the zero-credential default, not a failure.",
      howToEnable: `Set ${KEY_SOURCES_ENV} to comma-separated "provider:secretManagerName=ENV_VAR" triples, where provider is one of openrouter, groq or cerebras, and provide each named environment variable. Only the Secret Manager names are ever reported; key values are never returned or logged. OpenRouter reports spend; Groq and Cerebras expose no billing API, so their keys report liveness only.`,
    };
  }

  const keys = await Promise.all(
    sources.map((source) => readKey(source, env, fetchImpl)),
  );

  const alive = keys.filter((key) => key.alive === true);
  const readable = alive.filter((key) => key.spendReadability === "read");
  const uncapped = readable.filter((key) => key.uncapped === true);
  const capped = readable.filter((key) => key.uncapped === false);
  const spendUnreadable = alive.filter(
    (key) => key.spendReadability === "no_billing_api",
  );
  const unresolved = keys.filter((key) => key.state !== "active");
  const usdSpentWhereReadable = readable.reduce(
    (total, key) => total + (key.usdSpent ?? 0),
    0,
  );

  const warnings: string[] = [];
  if (uncapped.length > 0) {
    warnings.push(
      `${uncapped.length} active key${uncapped.length === 1 ? " has" : "s have"} no spend ceiling: ${uncapped.map((key) => key.secretName).join(", ")}. An uncapped key can spend without bound if it leaks.`,
    );
  }
  if (spendUnreadable.length > 0) {
    warnings.push(
      `${spendUnreadable.length} key${spendUnreadable.length === 1 ? "'s spend is" : "s' spend is"} unreadable because their provider exposes no billing API: ${spendUnreadable.map((key) => key.secretName).join(", ")}. Unknown, not zero, and not capped.`,
    );
  }
  const edgeBlocked = keys.filter((key) => key.state === "edge_blocked");
  if (edgeBlocked.length > 0) {
    warnings.push(
      `${edgeBlocked.length} key${edgeBlocked.length === 1 ? " was" : "s were"} blocked at a Cloudflare edge rather than rejected by the provider: ${edgeBlocked.map((key) => key.secretName).join(", ")}. Do not rotate on this signal — it means the request never reached the provider.`,
    );
  }
  const rejected = keys.filter((key) => key.state === "rejected");
  if (rejected.length > 0) {
    warnings.push(
      `${rejected.length} configured key${rejected.length === 1 ? " was" : "s were"} rejected by their provider: ${rejected.map((key) => key.secretName).join(", ")}.`,
    );
  }
  const unreachable = keys.filter((key) => key.state === "unreachable");
  if (unreachable.length > 0) {
    warnings.push(
      `${unreachable.length} key${unreachable.length === 1 ? "'s state is" : "s' states are"} unknown because upstream could not be reached; treat as unknown, not as zero spend.`,
    );
  }
  const missing = keys.filter((key) => key.state === "missing_from_environment");
  if (missing.length > 0) {
    warnings.push(
      `${missing.length} configured key${missing.length === 1 ? " was" : "s were"} not present in the environment: ${missing.map((key) => key.secretName).join(", ")}.`,
    );
  }

  const providerIds = [...new Set(sources.map((source) => source.provider))];
  const providers = providerIds.map((provider) => {
    const descriptor = PROVIDER_REGISTRY[provider];
    const forProvider = keys.filter((key) => key.provider === provider);
    return {
      provider,
      displayName: descriptor.displayName,
      keysConfigured: forProvider.length,
      keysAlive: forProvider.filter((key) => key.alive === true).length,
      spendVisibility: descriptor.spendVisibility,
      note:
        descriptor.spendVisibility === "api"
          ? `${descriptor.displayName} exposes per-key usage and ceiling, so spend below is measured.`
          : noBillingNote(provider),
    };
  });

  return {
    status: warnings.length > 0 ? "partial" : "ok",
    summary: `${keys.length} keys across ${providers.length} providers; ${alive.length} alive; ${uncapped.length} uncapped; ${capped.length} capped; ${spendUnreadable.length} with unreadable spend; $${usdSpentWhereReadable.toFixed(4)} spent where readable.`,
    checkedAt: now().toISOString(),
    keys,
    providers,
    totals: {
      configured: keys.length,
      alive: alive.length,
      uncapped: uncapped.length,
      capped: capped.length,
      spendUnreadable: spendUnreadable.length,
      unresolved: unresolved.length,
      usdSpentWhereReadable,
    },
    warnings,
  };
}

export function registerKeyInventory(
  server: McpServer,
  dependencies: KeyInventoryDependencies = {},
): void {
  server.registerTool(
    "dashboard_key_inventory",
    {
      title: "Open Dashboard key inventory",
      description:
        "Report configured OpenRouter, Groq and Cerebras keys by Secret Manager name: whether each key is alive, and for OpenRouter its spend, ceiling, remaining balance, free-tier flag and rate limit. Names the keys with no ceiling at all. Groq and Cerebras expose no billing API, so their spend is reported as unreadable rather than left blank. Distinguishes a Cloudflare edge block from a genuine credential rejection, because the two look alike and only one warrants rotating a key. Read-only: it cannot mint, modify, or revoke, and never returns or logs a key value.",
      inputSchema: keyInventoryInputSchema,
      outputSchema: keyInventoryOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runKeyInventory(input, dependencies)),
  );
}

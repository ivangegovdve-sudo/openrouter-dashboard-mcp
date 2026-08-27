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
 * path that can mint, modify, or revoke a key. Provisioning stays with
 * `openrouter-management-key` and a separate tool.
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
const USER_AGENT = "open-dashboard-mcp/0.1 (+read-only key inventory)";

/**
 * `provider:secretName=ENV_VAR` triples, comma separated. The Secret Manager name
 * is what gets reported; the environment variable is only ever read, never echoed.
 */
export const KEY_SOURCES_ENV = "OPEN_DASHBOARD_KEY_SOURCES";

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
    sources.push({ provider: parsed.data, secretName, envVar });
  }
  return sources;
}

const rateLimitSchema = z
  .object({
    requests: z.number().nullable().optional(),
    interval: z.string().nullable().optional(),
  })
  .loose()
  .nullable();

const openRouterKeyResponseSchema = z
  .object({
    data: z
      .object({
        label: z.string().nullable().optional(),
        usage: z.number().nullable().optional(),
        limit: z.number().nullable().optional(),
        limit_remaining: z.number().nullable().optional(),
        is_free_tier: z.boolean().nullable().optional(),
        rate_limit: rateLimitSchema.optional(),
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
    label: z.string().nullable(),
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
    label: null,
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
          note: `The request for ${source.secretName} was rejected at a Cloudflare edge (code 1010) before reaching ${PROVIDER_REGISTRY[source.provider].displayName}. This says nothing about whether the key is valid — do not rotate it on this signal.`,
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
      label: data.label ?? null,
      spendReadability: "read",
      usdSpent: data.usage ?? null,
      usdLimit,
      usdRemaining: data.limit_remaining ?? null,
      uncapped: usdLimit === null,
      isFreeTier: data.is_free_tier ?? null,
      rateLimit: data.rate_limit ?? null,
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
      `${edgeBlocked.length} key${edgeBlocked.length === 1 ? " was" : "s were"} blocked at a Cloudflare edge (code 1010) rather than rejected by the provider: ${edgeBlocked.map((key) => key.secretName).join(", ")}. Do not rotate on this signal — it means the request never reached the provider.`,
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

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  READ_ONLY_TOOL_ANNOTATIONS,
  toolResult,
} from "./shared.js";

/**
 * Key inventory is deliberately the only tool in this server that touches a
 * credential, and it is opt-in.
 *
 * Everything else here reads the zero-credential public dashboard, which is what
 * lets the server ship inside a distributed desktop app. Requiring a key at
 * startup would destroy that property for every other tool, so this one stays
 * dormant unless a host explicitly configures it and reports `unconfigured`
 * otherwise. An unconfigured inventory is a normal outcome, not an error.
 *
 * It is read-only by construction: this module issues GET requests and contains
 * no code path that can mint, modify, or revoke a key. Provisioning stays with
 * `openrouter-management-key` and a separate tool.
 */

const OPENROUTER_KEY_ENDPOINT = "https://openrouter.ai/api/v1/key";
const KEY_REQUEST_TIMEOUT_MS = 10_000;
const KEY_MAX_RESPONSE_BYTES = 64 * 1024;

/**
 * `secretName=ENV_VAR` pairs, comma separated. The Secret Manager name is what
 * gets reported; the environment variable is only ever read, never echoed.
 */
export const KEY_SOURCES_ENV = "OPENROUTER_KEY_SOURCES";

export const keySourceSchema = z
  .object({
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
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const secretName = trimmed.slice(0, separator).trim();
    const envVar = trimmed.slice(separator + 1).trim();
    if (secretName === "" || envVar === "") continue;
    if (seen.has(secretName)) continue;
    seen.add(secretName);
    sources.push({ secretName, envVar });
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
  /** The key answered and reported its own usage. */
  "active",
  /** The key was rejected upstream — revoked, expired, or mistyped. */
  "rejected",
  /** Configured but the named environment variable held nothing. */
  "missing_from_environment",
  /** Upstream could not be reached for this key. State unknown, not absent. */
  "unreachable",
]);

const keyReportSchema = z
  .object({
    /**
     * The Secret Manager name this key is stored under. The key value itself is
     * never read into this result, logged, or returned — only its name.
     */
    secretName: z.string(),
    state: keyStateSchema,
    /** OpenRouter's own label for the key, when it answered. */
    label: z.string().nullable(),
    usdSpent: z.number().nullable(),
    /**
     * The spend ceiling in USD, or null for no ceiling at all. Null is the
     * finding, not a missing value: an uncapped key can spend without bound if
     * it leaks, and that is precisely what this inventory exists to surface.
     */
    usdLimit: z.number().nullable(),
    usdRemaining: z.number().nullable(),
    /** True when this key has no spend ceiling. The number worth acting on. */
    uncapped: z.boolean().nullable(),
    isFreeTier: z.boolean().nullable(),
    rateLimit: rateLimitSchema.optional(),
    /** Present only when the key did not answer. Never contains key material. */
    note: z.string().nullable(),
  })
  .strict();

export const keyInventoryInputSchema = z.object({}).strict();

const keyInventoryReportedSchema = z
  .object({
    status: z.enum(["ok", "partial"]),
    summary: z.string(),
    checkedAt: z.string(),
    keys: z.array(keyReportSchema),
    totals: z
      .object({
        configured: z.number().int().min(0),
        active: z.number().int().min(0),
        /** Active keys with no spend ceiling. */
        uncapped: z.number().int().min(0),
        capped: z.number().int().min(0),
        unresolved: z.number().int().min(0),
        usdSpentAcrossActiveKeys: z.number(),
      })
      .strict(),
    warnings: z.array(z.string()),
  })
  .strict();

const keyInventoryUnconfiguredSchema = z
  .object({
    status: z.literal("unconfigured"),
    summary: z.string(),
    /** Told plainly so a host can turn it on without guessing the format. */
    howToEnable: z.string(),
  })
  .strict();

export const keyInventoryOutputSchema = z.discriminatedUnion("status", [
  keyInventoryReportedSchema,
  keyInventoryUnconfiguredSchema,
]);

export type KeyInventoryInput = z.infer<typeof keyInventoryInputSchema>;
export type KeyInventoryOutput = z.infer<typeof keyInventoryOutputSchema>;

export type KeyInventoryDependencies = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  now?: () => Date;
};

type KeyReport = z.infer<typeof keyReportSchema>;

function emptyReport(secretName: string): KeyReport {
  return {
    secretName,
    state: "unreachable",
    label: null,
    usdSpent: null,
    usdLimit: null,
    usdRemaining: null,
    uncapped: null,
    isFreeTier: null,
    note: null,
  };
}

async function readKey(
  source: KeySource,
  env: NodeJS.ProcessEnv,
  fetchImpl: typeof fetch,
): Promise<KeyReport> {
  const report = emptyReport(source.secretName);
  const secret = env[source.envVar];
  if (secret === undefined || secret.trim() === "") {
    return {
      ...report,
      state: "missing_from_environment",
      note: `No value was present in the configured environment variable for ${source.secretName}.`,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KEY_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(OPENROUTER_KEY_ENDPOINT, {
      method: "GET",
      headers: {
        // Constructed here and never stored, logged, or returned.
        authorization: `Bearer ${secret}`,
        accept: "application/json",
      },
      signal: controller.signal,
      redirect: "error",
    });

    if (response.status === 401 || response.status === 403) {
      return {
        ...report,
        state: "rejected",
        note: `The key stored as ${source.secretName} was rejected upstream (HTTP ${response.status}). It is revoked, expired, or wrong.`,
      };
    }
    if (!response.ok) {
      return {
        ...report,
        state: "unreachable",
        note: `Upstream returned HTTP ${response.status} for ${source.secretName}; its state is unknown, not absent.`,
      };
    }

    const text = await response.text();
    if (text.length > KEY_MAX_RESPONSE_BYTES) {
      return {
        ...report,
        state: "unreachable",
        note: `Upstream returned an oversized payload for ${source.secretName}.`,
      };
    }

    const parsed = openRouterKeyResponseSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      return {
        ...report,
        state: "unreachable",
        note: `Upstream returned an unrecognised payload for ${source.secretName}.`,
      };
    }

    const data = parsed.data.data;
    const usdLimit = data.limit ?? null;
    return {
      secretName: source.secretName,
      state: "active",
      label: data.label ?? null,
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
      note: `Could not reach OpenRouter to check ${source.secretName}; its state is unknown, not absent.`,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runKeyInventory(
  _input: KeyInventoryInput,
  {
    env = process.env,
    fetchImpl = fetch,
    now = () => new Date(),
  }: KeyInventoryDependencies = {},
): Promise<KeyInventoryOutput> {
  const sources = parseKeySources(env[KEY_SOURCES_ENV]);
  if (sources.length === 0) {
    return {
      status: "unconfigured",
      summary:
        "No OpenRouter keys are configured for inventory, so no spend can be reported. This is the zero-credential default, not a failure.",
      howToEnable: `Set ${KEY_SOURCES_ENV} to comma-separated "secretManagerName=ENV_VAR" pairs, and provide each named environment variable. Only the Secret Manager names are ever reported; key values are never returned or logged.`,
    };
  }

  const keys = await Promise.all(
    sources.map((source) => readKey(source, env, fetchImpl)),
  );

  const active = keys.filter((key) => key.state === "active");
  const uncapped = active.filter((key) => key.uncapped === true);
  const capped = active.filter((key) => key.uncapped === false);
  const unresolved = keys.filter((key) => key.state !== "active");
  const usdSpentAcrossActiveKeys = active.reduce(
    (total, key) => total + (key.usdSpent ?? 0),
    0,
  );

  const warnings: string[] = [];
  if (uncapped.length > 0) {
    warnings.push(
      `${uncapped.length} active key${uncapped.length === 1 ? " has" : "s have"} no spend ceiling: ${uncapped.map((key) => key.secretName).join(", ")}. An uncapped key can spend without bound if it leaks.`,
    );
  }
  const rejected = keys.filter((key) => key.state === "rejected");
  if (rejected.length > 0) {
    warnings.push(
      `${rejected.length} configured key${rejected.length === 1 ? " was" : "s were"} rejected upstream: ${rejected.map((key) => key.secretName).join(", ")}.`,
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

  return {
    status: warnings.length > 0 ? "partial" : "ok",
    summary: `${keys.length} keys configured; ${active.length} active; ${uncapped.length} uncapped; ${capped.length} capped; $${usdSpentAcrossActiveKeys.toFixed(4)} reported spent across active keys.`,
    checkedAt: now().toISOString(),
    keys,
    totals: {
      configured: keys.length,
      active: active.length,
      uncapped: uncapped.length,
      capped: capped.length,
      unresolved: unresolved.length,
      usdSpentAcrossActiveKeys,
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
      title: "Dashboard key inventory",
      description:
        "Report configured OpenRouter keys by Secret Manager name with their reported spend, spend ceiling, remaining balance, free-tier flag and rate limit, and name which keys have no ceiling at all. Read-only: it cannot mint, modify, or revoke a key, and it never returns or logs a key value. Returns 'unconfigured' when no keys are wired, which is the zero-credential default.",
      inputSchema: keyInventoryInputSchema,
      outputSchema: keyInventoryOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runKeyInventory(input, dependencies)),
  );
}

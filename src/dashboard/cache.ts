import type { z } from "zod";

import type { DashboardClient } from "./client.js";

/**
 * A response cache with a visible age.
 *
 * This server is consumed over stdio and relaunched by its host, and a single
 * `dashboard_model_economics` call can make two dozen upstream requests. Reading
 * live on every call would hammer a hobby-tier host that has no obligation to
 * survive it.
 *
 * But a cache that hides its age is worse than no cache at all here. Stale
 * pricing is the exact harm this tool exists to prevent: a model that stopped
 * being free yesterday reads as free in an answer served from last week. So
 * every cached read carries a measured `fetchedAt` and an `expiresAt`, and once
 * past expiry it is reported as `expired` with the time it was last known
 * good -- never handed back as if it were current.
 */

export const DEFAULT_CACHE_TTL_MS = 5 * 60_000;

/**
 * How a value reached the caller. Part of every answer, not something a caller
 * has to ask for.
 */
export type FreshnessState =
  /** Fetched from upstream during this call. */
  | "live"
  /** Served from cache, still inside its expiry. */
  | "cached"
  /**
   * Served from cache PAST its expiry, because upstream could not be reached.
   * The value is last-known, not current, and says so.
   */
  | "expired";

export type Freshness = {
  state: FreshnessState;
  /** When this value was actually measured from upstream. */
  fetchedAt: string;
  /** Whole seconds between that measurement and this answer. */
  ageSeconds: number;
  expiresAt: string;
  /**
   * Present only when `state` is `expired`: says plainly that the number is the
   * last known one and when it was known, so it cannot be read as current.
   */
  note?: string;
};

type Entry = {
  /** The parsed value, kept so a repeat read does not re-parse. */
  value: unknown;
  fetchedAtMs: number;
  expiresAtMs: number;
};

/**
 * Freshness is attached to the returned object rather than kept in module state,
 * so two clients in the same process -- which is exactly what the test suite
 * does -- cannot read each other's metadata.
 */
const FRESHNESS = new WeakMap<object, Freshness>();

export function freshnessOf(value: unknown): Freshness | null {
  if (value === null || typeof value !== "object") return null;
  return FRESHNESS.get(value) ?? null;
}

function stamp(value: unknown, freshness: Freshness): void {
  if (value !== null && typeof value === "object") {
    FRESHNESS.set(value, freshness);
  }
}

function describe(
  state: FreshnessState,
  fetchedAtMs: number,
  expiresAtMs: number,
  nowMs: number,
): Freshness {
  const fetchedAt = new Date(fetchedAtMs).toISOString();
  const ageSeconds = Math.max(0, Math.floor((nowMs - fetchedAtMs) / 1000));
  return {
    state,
    fetchedAt,
    ageSeconds,
    expiresAt: new Date(expiresAtMs).toISOString(),
    ...(state === "expired"
      ? {
          note: `Upstream could not be reached, so this is the last known value, measured ${fetchedAt} (${ageSeconds}s ago). It is not current.`,
        }
      : {}),
  };
}

export type CachingClientOptions = {
  ttlMs?: number;
  now?: () => number;
};

/**
 * Wrap a client so repeat reads inside the TTL are served from memory.
 *
 * On an upstream failure with an expired entry in hand, the expired value is
 * returned rather than an error -- but marked `expired` with the time it was
 * last known. That is deliberately not a silent fallback: the caller receives
 * the age in the same response and can refuse it. With no entry at all, the
 * upstream error propagates untouched, because "unavailable" and "old" are
 * different answers and only one of them is a number.
 */
export function withCache(
  inner: DashboardClient,
  options: CachingClientOptions = {},
): DashboardClient {
  const ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS;
  const now = options.now ?? (() => Date.now());
  const entries = new Map<string, Entry>();

  return {
    async get<T>(
      path: string,
      query: URLSearchParams,
      schema: z.ZodType<T>,
    ): Promise<T> {
      const key = `${path}?${query.toString()}`;
      const nowMs = now();
      const hit = entries.get(key);

      if (hit && nowMs < hit.expiresAtMs) {
        stamp(
          hit.value,
          describe("cached", hit.fetchedAtMs, hit.expiresAtMs, nowMs),
        );
        return hit.value as T;
      }

      try {
        const value = await inner.get(path, query, schema);
        const expiresAtMs = nowMs + ttlMs;
        entries.set(key, { value, fetchedAtMs: nowMs, expiresAtMs });
        stamp(value, describe("live", nowMs, expiresAtMs, nowMs));
        return value;
      } catch (error) {
        if (hit) {
          stamp(
            hit.value,
            describe("expired", hit.fetchedAtMs, hit.expiresAtMs, nowMs),
          );
          return hit.value as T;
        }
        // Nothing cached: the caller gets the failure, not a fabricated value.
        throw error;
      }
    },
  };
}

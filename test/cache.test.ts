import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

import { freshnessOf, withCache } from "../src/dashboard/cache.js";
import type { DashboardClient } from "../src/dashboard/client.js";
import { DashboardRequestError } from "../src/dashboard/errors.js";

const schema = z.object({ value: z.number() }).strict();

function counting(responses: Array<{ value: number } | Error>): {
  client: DashboardClient;
  calls: () => number;
} {
  let index = 0;
  return {
    calls: () => index,
    client: {
      async get(_path, _query, s) {
        const next = responses[Math.min(index, responses.length - 1)];
        index += 1;
        if (next instanceof Error) throw next;
        return s.parse({ ...next });
      },
    },
  };
}

test("serves a repeat read from cache and says how old it is", async () => {
  let clock = 1_000_000;
  const upstream = counting([{ value: 1 }]);
  const client = withCache(upstream.client, { ttlMs: 60_000, now: () => clock });

  const first = await client.get("/x", new URLSearchParams(), schema);
  assert.equal(freshnessOf(first)?.state, "live");
  assert.equal(freshnessOf(first)?.ageSeconds, 0);

  clock += 30_000;
  const second = await client.get("/x", new URLSearchParams(), schema);
  assert.equal(upstream.calls(), 1, "second read must not hit upstream");
  assert.equal(freshnessOf(second)?.state, "cached");
  // The age is in the answer, not something a caller has to ask for.
  assert.equal(freshnessOf(second)?.ageSeconds, 30);
});

test("refetches once the entry expires", async () => {
  let clock = 1_000_000;
  const upstream = counting([{ value: 1 }, { value: 2 }]);
  const client = withCache(upstream.client, { ttlMs: 60_000, now: () => clock });

  await client.get("/x", new URLSearchParams(), schema);
  clock += 61_000;
  const fresh = await client.get("/x", new URLSearchParams(), schema);
  assert.equal(upstream.calls(), 2);
  assert.equal(fresh.value, 2);
  assert.equal(freshnessOf(fresh)?.state, "live");
});

test("keys the cache by query, not path alone", async () => {
  let clock = 1_000_000;
  const upstream = counting([{ value: 1 }, { value: 2 }]);
  const client = withCache(upstream.client, { ttlMs: 60_000, now: () => clock });

  await client.get("/x", new URLSearchParams({ limit: "1" }), schema);
  await client.get("/x", new URLSearchParams({ limit: "2" }), schema);
  assert.equal(upstream.calls(), 2, "different queries are different reads");
});

test("marks a value expired rather than passing it off as current", async () => {
  let clock = 1_000_000;
  const upstream = counting([
    { value: 7 },
    new DashboardRequestError("unreachable", "down", { retryable: true }),
  ]);
  const client = withCache(upstream.client, { ttlMs: 60_000, now: () => clock });

  await client.get("/x", new URLSearchParams(), schema);
  clock += 120_000;
  const stale = await client.get("/x", new URLSearchParams(), schema);

  const freshness = freshnessOf(stale);
  assert.equal(stale.value, 7);
  // The number still arrives -- but never without the age and the warning.
  assert.equal(freshness?.state, "expired");
  assert.equal(freshness?.ageSeconds, 120);
  assert.match(String(freshness?.note), /last known value/);
  assert.match(String(freshness?.note), /It is not current/);
});

test("propagates the failure when nothing is cached", async () => {
  const upstream = counting([
    new DashboardRequestError("unreachable", "down", { retryable: true }),
  ]);
  const client = withCache(upstream.client, { ttlMs: 60_000 });

  // "unavailable" and "old" are different answers, and only one is a number.
  await assert.rejects(
    client.get("/x", new URLSearchParams(), schema),
    (error: unknown) => error instanceof DashboardRequestError,
  );
});

test("does not leak freshness between two clients in one process", async () => {
  const a = withCache(counting([{ value: 1 }]).client, { ttlMs: 60_000 });
  const b = withCache(counting([{ value: 2 }]).client, { ttlMs: 60_000 });
  const first = await a.get("/x", new URLSearchParams(), schema);
  const second = await b.get("/x", new URLSearchParams(), schema);
  assert.notEqual(first, second);
  assert.equal(freshnessOf(first)?.state, "live");
  assert.equal(freshnessOf(second)?.state, "live");
});

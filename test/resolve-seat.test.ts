import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { SEAT_EXCLUDED, SEAT_POLICIES, SEAT_POOL, SEAT_ROLES, resolveSeatOutputSchema, runResolveSeat } from "../src/tools/resolve-seat.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/seat-pool.json", import.meta.url), "utf8")) as Record<string, string[]>;

function fakeFetch(status: number, body: unknown, seen?: { url?: string; body?: any; auth?: string | null }): typeof fetch {
  return (async (url: any, init: any) => {
    if (seen) { seen.url = String(url); seen.body = JSON.parse(init.body); seen.auth = new Headers(init.headers).get("authorization"); }
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

test("pool, exclusions, roles and policies match the router's shared fixture", () => {
  assert.deepEqual([...SEAT_POOL], fixture.order);
  assert.deepEqual([...SEAT_EXCLUDED], fixture.excluded);
  assert.deepEqual([...SEAT_ROLES], fixture.roles);
  assert.deepEqual([...SEAT_POLICIES], fixture.policies);
  assert.ok(SEAT_EXCLUDED.includes("claude") && SEAT_EXCLUDED.includes("cerebras"));
  assert.equal(SEAT_POOL[SEAT_POOL.length - 1], "openrouter");
});

test("a router seat is passed through, with the cross-family constraint forwarded verbatim", async () => {
  const seen: { url?: string; body?: any; auth?: string | null } = {};
  const out = await runResolveSeat(
    { consumer: "glass-solver", role: "review", excludeFamilies: ["openai"], task: "lock ordering" },
    { routerUrl: "http://router.test/", token: "tok", fetchImpl: fakeFetch(200, {
      outcome: "SEAT", policy: "cheapest", seat: "sail:deepseek-ai/X", provider: "sail", family: "deepseek", tier: 0,
      cost_basis: "list/measured", usd_per_mtok: "0.12", invoke: { kind: "router-proxy" }, because: "ok",
      jev: { used: false }, decision_id: "d1", considered: [] }, seen) });
  assert.equal(out.status, "seat");
  assert.equal(seen.url, "http://router.test/v1/seats/resolve");
  assert.deepEqual(seen.body.exclude_families, ["openai"]);
  assert.equal(seen.body.consumer, "glass-solver");
  assert.equal(seen.auth, "Bearer tok");
  resolveSeatOutputSchema.parse(out);
});

test("free-only with no free seat is 'unavailable', never a paid seat", async () => {
  const out = await runResolveSeat({ consumer: "public-council" }, { fetchImpl: fakeFetch(422, { detail: {
    type: "seat_unavailable", outcome: "UNAVAILABLE", policy: "free-only", because: "no free seat is available", considered: [], seat: null } }) });
  assert.equal(out.status, "unavailable");
  assert.match(JSON.stringify(out), /never falls back to a paid seat/);
  assert.equal("seat" in out, false);
});

test("an unreachable router is reported, and nothing is guessed", async () => {
  const out = await runResolveSeat({ consumer: "glass-solver" }, { fetchImpl: (async () => { throw new TypeError("fetch failed"); }) as typeof fetch });
  assert.equal(out.status, "router_unreachable");
  assert.equal("seat" in out, false);
});

test("a router rejection (unknown consumer) surfaces as 'rejected'", async () => {
  const out = await runResolveSeat({ consumer: "zzz" }, { fetchImpl: fakeFetch(400, { detail: "no policy: unknown consumer and none requested" }) });
  assert.equal(out.status, "rejected");
});

test("bad input is refused before any network call", async () => {
  await assert.rejects(runResolveSeat({ consumer: "x", role: "deploy" as never }, { fetchImpl: (async () => { throw new Error("called"); }) as typeof fetch }));
});

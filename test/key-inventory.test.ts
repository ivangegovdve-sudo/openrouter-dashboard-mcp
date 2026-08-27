import assert from "node:assert/strict";
import test from "node:test";

import {
  KEY_SOURCES_ENV,
  keyInventoryOutputSchema,
  parseKeySources,
  runKeyInventory,
} from "../src/tools/key-inventory.js";

const NOW = () => new Date("2026-08-27T00:00:00.000Z");
const SECRET_A = "sk-or-v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SECRET_B = "sk-or-v1-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function keyPayload(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ data: body }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("parses secret-name to environment-variable pairs and ignores malformed entries", () => {
  assert.deepEqual(parseKeySources("a=A, b=B"), [
    { secretName: "a", envVar: "A" },
    { secretName: "b", envVar: "B" },
  ]);
  assert.deepEqual(parseKeySources("  "), []);
  assert.deepEqual(parseKeySources(undefined), []);
  assert.deepEqual(parseKeySources("noequals,=B,c="), []);
  // A repeated secret name is taken once rather than double counted.
  assert.deepEqual(parseKeySources("a=A,a=OTHER"), [
    { secretName: "a", envVar: "A" },
  ]);
});

test("stays dormant and explains itself when no keys are configured", async () => {
  const output = await runKeyInventory({}, { env: {}, now: NOW });

  assert.equal(output.status, "unconfigured");
  if (output.status !== "unconfigured") assert.fail("expected unconfigured");
  assert.match(output.summary, /zero-credential default, not a failure/);
  assert.match(output.howToEnable, new RegExp(KEY_SOURCES_ENV));
  keyInventoryOutputSchema.parse(output);
});

test("names uncapped keys and separates them from capped gift keys", async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    const authorization = new Headers(init?.headers).get("authorization");
    if (authorization === `Bearer ${SECRET_A}`) {
      return keyPayload({
        label: "gift",
        usage: 2.5,
        limit: 15,
        limit_remaining: 12.5,
        is_free_tier: false,
      });
    }
    return keyPayload({
      label: "workhorse",
      usage: 41.125,
      limit: null,
      limit_remaining: null,
      is_free_tier: false,
    });
  };

  const output = await runKeyInventory(
    {},
    {
      env: {
        [KEY_SOURCES_ENV]:
          "openrouter-anycloudllm-gift=OR_GIFT,openrouter-council=OR_COUNCIL",
        OR_GIFT: SECRET_A,
        OR_COUNCIL: SECRET_B,
      },
      fetchImpl,
      now: NOW,
    },
  );

  assert.equal(output.status, "partial");
  if (output.status === "unconfigured") assert.fail("expected a report");

  const gift = output.keys.find(
    (key) => key.secretName === "openrouter-anycloudllm-gift",
  );
  const council = output.keys.find(
    (key) => key.secretName === "openrouter-council",
  );

  assert.equal(gift?.uncapped, false);
  assert.equal(gift?.usdLimit, 15);
  assert.equal(council?.uncapped, true);
  assert.equal(council?.usdLimit, null);
  assert.equal(output.totals.uncapped, 1);
  assert.equal(output.totals.capped, 1);
  assert.equal(output.totals.usdSpentAcrossActiveKeys, 43.625);
  assert.match(output.warnings.join(" "), /no spend ceiling: openrouter-council/);
  keyInventoryOutputSchema.parse(output);
});

test("never returns a key value anywhere in the result", async () => {
  const fetchImpl: typeof fetch = async () =>
    keyPayload({ label: "any", usage: 1, limit: 5, limit_remaining: 4 });

  const output = await runKeyInventory(
    {},
    {
      env: { [KEY_SOURCES_ENV]: "openrouter-spare=OR_SPARE", OR_SPARE: SECRET_A },
      fetchImpl,
      now: NOW,
    },
  );

  const serialized = JSON.stringify(output);
  assert.doesNotMatch(serialized, /sk-or-v1-/);
  assert.doesNotMatch(serialized, /Bearer/i);
  assert.match(serialized, /openrouter-spare/);
});

test("reports a rejected key as revoked rather than as zero spend", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response("", { status: 401 });

  const output = await runKeyInventory(
    {},
    {
      env: { [KEY_SOURCES_ENV]: "openrouter-dead=OR_DEAD", OR_DEAD: SECRET_A },
      fetchImpl,
      now: NOW,
    },
  );
  if (output.status === "unconfigured") assert.fail("expected a report");

  assert.equal(output.keys[0]?.state, "rejected");
  assert.equal(output.keys[0]?.usdSpent, null);
  assert.equal(output.totals.active, 0);
  assert.match(output.warnings.join(" "), /rejected upstream/);
});

test("reports an unreachable key as unknown rather than as zero spend", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("network down");
  };

  const output = await runKeyInventory(
    {},
    {
      env: { [KEY_SOURCES_ENV]: "openrouter-spare=OR_SPARE", OR_SPARE: SECRET_A },
      fetchImpl,
      now: NOW,
    },
  );
  if (output.status === "unconfigured") assert.fail("expected a report");

  assert.equal(output.keys[0]?.state, "unreachable");
  assert.equal(output.keys[0]?.usdSpent, null);
  assert.equal(output.totals.usdSpentAcrossActiveKeys, 0);
  assert.match(output.warnings.join(" "), /unknown, not as zero spend/);
});

test("reports a configured key that is absent from the environment", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("must not be called");
  };

  const output = await runKeyInventory(
    {},
    {
      env: { [KEY_SOURCES_ENV]: "openrouter-ghost=OR_GHOST" },
      fetchImpl,
      now: NOW,
    },
  );
  if (output.status === "unconfigured") assert.fail("expected a report");

  assert.equal(output.keys[0]?.state, "missing_from_environment");
  assert.match(output.warnings.join(" "), /not present in the environment/);
});

test("issues only GET requests", async () => {
  const methods: string[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    methods.push(init?.method ?? "GET");
    return keyPayload({ label: "any", usage: 0, limit: null });
  };

  await runKeyInventory(
    {},
    {
      env: { [KEY_SOURCES_ENV]: "openrouter-spare=OR_SPARE", OR_SPARE: SECRET_A },
      fetchImpl,
      now: NOW,
    },
  );

  assert.deepEqual(methods, ["GET"]);
});

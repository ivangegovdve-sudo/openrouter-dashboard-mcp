import assert from "node:assert/strict";
import test from "node:test";

import {
  KEY_SOURCES_ENV,
  redactKeyShaped,
  keyInventoryOutputSchema,
  parseKeySources,
  runKeyInventory,
} from "../src/tools/key-inventory.js";

const NOW = () => new Date("2026-08-27T00:00:00.000Z");
const SECRET_A = "sk-or-v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SECRET_B = "sk-or-v1-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SECRET_C = "gsk-cccccccccccccccccccccccccccccccc";

function keyPayload(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify({ data: body }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function modelsPayload(): Response {
  return new Response(JSON.stringify({ object: "list", data: [] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

test("parses provider-scoped triples and rejects unknown providers", () => {
  assert.deepEqual(
    parseKeySources("openrouter:a=A, groq:b=B, cerebras:c=C"),
    [
      { provider: "openrouter", secretName: "a", envVar: "A" },
      { provider: "groq", secretName: "b", envVar: "B" },
      { provider: "cerebras", secretName: "c", envVar: "C" },
    ],
  );
  assert.deepEqual(parseKeySources(undefined), []);
  assert.deepEqual(parseKeySources("  "), []);
  // No provider, unknown provider, and empty halves are all dropped.
  assert.deepEqual(parseKeySources("a=A,hume:b=B,openrouter:=C,groq:d="), []);
  // The same secret under one provider is taken once.
  assert.deepEqual(parseKeySources("groq:a=A,groq:a=OTHER"), [
    { provider: "groq", secretName: "a", envVar: "A" },
  ]);
  // The same secret name under two providers is two distinct keys.
  assert.equal(parseKeySources("groq:shared=A,cerebras:shared=B").length, 2);
});

test("stays dormant and explains the triple format when nothing is configured", async () => {
  const output = await runKeyInventory({}, { env: {}, now: NOW });

  assert.equal(output.status, "unconfigured");
  if (output.status !== "unconfigured") assert.fail("expected unconfigured");
  assert.match(output.summary, /zero-credential default, not a failure/);
  assert.match(output.howToEnable, new RegExp(KEY_SOURCES_ENV));
  assert.match(output.howToEnable, /openrouter, groq or cerebras/);
  keyInventoryOutputSchema.parse(output);
});

test("reads OpenRouter spend and reports Groq spend as structurally unreadable", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("openrouter.ai")) {
      return keyPayload({
        label: "council",
        usage: 41.125,
        limit: null,
        limit_remaining: null,
        is_free_tier: false,
      });
    }
    return modelsPayload();
  };

  const output = await runKeyInventory(
    {},
    {
      env: {
        [KEY_SOURCES_ENV]:
          "openrouter:openrouter-primary=OR_COUNCIL,groq:groq-primary=GROQ_OD",
        OR_COUNCIL: SECRET_A,
        GROQ_OD: SECRET_C,
      },
      fetchImpl,
      now: NOW,
    },
  );
  if (output.status === "unconfigured") assert.fail("expected a report");

  const or = output.keys.find((key) => key.provider === "openrouter");
  const groq = output.keys.find((key) => key.provider === "groq");

  assert.equal(or?.spendReadability, "read");
  assert.equal(or?.usdSpent, 41.125);
  assert.equal(or?.uncapped, true);

  // Groq authenticated, but its spend is unreadable rather than zero.
  assert.equal(groq?.state, "active");
  assert.equal(groq?.alive, true);
  assert.equal(groq?.spendReadability, "no_billing_api");
  assert.equal(groq?.usdSpent, null);
  assert.equal(groq?.uncapped, null);
  assert.match(String(groq?.note), /no billing API/);

  assert.equal(output.totals.alive, 2);
  assert.equal(output.totals.spendUnreadable, 1);
  assert.equal(output.totals.usdSpentWhereReadable, 41.125);
  assert.match(output.warnings.join(" "), /Unknown, not zero, and not capped/);
  keyInventoryOutputSchema.parse(output);
});

test("separates a Cloudflare edge block from a rejected credential", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    if (String(input).includes("groq")) {
      return new Response(
        "error code: 1010 -- Cloudflare -- access denied",
        { status: 403 },
      );
    }
    return new Response(
      JSON.stringify({ error: { code: "invalid_api_key" } }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  };

  const output = await runKeyInventory(
    {},
    {
      env: {
        [KEY_SOURCES_ENV]:
          "groq:groq-secondary=GROQ_PI,openrouter:openrouter-dead=OR_DEAD",
        GROQ_PI: SECRET_C,
        OR_DEAD: SECRET_B,
      },
      fetchImpl,
      now: NOW,
    },
  );
  if (output.status === "unconfigured") assert.fail("expected a report");

  const groq = output.keys.find((key) => key.provider === "groq");
  const or = output.keys.find((key) => key.provider === "openrouter");

  assert.equal(groq?.state, "edge_blocked");
  // An edge block is not evidence the key is dead, so alive stays unknown.
  assert.equal(groq?.alive, null);
  assert.match(String(groq?.note), /do not rotate it on this signal/i);

  assert.equal(or?.state, "rejected");
  assert.equal(or?.alive, false);

  assert.match(output.warnings.join(" "), /Do not rotate on this signal/);
  assert.match(output.warnings.join(" "), /rejected by their provider/);
});

test("always sends a User-Agent so an edge does not reject the probe", async () => {
  const agents: (string | null)[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    agents.push(new Headers(init?.headers).get("user-agent"));
    return modelsPayload();
  };

  await runKeyInventory(
    {},
    {
      env: {
        [KEY_SOURCES_ENV]: "cerebras:cerebras-primary=CB",
        CB: SECRET_C,
      },
      fetchImpl,
      now: NOW,
    },
  );

  assert.equal(agents.length, 1);
  assert.match(String(agents[0]), /open-dashboard-mcp/);
});

test("never returns a key value anywhere in the result", async () => {
  const fetchImpl: typeof fetch = async (input) =>
    String(input).includes("openrouter")
      ? keyPayload({ label: "any", usage: 1, limit: 5, limit_remaining: 4 })
      : modelsPayload();

  const output = await runKeyInventory(
    {},
    {
      env: {
        [KEY_SOURCES_ENV]:
          "openrouter:openrouter-spare=OR_SPARE,cerebras:cerebras-secondary=CB",
        OR_SPARE: SECRET_A,
        CB: SECRET_C,
      },
      fetchImpl,
      now: NOW,
    },
  );

  const serialized = JSON.stringify(output);
  assert.doesNotMatch(serialized, /sk-or-v1-/);
  assert.doesNotMatch(serialized, /gsk-/);
  assert.doesNotMatch(serialized, /Bearer/i);
  assert.match(serialized, /openrouter-spare/);
  assert.match(serialized, /cerebras-secondary/);
});

test("filters to the requested providers", async () => {
  const fetchImpl: typeof fetch = async () => modelsPayload();

  const output = await runKeyInventory(
    { providers: ["cerebras"] },
    {
      env: {
        [KEY_SOURCES_ENV]:
          "groq:groq-secondary=GROQ_PI,cerebras:cerebras-tertiary=CB",
        GROQ_PI: SECRET_C,
        CB: SECRET_C,
      },
      fetchImpl,
      now: NOW,
    },
  );
  if (output.status === "unconfigured") assert.fail("expected a report");

  assert.deepEqual(
    output.keys.map((key) => key.secretName),
    ["cerebras-tertiary"],
  );
});

test("reports an unreachable key as unknown rather than as zero spend", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("network down");
  };

  const output = await runKeyInventory(
    {},
    {
      env: {
        [KEY_SOURCES_ENV]: "openrouter:openrouter-spare=OR_SPARE",
        OR_SPARE: SECRET_A,
      },
      fetchImpl,
      now: NOW,
    },
  );
  if (output.status === "unconfigured") assert.fail("expected a report");

  assert.equal(output.keys[0]?.state, "unreachable");
  assert.equal(output.keys[0]?.usdSpent, null);
  assert.equal(output.totals.usdSpentWhereReadable, 0);
  assert.match(output.warnings.join(" "), /unknown, not as zero spend/);
});

test("reports a configured key that is absent from the environment", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("must not be called");
  };

  const output = await runKeyInventory(
    {},
    {
      env: { [KEY_SOURCES_ENV]: "groq:groq-ghost=GROQ_GHOST" },
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
      env: {
        [KEY_SOURCES_ENV]: "openrouter:openrouter-spare=OR_SPARE",
        OR_SPARE: SECRET_A,
      },
      fetchImpl,
      now: NOW,
    },
  );

  assert.deepEqual(methods, ["GET"]);
});

test("redacts anything key-shaped rather than trimming it", () => {
  // A masked fingerprint is still key material. A prefix, a suffix, or "just the
  // last four to confirm it loaded" is not a safe thing to return.
  assert.match(String(redactKeyShaped("sk-or-v1-au7...890")), /redacted/);
  assert.match(String(redactKeyShaped(SECRET_A)), /redacted/);
  assert.match(String(redactKeyShaped("Bearer abc123")), /redacted/);
  assert.match(String(redactKeyShaped("gsk_abcdefghijklmnop")), /redacted/);
  // Ordinary labels survive untouched.
  assert.equal(redactKeyShaped("production router"), "production router");
  assert.equal(redactKeyShaped(null), null);
});

test("does not echo a provider label that is a masked key fingerprint", async () => {
  const fetchImpl: typeof fetch = async () =>
    keyPayload({
      // OpenRouter documents `label` as a masked key fingerprint.
      label: "sk-or-v1-au7...890",
      usage: 1,
      limit: null,
    });

  const output = await runKeyInventory(
    {},
    {
      env: { [KEY_SOURCES_ENV]: "openrouter:my-key=OR", OR: SECRET_A },
      fetchImpl,
      now: NOW,
    },
  );
  if (output.status === "unconfigured") assert.fail("expected a report");

  assert.match(String(output.keys[0]?.label), /redacted/);
  assert.doesNotMatch(JSON.stringify(output), /au7/);
});

test("does not echo a real key pasted into the secret-name position", async () => {
  const fetchImpl: typeof fetch = async () => modelsPayload();

  const output = await runKeyInventory(
    {},
    {
      env: {
        [KEY_SOURCES_ENV]: `groq:${SECRET_C}=GK`,
        GK: SECRET_C,
      },
      fetchImpl,
      now: NOW,
    },
  );
  if (output.status === "unconfigured") assert.fail("expected a report");

  // The operator writes this half; a mistake there must not become a leak.
  assert.doesNotMatch(JSON.stringify(output), /cccccccc/);
  assert.match(String(output.keys[0]?.secretName), /redacted/);
});

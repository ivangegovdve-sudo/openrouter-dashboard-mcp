import assert from "node:assert/strict";
import test from "node:test";

import {
  isPlausibleSecretName,
  KEY_SOURCES_ENV,
  OMITTED_SECRET_NAME,
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

test("Sail's documented billing API is unread rather than nonexistent, including failed probes", async () => {
  for (const active of [true, false]) {
    const requested: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      requested.push(String(input));
      if (!active) throw new Error("fixture network failure");
      return modelsPayload();
    };
    const output = await runKeyInventory({}, {
      env: { [KEY_SOURCES_ENV]: "sail:sail-primary=SAIL_TEST", SAIL_TEST: SECRET_A },
      fetchImpl,
      now: NOW,
    });
    if (output.status === "unconfigured") assert.fail("expected a report");
    assert.deepEqual(requested, ["https://api.sailresearch.com/v1/models"]);
    const sail = output.keys[0];
    assert.ok(sail);
    assert.equal(sail.spendReadability, "unread");
    assert.equal(sail.usdSpent, null);
    assert.equal(sail.alive, active ? true : null);
    assert.doesNotMatch(JSON.stringify(output), /exposes no billing API|no_billing_api/);
    assert.equal(output.providers[0]?.spendVisibility, "unknown");
    if (active) assert.match(String(sail.note), /not read by this integration/);
    keyInventoryOutputSchema.parse(output);
  }
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

test("does not return the provider key label at all", async () => {
  const fetchImpl: typeof fetch = async () =>
    keyPayload({
      // OpenRouter documents `label` as a masked key fingerprint. Rather than
      // trying to recognise every format a provider might use, the field is not
      // returned -- that removes the question instead of answering it badly.
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

  const serialized = JSON.stringify(output);
  assert.doesNotMatch(serialized, /au7/);
  assert.doesNotMatch(serialized, /label/);
  assert.equal(output.keys[0]?.secretName, "my-key");
});

test("omits, rather than echoes, a secret-name position that is not a name", async () => {
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
  assert.equal(output.keys[0]?.secretName, OMITTED_SECRET_NAME);
});

test("does not redact an ordinary label that merely contains a key-ish substring", () => {
  // "task-production" contains "sk-production"; a left word boundary keeps it.
  assert.equal(redactKeyShaped("task-production"), "task-production");
  assert.equal(redactKeyShaped("openrouter-primary-key"), "openrouter-primary-key");
  assert.equal(redactKeyShaped("my-groq-key-for-batch-jobs"), "my-groq-key-for-batch-jobs");
});

test("redacts an opaque token from a credential family it has never seen", () => {
  // The named patterns are a denylist and cannot know about future families,
  // so a long high-entropy run is redacted on shape alone.
  assert.match(String(redactKeyShaped("Zx9Qw2Lm8Rt4Yv6Bn1Kp3Hd5Fg7Js0Aa")), /redacted/);
  assert.match(String(redactKeyShaped("label: 8f3aB9c2D7e1F4g6H8j0K2l4M6n8P0q2R4s6")), /redacted/);
  // Prose and slugs are untouched.
  assert.equal(redactKeyShaped("production router for batch"), "production router for batch");
});

test("accepts real secret-manager names and refuses everything that is not one", () => {
  for (const name of [
    "openrouter-primary",
    "groq_open_dashboard",
    "cerebras.key.2",
    "my-key",
  ]) {
    assert.equal(isPlausibleSecretName(name), true, name);
  }

  // Every bypass the reviewer found against the shape heuristic, refused here by
  // the positive rule instead: a NAME is short and word-like.
  for (const notAName of [
    "deadbeefdeadbeefdeadbeefdeadbeef",
    "550e8400-e29b-41d4-a716-446655440000",
    "Ab3Cd5Ef7Gh9Jk2Lm4Np6Qr",
    "Ab3Cd5Ef7Gh9Jk2-Lm4Np6Qr8St0Uv2",
    "sk-or-v1-aaaaaaaaaaaaaaaaaaaaaaaa",
    "key_sk-abc12345678",
    "a".repeat(65),
    "has spaces",
    "-leading-hyphen",
  ]) {
    assert.equal(isPlausibleSecretName(notAName), false, notAName);
  }
});

test("redacts underscore-prefixed credentials, which a word boundary would miss", () => {
  // JavaScript \b counts _ as a word character, so \bsk- would let these pass.
  assert.match(String(redactKeyShaped("key_sk-abc12345678")), /redacted/);
  assert.match(String(redactKeyShaped("auth_Bearer abc123")), /redacted/);
  assert.match(String(redactKeyShaped("x_gsk_abcdefghijkl")), /redacted/);
});

test("redacts the opaque shapes that slipped past the first heuristic", () => {
  for (const token of [
    "deadbeefdeadbeefdeadbeefdeadbeef",
    "550e8400-e29b-41d4-a716-446655440000",
    "token:Zx9Qw2Lm8Rt4Yv6Bn1Kp3Hd5Fg7Js0Aa",
    '"Zx9Qw2Lm8Rt4Yv6Bn1Kp3Hd5Fg7"',
  ]) {
    assert.match(String(redactKeyShaped(token)), /redacted/, token);
  }
  // Ordinary prose and slugs still survive.
  for (const ok of [
    "production router",
    "openrouter-primary-key",
    "batch jobs europe",
  ]) {
    assert.equal(redactKeyShaped(ok), ok, ok);
  }
});

test("redacts a dotted credential and keeps a realistic versioned name", () => {
  // A run scanner that breaks on dots never sees these as one token.
  assert.match(String(redactKeyShaped("deadbeef.deadbeef.deadbeef.deadbeef")), /redacted/);
  assert.match(String(redactKeyShaped("Ab3Cd5Ef7Gh9Jk2.Lm4Np6Qr8St0Uv2")), /redacted/);
  assert.equal(isPlausibleSecretName("deadbeef.deadbeef.deadbeef.deadbeef"), false);
  assert.equal(isPlausibleSecretName("Ab3Cd5Ef7Gh9Jk2.Lm4Np6Qr8St0Uv2"), false);

  // Names made of words survive, including versioned and long ones.
  for (const name of [
    "openrouter-primary-key-2026",
    "my-groq-key-for-batch-jobs",
    "openRouterPrimary",
    "project.openrouter.primary",
  ]) {
    assert.equal(redactKeyShaped(name), name, name);
    assert.equal(isPlausibleSecretName(name), true, name);
  }
});

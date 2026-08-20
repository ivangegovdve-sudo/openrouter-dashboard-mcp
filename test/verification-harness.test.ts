import assert from "node:assert/strict";
import { connect } from "node:net";
import test from "node:test";

import { z } from "zod";

import { createDashboardClient } from "../src/dashboard/client.js";
import { DashboardRequestError } from "../src/dashboard/errors.js";

async function loadFixtureHarness(): Promise<
  typeof import("../scripts/fixture-dashboard.js")
> {
  try {
    return await import("../scripts/fixture-dashboard.js");
  } catch (error) {
    assert.fail(`fixture harness must load: ${String(error)}`);
  }
}

async function loadStdioHarness(): Promise<
  typeof import("../scripts/verify-stdio.js")
> {
  try {
    return await import("../scripts/verify-stdio.js");
  } catch (error) {
    assert.fail(`stdio harness must load: ${String(error)}`);
  }
}

async function loadStdoutHarness(): Promise<
  typeof import("../scripts/verify-stdout.js")
> {
  try {
    return await import("../scripts/verify-stdout.js");
  } catch (error) {
    assert.fail(`stdout harness must load: ${String(error)}`);
  }
}

test("fixture valid mode returns schema-valid JSON and records no body", async () => {
  const { startFixtureDashboard } = await loadFixtureHarness();
  const fixture = await startFixtureDashboard({ mode: "fixture" });
  try {
    const client = createDashboardClient({ baseUrl: fixture.baseUrl });
    const result = await client.get(
      "/__self-test/valid",
      new URLSearchParams(),
      z.object({ status: z.literal("ok") }).strict(),
    );

    assert.deepEqual(result, { status: "ok" });
    assert.deepEqual(fixture.requests, [
      { method: "GET", path: "/__self-test/valid", query: "" },
    ]);
    assert.doesNotMatch(JSON.stringify(fixture.requests), /body|headers/i);
  } finally {
    await fixture.close();
    await fixture.close();
  }
});

test("fixture HTTP 500 mode becomes a bounded http_error", async () => {
  const { startFixtureDashboard } = await loadFixtureHarness();
  const fixture = await startFixtureDashboard({ mode: "fixture" });
  try {
    const client = createDashboardClient({ baseUrl: fixture.baseUrl });
    await assert.rejects(
      client.get(
        "/__self-test/500",
        new URLSearchParams(),
        z.object({ status: z.string() }),
      ),
      (error: unknown) =>
        error instanceof DashboardRequestError &&
        error.kind === "http_error" &&
        error.status === 500,
    );
  } finally {
    await fixture.close();
  }
});

test("fixture HTML mode becomes non_json without leaking its body", async () => {
  const { startFixtureDashboard } = await loadFixtureHarness();
  const fixture = await startFixtureDashboard({ mode: "fixture" });
  try {
    const client = createDashboardClient({ baseUrl: fixture.baseUrl });
    await assert.rejects(
      client.get(
        "/__self-test/html",
        new URLSearchParams(),
        z.object({ status: z.string() }),
      ),
      (error: unknown) =>
        error instanceof DashboardRequestError &&
        error.kind === "non_json" &&
        !JSON.stringify(error).includes("fixture-html-body"),
    );
  } finally {
    await fixture.close();
  }
});

test("fixture hung mode obeys an injected short DashboardClient timeout", async () => {
  const { startFixtureDashboard } = await loadFixtureHarness();
  const fixture = await startFixtureDashboard({ mode: "fixture" });
  const startedAt = performance.now();
  try {
    const client = createDashboardClient({
      baseUrl: fixture.baseUrl,
      timeoutMs: 75,
    });
    await assert.rejects(
      client.get(
        "/__self-test/hang",
        new URLSearchParams(),
        z.object({ status: z.string() }),
      ),
      (error: unknown) =>
        error instanceof DashboardRequestError && error.kind === "timeout",
    );
    assert.ok(performance.now() - startedAt < 1_000);
  } finally {
    await fixture.close();
  }
});

test("dead-port allocation returns a loopback URL that refuses connections", async () => {
  const { allocateDeadDashboardUrl } = await loadFixtureHarness();
  const baseUrl = await allocateDeadDashboardUrl();
  const url = new URL(baseUrl);

  assert.equal(url.hostname, "127.0.0.1");
  await assert.rejects(
    new Promise<void>((resolve, reject) => {
      const socket = connect(Number(url.port), url.hostname);
      socket.setTimeout(1_000);
      socket.once("connect", () => {
        socket.destroy();
        resolve();
      });
      socket.once("timeout", () => {
        socket.destroy();
        reject(new Error("dead port connection timed out"));
      });
      socket.once("error", reject);
    }),
  );
});

test("standard call matrix covers the exact seven tools and arguments", async () => {
  const { STANDARD_CALLS } = await loadStdioHarness();

  assert.deepEqual(STANDARD_CALLS, [
    {
      name: "dashboard_resolve_model",
      arguments: {
        intent: "any_available",
        constraints: { outputModality: "text" },
        fallbackDepth: 3,
        verbose: false,
      },
    },
    {
      name: "dashboard_model_status",
      arguments: { slug: "groq/llama-3.3-70b-versatile" },
    },
    {
      name: "dashboard_whats_changed",
      arguments: { since: "2026-08-18", limit: 5 },
    },
    {
      name: "dashboard_free_models",
      arguments: { outputModality: "text", limit: 5 },
    },
    {
      name: "dashboard_usage_leaders",
      arguments: { windowDays: 7, limit: 5 },
    },
    { name: "dashboard_source_health", arguments: {} },
    {
      name: "dashboard_github_movers",
      arguments: { category: "mcp", windowDays: 7, limit: 5 },
    },
  ]);
});

test("diagnostic call matrix covers all seven deliberate assertions", async () => {
  const { DIAGNOSTIC_CALLS } = await loadStdioHarness();

  assert.deepEqual(DIAGNOSTIC_CALLS, [
    {
      name: "dashboard_resolve_model",
      arguments: {
        intent: "cheapest_capable",
        constraints: {
          free: true,
          minContext: "90071992547409930002",
          outputModality: "text",
        },
        fallbackDepth: 3,
        verbose: false,
      },
    },
    {
      name: "dashboard_model_status",
      arguments: { slug: "fixture/no-such-model" },
    },
    {
      name: "dashboard_whats_changed",
      arguments: { since: "2026-08-18", limit: 5 },
    },
    {
      name: "dashboard_free_models",
      arguments: { outputModality: "text", limit: 5 },
    },
    {
      name: "dashboard_usage_leaders",
      arguments: { windowDays: 7, limit: 3 },
    },
    { name: "dashboard_source_health", arguments: {} },
    {
      name: "dashboard_github_movers",
      arguments: { category: "mcp", windowDays: 7, limit: 3 },
    },
  ]);
  assert.equal(new Set(DIAGNOSTIC_CALLS.map((call) => call.name)).size, 7);
});

test("live capability declines require the exact route and PR 24 message", async () => {
  const { assertModeResult } = await loadStdioHarness();
  const capabilityMessage =
    "This tool needs /api/public/v2/live-models, which is not yet deployed. It ships with PR #24. Until then, ask about deprecations or history instead.";
  const exact = {
    status: "unavailable",
    summary: capabilityMessage,
    message: capabilityMessage,
    missingCapability: "/api/public/v2/live-models",
  };

  assert.doesNotThrow(() =>
    assertModeResult("live", "dashboard_resolve_model", exact, 1),
  );
  for (const invalid of [
    { ...exact, missingCapability: "/api/public/v2/other" },
    { ...exact, summary: "wrong" },
    { ...exact, message: "wrong" },
  ]) {
    assert.throws(() =>
      assertModeResult("live", "dashboard_resolve_model", invalid, 1),
    );
  }
});

test("evidence sanitization removes forbidden diagnostics and strips URL secrets", async () => {
  const { sanitizeEvidenceValue } = await loadStdioHarness();
  const result = sanitizeEvidenceValue({
    mode: "fixture",
    responseBody: "fixture-html-body",
    stack: "private stack",
    cause: "private cause",
    headers: { accept: "application/json" },
    environment: { region: "test" },
    sourceUrl: "https://user@example.test/path?private=yes#fragment",
    structuredContent: { status: "ok", totalTokens: "10" },
  });
  const serialized = JSON.stringify(result);

  assert.deepEqual(result, {
    mode: "fixture",
    sourceUrl: "https://example.test/path",
    structuredContent: { status: "ok", totalTokens: "10" },
  });
  assert.doesNotMatch(
    serialized,
    /fixture-html-body|private stack|private cause|private=yes|fragment/,
  );
});

test("credential guard rejects normalized credential fields and values", async () => {
  const { assertEvidenceCredentialSafe } = await loadStdioHarness();

  for (const value of [
    { api_key: "redacted" },
    { Authorization: "redacted" },
    { clientSecret: "redacted" },
    { access_token: "redacted" },
    { note: ["Bear", "er neutral"].join("") },
  ]) {
    assert.throws(() => assertEvidenceCredentialSafe(value));
  }

  assert.doesNotThrow(() =>
    assertEvidenceCredentialSafe({
      totalTokens: "10",
      ecosystemTokenVolume: "20",
      promptUsdPerToken: "0.000001",
      completionUsdPerToken: "0.000002",
    }),
  );
});

test("purity parser accepts only complete correlated JSON-RPC NDJSON", async () => {
  const { parsePurityFrames } = await loadStdoutHarness();
  const bytes = Buffer.from(
    '{"jsonrpc":"2.0","id":1,"result":{}}\n' +
      '{"jsonrpc":"2.0","method":"notifications/tools/list_changed"}\n' +
      '{"jsonrpc":"2.0","id":2,"result":{"tools":[]}}\n',
    "utf8",
  );

  const frames = parsePurityFrames(bytes, new Set([1, 2]));

  assert.equal(frames.length, 3);
  assert.deepEqual(
    frames
      .filter((frame) => "id" in frame)
      .map((frame) => (frame as { id: unknown }).id),
    [1, 2],
  );
});

test("purity parser rejects an id-bearing server request as a response", async () => {
  const { parsePurityFrames } = await loadStdoutHarness();
  const bytes = Buffer.from(
    '{"jsonrpc":"2.0","id":1,"method":"sampling/createMessage","params":{}}\n',
    "utf8",
  );

  assert.throws(() => parsePurityFrames(bytes, new Set([1])));
});

for (const purityCase of [
  {
    name: "malformed JSON-RPC",
    bytes: Buffer.from("not-json\n", "utf8"),
    expectedIds: new Set<number>(),
  },
  {
    name: "invalid UTF-8",
    bytes: Buffer.from([0xff, 0x0a]),
    expectedIds: new Set<number>(),
  },
  {
    name: "blank interstitial stdout line",
    bytes: Buffer.from(
      '{"jsonrpc":"2.0","id":1,"result":{}}\n\n',
      "utf8",
    ),
    expectedIds: new Set([1]),
  },
  {
    name: "unterminated final frame",
    bytes: Buffer.from('{"jsonrpc":"2.0","id":1,"result":{}}', "utf8"),
    expectedIds: new Set([1]),
  },
  {
    name: "unknown response id",
    bytes: Buffer.from(
      '{"jsonrpc":"2.0","id":2,"result":{}}\n',
      "utf8",
    ),
    expectedIds: new Set([1]),
  },
  {
    name: "missing expected response id",
    bytes: Buffer.from(
      '{"jsonrpc":"2.0","id":1,"result":{}}\n',
      "utf8",
    ),
    expectedIds: new Set([1, 2]),
  },
] as const) {
  test(`purity parser rejects ${purityCase.name}`, async () => {
    const { parsePurityFrames } = await loadStdoutHarness();
    assert.throws(() =>
      parsePurityFrames(purityCase.bytes, purityCase.expectedIds),
    );
  });
}

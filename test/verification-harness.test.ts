import assert from "node:assert/strict";
import { connect } from "node:net";
import test from "node:test";

import { z } from "zod";

import { createDashboardClient } from "../src/dashboard/client.js";
import { DashboardRequestError } from "../src/dashboard/errors.js";
import { runFreeModels } from "../src/tools/free-models.js";
import { runModelStatus } from "../src/tools/model-status.js";
import { runResolveModel } from "../src/tools/resolve-model.js";

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

test("standard call matrix covers the exact ten tools and arguments", async () => {
  const { STANDARD_CALLS } = await loadStdioHarness();

  assert.deepEqual(STANDARD_CALLS, [
    {
      name: "dashboard_resolve_model",
      arguments: {
        intent: "any_available",
        constraints: { outputModality: "text" },
        fallbackDepth: 3,
        verbose: true,
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
    {
      name: "dashboard_github_trending",
      arguments: { since: "daily", limit: 5 },
    },
    {
      name: "dashboard_model_economics",
      arguments: { outputModality: "text", limit: 5, discountEnrichment: 2 },
    },
    { name: "dashboard_key_inventory", arguments: {} },
  ]);
});

test("diagnostic call matrix covers all ten deliberate assertions", async () => {
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
    {
      name: "dashboard_github_trending",
      arguments: { since: "daily", limit: 3 },
    },
    {
      name: "dashboard_model_economics",
      arguments: {
        ids: [
          "fixture/discounted",
          "fixture-groq/priced",
          "fixture-cerebras/bare",
          "fixture/no-such-model",
        ],
        discountEnrichment: 3,
      },
    },
    { name: "dashboard_key_inventory", arguments: {} },
  ]);
  assert.equal(new Set(DIAGNOSTIC_CALLS.map((call) => call.name)).size, 10);
});

test("offline mode rejects a schema-invalid payload with nested unreachable evidence", async () => {
  const { assertModeResult } = await loadStdioHarness();

  assert.throws(() =>
    assertModeResult(
      "offline",
      "dashboard_source_health",
      {
        status: "not-a-registered-output-branch",
        nested: { kind: "unreachable" },
      },
      1,
    ),
  );
});

test("HTML mode rejects a schema-invalid payload with nested non_json evidence", async () => {
  const { assertModeResult } = await loadStdioHarness();

  assert.throws(() =>
    assertModeResult(
      "html",
      "dashboard_source_health",
      {
        status: "not-a-registered-output-branch",
        nested: { kind: "non_json" },
      },
      1,
    ),
  );
});

test("live capability declines require the exact route and PR 24 message", async () => {
  const { assertModeResult } = await loadStdioHarness();
  const capabilityMessage =
    "This tool needs /api/public/v2/live-models, which the dashboard is not currently publishing. Ask about deprecations or history instead, and check dashboard_source_health for which collector is failing.";
  const exact = {
    status: "unavailable",
    summary: capabilityMessage,
    message: capabilityMessage,
    missingCapability: "/api/public/v2/live-models",
    evidence: [],
    provenance: [],
    warnings: [],
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

test("live normal-branch validation enforces schemas and tool invariants", async () => {
  const { assertModeResult } = await loadStdioHarness();
  const { startFixtureDashboard } = await loadFixtureHarness();
  const fixture = await startFixtureDashboard({ mode: "fixture" });
  try {
    const client = createDashboardClient({ baseUrl: fixture.baseUrl });
    const resolverArguments = {
      intent: "cheapest_capable" as const,
      constraints: { free: true, outputModality: "text" },
      fallbackDepth: 3,
      verbose: true,
    };
    const statusArguments = { slug: "fixture/free-text" };
    const freeArguments = { outputModality: "text", limit: 5 };
    const [resolver, status, free] = await Promise.all([
      runResolveModel(resolverArguments, { client }),
      runModelStatus(statusArguments, { client }),
      runFreeModels(freeArguments, { client }),
    ]);

    if (resolver.status !== "ok" || resolver.resolved[0] === undefined) {
      assert.fail("fixture resolver must return a normal resolved row");
    }
    if (status.status !== "ok") {
      assert.fail("fixture model status must return the exact requested model");
    }
    if (
      (free.status !== "ok" && free.status !== "partial") ||
      free.liveCandidates.data[0] === undefined
    ) {
      assert.fail("fixture free-model output must return a normal candidate row");
    }
    assert.ok(resolver.excluded.some((entry) => entry.reason === "disappeared"));
    assert.ok(
      resolver.excluded.some(
        (entry) => entry.reason === "pricing_not_published",
      ),
    );

    assert.doesNotThrow(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        resolver,
        1,
        resolverArguments,
      ),
    );
    assert.doesNotThrow(() =>
      assertModeResult(
        "live",
        "dashboard_model_status",
        status,
        1,
        statusArguments,
      ),
    );
    assert.doesNotThrow(() =>
      assertModeResult(
        "live",
        "dashboard_free_models",
        free,
        1,
        freeArguments,
      ),
    );

    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        { ...resolver, schemaVersion: "1.0" },
        1,
        resolverArguments,
      ),
    );

    const resolverUnknown = structuredClone(resolver);
    resolverUnknown.resolved[0]!.isFree = null;
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        resolverUnknown,
        1,
        resolverArguments,
      ),
    );

    const resolverOverlap = structuredClone(resolver);
    resolverOverlap.excluded.push({
      provider: resolverOverlap.resolved[0]!.provider,
      id: resolverOverlap.resolved[0]!.id,
      reason: "disappeared",
    });
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        resolverOverlap,
        1,
        resolverArguments,
      ),
    );

    const wrongModel = structuredClone(status);
    wrongModel.model.id = "fixture/different-model";
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_model_status",
        wrongModel,
        1,
        statusArguments,
      ),
    );

    const unavailableFree = structuredClone(free);
    unavailableFree.liveCandidates.data[0]!.availability = "disappeared";
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_free_models",
        unavailableFree,
        1,
        freeArguments,
      ),
    );

    const overLimitFree = structuredClone(free);
    overLimitFree.liveCandidates.data = Array.from(
      { length: freeArguments.limit + 1 },
      () => structuredClone(free.liveCandidates.data[0]!),
    );
    overLimitFree.liveCandidates.cap.returnedCount =
      overLimitFree.liveCandidates.data.length;
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_free_models",
        overLimitFree,
        1,
        freeArguments,
      ),
    );
  } finally {
    await fixture.close();
  }
});

test("resolver live invariants require exactly the bounded eligible result count", async () => {
  const { assertModeResult } = await loadStdioHarness();
  const { startFixtureDashboard } = await loadFixtureHarness();
  const fixture = await startFixtureDashboard({ mode: "fixture" });
  try {
    const client = createDashboardClient({ baseUrl: fixture.baseUrl });
    const resolverArguments = {
      intent: "any_available" as const,
      constraints: { free: true, outputModality: "text" },
      fallbackDepth: 3,
      verbose: true,
    };
    const resolver = await runResolveModel(resolverArguments, { client });
    if (resolver.status !== "ok" || resolver.resolved.length !== 1) {
      assert.fail("fixture resolver must return one normal resolved row");
    }

    const empty = structuredClone(resolver);
    empty.resolved = [];
    empty.cap.eligibleCount = 1;
    empty.cap.resolvedCount = 0;
    empty.cap.fallbackTruncated = true;
    empty.unsatisfiable = true;
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        empty,
        1,
        resolverArguments,
      ),
    );

    const undersized = structuredClone(resolver);
    undersized.cap.eligibleCount = 2;
    undersized.cap.fallbackTruncated = true;
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        undersized,
        1,
        resolverArguments,
      ),
    );
  } finally {
    await fixture.close();
  }
});

test("resolver live invariants prove every observable requested capability", async () => {
  const { assertModeResult } = await loadStdioHarness();
  const { startFixtureDashboard } = await loadFixtureHarness();
  const fixture = await startFixtureDashboard({ mode: "fixture" });
  try {
    const client = createDashboardClient({ baseUrl: fixture.baseUrl });
    const baseArguments = {
      intent: "any_available" as const,
      constraints: { free: true, outputModality: "text" },
      fallbackDepth: 3,
      verbose: true,
    };
    const resolver = await runResolveModel(baseArguments, { client });
    if (
      resolver.status !== "ok" ||
      resolver.resolved[0]?.details === undefined
    ) {
      assert.fail("verbose fixture resolver must expose candidate details");
    }
    assert.doesNotThrow(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        resolver,
        1,
        baseArguments,
      ),
    );

    const missingDetails = structuredClone(resolver);
    delete missingDetails.resolved[0]!.details;
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        missingDetails,
        1,
        baseArguments,
      ),
    );

    const wrongDetailsIdentity = structuredClone(resolver);
    wrongDetailsIdentity.resolved[0]!.details!.id = "fixture/other-model";
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        wrongDetailsIdentity,
        1,
        baseArguments,
      ),
    );

    const wrongModality = structuredClone(resolver);
    wrongModality.resolved[0]!.details!.outputModalities = ["audio"];
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        wrongModality,
        1,
        baseArguments,
      ),
    );

    const reasoningArguments = {
      ...baseArguments,
      constraints: { ...baseArguments.constraints, reasoning: true },
    };
    const reasoning = structuredClone(resolver);
    reasoning.constraints = { ...reasoning.constraints, reasoning: true };
    assert.doesNotThrow(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        reasoning,
        1,
        reasoningArguments,
      ),
    );
    const unknownReasoning = structuredClone(reasoning);
    unknownReasoning.resolved[0]!.details!.reasoningEfforts = null;
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        unknownReasoning,
        1,
        reasoningArguments,
      ),
    );

    const nonReasoningArguments = {
      ...baseArguments,
      constraints: { ...baseArguments.constraints, reasoning: false },
    };
    const nonReasoning = structuredClone(resolver);
    nonReasoning.constraints = {
      ...nonReasoning.constraints,
      reasoning: false,
    };
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        nonReasoning,
        1,
        nonReasoningArguments,
      ),
    );

    const activeProviderArguments = {
      ...baseArguments,
      constraints: {
        ...baseArguments.constraints,
        requireProviderActive: true as const,
      },
    };
    const activeProvider = structuredClone(resolver);
    activeProvider.constraints = {
      ...activeProvider.constraints,
      requireProviderActive: true,
    };
    activeProvider.resolved[0]!.details!.providerActive = true;
    assert.doesNotThrow(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        activeProvider,
        1,
        activeProviderArguments,
      ),
    );
    const inactiveProvider = structuredClone(activeProvider);
    inactiveProvider.resolved[0]!.details!.providerActive = false;
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_resolve_model",
        inactiveProvider,
        1,
        activeProviderArguments,
      ),
    );
  } finally {
    await fixture.close();
  }
});

test("free-model live invariants require zero concrete-free pricing", async () => {
  const { assertModeResult } = await loadStdioHarness();
  const { startFixtureDashboard } = await loadFixtureHarness();
  const fixture = await startFixtureDashboard({ mode: "fixture" });
  try {
    const client = createDashboardClient({ baseUrl: fixture.baseUrl });
    const freeArguments = { outputModality: "text", limit: 5 };
    const free = await runFreeModels(freeArguments, { client });
    if (
      (free.status !== "ok" && free.status !== "partial") ||
      free.liveCandidates.data[0] === undefined
    ) {
      assert.fail("fixture free-model output must expose a live candidate");
    }
    assert.doesNotThrow(() =>
      assertModeResult(
        "live",
        "dashboard_free_models",
        free,
        1,
        freeArguments,
      ),
    );

    const nonzeroPrompt = structuredClone(free);
    nonzeroPrompt.liveCandidates.data[0]!.pricing.promptUsdPerToken =
      "0.000001";
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_free_models",
        nonzeroPrompt,
        1,
        freeArguments,
      ),
    );

    const nonzeroCompletion = structuredClone(free);
    nonzeroCompletion.liveCandidates.data[0]!.pricing.completionUsdPerToken =
      "0.000001";
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_free_models",
        nonzeroCompletion,
        1,
        freeArguments,
      ),
    );

    const wrongFreeKind = structuredClone(free);
    wrongFreeKind.liveCandidates.data[0]!.freeKind = "paid_or_unknown";
    assert.throws(() =>
      assertModeResult(
        "live",
        "dashboard_free_models",
        wrongFreeKind,
        1,
        freeArguments,
      ),
    );
  } finally {
    await fixture.close();
  }
});

test("evidence validation preserves safe payloads and fails closed on forbidden fields", async () => {
  const { validateEvidenceValue } = await loadStdioHarness();
  const evidence = {
    mode: "fixture",
    elapsedMs: 12.5,
    toolDefinitions: [{ name: "dashboard_source_health" }],
    calls: [
      {
        name: "dashboard_source_health",
        arguments: {},
        elapsedMs: 1.25,
        structuredContent: {
          status: "ok",
          sourceUrl: "https://example.test/path?view=public#section",
          totalTokens: "10",
        },
      },
    ],
  };

  assert.equal(
    JSON.stringify(validateEvidenceValue(evidence)),
    JSON.stringify(evidence),
  );
  assert.throws(() =>
    validateEvidenceValue({
      ...evidence,
      calls: [{ ...evidence.calls[0], responseBody: "must-not-be-recorded" }],
    }),
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
      ecosystemTokenVolumeMovement: "up",
      previousEcosystemTokenVolume: "19",
      rolling30DayEcosystemTokenVolume: "200",
      categoryTokenShare: "0.25",
    }),
  );
});

test("credential guard rejects credential-bearing field-name variants", async () => {
  const { assertEvidenceCredentialSafe } = await loadStdioHarness();

  for (const value of [
    { authToken: "opaque" },
    { authorizationHeader: "opaque" },
    { apiKeyValue: "opaque" },
  ]) {
    assert.throws(() => assertEvidenceCredentialSafe(value));
  }
});

test("purity parser accepts complete correlated response-only JSON-RPC NDJSON", async () => {
  const { parsePurityFrames } = await loadStdoutHarness();
  const bytes = Buffer.from(
    '{"jsonrpc":"2.0","id":1,"result":{}}\n' +
      '{"jsonrpc":"2.0","id":2,"result":{"tools":[]}}\n',
    "utf8",
  );

  const frames = parsePurityFrames(bytes, new Set([1, 2]));

  assert.equal(frames.length, 2);
  assert.deepEqual(
    frames
      .filter((frame) => "id" in frame)
      .map((frame) => (frame as { id: unknown }).id),
    [1, 2],
  );
});

test("purity parser rejects an unsolicited notification stdout frame", async () => {
  const { parsePurityFrames } = await loadStdoutHarness();
  const bytes = Buffer.from(
    '{"jsonrpc":"2.0","id":1,"result":{}}\n' +
      '{"jsonrpc":"2.0","method":"notifications/tools/list_changed"}\n',
    "utf8",
  );

  assert.throws(() => parsePurityFrames(bytes, new Set([1])));
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
  {
    name: "response containing both result and error",
    bytes: Buffer.from(
      '{"jsonrpc":"2.0","id":1,"result":{},"error":{"code":-32603,"message":"ambiguous"}}\n',
      "utf8",
    ),
    expectedIds: new Set([1]),
  },
] as const) {
  test(`purity parser rejects ${purityCase.name}`, async () => {
    const { parsePurityFrames } = await loadStdoutHarness();
    assert.throws(() =>
      parsePurityFrames(purityCase.bytes, purityCase.expectedIds),
    );
  });
}

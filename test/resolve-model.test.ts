import assert from "node:assert/strict";
import test from "node:test";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../src/dashboard/client.js";
import { DashboardRequestError } from "../src/dashboard/errors.js";
import { liveModelSchema } from "../src/dashboard/schemas/live-models.js";
import { createServer } from "../src/server.js";
import {
  RESOLVE_MODEL_CAPABILITY_MESSAGE,
  RESOLVE_MODEL_ITEM_LIMIT,
  RESOLVE_MODEL_PAGE_LIMIT,
  resolveModelInputSchema,
  resolveModelOutputSchema,
  runResolveModel,
} from "../src/tools/resolve-model.js";
import {
  liveModelFixture,
  manifestFixture,
  opaqueCursor,
  publicCompleteness,
  publicProvenance,
  publicWindow,
} from "./fixtures.js";

const manifestEndpoint = "/api/public/v2/manifest";
const liveModelsEndpoint = "/api/public/v2/live-models";

type LiveModel = z.infer<typeof liveModelSchema>;
type Request = { path: string; query: URLSearchParams };

function liveModel(overrides: Partial<LiveModel> = {}): LiveModel {
  return liveModelSchema.parse({
    ...liveModelFixture,
    provider: "groq",
    id: "groq/eligible",
    contextLength: "90071992547409930001",
    pricing: {
      promptUsdPerToken: "0",
      completionUsdPerToken: "0",
    },
    isFree: true,
    freeKind: "concrete_free",
    providerActive: true,
    reasoningEfforts: ["high"],
    outputModalities: ["text"],
    availability: "available",
    ...overrides,
  });
}

test("live-model schema rejects favourable freeness markers with contradictory metadata", () => {
  const consistentFree = {
    ...liveModelFixture,
    pricing: {
      promptUsdPerToken: "0.0000",
      completionUsdPerToken: "0",
    },
    isFree: true,
    freeKind: "concrete_free",
  } as const;
  assert.equal(liveModelSchema.safeParse(consistentFree).success, true);

  for (const contradictory of [
    { ...consistentFree, freeKind: "paid_or_unknown" as const },
    {
      ...consistentFree,
      pricing: {
        promptUsdPerToken: "0.000001",
        completionUsdPerToken: "0",
      },
    },
    { ...consistentFree, isFree: null },
    {
      ...consistentFree,
      isFree: false,
      freeKind: "paid_or_unknown" as const,
      pricing: {
        promptUsdPerToken: null,
        completionUsdPerToken: "0",
      },
    },
    {
      ...consistentFree,
      isFree: null,
      freeKind: "paid_or_unknown" as const,
    },
  ]) {
    assert.equal(liveModelSchema.safeParse(contradictory).success, false);
  }

  assert.equal(
    liveModelSchema.safeParse({
      ...consistentFree,
      isFree: false,
      freeKind: "paid_or_unknown",
    }).success,
    true,
    "zero token prices can remain paid when another modality carries the charge",
  );
  assert.equal(
    liveModelSchema.safeParse({
      ...consistentFree,
      isFree: null,
      freeKind: "free_router",
      pricing: {
        promptUsdPerToken: null,
        completionUsdPerToken: "0",
      },
    }).success,
    true,
  );
});

test("live-model schema accepts conservative media pricing with zero token placeholders", () => {
  const mediaModel = {
    ...liveModelFixture,
    id: "openrouter/audio-priced-elsewhere",
    pricing: {
      promptUsdPerToken: "0",
      completionUsdPerToken: "0",
    },
    isFree: null,
    freeKind: "paid_or_unknown",
    outputModalities: ["text", "audio"],
    missingFields: ["native_output_pricing"],
  } as const;

  assert.equal(
    liveModelSchema.safeParse(mediaModel).success,
    true,
    "zero token placeholders do not make a separately priced media model free",
  );
});

function liveModelsResponse(
  data: readonly LiveModel[],
  cursor: string | null = null,
) {
  return {
    schemaVersion: "2.0",
    data: [...data],
    cursor,
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  } as const;
}

function snapshotClient(
  auditRows: readonly LiveModel[],
  rankingRows: readonly LiveModel[] = auditRows,
): { client: DashboardClient; requests: Request[] } {
  const requests: Request[] = [];
  let unrankedScan = 0;

  const client: DashboardClient = {
    async get(path, query, schema) {
      requests.push({ path, query: new URLSearchParams(query) });
      if (path === manifestEndpoint) return schema.parse(manifestFixture);
      if (path !== liveModelsEndpoint) {
        throw new Error(`Unexpected test path: ${path}`);
      }
      assert.equal(query.get("availability"), "available");

      if (query.has("sort")) {
        return schema.parse(liveModelsResponse(rankingRows));
      }
      if (query.get("cursor") === null) unrankedScan += 1;
      return schema.parse(
        liveModelsResponse(unrankedScan === 1 ? auditRows : rankingRows),
      );
    },
  };
  return { client, requests };
}

async function connectTestClient(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "resolver-test-client", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

test("returns only ids eligible after every requested filter", async () => {
  const rows = [
    liveModel(),
    liveModel({ id: "openrouter/wrong-provider", provider: "openrouter" }),
    liveModel({
      id: "groq/unknown-price",
      pricing: { promptUsdPerToken: null, completionUsdPerToken: null },
      isFree: null,
      freeKind: "paid_or_unknown",
    }),
    liveModel({
      id: "groq/paid",
      pricing: {
        promptUsdPerToken: "0.000001",
        completionUsdPerToken: "0.000001",
      },
      isFree: false,
      freeKind: "paid_or_unknown",
    }),
    liveModel({ id: "groq/context-unknown", contextLength: null }),
    liveModel({ id: "groq/context-small", contextLength: "8192" }),
    liveModel({ id: "groq/modalities-unknown", outputModalities: null }),
    liveModel({ id: "groq/wrong-modality", outputModalities: ["image"] }),
    liveModel({ id: "groq/reasoning-unknown", reasoningEfforts: null }),
    liveModel({ id: "groq/inactive", providerActive: false }),
    liveModel({ id: "groq/active-unknown", providerActive: null }),
    liveModel({
      id: "groq/disappeared",
      availability: "disappeared",
      disappearedAt: "2026-08-19T06:00:00.000Z",
      absenceStreak: "1",
    }),
  ];
  const { client, requests } = snapshotClient(rows);

  const result = await runResolveModel(
    {
      intent: "largest_context",
      constraints: {
        free: true,
        minContext: "90071992547409930000",
        outputModality: "text",
        reasoning: true,
        providers: ["groq"],
        requireProviderActive: true,
      },
      fallbackDepth: 10,
    },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(result.resolved.map((row) => row.id), ["groq/eligible"]);
  assert.equal(result.resolved[0]?.details, undefined);
  assert.deepEqual(
    new Set(result.excluded.map((row) => row.reason)),
    new Set([
      "provider_not_allowed",
      "pricing_not_published",
      "pricing_constraint_not_satisfied",
      "context_not_published",
      "context_below_minimum",
      "output_modalities_not_published",
      "output_modality_not_supported",
      "reasoning_not_published",
      "provider_not_active",
      "provider_active_not_published",
      "disappeared",
    ]),
  );
  assert.ok(
    requests
      .filter((request) => request.path === liveModelsEndpoint)
      .every((request) => request.query.get("availability") === "available"),
  );
  const ranked = requests.find((request) => request.query.has("sort"));
  assert.ok(ranked);
  assert.equal(ranked.query.get("sort"), "context-desc");
  assert.equal(ranked.query.get("free"), "true");
  assert.equal(ranked.query.get("minContext"), "90071992547409930000");
  assert.equal(ranked.query.get("outputModality"), "text");
  assert.equal(ranked.query.get("reasoning"), "true");
  assert.equal(ranked.query.get("provider"), "groq");
});

test("resolver excludes contradictory favourable freeness metadata even without a free constraint", async () => {
  const consistent = liveModel({ id: "groq/consistent" });
  const contradictory = {
    ...consistent,
    id: "groq/contradictory",
    pricing: {
      promptUsdPerToken: "0.000001",
      completionUsdPerToken: "0",
    },
    isFree: true,
    freeKind: "paid_or_unknown" as const,
  } as unknown as LiveModel;
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === manifestEndpoint) return schema.parse(manifestFixture);
      if (path === liveModelsEndpoint) {
        return liveModelsResponse([contradictory, consistent]) as never;
      }
      throw new Error(`Unexpected test path: ${path}`);
    },
  };

  const result = await runResolveModel(
    { intent: "any_available", fallbackDepth: 3 },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(
    result.resolved.map((row) => row.id),
    ["groq/consistent"],
  );
  assert.ok(
    result.excluded.some(
      (row) =>
        row.id === "groq/contradictory" &&
        row.reason === "inconsistent_free_metadata",
    ),
  );
});

test("does not silently add or drop constraints", async () => {
  const audio = liveModel({
    provider: "cerebras",
    id: "cerebras/audio",
    isFree: false,
    freeKind: "paid_or_unknown",
    providerActive: null,
    reasoningEfforts: null,
    outputModalities: ["audio"],
    pricing: {
      promptUsdPerToken: "0.000001",
      completionUsdPerToken: "0.000001",
    },
  });
  const text = liveModel({
    provider: "openrouter",
    id: "openrouter/text",
    isFree: false,
    freeKind: "paid_or_unknown",
    providerActive: null,
    reasoningEfforts: null,
    pricing: {
      promptUsdPerToken: "0.000002",
      completionUsdPerToken: "0.000002",
    },
  });
  const { client } = snapshotClient([text, audio]);

  const result = await runResolveModel(
    { intent: "cheapest_capable" },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(result.constraints, {});
  assert.equal(result.resolved[0]?.id, "cerebras/audio");
});

test("never resolves a candidate absent from either required snapshot", async () => {
  const auditOnly = liveModel({ id: "groq/audit-only" });
  const rankedOnly = liveModel({ id: "groq/ranked-only" });
  const { client } = snapshotClient([auditOnly], [rankedOnly]);

  const result = await runResolveModel(
    { intent: "largest_context" },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.unsatisfiable, true);
  assert.deepEqual(result.resolved, []);
  assert.ok(
    result.excluded.some(
      (row) =>
        row.id === "groq/audit-only" &&
        row.reason === "absent_from_ranked_snapshot",
    ),
  );
  assert.ok(
    result.excluded.some(
      (row) =>
        row.id === "groq/ranked-only" &&
        row.reason === "absent_from_audit_snapshot",
    ),
  );
});

test("returns no placeholder or near miss when constraints are unsatisfiable", async () => {
  const nearMiss = liveModel({
    id: "groq/near-miss",
    contextLength: "32768",
  });
  const { client } = snapshotClient([nearMiss]);

  const result = await runResolveModel(
    {
      intent: "largest_context",
      constraints: { minContext: "90071992547409930001" },
    },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.unsatisfiable, true);
  assert.deepEqual(result.resolved, []);
  assert.ok(result.excluded.length > 0);
  assert.ok(
    result.excluded.some(
      (row) =>
        row.id === "groq/near-miss" &&
        row.reason === "context_below_minimum",
    ),
  );
});

test("ranks unrestricted cheapest prices as exact decimals and excludes unpublished pricing", async () => {
  const unknown = liveModel({
    id: "groq/unknown",
    isFree: null,
    freeKind: "paid_or_unknown",
    pricing: { promptUsdPerToken: null, completionUsdPerToken: null },
  });
  const nativeMediaPriceUnknown = liveModel({
    id: "openrouter/native-media-price-unknown",
    provider: "openrouter",
    isFree: null,
    freeKind: "paid_or_unknown",
    outputModalities: ["audio"],
    pricing: { promptUsdPerToken: "0", completionUsdPerToken: "0" },
    missingFields: ["native_output_pricing"],
  });
  const larger = liveModel({
    id: "groq/larger",
    isFree: false,
    freeKind: "paid_or_unknown",
    pricing: {
      promptUsdPerToken: "90071992547409930001",
      completionUsdPerToken: "0",
    },
  });
  const smaller = liveModel({
    id: "groq/smaller",
    isFree: false,
    freeKind: "paid_or_unknown",
    pricing: {
      promptUsdPerToken: "90071992547409930000",
      completionUsdPerToken: "0",
    },
  });
  const { client, requests } = snapshotClient([
    nativeMediaPriceUnknown,
    unknown,
    larger,
    smaller,
  ]);

  const result = await runResolveModel(
    { intent: "cheapest_capable", fallbackDepth: 2 },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(
    result.resolved.map((row) => row.id),
    ["groq/smaller", "groq/larger"],
  );
  assert.ok(
    result.excluded.some(
      (row) => row.id === "groq/unknown" && row.reason === "pricing_not_published",
    ),
  );
  assert.ok(
    result.excluded.some(
      (row) =>
        row.id === "openrouter/native-media-price-unknown" &&
        row.reason === "pricing_not_published",
    ),
  );
  assert.equal(
    requests.some((request) => request.query.get("sort") === "price-asc"),
    false,
  );
});

test("uses published token prices when only separate native output pricing is missing", async () => {
  const mixedModality = liveModel({
    id: "openrouter/mixed-modality-priced-text",
    provider: "openrouter",
    isFree: false,
    freeKind: "paid_or_unknown",
    outputModalities: ["text", "audio"],
    pricing: {
      promptUsdPerToken: "0.00000025",
      completionUsdPerToken: "0.00000097",
    },
    missingFields: ["native_output_pricing"],
  });
  const { client } = snapshotClient([mixedModality]);

  const result = await runResolveModel(
    {
      intent: "cheapest_capable",
      constraints: { outputModality: "text" },
    },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.unsatisfiable, false);
  assert.deepEqual(result.resolved.map((row) => row.id), [mixedModality.id]);
  assert.equal(result.resolved[0]?.value, "0.61");
  assert.equal(result.resolved[0]?.measurement, "measured");
});

test("orders any-available by requested provider order then id and truncates fallbacks", async () => {
  const rows = [
    liveModel({ provider: "openrouter", id: "openrouter/a" }),
    liveModel({ provider: "groq", id: "groq/z" }),
    liveModel({ provider: "groq", id: "groq/a" }),
    liveModel({ provider: "openrouter", id: "openrouter/b" }),
    liveModel({ provider: "cerebras", id: "cerebras/a" }),
  ];
  const { client } = snapshotClient(rows);

  const result = await runResolveModel(
    {
      intent: "any_available",
      constraints: { providers: ["groq", "openrouter"] },
      fallbackDepth: 3,
    },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(
    result.resolved.map((row) => row.id),
    ["groq/a", "groq/z", "openrouter/a"],
  );
  assert.equal(result.cap.resolvedLimit, 3);
  assert.ok(
    result.excluded.some(
      (row) =>
        row.id === "cerebras/a" && row.reason === "provider_not_allowed",
    ),
  );
});

test("orders context integer strings without numeric overflow", async () => {
  const lower = liveModel({
    id: "groq/lower-context",
    contextLength: "90071992547409930000",
  });
  const higher = liveModel({
    id: "groq/higher-context",
    contextLength: "90071992547409930001",
  });
  const { client } = snapshotClient([lower, higher], [lower, higher]);

  const result = await runResolveModel(
    { intent: "largest_context", fallbackDepth: 2 },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(
    result.resolved.map((row) => row.id),
    ["groq/higher-context", "groq/lower-context"],
  );
});

test("retains unmeasured throughput last and labels it unmeasured", async () => {
  const unmeasured = liveModel({ id: "groq/unmeasured", performance: null });
  const slower = liveModel({
    id: "groq/slower",
    performance: {
      throughputTps: "90071992547409930000",
      latencyMsP50: "20",
      fastestProvider: "groq",
      observedAt: "2026-08-19T05:45:00.000Z",
    },
  });
  const faster = liveModel({
    id: "groq/faster",
    performance: {
      throughputTps: "90071992547409930001",
      latencyMsP50: "30",
      fastestProvider: "groq",
      observedAt: "2026-08-19T05:45:00.000Z",
    },
  });
  const { client } = snapshotClient(
    [unmeasured, slower, faster],
    [unmeasured, slower, faster],
  );

  const result = await runResolveModel(
    { intent: "fastest_available", fallbackDepth: 3 },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.deepEqual(
    result.resolved.map((row) => [row.id, row.measurement]),
    [
      ["groq/faster", "measured"],
      ["groq/slower", "measured"],
      ["groq/unmeasured", "unmeasured"],
    ],
  );
});

test("paginates only the unranked audit and never combines cursor with sort", async () => {
  const first = liveModel({ id: "groq/first", contextLength: "1" });
  const second = liveModel({ id: "groq/second", contextLength: "2" });
  const requests: Request[] = [];
  const client: DashboardClient = {
    async get(path, query, schema) {
      requests.push({ path, query: new URLSearchParams(query) });
      if (path === manifestEndpoint) return schema.parse(manifestFixture);
      assert.equal(path, liveModelsEndpoint);
      assert.equal(query.get("availability"), "available");
      if (query.has("sort")) {
        assert.equal(query.get("cursor"), null);
        return schema.parse(liveModelsResponse([first, second]));
      }
      return schema.parse(
        query.get("cursor") === null
          ? liveModelsResponse([first], opaqueCursor)
          : liveModelsResponse([second]),
      );
    },
  };

  const result = await runResolveModel(
    { intent: "largest_context", fallbackDepth: 2 },
    { client },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.cap.audit.pageLimit, RESOLVE_MODEL_PAGE_LIMIT);
  assert.equal(result.cap.audit.itemLimit, RESOLVE_MODEL_ITEM_LIMIT);
  assert.equal(result.cap.audit.pagesScanned, 2);
  assert.deepEqual(
    result.resolved.map((row) => row.id),
    ["groq/second", "groq/first"],
  );
  assert.ok(
    requests
      .filter((request) => request.query.has("sort"))
      .every((request) => request.query.get("cursor") === null),
  );
});

test("uses strict resolver defaults and maximum fallback depth", () => {
  assert.deepEqual(
    resolveModelInputSchema.parse({ intent: "any_available" }),
    {
      intent: "any_available",
      constraints: {},
      fallbackDepth: 3,
      verbose: false,
    },
  );
  assert.throws(() =>
    resolveModelInputSchema.parse({
      intent: "any_available",
      fallbackDepth: 11,
    }),
  );
  assert.throws(() =>
    resolveModelInputSchema.parse({
      intent: "any_available",
      constraints: { approximateContext: true },
    }),
  );
  assert.throws(() =>
    resolveModelInputSchema.parse({
      intent: "any_available",
      constraints: { requireProviderActive: false },
    }),
  );
});

test("declines with the exact capability literal when live-models is absent", async () => {
  const requests: Request[] = [];
  const client: DashboardClient = {
    async get(path, query, schema) {
      requests.push({ path, query: new URLSearchParams(query) });
      assert.equal(path, manifestEndpoint);
      return schema.parse({
        ...manifestFixture,
        routes: [manifestEndpoint],
      });
    },
  };

  const result = await runResolveModel(
    { intent: "any_available" },
    { client },
  );

  assert.equal(result.status, "unavailable");
  if (result.status !== "unavailable") return;
  assert.equal(result.summary, RESOLVE_MODEL_CAPABILITY_MESSAGE);
  assert.equal(
    result.summary,
    "This tool needs /api/public/v2/live-models, which the dashboard is not currently publishing. Ask about deprecations or history instead, and check dashboard_source_health for which collector is failing.",
  );
  assert.deepEqual(requests.map((request) => request.path), [manifestEndpoint]);
});

test("returns safe structured errors instead of throwing", async () => {
  const client: DashboardClient = {
    async get() {
      throw new DashboardRequestError(
        "http_error",
        "The dashboard catalogue returned HTTP 503.",
        { retryable: true, status: 503 },
      );
    },
  };

  const result = await runResolveModel(
    { intent: "any_available" },
    { client },
  );

  assert.deepEqual(result, {
    status: "error",
    summary: "The dashboard catalogue returned HTTP 503.",
    error: {
      kind: "http_error",
      message: "The dashboard catalogue returned HTTP 503.",
      retryable: true,
      status: 503,
    },
  });
});

test("registers a read-only resolver with matching structured and JSON output", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const body =
      url.pathname === manifestEndpoint
        ? manifestFixture
        : liveModelsResponse([liveModel()]);
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    });
  };
  const server = createServer({
    baseUrl: "https://catalogue.test/",
    fetchImpl,
  });
  const client = await connectTestClient(server);

  try {
    const listed = await client.listTools();
    const tool = listed.tools.find(
      (candidate) => candidate.name === "dashboard_resolve_model",
    );
    assert.ok(tool);
    assert.deepEqual(tool.annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
    assert.ok(tool.inputSchema);
    assert.ok(tool.outputSchema);

    const result = await client.callTool({
      name: "dashboard_resolve_model",
      arguments: { intent: "any_available" },
    });
    assert.equal(result.isError, undefined);
    assert.ok(result.structuredContent);
    resolveModelOutputSchema.parse(result.structuredContent);
    const text = result.content.find((item) => item.type === "text");
    assert.ok(text && text.type === "text");
    assert.deepEqual(JSON.parse(text.text), result.structuredContent);
  } finally {
    await client.close();
  }
});

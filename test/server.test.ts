import assert from "node:assert/strict";
import test from "node:test";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { McpServer } from "@modelcontextprotocol/server";

import { createServer } from "../src/server.js";
import { generationCostCollectionSchema, generationCostObservationSchema } from "../src/generation-cost.js";
import { contractOutputSchema } from "../src/tools/contract.js";
import { generationCostsOutputSchema } from "../src/tools/generation-costs.js";
import { githubMoversOutputSchema } from "../src/tools/github-movers.js";
import { githubTrendingOutputSchema } from "../src/tools/github-trending.js";
import { usageLeadersOutputSchema } from "../src/tools/usage-leaders.js";
import {
  manifestFixture,
  publicCompleteness,
  publicProvenance,
  publicWindow,
  runId,
  sourceStatusFixture,
} from "./fixtures.js";

type CountingFetch = typeof fetch & { calls: number };

function failIfCalled(): CountingFetch {
  const fetchImpl = (async () => {
    fetchImpl.calls += 1;
    throw new Error("fetch must not run during construction or tools/list");
  }) as CountingFetch;
  fetchImpl.calls = 0;
  return fetchImpl;
}

async function connectTestClient(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "dashboard-test-client", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

test("registers exactly the seventeen tools without fetching during construction or tools/list", async () => {
  const fetchImpl = failIfCalled();
  const server = createServer({ fetchImpl });

  assert.ok(server);
  assert.equal(fetchImpl.calls, 0);

  const client = await connectTestClient(server);
  try {
    const listed = await client.listTools();
    assert.equal(fetchImpl.calls, 0);
    assert.deepEqual(
      listed.tools.map((tool) => tool.name).sort(),
      [
        "dashboard_benchmarks",
        "dashboard_catalogue",
        "dashboard_contract",
        "dashboard_free_models",
        "dashboard_generation_costs",
        "dashboard_github_movers",
        "dashboard_github_trending",
        "dashboard_key_inventory",
        "dashboard_matrix",
        "dashboard_model_economics",
        "dashboard_model_status",
        "dashboard_price_comparison",
        "dashboard_resolve_model",
        "dashboard_source_health",
        "dashboard_speed",
        "dashboard_usage_leaders",
        "dashboard_whats_changed",
      ],
    );
    for (const tool of listed.tools) {
      assert.deepEqual(tool.annotations, {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      });
      assert.ok(tool.inputSchema);
      assert.ok(tool.outputSchema);
    }
  } finally {
    await client.close();
  }
});

test("install-time selection removes deselected tools and provider comparisons", async () => {
  const server = createServer({
    selectedTools: ["dashboard_contract", "dashboard_price_comparison"],
    selectedProviders: ["openrouter"],
    fetchImpl: failIfCalled(),
  });
  const client = await connectTestClient(server);
  try {
    const listed = await client.listTools();
    assert.deepEqual(listed.tools.map((tool) => tool.name), ["dashboard_contract"]);
    const result = await client.callTool({ name: "dashboard_contract", arguments: {} });
    assert.equal(result.isError, undefined);
    contractOutputSchema.parse(result.structuredContent);
  } finally {
    await client.close();
  }
});

test("serializes the measured generation-cost observation through the registered MCP tool", async () => {
  const observation = generationCostObservationSchema.parse({
    id: "generation-1",
    provider: "openrouter",
    upstreamProvider: "Azure",
    model: "openai/gpt-4o-mini",
    observedAt: "2026-09-11T10:00:00.000Z",
    provenanceDate: "2026-09-11T10:00:00.000Z",
    workload: { name: "smoke generation", inputTokens: "10", outputTokens: "3", maxOutputTokens: "8" },
    vantagePoint: "Windows workstation / Sofia public internet",
    tokenCounts: { input: "10", output: "3", total: "13" },
    costUsd: "0.00000123",
    costState: "MEASURED",
    provenance: "MEASURED",
    balanceDeltaUsd: null,
    authoritativeField: "usage.cost",
    sourceUrl: "https://openrouter.ai/api/v1/chat/completions",
    latency: {
      ttftMs: "120",
      roundTripMs: "450",
      sustainedThroughputTps: "6.66",
      workload: { name: "smoke generation", inputTokens: "10", outputTokens: "3", maxOutputTokens: "8" },
      vantagePoint: "Windows workstation / Sofia public internet",
      tokenBudget: { inputTokens: "10", outputTokens: "8" },
      n: "1",
      percentileMethod: "single_observation",
      observedAt: "2026-09-11T10:00:00.000Z",
    },
    note: "Captured from the provider response; no catalogue arithmetic used.",
  });
  const collection = generationCostCollectionSchema.parse({
    schemaVersion: "2.0",
    data: [observation],
    summaries: [],
    policies: [],
    cursor: null,
    window: { start: "2026-09-11", end: "2026-09-11", timezone: "UTC", inclusive: true, basis: "observed" },
    completeness: { acquisitionComplete: true, populationCompleteness: "full", missingFields: [] },
    stale: false,
    rank: null,
    provenance: [{ sourceId: "test", sourceTier: "best_effort", runId, fetchedAt: "2026-09-11T10:00:00.000Z", sourceAsOf: "2026-09-11T10:00:00.000Z", transformVersion: "test", citation: "/api/public/v2/generation-costs" }],
  });
  const server = createServer({
    baseUrl: "https://catalogue.test/",
    fetchImpl: async () => new Response(JSON.stringify(collection), { headers: { "content-type": "application/json" } }),
  });
  const client = await connectTestClient(server);
  try {
    const result = await client.callTool({ name: "dashboard_generation_costs", arguments: { provider: "openrouter", model: "openai/gpt-4o-mini" } });
    assert.equal(result.isError, undefined);
    const parsed = generationCostsOutputSchema.parse(result.structuredContent);
    assert.equal(parsed.observations[0]?.upstreamProvider, "Azure");
    assert.equal(parsed.observations[0]?.costUsd, "0.00000123");
    assert.equal(parsed.observations[0]?.provenance, "MEASURED");
    assert.deepEqual(parsed.summaries, []);
    assert.deepEqual(parsed.policies, []);
    const text = result.content.find((item) => item.type === "text");
    assert.ok(text && text.type === "text");
    assert.deepEqual(JSON.parse(text.text), result.structuredContent);
  } finally {
    await client.close();
  }
});

test("serializes and validates both new Task 6 handlers while keeping the connection alive", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("private offline registration diagnostic");
  };
  const server = createServer({
    baseUrl: "https://catalogue.test/",
    fetchImpl,
  });
  const client = await connectTestClient(server);

  try {
    const calls = [
      {
        name: "dashboard_usage_leaders",
        arguments: { windowDays: 1, limit: 1 },
        schema: usageLeadersOutputSchema,
      },
      {
        name: "dashboard_github_movers",
        arguments: { category: "mcp", windowDays: 7, limit: 1 },
        schema: githubMoversOutputSchema,
      },
      {
        name: "dashboard_github_trending",
        arguments: { since: "daily", limit: 1 },
        schema: githubTrendingOutputSchema,
      },
    ] as const;

    for (const call of calls) {
      const result = await client.callTool({
        name: call.name,
        arguments: call.arguments,
      });
      assert.equal(result.isError, undefined);
      assert.ok(result.structuredContent);
      call.schema.parse(result.structuredContent);
      const text = result.content.find((item) => item.type === "text");
      assert.ok(text && text.type === "text");
      assert.deepEqual(JSON.parse(text.text), result.structuredContent);
      assert.doesNotMatch(
        JSON.stringify(result),
        /private offline registration diagnostic/,
      );
    }

    const listed = await client.listTools();
    assert.equal(listed.tools.length, 17);
  } finally {
    await client.close();
  }
});

test("returns matching structured content and JSON text from the registered handler", async () => {
  const statusResponse = {
    schemaVersion: "2.0",
    data: [sourceStatusFixture],
    cursor: null,
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  } as const;
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const body =
      url.pathname === "/api/public/v2/manifest"
        ? manifestFixture
        : statusResponse;
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
    const result = await client.callTool({
      name: "dashboard_source_health",
      arguments: {},
    });
    assert.equal(result.isError, undefined);
    assert.ok(result.structuredContent);
    const text = result.content.find((item) => item.type === "text");
    assert.ok(text && text.type === "text");
    assert.deepEqual(JSON.parse(text.text), result.structuredContent);
  } finally {
    await client.close();
  }
});

test("serializes and validates the registered model-status handler output", async () => {
  const capabilityMessage =
    "This tool needs /api/public/v2/live-models, which the dashboard is not currently publishing. Ask about deprecations or history instead, and check dashboard_source_health for which collector is failing.";
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/api/public/v2/manifest");
    return new Response(
      JSON.stringify({
        ...manifestFixture,
        routes: ["/api/public/v2/manifest"],
      }),
      { headers: { "content-type": "application/json" } },
    );
  };
  const server = createServer({
    baseUrl: "https://catalogue.test/",
    fetchImpl,
  });
  const client = await connectTestClient(server);

  try {
    const result = await client.callTool({
      name: "dashboard_model_status",
      arguments: { slug: "groq/retired-model" },
    });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent?.status, "unavailable");
    assert.equal(result.structuredContent?.summary, capabilityMessage);
    const text = result.content.find((item) => item.type === "text");
    assert.ok(text && text.type === "text");
    assert.deepEqual(JSON.parse(text.text), result.structuredContent);
  } finally {
    await client.close();
  }
});

test("serializes and validates the registered whats-changed handler output", async () => {
  const historyResponse = {
    schemaVersion: "2.0",
    status: "available",
    data: {
      modelUsage: [
        { date: "2026-08-18", complete: true, rows: [] },
        { date: "2026-08-19", complete: true, rows: [] },
      ],
      appRanks: [],
      githubRanks: [],
    },
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  } as const;
  const deprecationsResponse = {
    schemaVersion: "2.0",
    data: [
      {
        modelId: "example/retiring",
        state: "scheduled_deprecation",
        expirationDate: null,
        firstObservedAt: "2026-08-19T06:00:00.000Z",
        lastObservedAt: "2026-08-19T06:00:00.000Z",
        evidenceRunId: runId,
      },
    ],
    cursor: null,
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  } as const;
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    let body: unknown;
    if (url.pathname === "/api/public/v2/manifest") {
      body = {
        ...manifestFixture,
        routes: [
          "/api/public/v2/manifest",
          "/api/public/v2/history",
          "/api/public/v2/deprecations",
        ],
      };
    } else if (url.pathname === "/api/public/v2/history") {
      body = historyResponse;
    } else if (url.pathname === "/api/public/v2/deprecations") {
      body = deprecationsResponse;
    } else {
      throw new Error(`Unexpected test path: ${url.pathname}`);
    }
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
    const result = await client.callTool({
      name: "dashboard_whats_changed",
      arguments: { since: "2026-08-18", limit: 5 },
    });
    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent?.status, "partial");
    // The stub serves no /price-changes route and errors rather than 404ing, so
    // the section says it could not be read. It must never return an empty list,
    // which a caller would read as "nothing started charging me".
    assert.equal(
      (result.structuredContent?.priceChanges as { status: string }).status,
      "unavailable",
    );
    const text = result.content.find((item) => item.type === "text");
    assert.ok(text && text.type === "text");
    assert.deepEqual(JSON.parse(text.text), result.structuredContent);
  } finally {
    await client.close();
  }
});

test("keeps the MCP connection alive after an offline tool result", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error("private network diagnostic");
  };
  const server = createServer({
    baseUrl: "https://catalogue.test/",
    fetchImpl,
  });
  const client = await connectTestClient(server);

  try {
    const result = await client.callTool({
      name: "dashboard_source_health",
      arguments: {},
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(result.structuredContent, {
      status: "error",
      summary: "Cannot reach the dashboard catalogue right now.",
      error: {
        kind: "unreachable",
        message: "Cannot reach the dashboard catalogue right now.",
        retryable: true,
      },
    });
    assert.doesNotMatch(JSON.stringify(result), /private network diagnostic/);

    const listed = await client.listTools();
    assert.equal(listed.tools[0]?.name, "dashboard_source_health");
  } finally {
    await client.close();
  }
});

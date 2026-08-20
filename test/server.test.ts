import assert from "node:assert/strict";
import test from "node:test";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { McpServer } from "@modelcontextprotocol/server";

import { createServer } from "../src/server.js";
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

test("registers source health through Task 4 tools without fetching during construction or tools/list", async () => {
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
        "dashboard_model_status",
        "dashboard_resolve_model",
        "dashboard_source_health",
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
    "This tool needs /api/public/v2/live-models, which is not yet deployed. It ships with PR #24. Until then, ask about deprecations or history instead.";
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
    assert.deepEqual(result.structuredContent?.priceChanges, {
      status: "unsupported_by_public_api",
      reason:
        "The public API does not publish historical prices, so price changes cannot be determined and are not inferred.",
    });
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

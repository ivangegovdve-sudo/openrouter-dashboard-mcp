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

test("registers source health without fetching during construction or tools/list", async () => {
  const fetchImpl = failIfCalled();
  const server = createServer({ fetchImpl });

  assert.ok(server);
  assert.equal(fetchImpl.calls, 0);

  const client = await connectTestClient(server);
  try {
    const listed = await client.listTools();
    assert.equal(fetchImpl.calls, 0);
    assert.equal(listed.tools.length, 1);
    assert.equal(listed.tools[0]?.name, "dashboard_source_health");
    assert.deepEqual(listed.tools[0]?.annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
    assert.ok(listed.tools[0]?.inputSchema);
    assert.ok(listed.tools[0]?.outputSchema);
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

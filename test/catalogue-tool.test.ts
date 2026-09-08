import assert from "node:assert/strict";
import test from "node:test";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "../src/server.js";
import { createDashboardClient } from "../src/dashboard/client.js";
import { collectDashboardCatalogue } from "../src/dashboard/catalogue.js";
import { catalogueInputSchema, catalogueOutputSchema, runCatalogue } from "../src/tools/catalogue.js";
import { liveModelFixture, publicCompleteness, publicProvenance, publicWindow } from "./fixtures.js";

const envelope = (data: unknown[], cursor: string | null = null) => ({
  schemaVersion: "2.0", data, cursor, window: publicWindow,
  completeness: publicCompleteness, stale: false, rank: null, provenance: publicProvenance,
});
const rows = [liveModelFixture, {
  ...liveModelFixture, id: "unpriced", pricing: { promptUsdPerToken: null, completionUsdPerToken: null },
  freeKind: "paid_or_unknown", isFree: null,
}];
const dependencies = () => ({
  client: createDashboardClient({ baseUrl: "https://fixture.test", cache: false,
    fetchImpl: async () => new Response(JSON.stringify(envelope(rows)), { headers: { "content-type": "application/json" } }),
  }),
});

test("catalogue retains unpriced identities and reports unknown native denominator", async () => {
  const result = await runCatalogue(catalogueInputSchema.parse({ providers: ["openrouter"] }), dependencies());
  catalogueOutputSchema.parse(result);
  assert.equal(result.models.length, 2);
  const unpriced = result.models.find(row => row.id === "unpriced")!;
  assert.equal(unpriced.pricing.status, "price_not_available");
  assert.equal(unpriced.pricing.prices.length, 0);
  const priced = result.models.find(row => row.id === liveModelFixture.id)!;
  assert.equal(priced.pricing.prices[0]?.value, "0.000000125");
  assert.equal(result.providers[0]?.population.listed, null);
  assert.equal(result.providers[0]?.population.received, 2);
  assert.equal(result.providers[0]?.population.excluded, null);
  assert.equal(result.providers[0]?.requestParameters.localExcluded, 0);
  assert.ok(result.providerMetadata[0]?.pitchResearch);
});

test("pagination counts retain the denominator and never filter by price", async () => {
  const result = await runCatalogue(catalogueInputSchema.parse({ providers: ["openrouter"], offset: 1, limit: 1 }), dependencies());
  assert.equal(result.models.length, 1);
  assert.equal(result.population.acquired, 2);
  assert.equal(result.population.matched, 2);
  assert.equal(result.population.omittedByPagination, 1);
  assert.equal(result.models[0]?.pricing.status, "price_not_available");
});

test("preserves source origin, price window and legal offset timestamps", async () => {
  const client = createDashboardClient({ baseUrl: "https://custom.test/", cache: false,
    fetchImpl: async () => new Response(JSON.stringify(envelope([{ ...liveModelFixture, pricingWindow: "flex", lastConfirmedAt: "2026-09-08T10:00:00+02:00" }])), { headers: { "content-type": "application/json" } }),
  });
  const result = await runCatalogue(catalogueInputSchema.parse({ providers: ["openrouter"] }), { client });
  assert.equal(result.models[0]?.provenance.sourceUrl, "https://custom.test/api/public/v2/live-models");
  assert.equal(result.models[0]?.pricing.prices[0]?.conditions.pricingWindow, "flex");
  assert.equal(result.models[0]?.provenance.observedAt, "2026-09-08T10:00:00+02:00");
});

test("media filtering includes every published output modality", async () => {
  const client = createDashboardClient({ baseUrl: "https://fixture.test/", cache: false,
    fetchImpl: async () => new Response(JSON.stringify(envelope([{ ...liveModelFixture, outputModalities: ["text", "image"] }])), { headers: { "content-type": "application/json" } }),
  });
  const result = await runCatalogue(catalogueInputSchema.parse({ providers: ["openrouter"], mediaKind: "image" }), { client });
  assert.equal(result.models.length, 1);
  assert.deepEqual(result.models[0]?.outputModalities, ["text", "image"]);
});

test("model-id filter reports exclusions without changing acquisition denominator", async () => {
  const result = await runCatalogue(catalogueInputSchema.parse({ providers: ["openrouter"], modelIds: ["unpriced"] }), dependencies());
  assert.equal(result.models.length, 1);
  assert.equal(result.models[0]?.id, "unpriced");
  assert.equal(result.population.acquired, 2);
  assert.equal(result.population.excludedByModelId, 1);
});

test("a repeated dashboard cursor is bounded and reported partial", async () => {
  let calls = 0;
  const client = createDashboardClient({ baseUrl: "https://fixture.test", cache: false,
    fetchImpl: async () => { calls++; return new Response(JSON.stringify(envelope(rows, "repeat")), { headers: { "content-type": "application/json" } }); },
  });
  const result = await collectDashboardCatalogue({ client, providers: ["openrouter"] });
  assert.equal(calls, 2);
  assert.equal(result.providers[0]?.status, "partial");
  assert.equal(result.models.length, 2);
});

test("failed sources remain unknown and contain no internal diagnostic", async () => {
  const client = createDashboardClient({ baseUrl: "https://fixture.test", cache: false,
    fetchImpl: async () => { throw new Error("private diagnostic sentinel"); },
  });
  const result = await runCatalogue(catalogueInputSchema.parse({ providers: ["openrouter"] }), { client });
  assert.equal(result.status, "unavailable");
  assert.equal(result.providers[0]?.population.received, null);
  assert.doesNotMatch(JSON.stringify(result), /private diagnostic sentinel/);
});

test("tools/call exposes validated catalogue output and tools/list never fetches", async () => {
  let calls = 0;
  const server = createServer({ fetchImpl: async () => { calls++; return new Response(JSON.stringify(envelope(rows)), { headers: { "content-type": "application/json" } }); } });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const client = new Client({ name: "catalogue-test", version: "1" });
  await client.connect(ct);
  try {
    const list = await client.listTools();
    assert.equal(calls, 0);
    assert.ok(list.tools.find(tool => tool.name === "dashboard_catalogue"));
    const result = await client.callTool({ name: "dashboard_catalogue", arguments: { providers: ["openrouter"] } });
    assert.equal(result.isError, undefined);
    catalogueOutputSchema.parse(result.structuredContent);
    assert.equal(calls, 1);
  } finally { await client.close(); }
});

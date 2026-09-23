import assert from "node:assert/strict";
import test from "node:test";
import { PROVIDER_REGISTRY, describeProvider } from "../src/providers/registry.js";
import { catalogueInputSchema, runCatalogue } from "../src/tools/catalogue.js";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { createServer } from "../src/server.js";
import { priceComparisonOutputSchema } from "../src/catalogue/compare.js";

test("registry distinguishes aggregator comparisons from media generation", () => {
  assert.equal(describeProvider("crazyrouter").providerKind, "aggregator");
  assert.equal(PROVIDER_REGISTRY.openrouter.providerKind, "aggregator");
  assert.equal(PROVIDER_REGISTRY.fal.providerKind, "media");
  assert.equal(PROVIDER_REGISTRY.wavespeed.providerKind, "media");
  assert.equal(describeProvider("crazyrouter").spendVisibility, "unknown");
  assert.equal(describeProvider("crazyrouter").pitchResearch.status, "published");
  assert.equal(describeProvider("crazyrouter").caveatResearch.status, "not_found_in_checked_sources");
});

test("comparison tool returns the same validated JSON in both MCP content surfaces", async () => {
  let fetches = 0;
  const server = createServer({ fetchImpl: async (input, init) => {
    fetches++;
    assert.equal(init?.method, "GET");
    const url = new URL(String(input));
    if (url.host === "crazyrouter.com") return Response.json({ success: true, data: [{ model_name: "gpt-4o", vendor_id: 4, quota_type: 0, model_ratio: 1.25, completion_ratio: 4, discount: 0.65, enable_groups: ["default"] }], vendors: [{ id: 4, name: "OpenAI" }], group_ratio: { default: 1 } });
    assert.equal(url.host, "openrouter.ai");
    return Response.json({ data: [{ id: "openai/gpt-4o", canonical_slug: "openai/gpt-4o", pricing: { prompt: "0.0000025", completion: "0.00001" } }] });
  } });
  const client = new Client({ name: "comparison-tool-test", version: "1" });
  const [ct, st] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(st); await client.connect(ct);
    await client.listTools(); assert.equal(fetches, 0);
    const result = await client.callTool({ name: "dashboard_price_comparison", arguments: { modelIds: ["gpt-4o"] } });
    assert.equal(result.isError, undefined);
    const output = priceComparisonOutputSchema.parse(result.structuredContent);
    const text = result.content.find(item => item.type === "text");
    assert.ok(text && text.type === "text");
    assert.deepEqual(JSON.parse(text.text), output);
    assert.equal(output.rows[0]?.status, "comparable");
    assert.equal(output.rows[0]?.comparisons.input.status, "comparable");
    assert.equal(output.rows[0]?.comparisons.input.pairs[0]?.savingsPercent.value, "35");
    assert.equal(output.rows[0]?.crazyrouter?.pricePoints[0]?.provenance, "derived");
    assert.equal(output.rows[0]?.crazyrouter?.pricePoints[0]?.sourceText, "Crazyrouter model discount badge: 0.65");
    assert.equal(fetches, 2);
  } finally { await client.close(); await server.close(); }
});

test("catalogue routes Crazyrouter to its own source and preserves unpriced identities", async () => {
  const urls: string[] = [];
  const result = await runCatalogue(catalogueInputSchema.parse({ providers: ["crazyrouter"] }), {
    client: {} as never,
    fetchImpl: async input => {
      urls.push(String(input));
      return Response.json({ success: true, data: [{ model_name: "no-price", quota_type: 1 }], vendors: [], group_ratio: { default: 1 } });
    },
  });
  assert.deepEqual(urls, ["https://crazyrouter.com/api/pricing"]);
  assert.equal(result.models[0]?.id, "no-price");
  assert.equal(result.models[0]?.pricingState, "unknown");
  assert.equal(result.providers[0]?.population.received, 1);
  assert.equal(result.providers[0]?.population.retained, 1);
  assert.equal(result.providers[0]?.population.excluded, 0);
  assert.equal(result.providers[0]?.population.listed, null);
  assert.equal(result.status, "partial");
});

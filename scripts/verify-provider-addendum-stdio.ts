import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { catalogueOutputSchema } from "../src/tools/catalogue.js";
import { priceComparisonOutputSchema } from "../src/catalogue/compare.js";
import { EXPECTED_TOOL_NAMES } from "./verify-stdio.js";

// The verifier's parent supplies secrets in memory. Neither CLI arguments nor
// generated evidence contain them; the MCP child receives only these keys.
const falKey = process.env.FAL_API_KEY, crazyKey = process.env.CRAZYROUTER_API_KEY;
assert.ok(falKey && crazyKey, "Both provider environment keys must be supplied for authenticated verification");
const client = new Client({ name: "provider-addendum-release-verifier", version: "1" });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve("build/index.js")],
  env: { FAL_API_KEY: falKey, CRAZYROUTER_API_KEY: crazyKey }, stderr: "pipe" });
const startedAt = new Date().toISOString();
const falChecks = [
  { id: "fal-ai/bytedance/seedream/v4/text-to-image", value: "0.03", unit: "usd_per_image" },
  { id: "fal-ai/flux-pro/kontext", value: "0.04", unit: "usd_per_image" },
  { id: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video", value: "0.07", unit: "usd_per_video_second" },
] as const;
const sharedIds = ["gpt-4o", "gpt-4o-mini", "gpt-4.1"];
try {
  await client.connect(transport);
  const tools = (await client.listTools()).tools;
  assert.deepEqual(tools.map(tool => tool.name).sort(), [...EXPECTED_TOOL_NAMES].sort());
  assert.equal(client.getServerVersion()?.version, "0.9.0");
  assert.ok(tools.every(tool => tool.annotations?.readOnlyHint));
  const catalogueCall = await client.callTool({ name: "dashboard_catalogue", arguments: {
    providers: ["fal", "crazyrouter"], modelIds: [...falChecks.map(check => check.id), ...sharedIds], limit: 20,
  } }, { timeout: 180000 });
  assert.equal(catalogueCall.isError, undefined);
  const catalogue = catalogueOutputSchema.parse(catalogueCall.structuredContent);
  const text = catalogueCall.content.find(item => item.type === "text");
  assert.ok(text && text.type === "text"); assert.deepEqual(JSON.parse(text.text), catalogue);
  for (const provider of catalogue.providers) {
    assert.equal(provider.population.completeness, "full");
    assert.equal(provider.population.retained, provider.population.listed);
    assert.equal(provider.population.excluded, 0);
  }
  assert.equal(catalogue.providers.find(p => p.provider === "fal")?.requestParameters.pricingAuthentication, "api_key");
  assert.equal(catalogue.providers.find(p => p.provider === "crazyrouter")?.requestParameters.authenticatedCatalogueStatus, "available");
  const comparisonCall = await client.callTool({ name: "dashboard_price_comparison", arguments: { modelIds: sharedIds, limit: 20 } }, { timeout: 90000 });
  assert.equal(comparisonCall.isError, undefined);
  const comparison = priceComparisonOutputSchema.parse(comparisonCall.structuredContent);
  const comparisonText = comparisonCall.content.find(item => item.type === "text");
  assert.ok(comparisonText && comparisonText.type === "text"); assert.deepEqual(JSON.parse(comparisonText.text), comparison);
  const priceChecks = falChecks.map(check => {
    const model = catalogue.models.find(model => model.provider === "fal" && model.id === check.id);
    assert.ok(model, "Required fal identity was not retained");
    const actual = model.pricing.prices.find(price => price.unit === check.unit)?.value;
    // A source limit is recorded honestly. Never turn unknown into a passing price assertion.
    return { ...check, actual: actual ?? null, status: actual === undefined ? "unobserved" : actual === check.value ? "matched" : "mismatch", reason: model.pricing.reason ?? null };
  });
  const evidence = { startedAt, finishedAt: new Date().toISOString(), version: client.getServerVersion()?.version,
    tools: tools.map(tool => tool.name), catalogue, comparison, priceChecks, noInferenceRequested: true };
  const serialized = JSON.stringify(evidence, null, 2);
  assert.ok(!serialized.includes(falKey) && !serialized.includes(crazyKey), "Unsafe reflected metadata omitted");
  if (process.argv[2]) await writeFile(process.argv[2], serialized);
  assert.ok(priceChecks.every(check => check.status === "matched"), "One or more selected fal prices are mismatched or unobserved; see sanitized evidence");
  for (const id of sharedIds) {
    const row = comparison.rows.find(row => row.id === id);
    assert.ok(row, "Required shared identity was not retained");
    assert.equal(row.status, "price_derived_not_comparable");
    assert.equal(row.comparisons.input.status, "not_comparable");
    assert.equal(row.comparisons.output.status, "not_comparable");
    assert.equal(row.comparisons.input.savingsPercent, undefined);
    assert.equal(row.comparisons.output.savingsPercent, undefined);
    assert.equal(row.claimAssessment.status, "not_comparable");
    assert.equal(row.crazyrouter?.prices[0]?.provenance?.basis, "derived");
    assert.equal(row.crazyrouter?.prices[0]?.provenance?.observedMultiplier, "0.65");
  }
  console.log(JSON.stringify({ version: evidence.version, tools: tools.length, catalogueProviders: catalogue.providers.map(p => ({ provider: p.provider, status: p.status, population: p.population, pricePopulation: p.requestParameters.pricePopulation })), priceChecks, sharedModels: comparison.rows.map(row => ({ id: row.id, status: row.status, inputSavingsPercent: row.comparisons.input.savingsPercent, outputSavingsPercent: row.comparisons.output.savingsPercent, claimAssessment: row.claimAssessment.status })), comparisonPopulation: comparison.population }));
} finally { await client.close(); }

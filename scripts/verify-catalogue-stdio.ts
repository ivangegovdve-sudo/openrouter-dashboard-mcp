import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { catalogueOutputSchema } from "../src/tools/catalogue.js";
import { PROVIDER_IDS } from "../src/providers/registry.js";

const client = new Client({ name: "catalogue-release-verification", version: "1" });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve("build/index.js")], stderr: "pipe" });
const startedAt = new Date().toISOString();
try {
  await client.connect(transport);
  const list = await client.listTools();
  assert.equal(list.tools.length, 13);
  assert.ok(list.tools.find(tool => tool.name === "dashboard_catalogue"));
  const version = JSON.parse(await readFile("package.json", "utf8")).version;
  assert.equal(client.getServerVersion()?.version, version);
  const args = { limit: 500 };
  const result = await client.callTool({ name: "dashboard_catalogue", arguments: args }, { timeout: 240_000 });
  assert.equal(result.isError, undefined);
  const output = catalogueOutputSchema.parse(result.structuredContent);
  const text = result.content.find(item => item.type === "text");
  assert.ok(text && text.type === "text");
  assert.deepEqual(JSON.parse(text.text), output);
  assert.deepEqual(output.providers.map(p => p.provider).sort(), [...PROVIDER_IDS].sort());
  for (const provider of output.providers) {
    const population = provider.population;
    if (population.completeness === "full") {
      assert.equal(population.excluded, 0);
      assert.equal(population.retained, population.listed);
    }
    if (provider.status === "unavailable") assert.equal(population.listed, null);
  }
  for (const model of output.models) {
    if (model.pricing.status === "price_not_available") assert.equal(model.pricing.prices.length, 0);
    for (const price of model.pricing.prices) if (price.value) assert.doesNotMatch(price.value, /e[+-]?\d/i);
  }
  const priceChecks = [
    { provider: "deepinfra", id: "black-forest-labs/FLUX-1.1-pro", unit: "usd_per_image", value: "0.04" },
    { provider: "wavespeed", id: "wavespeed-ai/wan-2.2/t2v-720p", unit: "usd_per_video_second", value: "0.06" },
    { provider: "fal", id: "fal-ai/bytedance/seedream/v4/text-to-image", unit: "usd_per_image", value: "0.03" },
  ];
  const selectedResult = await client.callTool({ name: "dashboard_catalogue", arguments: {
    providers: priceChecks.map(check => check.provider), modelIds: priceChecks.map(check => check.id), limit: 20,
  } }, { timeout: 240_000 });
  assert.equal(selectedResult.isError, undefined);
  const selected = catalogueOutputSchema.parse(selectedResult.structuredContent);
  for (const check of priceChecks) {
    const model = selected.models.find(row => row.provider === check.provider && row.id === check.id);
    assert.ok(model, `Missing ${check.provider}/${check.id}`);
    assert.equal(model.pricing.prices.find(price => price.unit === check.unit)?.value, check.value, check.id);
  }
  const evidence = { startedAt, finishedAt: new Date().toISOString(), version, tools: list.tools.map(tool => tool.name), args, output, selected, priceChecks };
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ version, tools: list.tools.length, population: output.population, providers: output.providers.map(({provider,status,population}) => ({provider,status,population})), priceChecks }, null, 2));
} finally { await client.close(); }

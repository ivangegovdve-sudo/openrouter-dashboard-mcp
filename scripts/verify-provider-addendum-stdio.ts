import assert from "node:assert/strict";
import { rm, writeFile } from "node:fs/promises";
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
// A STALE ARTIFACT MUST NOT SURVIVE A RUN THAT FAILS BEFORE WRITING. The evidence path
// is cleared up front, so whatever is there afterwards is this run's or nothing. Without
// this, a run that aborts early -- including the credential-safety abort below -- leaves
// the PREVIOUS run's file in place, and a reader has no way to tell it is not current.
if (process.argv[2]) await rm(process.argv[2], { force: true });

const client = new Client({ name: "provider-addendum-release-verifier", version: "1" });
const transport = new StdioClientTransport({ command: process.execPath, args: [resolve("build/index.js")],
  env: { FAL_API_KEY: falKey, CRAZYROUTER_API_KEY: crazyKey }, stderr: "pipe" });
const startedAt = new Date().toISOString();
const falChecks = [
  { id: "fal-ai/bytedance/seedream/v4/text-to-image", value: "0.03", unit: "image" },
  { id: "fal-ai/flux-pro/kontext", value: "0.04", unit: "image" },
  { id: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video", value: "0.07", unit: "video_second" },
] as const;
const sharedIds = ["gpt-4o", "gpt-4o-mini", "gpt-4.1"];
try {
  await client.connect(transport);
  const tools = (await client.listTools()).tools;
  assert.deepEqual(tools.map(tool => tool.name).sort(), [...EXPECTED_TOOL_NAMES].sort());
  assert.equal(client.getServerVersion()?.version, "1.0.0");
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
    const actual = model.pricePoints.find(price => price.unit === check.unit)?.amount;
    // A source limit is recorded honestly. Never turn unknown into a passing price assertion.
    return { ...check, actual: actual ?? null, status: actual === undefined ? "unobserved" : actual === check.value ? "matched" : "mismatch", reason: model.pricingNote ?? null };
  });
  // THE ARTIFACT NOW CARRIES ITS OWN VERDICT, AND THE VERDICT IS COMPUTED BEFORE IT IS
  // WRITTEN. The file used to be written here and asserted on the next line, so a failing
  // run left an artifact full of "unobserved"/"mismatch" rows that looked exactly like a
  // passing one -- and it had already overwritten whatever valid evidence was at that
  // path. Withholding the file on failure is the wrong repair: the assertion message
  // says "see sanitized evidence", so the artifact is meant to exist for diagnosis. It
  // must simply never claim to be a passing record when it is not.
  const failures: string[] = [];
  for (const check of priceChecks) {
    if (check.status !== "matched") failures.push(`fal price ${check.id} (${check.unit}) is ${check.status}`);
  }
  for (const id of sharedIds) {
    const row = comparison.rows.find(row => row.id === id);
    if (!row) { failures.push(`shared identity ${id} was not retained`); continue; }
    if (row.status !== "comparable") failures.push(`shared identity ${id} is ${row.status}, not comparable`);
    if (row.comparisons.input.status !== "comparable") failures.push(`shared identity ${id} input leg is ${row.comparisons.input.status}`);
    if (row.comparisons.output.status !== "comparable") failures.push(`shared identity ${id} output leg is ${row.comparisons.output.status}`);
    if (!row.comparisons.input.pairs[0]?.savingsPercent) failures.push(`shared identity ${id} has no input savings pair`);
    if (!row.comparisons.output.pairs[0]?.savingsPercent) failures.push(`shared identity ${id} has no output savings pair`);
    if (row.crazyrouter?.pricePoints[0]?.provenance !== "derived") failures.push(`shared identity ${id} Crazyrouter provenance is ${String(row.crazyrouter?.pricePoints[0]?.provenance)}, not derived`);
    if (!row.crazyrouter?.pricePoints[0]?.derivedFrom) failures.push(`shared identity ${id} derived price does not name what it was derived from`);
  }
  const evidence = { startedAt, finishedAt: new Date().toISOString(), version: client.getServerVersion()?.version,
    verdict: failures.length === 0 ? "passed" : "failed", failures,
    tools: tools.map(tool => tool.name), catalogue, comparison, priceChecks, noInferenceRequested: true };
  const serialized = JSON.stringify(evidence, null, 2);
  // THIS ASSERTION STAYS BEFORE THE WRITE AND MUST NOT BE FOLDED INTO `failures`. If the
  // serialized evidence contains a provider key, the correct outcome is that NO file is
  // written: recording the leak as a verdict would mean persisting the key to disk, which
  // is the one thing that must never happen. A run that aborts here leaves no artifact at
  // all, because the path was cleared at startup.
  assert.ok(!serialized.includes(falKey) && !serialized.includes(crazyKey), "Unsafe reflected metadata omitted");
  if (process.argv[2]) await writeFile(process.argv[2], serialized);
  assert.equal(failures.length, 0, "Authenticated verification failed; the written evidence records verdict \"failed\": " + failures.join("; "));
  console.log(JSON.stringify({ version: evidence.version, tools: tools.length, catalogueProviders: catalogue.providers.map(p => ({ provider: p.provider, status: p.status, population: p.population, pricePopulation: p.requestParameters.pricePopulation })), priceChecks, sharedModels: comparison.rows.map(row => ({ id: row.id, status: row.status, inputSavingsPercent: row.comparisons.input.pairs[0]?.savingsPercent.value ?? null, outputSavingsPercent: row.comparisons.output.pairs[0]?.savingsPercent.value ?? null })), comparisonPopulation: comparison.population }));
} finally { await client.close(); }

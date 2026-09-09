/** Read-only live evidence. No inference, credentials, retries, or unbounded crawling. */
import assert from "node:assert/strict";
import { collectMediaCatalogue, DEFAULT_WAVESPEED_ENRICH_IDS, exactDecimalRatio } from "../src/catalogue/index.js";

const stripTags = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
async function page(url: string): Promise<string> {
  const response = await fetch(url, { method: "GET", redirect: "error", signal: AbortSignal.timeout(10000), headers: { "User-Agent": "open-dashboard-mcp-price-verification/0.9" } });
  assert.equal(response.status, 200, `Published source unavailable: ${url}`);
  const reader = response.body!.getReader(), chunks: Uint8Array[] = [];
  let bytes = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    bytes += value.byteLength;
    if (bytes > 12 * 1024 * 1024) { await reader.cancel(); throw new Error("Public pricing page exceeds byte budget"); }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

const catalogue = await collectMediaCatalogue();
for (const provider of catalogue.providers) {
  assert.equal(provider.population.completeness, "full", `${provider.provider}: incomplete population`);
  assert.equal(provider.population.listed, provider.population.retained);
  assert.equal(provider.population.excluded, 0);
}
const comparisons: Array<Record<string, unknown>> = [];
function price(provider: string, id: string) {
  const model = catalogue.models.find(m => m.provider === provider && m.id === id);
  assert.ok(model, `${provider}/${id}: missing identity`);
  const p = model.pricing.prices[0]; assert.ok(p?.value, `${provider}/${id}: no exact terminating price`);
  return p;
}
const deepUrl = "https://deepinfra.com/pricing", deepHtml = await page(deepUrl);
const deepRow = [...deepHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].find(m => m[1]?.includes('href="/black-forest-labs/FLUX-1.1-pro"'));
assert.ok(deepRow, "DeepInfra model pricing row absent");
const deepCells = [...deepRow[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
const deepPublished = /^\$\s*(\d+(?:\.\d+)?)$/.exec(stripTags(deepCells[1]?.[1] ?? ""))?.[1];
assert.ok(deepPublished, "DeepInfra published price missing");
const deepPrice = price("deepinfra", "black-forest-labs/FLUX-1.1-pro");
assert.equal(deepPrice.value, exactDecimalRatio(deepPublished).value);
comparisons.push({ provider: "deepinfra", id: "black-forest-labs/FLUX-1.1-pro", native: deepPrice.native, converted: deepPrice.value, unit: deepPrice.unit, published: deepPublished, sourceUrl: deepUrl, match: true });

for (const id of DEFAULT_WAVESPEED_ENRICH_IDS) {
  const url = `https://wavespeed.ai/models/${id}`, html = await page(url);
  const row = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].find(m => /^5 seconds\s/.test(stripTags(m[1]!)));
  assert.ok(row, `WaveSpeed five-second pricing row absent: ${id}`);
  const cells = [...row[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)];
  const published = /^\$\s*(\d+(?:\.\d+)?)$/.exec(stripTags(cells.at(-1)?.[1] ?? ""))?.[1];
  assert.ok(published, `WaveSpeed five-second price absent: ${id}`);
  const p = price("wavespeed", id);
  assert.equal(p.value, exactDecimalRatio(published, "1", "5").value);
  comparisons.push({ provider: "wavespeed", id, native: p.native, converted: p.value, unit: p.unit, publishedForFiveSeconds: published, sourceUrl: url, match: true });
}
const falId = "fal-ai/bytedance/seedream/v4/text-to-image", falUrl = `https://fal.ai/models/${falId}`;
const falText = stripTags(await page(falUrl));
const falPublished = /Your request\s+will cost\s+\$\s*(\d+(?:\.\d+)?)\s+per image/.exec(falText)?.[1];
assert.ok(falPublished, "Fal model page explicit per-image price absent");
const falPrice = price("fal", falId);
assert.equal(falPrice.value, exactDecimalRatio(falPublished).value);
comparisons.push({ provider: "fal", id: falId, native: falPrice.native, converted: falPrice.value, unit: falPrice.unit, published: falPublished, sourceUrl: falUrl, match: true });

console.log(JSON.stringify({ observedAt: new Date().toISOString(),
  population: catalogue.population,
  providers: catalogue.providers.map(provider => ({ provider: provider.provider, population: provider.population, pagesFetched: provider.requestParameters.pagesFetched,
    pricedModels: catalogue.models.filter(m => m.provider === provider.provider && m.pricing.status === "available").length,
    mediaPricedModels: catalogue.models.filter(m => m.provider === provider.provider && m.pricing.prices.some(p => ["usd_per_image", "usd_per_video_second"].includes(p.unit))).length,
  })), comparisons, comparisonCount: comparisons.length, comparedProviders: [...new Set(comparisons.map(c => c.provider))],
}, null, 2));

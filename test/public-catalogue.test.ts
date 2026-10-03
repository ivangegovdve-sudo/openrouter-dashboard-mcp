import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { readPublicCatalogue, publicCatalogueSchema } from '../src/public-catalogue.js';
test('public acquisition retains more than one MCP page and exact source prices', async () => {
  const catalogue = await readPublicCatalogue(['openrouter'], { fetchImpl: async () => new Response(JSON.stringify({ data: Array.from({ length: 600 }, (_, i) => ({ id: `model-${i}`, name: `Model ${i}`, context_length: 128000, architecture: { output_modalities: ['text'] }, pricing: { prompt: '0.0000008', completion: '0.0000016' } })) }), { headers: { 'Content-Type': 'application/json' } }) });
  assert.equal(catalogue.models.length, 600);
  assert.equal(catalogue.models[0]!.pricePoints[0]!.amount, '0.0000008');
  assert.equal(catalogue.inferenceCalls, 0);
  const polluted = { ...catalogue, queries: { publicCouncil: { rule: 'literal_cheapest_paid' } }, selection: 'private', models: catalogue.models.map(row => ({ ...row, nativePricing: { councilPolicy: 'private' } })) };
  const clean = publicCatalogueSchema.parse(polluted);
  assert.ok(!JSON.stringify(clean).includes('literal_cheapest_paid'));
  assert.ok(!JSON.stringify(clean).includes('councilPolicy'));
  assert.ok(!('requestParameters' in clean.providers[0]!));
});

test('public Cerebras acquisition accepts the hosted rendered-page adapter', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/cerebras-pricing.rendered-dom.json', import.meta.url), 'utf8'));
  const catalogue = await readPublicCatalogue(['cerebras'], {
    renderedPageFetcher: async () => ({
      ...fixture,
      tables: fixture.tables.map((table: { caption: { visibleText: string }; rows: { visibleText: string }[][] }) => ({
        caption: table.caption.visibleText,
        rows: table.rows.map(row => row.map(cell => cell.visibleText)),
      })),
    }),
  });
  assert.ok(catalogue.models.length > 0);
  assert.notEqual(catalogue.providers[0]!.status, 'unavailable');
  assert.equal(catalogue.inferenceCalls, 0);
});

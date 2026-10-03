// Run on the named machine. Catalogue/price reads only; the inference spend cap is $0.
import { readPublicCatalogue, PROVIDER_IDS } from '../build/public-catalogue.js';
import { writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';

const location = process.argv[2];
if (!['bulgaria-desktop', 'kvm2-europe', 'oracle-us'].includes(location)) throw new Error('LOCATION_REQUIRED');
const output = process.argv[3];
if (!output) throw new Error('OUTPUT_REQUIRED');
// Optional credentials arrive on stdin, never argv, disk, or logs.
if (process.argv.includes('--credentials-stdin')) {
  let input = ''; for await (const chunk of process.stdin) input += chunk;
  const supplied = JSON.parse(input);
  for (const name of ['GROQ_API_KEY', 'AKASHML_API_KEY', 'QWENCLOUD_API_KEY', 'SAIL_API_KEY']) {
    if (typeof supplied[name] === 'string') process.env[name] = supplied[name];
  }
  input = '';
}
const startedAt = new Date().toISOString();
const providers = [], models = [], verification = [];
for (const provider of PROVIDER_IDS) {
  const first = await readPublicCatalogue([provider]);
  providers.push(...first.providers); models.push(...first.models);
  // A second real acquisition checks three priced identities per provider.
  const samples = first.models.filter(row => row.pricePoints.length).slice(0, 3);
  const second = samples.length ? await readPublicCatalogue([provider]) : null;
  for (const row of samples) {
    const again = second.models.find(item => item.provider === row.provider && item.id === row.id);
    const values = points => points.map(({ amount, unit, condition }) => ({ amount, unit, condition }));
    verification.push({ provider, id: row.id, first: values(row.pricePoints), second: again ? values(again.pricePoints) : null,
      matches: !!again && JSON.stringify(values(row.pricePoints)) === JSON.stringify(values(again.pricePoints)),
      firstObservedAt: first.fetchedAt, secondObservedAt: second.fetchedAt });
  }
}
const result = { schemaVersion: '1.0', location, hostname: hostname(), startedAt, fetchedAt: new Date().toISOString(),
  availabilityBasis: 'catalogue_listing_only', inferenceCalls: 0, inferenceSpendUsd: '0', spendCapUsd: '0', providers, models, verification };
await writeFile(output, JSON.stringify(result));
console.log(JSON.stringify({ location, models: models.length, providers: providers.map(row => ({ provider: row.provider, status: row.status,
  listed: row.population.listed, error: row.error, priced: models.filter(m => m.provider === row.provider && m.pricePoints.length).length })),
  verificationSamples: verification.length, mismatches: verification.filter(row => !row.matches).length, inferenceSpendUsd: '0' }));

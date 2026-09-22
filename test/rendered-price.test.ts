import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { providerPriceCoverageResultSchema, resolveProviderPriceCoverage } from "../src/catalogue/price-coverage.js";
import { extractVisibleTableRows } from "../src/catalogue/rendered-page.js";
import { cerebrasModelPriceState, collectRenderedPriceCatalogue, parseCerebrasRenderedPricing } from "../src/catalogue/rendered-price.js";
import { runCatalogue } from "../src/tools/catalogue.js";

type FixtureCell = { visibleText: string; ariaLabel: string };
type FixtureTable = { caption: FixtureCell; rows: FixtureCell[][] };
type Fixture = { url: string; fetchedAt: string; domSettled: true; tables: FixtureTable[] };

async function loadFixture(): Promise<Fixture> {
  return JSON.parse(await readFile(new URL("./fixtures/cerebras-pricing.rendered-dom.json", import.meta.url), "utf8")) as Fixture;
}

/**
 * Rehydrates a saved post-JS DOM shape. getAttribute intentionally throws: a
 * successful extraction proves the parser did not inspect aria-label values.
 */
function fixtureDocument(fixture: Fixture) {
  return {
    querySelectorAll: (_selector: "table") => fixture.tables.map((table) => ({
      caption: { innerText: table.caption.visibleText },
      rows: table.rows.map((row) => ({
        cells: row.map((cell) => ({
          innerText: cell.visibleText,
          getAttribute: () => { throw new Error(`aria-label accessed: ${cell.ariaLabel}`); },
        })),
      })),
    })),
  };
}

test("prevents PRICES_UNPUBLISHED from being constructed without rendered-page evidence", () => {
  assert.throws(() => providerPriceCoverageResultSchema.parse({
    provider: "cerebras",
    state: "PRICES_UNPUBLISHED",
    priceRowCount: 0,
    apiPriceObservation: "no_prices",
  }));
  assert.throws(() => providerPriceCoverageResultSchema.parse({
    provider: "cerebras",
    state: "PRICES_UNPUBLISHED",
    priceRowCount: 0,
    apiPriceObservation: "no_prices",
    renderedPageEvidence: { url: "https://www.cerebras.ai/pricing", javascriptExecuted: true, tableCount: 1, priceRowCount: 0, outcome: "rendered_no_prices" },
  }));
  assert.throws(() => providerPriceCoverageResultSchema.parse({
    provider: "cerebras",
    state: "PRICES_UNPUBLISHED",
    priceRowCount: 0,
    apiPriceObservation: "no_prices",
    renderedPageEvidence: {
      url: "https://www.cerebras.ai/pricing",
      fetchedAt: "2026-09-23T09:00:00.000Z",
      javascriptExecuted: true,
      domSettled: true,
      tableCount: 1,
      priceTableCount: 1,
      priceTableObserved: true,
      priceRowCount: 0,
      explicitNoPrices: false,
      outcome: "rendered_no_prices",
    },
  }));
});

test("API silence without a rendered-page fetch resolves to UNKNOWN", () => {
  const result = resolveProviderPriceCoverage({
    provider: "cerebras",
    apiPriceObservation: "no_prices",
    apiPriceRowCount: 0,
  });
  assert.equal(result.state, "UNKNOWN");
  assert.equal(result.priceRowCount, 0);
});

test("a rendered-page fetch failure remains UNKNOWN rather than PRICES_UNPUBLISHED", async () => {
  const result = await collectRenderedPriceCatalogue({
    renderedPageFetcher: async () => { throw new Error("offline renderer unavailable"); },
  });
  assert.equal(result.providers[0]?.priceCoverage?.state, "UNKNOWN");
  assert.equal(result.providers[0]?.requestParameters.javascriptExecuted, false);
});

test("saved Cerebras rendered DOM yields exactly two priced rows and one offered-unpriced model", async () => {
  const fixture = await loadFixture();
  const tables = extractVisibleTableRows(fixtureDocument(fixture));
  const parsed = parseCerebrasRenderedPricing(tables);

  assert.deepEqual(parsed.priceRows.map((row) => [row.id, row.throughputTokensPerSecond, row.inputUsdPerMillion, row.outputUsdPerMillion]), [
    ["gpt-oss-120b", "~3000 tokens/s", "0.35", "0.75"],
    ["qwen-3.8-27b", "~1,850 tokens/s", "0.99", "1.49"],
  ]);
  assert.equal(cerebrasModelPriceState("gemma-4-31b", parsed), "offered_unpriced");
  assert.equal(cerebrasModelPriceState("not-on-the-page", parsed), "not_offered");

  const snapshot = { url: fixture.url, fetchedAt: fixture.fetchedAt, domSettled: fixture.domSettled, tables };
  const result = await collectRenderedPriceCatalogue({ renderedPageFetcher: async () => snapshot });
  assert.equal(result.providers[0]?.priceCoverage?.state, "PUBLISHES_PRICES");
  assert.equal(result.providers[0]?.priceCoverage?.renderedPageEvidence?.url, fixture.url);
  assert.equal(result.providers[0]?.priceCoverage?.renderedPageEvidence?.fetchedAt, fixture.fetchedAt);
  assert.equal(result.models.find((model) => model.id === "gemma-4-31b")?.modelPriceState, "offered_unpriced");
  assert.equal(result.models.find((model) => model.id === "gemma-4-31b")?.modelOfferingState, "listed_as_offered");
  assert.equal(result.models.find((model) => model.id === "qwen-3.8-27b")?.modelOfferingState, "not_listed_as_offered");
  assert.deepEqual(result.models.find((model) => model.id === "gpt-oss-120b")?.pricePoints.map((point) => point.amount), ["0.00000035", "0.00000075"]);
});

test("Cerebras rendered pricing never reads aria-label prices", async () => {
  const fixture = await loadFixture();
  const parsed = parseCerebrasRenderedPricing(extractVisibleTableRows(fixtureDocument(fixture)));
  assert.deepEqual(parsed.priceRows.map((row) => [row.inputUsdPerMillion, row.outputUsdPerMillion]), [
    ["0.35", "0.75"],
    ["0.99", "1.49"],
  ]);
});

test("a header-only rendered price table remains UNKNOWN rather than PRICES_UNPUBLISHED", async () => {
  const result = await collectRenderedPriceCatalogue({
    renderedPageFetcher: async () => ({
      url: "https://www.cerebras.ai/pricing",
      fetchedAt: "2026-09-23T10:00:00.000Z",
      domSettled: true,
      tables: [{ caption: "Model pricing", rows: [["Model", "Input price", "Output price"]] }],
    }),
  });
  assert.equal(result.providers[0]?.priceCoverage?.state, "UNKNOWN");
  assert.equal(result.providers[0]?.priceCoverage?.renderedPageEvidence, undefined);
});

test("a settled table with explicit no-prices text is the only route to PRICES_UNPUBLISHED", async () => {
  const result = await collectRenderedPriceCatalogue({
    renderedPageFetcher: async () => ({
      url: "https://www.cerebras.ai/pricing",
      fetchedAt: "2026-09-23T10:00:00.000Z",
      domSettled: true,
      tables: [{
        caption: "Model pricing",
        rows: [
          ["Model", "Input price", "Output price"],
          ["No published prices", "No published prices", "No published prices"],
        ],
      }],
    }),
  });
  assert.equal(result.providers[0]?.priceCoverage?.state, "PRICES_UNPUBLISHED");
  assert.deepEqual(result.providers[0]?.priceCoverage?.renderedPageEvidence, {
    url: "https://www.cerebras.ai/pricing",
    fetchedAt: "2026-09-23T10:00:00.000Z",
    javascriptExecuted: true,
    domSettled: true,
    tableCount: 1,
    priceTableCount: 1,
    priceTableObserved: true,
    priceRowCount: 0,
    explicitNoPrices: true,
    outcome: "rendered_no_prices",
  });
});

test("a price-like but unretained rendered row remains UNKNOWN rather than PRICES_UNPUBLISHED", async () => {
  const result = await collectRenderedPriceCatalogue({
    renderedPageFetcher: async () => ({
      url: "https://www.cerebras.ai/pricing",
      fetchedAt: "2026-09-23T10:03:00.000Z",
      domSettled: true,
      tables: [{
        caption: "Model pricing",
        rows: [
          ["Model", "Input price", "Output price"],
          ["GPT OSS 120B", "$0.35", "$0.75"],
        ],
      }],
    }),
  });
  assert.equal(result.providers[0]?.priceCoverage?.state, "UNKNOWN");
  assert.equal(result.providers[0]?.priceCoverage?.renderedPageEvidence, undefined);
  assert.equal(result.providers[0]?.requestParameters.unparseablePriceRowCount, 1);
});

test("an unrecognized rendered table remains UNKNOWN rather than claiming unpublished prices", async () => {
  const result = await collectRenderedPriceCatalogue({
    renderedPageFetcher: async () => ({
      url: "https://www.cerebras.ai/pricing",
      fetchedAt: "2026-09-23T10:05:00.000Z",
      domSettled: true,
      tables: [{ caption: "Unrelated table", rows: [["Feature", "Developer"], ["Fast inference", "yes"]] }],
    }),
  });
  assert.equal(result.providers[0]?.priceCoverage?.state, "UNKNOWN");
  assert.equal(result.providers[0]?.priceCoverage?.renderedPageEvidence, undefined);
  assert.equal(result.providers[0]?.requestParameters.priceTableCount, 0);
});

test("dashboard_catalogue runs the rendered Cerebras source as a first-class collector", async () => {
  const fixture = await loadFixture();
  const tables = extractVisibleTableRows(fixtureDocument(fixture));
  const result = await runCatalogue({ providers: ["cerebras"], offset: 0, limit: 20 }, {
    client: {} as never,
    renderedPageFetcher: async () => ({ url: fixture.url, fetchedAt: fixture.fetchedAt, domSettled: fixture.domSettled, tables }),
  });
  assert.equal(result.providers[0]?.priceCoverage?.state, "PUBLISHES_PRICES");
  assert.deepEqual(result.models.map((model) => model.id), ["gemma-4-31b", "gpt-oss-120b", "qwen-3.8-27b"]);
});

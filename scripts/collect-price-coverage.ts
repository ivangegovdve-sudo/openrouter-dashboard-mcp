/**
 * Live, read-only price-coverage probe. It deliberately uses the same source
 * collectors as dashboard_catalogue; a browser-rendered source participates
 * in the normal source list rather than being a documentation-only fallback.
 *
 * Credentials are read from the process environment and are never serialized.
 */
import { collectMediaCatalogue } from "../src/catalogue/index.js";
import { collectCrazyrouterCatalogue } from "../src/catalogue/crazyrouter.js";
import { collectNativePriceCatalogue } from "../src/catalogue/native-price.js";
import { resolveProviderPriceCoverage, type ProviderPriceCoverageResult } from "../src/catalogue/price-coverage.js";
import { collectRenderedPriceCatalogue } from "../src/catalogue/rendered-price.js";

const SAIL_PRICING_URL = "https://docs.sailresearch.com/pricing.md";
const PROVIDER_ORDER = [
  "openrouter", "groq", "cerebras", "sail", "nous", "qwencloud", "deepinfra", "novita", "sambanova", "chutes", "wavespeed", "fal", "crazyrouter",
] as const;

type CoverageRow = {
  provider: string;
  coverage: ProviderPriceCoverageResult;
  sourceUrl: string;
  sourceKind: string;
  collectorStatus: string;
};

function rowsFromCollector(input: { providers: Array<{ provider: string; sourceUrl: string; status: string; requestParameters: Record<string, unknown>; priceCoverage?: ProviderPriceCoverageResult | undefined }> }, fallbackKind: string): CoverageRow[] {
  return input.providers.map((provider) => ({
    provider: provider.provider,
    coverage: provider.priceCoverage ?? resolveProviderPriceCoverage({
      provider: provider.provider,
      apiPriceObservation: "unavailable",
      sourceReachable: false,
    }),
    sourceUrl: provider.sourceUrl,
    sourceKind: String(provider.requestParameters.sourceKind ?? fallbackKind),
    collectorStatus: provider.status,
  }));
}

async function sailCoverage(): Promise<CoverageRow> {
  try {
    const response = await fetch(SAIL_PRICING_URL, { headers: { Accept: "text/markdown,text/plain" }, redirect: "error" });
    if (!response.ok) throw new Error("SAIL_PRICING_HTTP_ERROR");
    const text = await response.text();
    // Sail is Markdown, not HTML. Count visible Markdown-table rows with a
    // dollar value; no DOM accessibility attributes are read.
    const priceRowCount = text.split(/\r?\n/).filter((line) => line.includes("|") && /\$\s*\d/.test(line)).length;
    const coverage = resolveProviderPriceCoverage({
      provider: "sail",
      apiPriceObservation: priceRowCount > 0 ? "prices_found" : "no_prices",
      apiPriceRowCount: priceRowCount,
    });
    return { provider: "sail", coverage, sourceUrl: SAIL_PRICING_URL, sourceKind: "markdown", collectorStatus: "available" };
  } catch {
    return {
      provider: "sail",
      coverage: resolveProviderPriceCoverage({ provider: "sail", apiPriceObservation: "unavailable", sourceReachable: false }),
      sourceUrl: SAIL_PRICING_URL,
      sourceKind: "markdown",
      collectorStatus: "unavailable",
    };
  }
}

async function main(): Promise<void> {
  const [native, rendered, media, crazyrouter, sail] = await Promise.all([
    collectNativePriceCatalogue({ timeoutMs: 30_000 }),
    collectRenderedPriceCatalogue({ timeoutMs: 30_000 }),
    collectMediaCatalogue({ timeoutMs: 30_000 }),
    collectCrazyrouterCatalogue({ timeoutMs: 30_000 }),
    sailCoverage(),
  ]);
  const rows = [
    ...rowsFromCollector(native, "native_json"),
    ...rowsFromCollector(rendered, "rendered_page"),
    ...rowsFromCollector(media, "native_catalogue"),
    ...rowsFromCollector({ providers: [crazyrouter.provider] }, "native_json"),
    sail,
  ].sort((left, right) => PROVIDER_ORDER.indexOf(left.provider as typeof PROVIDER_ORDER[number]) - PROVIDER_ORDER.indexOf(right.provider as typeof PROVIDER_ORDER[number]));
  console.log(JSON.stringify({ observedAt: new Date().toISOString(), providers: rows }, null, 2));
}

void main();

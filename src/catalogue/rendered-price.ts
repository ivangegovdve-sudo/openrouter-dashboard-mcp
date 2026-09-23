import { normalizePricePoint } from "./price-set.js";
import {
  modelOfferingStateSchema,
  modelPriceStateSchema,
  renderedPageEvidenceSchema,
  resolveProviderPriceCoverage,
  type ModelOfferingState,
  type ModelPriceState,
} from "./price-coverage.js";
import { catalogueModelSchema, catalogueProviderSchema, type CatalogueModel, type CatalogueProvider } from "./schemas.js";
import { fetchRenderedPageWithPlaywright, type RenderedPageFetcher, type RenderedPageSnapshot, type RenderedTable } from "./rendered-page.js";
import type { PricePoint } from "../contract.js";

/** Rendered pages are a primary source class, not a last-ditch fallback. */
export const RENDERED_PRICE_PROVIDER_IDS = ["cerebras"] as const;
export type RenderedPriceProviderId = (typeof RENDERED_PRICE_PROVIDER_IDS)[number];

export const RENDERED_PRICE_SOURCES: Record<RenderedPriceProviderId, string> = {
  cerebras: "https://www.cerebras.ai/pricing",
};

export type RenderedPriceOptions = {
  providers?: RenderedPriceProviderId[];
  renderedPageFetcher?: RenderedPageFetcher;
  timeoutMs?: number;
};

export type RenderedPriceCollection = {
  providers: CatalogueProvider[];
  models: CatalogueModel[];
};

export type CerebrasRenderedPriceRow = {
  id: string;
  displayName: string;
  /** Exact visible throughput text; it is not normalized into a price unit. */
  throughputTokensPerSecond: string | null;
  inputUsdPerMillion: string;
  outputUsdPerMillion: string;
  modelPriceState: "priced";
  modelOfferingState: ModelOfferingState;
};

export type CerebrasRenderedPricing = {
  priceRows: CerebrasRenderedPriceRow[];
  offeredModelIds: string[];
  tableCount: number;
  priceTableCount: number;
  candidatePriceRowCount: number;
  unparseablePriceRowCount: number;
  /** True only when a settled, otherwise-unambiguous table says prices are absent. */
  explicitNoPrices: boolean;
};

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function canonicalModelId(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function headerIndex(headers: string[], terms: string[]): number {
  return headers.findIndex((header) => terms.some((term) => header.includes(term)));
}

function usdPerMillion(value: string, header: string): string | undefined {
  const text = `${header} ${value}`.toLowerCase();
  // The visible DOM must establish both a USD amount and a million-token unit.
  if (!/\$|\busd\b/.test(text) || !/(?:\b1\s*m(?:illion)?\b|\bmillion\b|\/\s*m\b)/.test(text)) return undefined;
  const amount = value.match(/\$\s*(\d+(?:\.\d+)?)/) ?? value.match(/\b(\d+(?:\.\d+)?)\s*usd\b/i);
  return amount?.[1];
}

function throughputColumnIndex(headers: string[]): number {
  return headers.findIndex((header) => /(?:throughput|speed|tokens?\s*(?:\/|per)?\s*(?:s|sec(?:ond)?s?))/.test(header));
}

function explicitlyNoPublishedPrices(row: string[]): boolean {
  const text = normalizeText(row.join(" ")).toLowerCase();
  return /\b(?:no|not)\s+(?:(?:public(?:ly)?|published)\s+)?(?:prices?|pricing|rates?|costs?)\b/.test(text)
    || /\b(?:prices?|pricing|rates?|costs?)\s+(?:are|is)?\s*(?:not\s+published|unavailable)\b/.test(text);
}

function developerOfferings(tables: RenderedTable[]): string[] {
  const offered = new Set<string>();
  for (const table of tables) {
    const [headingRow, ...bodyRows] = table.rows;
    if (!headingRow) continue;
    const headers = headingRow.map((cell) => normalizeText(cell).toLowerCase());
    const tierIndex = headerIndex(headers, ["tier"]);
    const modelsIndex = headerIndex(headers, ["model"]);
    if (tierIndex >= 0 && modelsIndex >= 0) {
      for (const row of bodyRows) {
        if (!row[tierIndex] || !row[modelsIndex] || !/\bdeveloper\b/i.test(row[tierIndex])) continue;
        for (const candidate of row[modelsIndex].split(/[,;\n]/)) {
          const id = canonicalModelId(candidate);
          if (id) offered.add(id);
        }
      }
    }
    // The live Cerebras tier table is transposed: Developer is a column and
    // Models is a row label. Retain this separately from the price table.
    const developerIndex = headerIndex(headers, ["developer"]);
    const modelsRow = bodyRows.find((row) => /^models?$/i.test(normalizeText(row[0] ?? "")));
    if (developerIndex >= 0 && modelsRow?.[developerIndex]) {
      for (const candidate of modelsRow[developerIndex].split(/[,;\n]/)) {
        const id = canonicalModelId(candidate);
        if (id) offered.add(id);
      }
    }
  }
  return [...offered].sort();
}

/**
 * Parse only visible table cell text that the browser captured after page JS
 * executed. This never parses raw HTML and never consults aria attributes.
 */
export function parseCerebrasRenderedPricing(tables: RenderedTable[]): CerebrasRenderedPricing {
  const offeredModelIds = developerOfferings(tables);
  const offered = new Set(offeredModelIds);
  const rows = new Map<string, CerebrasRenderedPriceRow>();
  let priceTableCount = 0;
  let candidatePriceRowCount = 0;
  let unparseablePriceRowCount = 0;
  let explicitNoPriceRowCount = 0;

  for (const table of tables) {
    const [headingRow, ...bodyRows] = table.rows;
    if (!headingRow) continue;
    const headers = headingRow.map((cell) => normalizeText(cell).toLowerCase());
    const modelIndex = headerIndex(headers, ["model"]);
    const throughputIndex = throughputColumnIndex(headers);
    const inputIndex = headerIndex(headers, ["input", "prompt"]);
    const outputIndex = headerIndex(headers, ["output", "completion"]);
    if (modelIndex < 0 || inputIndex < 0 || outputIndex < 0) continue;
    priceTableCount++;
    for (const row of bodyRows) {
      if (!row.some((cell) => normalizeText(cell).length > 0)) continue;
      candidatePriceRowCount++;
      if (explicitlyNoPublishedPrices(row)) {
        explicitNoPriceRowCount++;
        continue;
      }
      const displayName = row[modelIndex] ? normalizeText(row[modelIndex]) : "";
      const id = canonicalModelId(displayName);
      const throughputTokensPerSecond = throughputIndex >= 0 && row[throughputIndex] !== undefined
        ? normalizeText(row[throughputIndex]) || null
        : null;
      const input = row[inputIndex] === undefined ? undefined : usdPerMillion(row[inputIndex], headers[inputIndex] ?? "");
      const output = row[outputIndex] === undefined ? undefined : usdPerMillion(row[outputIndex], headers[outputIndex] ?? "");
      if (!id || !input || !output) {
        unparseablePriceRowCount++;
        continue;
      }
      if (rows.has(id)) continue;
      rows.set(id, {
        id,
        displayName,
        throughputTokensPerSecond,
        inputUsdPerMillion: input,
        outputUsdPerMillion: output,
        modelPriceState: "priced",
        modelOfferingState: offered.has(id) ? "listed_as_offered" : "not_listed_as_offered",
      });
    }
  }
  const priceRows = [...rows.values()];
  return {
    priceRows,
    offeredModelIds,
    tableCount: tables.length,
    priceTableCount,
    candidatePriceRowCount,
    unparseablePriceRowCount,
    explicitNoPrices: priceRows.length === 0 && explicitNoPriceRowCount > 0 && unparseablePriceRowCount === 0,
  };
}

/** A model absent from both visible tables is representably not offered. */
export function cerebrasModelPriceState(modelId: string, pricing: CerebrasRenderedPricing): ModelPriceState {
  const id = canonicalModelId(modelId);
  if (pricing.priceRows.some((row) => row.id === id)) return "priced";
  if (pricing.offeredModelIds.includes(id)) return pricing.priceRows.length > 0 || pricing.explicitNoPrices ? "offered_unpriced" : "unknown";
  return "not_offered";
}

function cerebrasPricePoints(row: CerebrasRenderedPriceRow, sourceUrl: string, readAt: string): PricePoint[] {
  return [
    normalizePricePoint({
      id: `cerebras:${row.id}:input`, value: row.inputUsdPerMillion, unit: "token_in", divisor: "1000000",
      sourceUrl, readAt, provenance: "published", measurementOrigin: "catalogue", observed: null,
    }),
    normalizePricePoint({
      id: `cerebras:${row.id}:output`, value: row.outputUsdPerMillion, unit: "token_out", divisor: "1000000",
      sourceUrl, readAt, provenance: "published", measurementOrigin: "catalogue", observed: null,
    }),
  ];
}

function cerebrasModels(pricing: CerebrasRenderedPricing, snapshot: RenderedPageSnapshot): CatalogueModel[] {
  const pricedById = new Map(pricing.priceRows.map((row) => [row.id, row]));
  const ids = [...new Set([...pricedById.keys(), ...pricing.offeredModelIds])];
  return ids.map((id, sourceIndex) => {
    const priced = pricedById.get(id);
    const modelPriceState = cerebrasModelPriceState(id, pricing);
    const modelOfferingState: ModelOfferingState = priced?.modelOfferingState
      ?? (pricing.offeredModelIds.includes(id) ? "listed_as_offered" : "not_listed_as_offered");
    const pricePoints = priced ? cerebrasPricePoints(priced, snapshot.url, snapshot.fetchedAt) : [];
    return catalogueModelSchema.parse({
      provider: "cerebras",
      id,
      displayName: priced?.displayName ?? id,
      mediaKind: "text",
      nativeType: "text-generation",
      pricePoints,
      pricingState: modelPriceState === "priced" ? "published" : "unknown",
      modelPriceState: modelPriceStateSchema.parse(modelPriceState),
      modelOfferingState: modelOfferingStateSchema.parse(modelOfferingState),
      pricingNote: modelPriceState === "offered_unpriced"
        ? "Developer tier lists this model as offered, but the rendered price table has no matching row."
        : modelPriceState === "unknown"
          ? "The rendered page did not expose a recognizable price table for this offered model."
        : modelPriceState === "not_offered"
          ? "No matching model was visible in the rendered offering or price table."
          : "Price read from visible cells in the rendered Cerebras pricing table.",
      nativePricing: priced ? {
        throughputTokensPerSecond: priced.throughputTokensPerSecond,
        inputUsdPerMillion: priced.inputUsdPerMillion,
        outputUsdPerMillion: priced.outputUsdPerMillion,
      } : null,
      provenance: { sourceUrl: snapshot.url, observedAt: snapshot.fetchedAt, sourceIndex },
    });
  });
}

function unavailableProvider(sourceUrl: string, observedAt: string): CatalogueProvider {
  const priceCoverage = resolveProviderPriceCoverage({
    // A renderer failure is not proof that the provider lacks prices. Keep the
    // coverage conclusion unknown until a page was actually rendered.
    provider: "cerebras", apiPriceObservation: "not_fetched",
  });
  return catalogueProviderSchema.parse({
    provider: "cerebras",
    status: "unavailable",
    sourceUrl,
    observedAt,
    population: { listed: null, received: null, retained: null, excluded: null, exclusionRules: [], completeness: "unavailable" },
    requestParameters: { sourceKind: "rendered_page", javascriptExecuted: false, renderedPageError: "RENDERED_PAGE_FETCH_FAILED", measurementOrigin: "catalogue", observedChargeField: null },
    priceCoverage,
    error: "RENDERED_PAGE_FETCH_FAILED",
  });
}

async function collectCerebras(options: Required<Pick<RenderedPriceOptions, "timeoutMs">> & { renderedPageFetcher: RenderedPageFetcher }): Promise<{ provider: CatalogueProvider; models: CatalogueModel[] }> {
  const sourceUrl = RENDERED_PRICE_SOURCES.cerebras;
  try {
    const snapshot = await options.renderedPageFetcher({ url: sourceUrl, timeoutMs: options.timeoutMs });
    const parsed = parseCerebrasRenderedPricing(snapshot.tables);
    const outcome = parsed.priceRows.length > 0
      ? "rendered_prices_found"
      : parsed.explicitNoPrices && snapshot.domSettled
        ? "rendered_no_prices"
        : undefined;
    const evidence = outcome === undefined ? undefined : renderedPageEvidenceSchema.parse({
      url: snapshot.url,
      fetchedAt: snapshot.fetchedAt,
      javascriptExecuted: true,
      domSettled: snapshot.domSettled,
      tableCount: parsed.tableCount,
      priceTableCount: parsed.priceTableCount,
      priceTableObserved: true,
      priceRowCount: parsed.priceRows.length,
      explicitNoPrices: parsed.explicitNoPrices,
      outcome,
    });
    const priceCoverage = resolveProviderPriceCoverage({
      // This collector intentionally does not treat the model endpoint as a
      // price source. Its prior silence is not replayed as current evidence.
      provider: "cerebras", apiPriceObservation: "not_fetched", ...(evidence ? { renderedPageEvidence: evidence } : {}),
    });
    const models = cerebrasModels(parsed, snapshot);
    return {
      models,
      provider: catalogueProviderSchema.parse({
        provider: "cerebras",
        status: evidence ? "available" : "partial",
        sourceUrl: snapshot.url,
        observedAt: snapshot.fetchedAt,
        population: {
          listed: models.length, received: models.length, retained: models.length, excluded: 0,
          exclusionRules: ["The page's offering tier and price table are kept as separate observations; a model missing from one is not silently reconciled."],
          completeness: evidence ? "full" : "partial",
        },
        requestParameters: {
          sourceKind: "rendered_page", javascriptExecuted: true, ...(evidence ? { renderedPageEvidence: evidence } : {}),
          priceRows: parsed.priceRows.length, priceTableCount: parsed.priceTableCount, candidatePriceRowCount: parsed.candidatePriceRowCount, unparseablePriceRowCount: parsed.unparseablePriceRowCount, explicitNoPrices: parsed.explicitNoPrices, offeredModelIds: parsed.offeredModelIds, measurementOrigin: "catalogue", observedChargeField: null,
        },
        priceCoverage,
      }),
    };
  } catch {
    return { provider: unavailableProvider(sourceUrl, new Date().toISOString()), models: [] };
  }
}

/** Collect configured rendered sources as part of the ordinary catalogue path. */
export async function collectRenderedPriceCatalogue(options: RenderedPriceOptions = {}): Promise<RenderedPriceCollection> {
  const providers = [...new Set(options.providers ?? [...RENDERED_PRICE_PROVIDER_IDS])];
  if (providers.some((provider) => !RENDERED_PRICE_PROVIDER_IDS.includes(provider))) throw new Error("Unsupported rendered price provider");
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 15_000, 1), 30_000);
  const renderedPageFetcher = options.renderedPageFetcher ?? fetchRenderedPageWithPlaywright;
  const collections = await Promise.all(providers.map(async (provider) => {
    if (provider === "cerebras") return collectCerebras({ timeoutMs, renderedPageFetcher });
    throw new Error("Unsupported rendered price provider");
  }));
  return { providers: collections.map((collection) => collection.provider), models: collections.flatMap((collection) => collection.models) };
}

import { normalizePricePoint } from "./price-set.js";
import { mediaKind, record, scalar, type NativeRecord } from "./normalize.js";
import { catalogueModelSchema, catalogueProviderSchema, type CatalogueModel, type CatalogueProvider, type MediaKind } from "./schemas.js";
import { resolveProviderPriceCoverage } from "./price-coverage.js";
import type { PricePoint, PriceUnit } from "../contract.js";

/** Providers with a native, machine-readable price source not covered by the media adapters. */
export const NATIVE_PRICE_PROVIDER_IDS = [
  "openrouter",
  "groq",
  "nous",
  "qwencloud",
  "novita",
  "sambanova",
] as const;
export type NativePriceProviderId = (typeof NATIVE_PRICE_PROVIDER_IDS)[number];

export const NATIVE_PRICE_SOURCES: Record<NativePriceProviderId, string> = {
  openrouter: "https://openrouter.ai/api/v1/models",
  groq: "https://api.groq.com/openai/v1/models",
  nous: "https://inference-api.nousresearch.com/v1/models",
  qwencloud: "https://dashscope-intl.aliyuncs.com/api/v1/models",
  novita: "https://api.novita.ai/v3/openai/models",
  sambanova: "https://api.sambanova.ai/v1/models",
};

type SourceErrorCode =
  | "SOURCE_TIMEOUT"
  | "HTTP_ERROR"
  | "SOURCE_SHAPE_CHANGED"
  | "PRICE_SHAPE_CHANGED"
  | "KEY_NOT_CONFIGURED"
  | "SOURCE_FETCH_FAILED";

class SourceError extends Error {
  constructor(readonly code: SourceErrorCode) {
    super(code);
  }
}

type NativePriceOptions = {
  providers?: NativePriceProviderId[];
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  apiKeys?: Partial<Record<NativePriceProviderId, string>>;
};

export type NativePriceCollection = {
  providers: CatalogueProvider[];
  models: CatalogueModel[];
};

function modelKind(row: NativeRecord): MediaKind {
  const modalities = [row.output_modalities, row.outputModalities, row.input_modalities]
    .find((value): value is unknown[] => Array.isArray(value));
  const first = Array.isArray(modalities) ? modalities.find((value): value is string => typeof value === "string") : undefined;
  return mediaKind(first ?? scalar(row.model_type) ?? scalar(row.type) ?? "text-generation");
}

function modelId(row: NativeRecord): string | undefined {
  return scalar(row.id) ?? scalar(row.model_name) ?? scalar(row.model_id) ?? scalar(row.endpoint_id);
}

function safeNativePricing(row: NativeRecord): unknown {
  return row.pricing ?? row.prices ?? null;
}

function pricePoint(args: {
  provider: NativePriceProviderId;
  modelId: string;
  leg: string;
  value: string;
  unit: PriceUnit;
  sourceUrl: string;
  readAt: string;
  divisor?: string;
}): PricePoint | null {
  try {
    return normalizePricePoint({
      id: `${args.provider}:${args.modelId}:${args.leg}`,
      value: args.value,
      unit: args.unit,
      sourceUrl: args.sourceUrl,
      readAt: args.readAt,
      provenance: "published",
      measurementOrigin: "catalogue",
      observed: null,
      ...(args.divisor === undefined ? {} : { divisor: args.divisor }),
    });
  } catch {
    return null;
  }
}

const TOKEN_LEGS: Record<string, PriceUnit> = {
  prompt: "token_in",
  input: "token_in",
  completion: "token_out",
  output: "token_out",
  input_cache_read: "token_cached",
  input_cache_creation: "token_cache_create",
  input_cache_creation_5m: "token_cache_create",
  input_cache_write: "token_cache_create",
};

function tokenPricePoints(
  provider: NativePriceProviderId,
  id: string,
  pricing: NativeRecord,
  sourceUrl: string,
  observedAt: string,
  perMillion = false,
): PricePoint[] {
  const points: PricePoint[] = [];
  for (const [field, unit] of Object.entries(TOKEN_LEGS)) {
    const value = scalar(pricing[field]);
    if (value === undefined) continue;
    const point = pricePoint({ provider, modelId: id, leg: field, value, unit, sourceUrl, readAt: observedAt, ...(perMillion ? { divisor: "1000000" } : {}) });
    if (point) points.push(point);
  }
  return points;
}

function genericModel(
  provider: NativePriceProviderId,
  row: NativeRecord,
  sourceUrl: string,
  observedAt: string,
  sourceIndex: number,
  perMillion = false,
): CatalogueModel | null {
  const id = modelId(row);
  if (!id) return null;
  const pricing = record(row.pricing);
  const kind = modelKind(row);
  const points = tokenPricePoints(provider, id, pricing, sourceUrl, observedAt, perMillion);
  if (kind === "image") {
    const image = scalar(pricing.image);
    if (image !== undefined) {
      const point = pricePoint({ provider, modelId: id, leg: "image", value: image, unit: "image", sourceUrl, readAt: observedAt, ...(perMillion ? { divisor: "1000000" } : {}) });
      if (point) points.push(point);
    }
  }
  if (scalar(pricing.request) !== undefined) {
    const point = pricePoint({ provider, modelId: id, leg: "request", value: scalar(pricing.request)!, unit: "request", sourceUrl, readAt: observedAt, ...(perMillion ? { divisor: "1000000" } : {}) });
    if (point) points.push(point);
  }
  return catalogueModelSchema.parse({
    provider,
    id,
    displayName: scalar(row.name) ?? scalar(row.display_name) ?? id,
    mediaKind: kind,
    nativeType: scalar(row.model_type) ?? scalar(row.type) ?? "text-generation",
    ...(Array.isArray(row.output_modalities) && row.output_modalities.every((item) => typeof item === "string") ? { outputModalities: row.output_modalities } : {}),
    pricePoints: points,
    pricingState: points.length > 0 ? "published" : "unknown",
    pricingNote: points.length > 0 ? (perMillion ? "Provider prices are published per million tokens and converted exactly to per-token points." : "Provider prices are published as native per-token rates.") : "The model API did not expose a comparable price field; no rendered price-page finding was made.",
    nativePricing: safeNativePricing(row),
    provenance: { sourceUrl, observedAt, sourceIndex },
  });
}

function qwenTokenDivisor(priceUnit: string): string | undefined | null {
  if (/per\s+(?:1\s*m|million)\b/i.test(priceUnit)) return "1000000";
  if (/per\s+(?:1\s*k|thousand)\b/i.test(priceUnit)) return "1000";
  if (/per\s+token\b/i.test(priceUnit)) return undefined;
  return null;
}

function qwenTokenUnit(unit: PriceUnit, priceUnit: string): { unit: PriceUnit; divisor?: string } | null {
  const divisor = qwenTokenDivisor(priceUnit);
  if (divisor === null) return null;
  return { unit, ...(divisor === undefined ? {} : { divisor }) };
}

function qwenUnit(type: string, priceUnit: string): { unit: PriceUnit; divisor?: string } | null {
  if (["input_token", "prompt"].includes(type)) return qwenTokenUnit("token_in", priceUnit);
  if (["output_token", "completion"].includes(type)) return qwenTokenUnit("token_out", priceUnit);
  if (type.includes("cache_creation")) return qwenTokenUnit("token_cache_create", priceUnit);
  if (type.includes("cache")) return qwenTokenUnit("token_cached", priceUnit);
  if (/per\s+image/i.test(priceUnit)) return { unit: "image" };
  if (/per\s+request/i.test(priceUnit)) return { unit: "request" };
  if (/per\s+second/i.test(priceUnit)) return { unit: "video_second" };
  return null;
}

function qwenModel(row: NativeRecord, sourceUrl: string, observedAt: string, sourceIndex: number): CatalogueModel | null {
  const id = modelId(row);
  if (!id) return null;
  const points: PricePoint[] = [];
  const ranges = Array.isArray(row.prices) ? row.prices : [];
  for (const range of ranges) {
    const rangeRecord = record(range);
    if (scalar(rangeRecord.range_name) !== undefined && scalar(rangeRecord.range_name) !== "Default") continue;
    const entries = Array.isArray(rangeRecord.prices) ? rangeRecord.prices : [];
    for (const entry of entries) {
      const item = record(entry);
      const type = scalar(item.type), value = scalar(item.price), unitText = scalar(item.price_unit);
      if (!type || !value || !unitText) continue;
      const mapped = qwenUnit(type, unitText);
      if (!mapped) continue;
      const point = pricePoint({ provider: "qwencloud", modelId: id, leg: type, value, unit: mapped.unit, sourceUrl, readAt: observedAt, ...(mapped.divisor ? { divisor: mapped.divisor } : {}) });
      if (point) points.push(point);
    }
  }
  return catalogueModelSchema.parse({
    provider: "qwencloud",
    id,
    displayName: scalar(row.display_name) ?? scalar(row.name) ?? id,
    mediaKind: modelKind(row),
    nativeType: scalar(row.model_type) ?? "text-generation",
    ...(Array.isArray(row.output_modalities) && row.output_modalities.every((item) => typeof item === "string") ? { outputModalities: row.output_modalities } : {}),
    pricePoints: points,
    pricingState: points.length > 0 ? "published" : "unknown",
    pricingNote: "QwenCloud ranges are retained natively; only the unambiguous Default range and supported units become comparable points.",
    nativePricing: row.prices ?? null,
    provenance: { sourceUrl, observedAt, sourceIndex },
  });
}

function novitaModel(row: NativeRecord, sourceUrl: string, observedAt: string, sourceIndex: number): CatalogueModel | null {
  const id = modelId(row);
  if (!id) return null;
  const pricing = record(row.pricing);
  const tiered = row.is_tiered_billing === true;
  const points: PricePoint[] = [];
  if (!tiered) {
    for (const [field, unit] of [["prompt", "token_in"], ["completion", "token_out"], ["input_cache_read", "token_cached"]] as const) {
      const entry = record(pricing[field]);
      const value = scalar(entry.price_per_m_decimal) ?? scalar(row[`${field === "prompt" ? "input" : field === "completion" ? "output" : "input_cache_read"}_token_price_per_m`]);
      if (!value) continue;
      const point = pricePoint({ provider: "novita", modelId: id, leg: field, value, unit, sourceUrl, readAt: observedAt, divisor: "1000000" });
      if (point) points.push(point);
    }
  }
  return catalogueModelSchema.parse({
    provider: "novita",
    id,
    displayName: scalar(row.display_name) ?? scalar(row.title) ?? id,
    mediaKind: modelKind(row),
    nativeType: scalar(row.model_type) ?? "text-generation",
    ...(Array.isArray(row.output_modalities) && row.output_modalities.every((item) => typeof item === "string") ? { outputModalities: row.output_modalities } : {}),
    pricePoints: points,
    pricingState: points.length > 0 ? "published" : "unknown",
    pricingNote: tiered ? "Novita marks this model tiered; no single rate is inferred from the tiered source." : "Novita publishes per-million-token rates; comparable points are converted exactly to per-token units.",
    nativePricing: row.pricing ?? null,
    provenance: { sourceUrl, observedAt, sourceIndex },
  });
}

function rowsFor(provider: NativePriceProviderId, payload: NativeRecord): NativeRecord[] {
  if (provider === "qwencloud") {
    const output = record(payload.output);
    return Array.isArray(output.models) ? output.models.map(record) : [];
  }
  const rows = payload.data;
  return Array.isArray(rows) ? rows.map(record) : [];
}

function providerStatus(
  provider: NativePriceProviderId,
  sourceUrl: string,
  observedAt: string,
  rows: NativeRecord[],
  models: CatalogueModel[],
  requestParameters: Record<string, unknown>,
): CatalogueProvider {
  const priceRows = models.reduce((sum, model) => sum + model.pricePoints.length, 0);
  const priceCoverage = resolveProviderPriceCoverage({
    provider,
    apiPriceObservation: priceRows > 0 ? "prices_found" : "no_prices",
    apiPriceRowCount: priceRows,
  });
  return catalogueProviderSchema.parse({
    provider,
    status: "available",
    sourceUrl,
    observedAt,
    population: { listed: rows.length, received: rows.length, retained: models.length, excluded: rows.length - models.length, exclusionRules: ["Rows without a stable provider model id are excluded."], completeness: "full" },
    requestParameters: { ...requestParameters, priceRows, measurementOrigin: "catalogue", observedChargeField: null },
    priceCoverage,
  });
}

async function fetchJson(fetchImpl: typeof fetch, url: string, timeoutMs: number, apiKey?: string): Promise<NativeRecord> {
  if (apiKey === "") throw new SourceError("KEY_NOT_CONFIGURED");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "open-dashboard-mcp native-price catalogue/1.1", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) throw new SourceError("HTTP_ERROR");
    const text = await response.text();
    if (text.length > 16 * 1024 * 1024) throw new SourceError("SOURCE_SHAPE_CHANGED");
    try {
      return record(JSON.parse(text));
    } catch {
      throw new SourceError("SOURCE_SHAPE_CHANGED");
    }
  } catch (error) {
    if (controller.signal.aborted) throw new SourceError("SOURCE_TIMEOUT");
    if (error instanceof SourceError) throw error;
    throw new SourceError("SOURCE_FETCH_FAILED");
  } finally {
    clearTimeout(timer);
  }
}

function needsKey(provider: NativePriceProviderId): boolean {
  return provider === "groq" || provider === "qwencloud";
}

function emptyProvider(provider: NativePriceProviderId, sourceUrl: string, observedAt: string, error: SourceErrorCode): CatalogueProvider {
  const priceCoverage = resolveProviderPriceCoverage({ provider, apiPriceObservation: "unavailable", sourceReachable: false });
  return catalogueProviderSchema.parse({
    provider,
    status: "unavailable",
    sourceUrl,
    observedAt,
    population: { listed: null, received: null, retained: null, excluded: null, exclusionRules: [], completeness: "unavailable" },
    requestParameters: { measurementOrigin: "catalogue", observedChargeField: null },
    priceCoverage,
    error,
  });
}

/** Collect native price sources that the dashboard archive does not expose with a native denominator. */
export async function collectNativePriceCatalogue(options: NativePriceOptions = {}): Promise<NativePriceCollection> {
  const providers = [...new Set(options.providers ?? [...NATIVE_PRICE_PROVIDER_IDS])];
  const fetchImpl = options.fetchImpl ?? fetch;
  const observedAt = (options.now ?? (() => new Date()))().toISOString();
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 15000, 1), 30000);
  const collections = await Promise.all(providers.map(async (provider) => {
    const sourceUrl = NATIVE_PRICE_SOURCES[provider];
    const key = options.apiKeys?.[provider] ?? (provider === "groq" ? process.env.GROQ_API_KEY : provider === "qwencloud" ? process.env.QWENCLOUD_API_KEY : undefined);
    if (needsKey(provider) && !key) return { provider: emptyProvider(provider, sourceUrl, observedAt, "KEY_NOT_CONFIGURED"), models: [] };
    try {
      const payload = await fetchJson(fetchImpl, sourceUrl, timeoutMs, key);
      const rows = rowsFor(provider, payload);
      if (!rows.length) throw new SourceError("SOURCE_SHAPE_CHANGED");
      const models = rows.map((row, index) => provider === "qwencloud"
        ? qwenModel(row, sourceUrl, observedAt, index)
        : provider === "novita"
          ? novitaModel(row, sourceUrl, observedAt, index)
          : genericModel(provider, row, sourceUrl, observedAt, index))
        .filter((model): model is CatalogueModel => model !== null);
      return { provider: providerStatus(provider, sourceUrl, observedAt, rows, models, { apiKeyConfigured: Boolean(key), sourceKind: "native_json" }), models };
    } catch (error) {
      const code = error instanceof SourceError ? error.code : "SOURCE_FETCH_FAILED";
      return { provider: emptyProvider(provider, sourceUrl, observedAt, code), models: [] };
    }
  }));
  return { providers: collections.map((collection) => collection.provider), models: collections.flatMap((collection) => collection.models) };
}

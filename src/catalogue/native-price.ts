import { normalizePricePoint } from "./price-set.js";
import { exactDecimalRatio } from "./decimal.js";
import { mediaKind, record, scalar, type NativeRecord } from "./normalize.js";
import { catalogueModelSchema, catalogueProviderSchema, type CatalogueModel, type CatalogueProvider, type MediaKind } from "./schemas.js";
import { resolveProviderPriceCoverage } from "./price-coverage.js";
import type { PricePoint, PriceUnit } from "../contract.js";
import { responseShapeFor } from "../providers/response-shape.js";
import { classifyProviderBlock } from "../providers/registry.js";
import { parseSailPricing, SAIL_PRICING_URL, type SailPricing } from "./sail-pricing.js";

/** Providers with a native, machine-readable price source not covered by the media adapters. */
export const NATIVE_PRICE_PROVIDER_IDS = [
  "openrouter",
  "groq",
  "nous",
  "qwencloud",
  "novita",
  "sambanova",
  "akashml",
  "ionet",
  "sail",
] as const;
export type NativePriceProviderId = (typeof NATIVE_PRICE_PROVIDER_IDS)[number];

export const NATIVE_PRICE_SOURCES: Record<NativePriceProviderId, string> = {
  openrouter: "https://openrouter.ai/api/v1/models",
  groq: "https://api.groq.com/openai/v1/models",
  nous: "https://inference-api.nousresearch.com/v1/models",
  qwencloud: "https://dashscope-intl.aliyuncs.com/api/v1/models",
  novita: "https://api.novita.ai/v3/openai/models",
  sambanova: "https://api.sambanova.ai/v1/models",
  akashml: "https://api.akashml.com/v1/models",
  ionet: "https://api.intelligence.io.solutions/api/v1/models",
  sail: "https://api.sailresearch.com/v1/models",
};

type SourceErrorCode =
  | "SOURCE_TIMEOUT"
  | "HTTP_ERROR"
  /** A Cloudflare edge rejected the request (e.g. error 1010); says nothing about the key. */
  | "EDGE_BLOCKED"
  /** The provider itself rejected the credential. */
  | "PROVIDER_REJECTED"
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
  const contextLength = positiveInteger(row.context_length) ?? positiveInteger(row.context_window);
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
    ...(contextLength ? { contextLength } : {}),
    // OpenRouter is in the starting set, so its rows say "unmeasured" explicitly
    // rather than omitting the shape; its own reasoning flag is carried as advertised.
    ...(provider === "openrouter" ? { responseShape: responseShapeFor("openrouter", id, Array.isArray(row.supported_parameters) ? row.supported_parameters.includes("reasoning") : null) } : {}),
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

function textKind(row: NativeRecord): MediaKind {
  const outputs = Array.isArray(row.output_modalities) ? row.output_modalities : [];
  if (outputs.includes("image")) return "image";
  if (outputs.includes("text")) return "text";
  return "unknown";
}

function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

/**
 * AkashML publishes a USD-per-token `pricing` object per model on its keyed
 * /models. Rates differ ~44x across its six models (measured 2026-09-25), so it
 * is modelled per model, never as one provider rate.
 */
function akashmlModel(row: NativeRecord, sourceUrl: string, observedAt: string, sourceIndex: number): CatalogueModel | null {
  const id = modelId(row);
  if (!id) return null;
  const pricing = record(row.pricing);
  const points = tokenPricePoints("akashml", id, pricing, sourceUrl, observedAt);
  const features = Array.isArray(row.supported_features) ? row.supported_features : [];
  const contextLength = positiveInteger(row.context_length);
  return catalogueModelSchema.parse({
    provider: "akashml",
    id,
    displayName: scalar(row.name) ?? id,
    mediaKind: textKind(row),
    nativeType: "chat-completion",
    ...(Array.isArray(row.output_modalities) && row.output_modalities.every((item) => typeof item === "string") ? { outputModalities: row.output_modalities } : {}),
    pricePoints: points,
    pricingState: points.length > 0 ? "published" : "unknown",
    pricingNote: points.length > 0
      ? "AkashML publishes per-model USD-per-token rates on its keyed /models; these are read as published. A single provider-wide rate is not used."
      : "The AkashML model row carried no comparable price field.",
    nativePricing: row.pricing ?? null,
    ...(contextLength ? { contextLength } : {}),
    responseShape: responseShapeFor("akashml", id, features.includes("reasoning")),
    provenance: { sourceUrl, observedAt, sourceIndex },
  });
}

/**
 * io.net IO Intelligence publishes per-token prices as JSON numbers
 * (`input_token_price`, `output_token_price`, `cache_read_token_price`) on a
 * public /models. Numbers are converted via their decimal text, never floats.
 */
function ionetModel(row: NativeRecord, sourceUrl: string, observedAt: string, sourceIndex: number): CatalogueModel | null {
  const id = modelId(row);
  if (!id) return null;
  const points: PricePoint[] = [];
  for (const [field, unit] of [["input_token_price", "token_in"], ["output_token_price", "token_out"], ["cache_read_token_price", "token_cached"]] as const) {
    const value = scalar(row[field]);
    if (value === undefined) continue;
    const point = pricePoint({ provider: "ionet", modelId: id, leg: field, value, unit, sourceUrl, readAt: observedAt });
    if (point) points.push(point);
  }
  const contextLength = positiveInteger(row.context_window) ?? positiveInteger(row.max_model_len);
  return catalogueModelSchema.parse({
    provider: "ionet",
    id,
    displayName: scalar(row.name) ?? id,
    mediaKind: textKind(row),
    nativeType: "chat-completion",
    ...(Array.isArray(row.output_modalities) && row.output_modalities.every((item) => typeof item === "string") ? { outputModalities: row.output_modalities } : {}),
    pricePoints: points,
    pricingState: points.length > 0 ? "published" : "unknown",
    pricingNote: points.length > 0
      ? "io.net publishes per-token USD rates as JSON numbers on its public /models; they are converted exactly from their decimal text."
      : "The io.net model row carried no comparable price field.",
    nativePricing: {
      input_token_price: row.input_token_price ?? null,
      output_token_price: row.output_token_price ?? null,
      cache_read_token_price: row.cache_read_token_price ?? null,
      min_access_tier: row.min_access_tier ?? null,
    },
    ...(contextLength ? { contextLength } : {}),
    responseShape: responseShapeFor("ionet", id, typeof row.supports_reasoning === "boolean" ? row.supports_reasoning : null),
    provenance: { sourceUrl, observedAt, sourceIndex },
  });
}

/**
 * Sail's keyed /models returns identities only. Prices come from the pinned,
 * digest-verified pricing document and from nowhere else: a stale digest
 * leaves every Sail row unpriced with the reason, never on last week's rates.
 */
const SAIL_MODELS_URL = "https://docs.sailresearch.com/models.md";

/**
 * Sail publishes context sizes only on its models page, as rounded labels. Each
 * model is one table row: a model cell carrying the Context label and a slug
 * cell carrying the id in <code>. A label is bound only when both sit in the
 * same row, so a row without a Context line never inherits a neighbour's, and
 * a documented model missing from /models cannot pass its label on.
 */
export function parseSailContextLabels(doc: string, ids: ReadonlySet<string>): Map<string, string> {
  const labels = new Map<string, string>();
  for (const row of doc.split(/<tr\b/).slice(1)) {
    const body = row.split(/<\/tr>/)[0] ?? "";
    const slug = /cap-cell-slug[\s\S]*?<code>([^<]+)<\/code>/.exec(body)?.[1]?.trim();
    const context = /cap-expand-key">Context<\/span>\s*<span className="cap-expand-val">([^<]+)<\/span>/.exec(body)?.[1]?.trim();
    if (slug && context && ids.has(slug) && !labels.has(slug)) labels.set(slug, context);
  }
  return labels;
}

type SailContext = { state: "read" | "unavailable"; labels: Map<string, string>; error?: string };

/** A failed read is reported as unavailable, never as "no context published". */
async function fetchSailContextLabels(fetchImpl: typeof fetch, timeoutMs: number, ids: ReadonlySet<string>): Promise<SailContext> {
  try {
    const response = await fetchImpl(SAIL_MODELS_URL, { headers: { "User-Agent": "open-dashboard-mcp native-price catalogue/1.4" }, signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
    if (!response.ok) return { state: "unavailable", labels: new Map(), error: `HTTP_${response.status}` };
    return { state: "read", labels: parseSailContextLabels(await response.text(), ids) };
  } catch (error) {
    return { state: "unavailable", labels: new Map(), error: error instanceof Error && error.name === "TimeoutError" ? "SOURCE_TIMEOUT" : "SOURCE_FETCH_FAILED" };
  }
}

function sailModel(row: NativeRecord, pricing: SailPricing | null, sourceUrl: string, observedAt: string, sourceIndex: number, contextLabels: Map<string, string> = new Map()): CatalogueModel | null {
  const id = modelId(row);
  if (!id) return null;
  const points = pricing?.state === "verified" ? pricing.prices.get(id) ?? [] : [];
  const pricingNote = pricing === null
    ? "Sail's pricing document could not be fetched, so no price is quoted."
    : pricing.state === "stale"
      ? `PRICES ARE STALE: Sail's pricing document hashes to ${pricing.digest}, not the pinned digest, so no Sail price is quoted until the pin is reconciled.`
      : points.length > 0
        ? "Prices from Sail's digest-verified pricing document, one set per completion window (ASAP, Balanced, Flex); each price names its window."
        : "Listed by Sail's /models but absent from its verified pricing document.";
  return catalogueModelSchema.parse({
    provider: "sail",
    id,
    displayName: id,
    mediaKind: "text",
    nativeType: "chat-completion",
    pricePoints: points,
    pricingState: points.length > 0 ? "published" : "unknown",
    pricingNote,
    nativePricing: null,
    responseShape: responseShapeFor("sail", id, null),
    ...(contextLabels.has(id) ? { contextLengthLabel: { value: contextLabels.get(id)!, sourceUrl: SAIL_MODELS_URL, observedAt } } : {}),
    provenance: { sourceUrl, observedAt, sourceIndex },
  });
}

async function fetchSailPricing(fetchImpl: typeof fetch, timeoutMs: number, observedAt: string): Promise<SailPricing | null> {
  try {
    const response = await fetchImpl(SAIL_PRICING_URL, { headers: { "User-Agent": "open-dashboard-mcp native-price catalogue/1.3" }, signal: AbortSignal.timeout(timeoutMs), redirect: "error" });
    if (!response.ok) return null;
    return parseSailPricing(Buffer.from(await response.arrayBuffer()), observedAt);
  } catch {
    return null;
  }
}

/** Exact decimal comparison: -1, 0 or 1. Never binary floating point. */
function compareDecimal(a: string, b: string): number {
  const x = exactDecimalRatio(a), y = exactDecimalRatio(b);
  const left = BigInt(x.numerator) * BigInt(y.denominator), right = BigInt(y.numerator) * BigInt(x.denominator);
  return left < right ? -1 : left > right ? 1 : 0;
}

function tokenLegs(model: CatalogueModel): { input: string | null; output: string | null } {
  const leg = (unit: string) => model.pricePoints.find((point) => point.unit === unit && point.condition === null)?.amount ?? null;
  return { input: leg("token_in"), output: leg("token_out") };
}

/**
 * Nous resells OpenRouter's catalogue. Its advertised discounts are measured
 * against its own pricing.original, often above OpenRouter's price, so each Nous
 * row is compared with OpenRouter's live price for the same id. An OpenRouter
 * read that fails leaves the comparison "unknown", never assumed.
 */
async function annotateNousResale(models: CatalogueModel[], options: { fetchImpl: typeof fetch; timeoutMs: number; observedAt: string; collectedOpenRouter: boolean }): Promise<void> {
  let openRouter: Map<string, { input: string | null; output: string | null }> | null = null;
  let openRouterReadAt: string | null = null;
  if (options.collectedOpenRouter) {
    openRouter = new Map(models.filter((model) => model.provider === "openrouter").map((model) => [model.id, tokenLegs(model)]));
    openRouterReadAt = models.find((model) => model.provider === "openrouter")?.provenance.observedAt ?? null;
    if (openRouter.size === 0) openRouter = null;
  } else {
    try {
      const payload = await fetchJson(options.fetchImpl, NATIVE_PRICE_SOURCES.openrouter, options.timeoutMs);
      const rows = rowsFor("openrouter", payload);
      openRouter = new Map();
      rows.forEach((row, index) => {
        const model = genericModel("openrouter", row, NATIVE_PRICE_SOURCES.openrouter, options.observedAt, index);
        if (model) openRouter!.set(model.id, tokenLegs(model));
      });
      openRouterReadAt = options.observedAt;
      if (openRouter.size === 0) openRouter = null;
    } catch {
      openRouter = null;
    }
  }
  for (const model of models) {
    if (model.provider !== "nous") continue;
    const original = record(record(model.nativePricing).original);
    const claimedOriginal = Object.keys(original).length
      ? { input: scalar(original.prompt) ?? null, output: scalar(original.completion) ?? null }
      : null;
    const nous = tokenLegs(model);
    const or = openRouter?.get(model.id) ?? null;
    let versus: NonNullable<CatalogueModel["resale"]>["versusOpenRouter"] = "unknown";
    if (openRouter && !or) versus = "not_listed";
    else if (or) {
      const legs = ([["input", nous.input, or.input], ["output", nous.output, or.output]] as const)
        .filter(([, a, b]) => a !== null && b !== null)
        .map(([, a, b]) => compareDecimal(a!, b!));
      if (legs.length === 0) versus = "unknown";
      else if (legs.every((v) => v === 0)) versus = "identical";
      else if (legs.every((v) => v <= 0)) versus = "cheaper";
      else if (legs.every((v) => v >= 0)) versus = "dearer";
      else versus = "mixed";
    }
    model.resale = {
      correlatedWith: "openrouter",
      claimedOriginal,
      versusOpenRouter: versus,
      openRouterPrice: or,
      openRouterReadAt: or ? openRouterReadAt : null,
    };
  }
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
    // Only a request that carried a key can have its credential rejected; a
    // public catalogue's 401/403 stays a plain HTTP error (reviewer finding, #49).
    if (apiKey && (response.status === 401 || response.status === 403)) {
      const body = (await response.text()).slice(0, 4096);
      throw new SourceError(classifyProviderBlock(response.status, body, response.headers) === "edge_blocked" ? "EDGE_BLOCKED" : "PROVIDER_REJECTED");
    }
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
  return provider === "groq" || provider === "qwencloud" || provider === "akashml" || provider === "sail";
}

const KEY_ENV: Partial<Record<NativePriceProviderId, string>> = {
  groq: "GROQ_API_KEY",
  qwencloud: "QWENCLOUD_API_KEY",
  akashml: "AKASHML_API_KEY",
  sail: "SAIL_API_KEY",
};

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
    const envName = KEY_ENV[provider];
    const key = options.apiKeys?.[provider] ?? (envName ? process.env[envName] : undefined);
    if (needsKey(provider) && !key) return { provider: emptyProvider(provider, sourceUrl, observedAt, "KEY_NOT_CONFIGURED"), models: [] };
    try {
      const payload = await fetchJson(fetchImpl, sourceUrl, timeoutMs, key);
      const rows = rowsFor(provider, payload);
      if (!rows.length) throw new SourceError("SOURCE_SHAPE_CHANGED");
      const sailPricing = provider === "sail" ? await fetchSailPricing(fetchImpl, timeoutMs, observedAt) : null;
      const sailContext: SailContext | null = provider === "sail" ? await fetchSailContextLabels(fetchImpl, timeoutMs, new Set(rows.map((row) => modelId(row)).filter((id): id is string => Boolean(id)))) : null;
      const models = rows.map((row, index) => provider === "qwencloud"
        ? qwenModel(row, sourceUrl, observedAt, index)
        : provider === "novita"
          ? novitaModel(row, sourceUrl, observedAt, index)
          : provider === "akashml"
            ? akashmlModel(row, sourceUrl, observedAt, index)
            : provider === "ionet"
              ? ionetModel(row, sourceUrl, observedAt, index)
              : provider === "sail"
                ? sailModel(row, sailPricing, sourceUrl, observedAt, index, sailContext?.labels)
                : genericModel(provider, row, sourceUrl, observedAt, index))
        .filter((model): model is CatalogueModel => model !== null);
      const status = providerStatus(provider, sourceUrl, observedAt, rows, models, { apiKeyConfigured: Boolean(key), sourceKind: "native_json", ...(provider === "sail" ? { pricingSource: SAIL_PRICING_URL, pricingDigest: sailPricing?.state ?? "unavailable", contextSource: SAIL_MODELS_URL, contextSourceState: sailContext?.state ?? "unavailable", contextLabels: sailContext?.labels.size ?? 0, ...(sailContext?.error ? { contextSourceError: sailContext.error } : {}) } : {}) });
      // Identities without their only price source are a degraded answer, not a
      // complete one: a Sail-only catalogue must not report ok while quoting nothing.
      if (provider === "sail" && sailPricing?.state !== "verified") {
        return { provider: catalogueProviderSchema.parse({ ...status, status: "partial", error: sailPricing ? "PRICING_STALE" : "PRICING_UNAVAILABLE" }), models };
      }
      return { provider: status, models };
    } catch (error) {
      const code = error instanceof SourceError ? error.code : "SOURCE_FETCH_FAILED";
      return { provider: emptyProvider(provider, sourceUrl, observedAt, code), models: [] };
    }
  }));
  const models = collections.flatMap((collection) => collection.models);
  if (providers.includes("nous")) {
    await annotateNousResale(models, { fetchImpl, timeoutMs, observedAt, collectedOpenRouter: providers.includes("openrouter") });
  }
  return { providers: collections.map((collection) => collection.provider), models };
}

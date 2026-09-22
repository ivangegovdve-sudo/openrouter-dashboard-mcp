import { pricePoint } from "./price-set.js";
import { record, scalar } from "./normalize.js";
import {
  catalogueModelSchema,
  catalogueProviderSchema,
  type CatalogueModel,
  type CatalogueProvider,
  type MediaKind,
} from "./schemas.js";
import type { PricePoint, PriceUnit } from "../contract.js";

/** Public pricing page and the JSON comparison source it opens. */
export const HIGGSFIELD_PRICING_URL = "https://higgsfield.ai/pricing";
export const HIGGSFIELD_COMPARE_URL =
  "https://fnf-api-gw.higgsfield.ai/fnf/subscriptions/v2/compare?plan_set_key=ps_a3&billing_period=monthly&with_localization=true";

const HIGGSFIELD_CATEGORIES: Record<string, { mediaKind: MediaKind; unit: PriceUnit }> = {
  video: { mediaKind: "video", unit: "credit_video" },
  image: { mediaKind: "image", unit: "credit_image" },
  "lipsync-studio": { mediaKind: "audio", unit: "credit_audio" },
};

const DETAIL_RE = /^([~≈])?\s*(\d+(?:\.\d+)?)\s+credits?\s*\/\s*(?:(\d+)\s*(s)|image)$/i;

function scalarOrNull(value: unknown): string | number | boolean | null {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? value : null;
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180);
}

function planValues(value: unknown): Record<string, string | number | boolean | null> {
  const values = record(value);
  return Object.fromEntries(Object.entries(values).map(([name, raw]) => {
    const item = record(raw);
    return [name, scalarOrNull(item.value ?? raw)];
  }));
}

function planSummary(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row) => row && typeof row === "object" && !Array.isArray(row)).map((row) => {
    const item = record(row);
    return {
      name: scalarOrNull(item.name),
      planType: scalarOrNull(item.plan_type),
      billingPeriod: scalarOrNull(item.billing_period),
      credits: scalarOrNull(item.credits),
    };
  });
}

function higgsfieldModel(
  category: Record<string, unknown>,
  feature: Record<string, unknown>,
  sourceUrl: string,
  observedAt: string,
  sourceIndex: number,
): CatalogueModel | null {
  const categorySlug = scalar(category.slug);
  const name = scalar(feature.name);
  const detail = scalar(feature.detail)?.trim();
  const kind = categorySlug === undefined ? undefined : HIGGSFIELD_CATEGORIES[categorySlug];
  if (!categorySlug || !name || !detail || !kind) return null;
  const match = DETAIL_RE.exec(detail);
  if (!match) return null;
  const approximate = Boolean(match[1]);
  const durationSeconds = match[3] === undefined ? null : Number(match[3]);
  const id = `${categorySlug}/${slug(name)}`;
  const point: PricePoint = pricePoint({
    id: `higgsfield:${id}`,
    amount: match[2]!,
    unit: kind.unit,
    condition: null,
    sourceUrl,
    readAt: observedAt,
    provenance: "parsed_from_prose",
    measurementOrigin: "catalogue",
    observed: null,
    sourceText: detail,
  });
  return catalogueModelSchema.parse({
    provider: "higgsfield",
    id,
    displayName: name,
    mediaKind: kind.mediaKind,
    nativeType: "higgsfield-web-plan-credit-rate",
    outputModalities: [kind.mediaKind],
    pricePoints: [point],
    pricingState: "published",
    pricingNote: "Higgsfield publishes a web-plan credit rate. Credits are not converted to USD or EUR, and the web plans are not evidence of MCP or CLI inference availability.",
    nativePricing: {
      type: "web_plan_credits",
      detail,
      approximate,
      ...(durationSeconds === null ? {} : { durationSeconds }),
      planAccess: planValues(feature.values),
    },
    provenance: { sourceUrl, observedAt, sourceIndex },
  });
}

export type HiggsfieldComparison = {
  models: CatalogueModel[];
  provider: CatalogueProvider;
};

/** Parse the JSON payload opened by the public Higgsfield pricing page. */
export function parseHiggsfieldCompare(payload: unknown, observedAt: string): HiggsfieldComparison {
  const body = record(payload);
  if (!Array.isArray(body.categories)) throw new Error("HIGGSFIELD_CATEGORIES_SHAPE_CHANGED");
  const models: CatalogueModel[] = [];
  const identities = new Set<string>();
  let listed = 0;
  let withoutGenerationPrice = 0;
  for (const rawCategory of body.categories) {
    const category = record(rawCategory);
    if (!Array.isArray(category.features)) throw new Error("HIGGSFIELD_CATEGORY_SHAPE_CHANGED");
    for (const rawFeature of category.features) {
      listed++;
      const model = higgsfieldModel(category, record(rawFeature), HIGGSFIELD_COMPARE_URL, observedAt, listed - 1);
      if (!model) {
        withoutGenerationPrice++;
        continue;
      }
      if (identities.has(model.id)) throw new Error("HIGGSFIELD_DUPLICATE_MODEL_ID");
      identities.add(model.id);
      models.push(model);
    }
  }
  const plans = planSummary(body.plans);
  if (plans.length === 0) throw new Error("HIGGSFIELD_PLAN_POPULATION_MISSING");
  const provider = catalogueProviderSchema.parse({
    provider: "higgsfield",
    status: "available",
    sourceUrl: HIGGSFIELD_COMPARE_URL,
    observedAt,
    population: {
      listed,
      received: listed,
      retained: models.length,
      excluded: withoutGenerationPrice,
      exclusionRules: ["access, concurrency and credit-balance rows are retained in provider metadata but are not model generation prices"],
      completeness: "full",
    },
    requestParameters: {
      sourceApiUrl: HIGGSFIELD_COMPARE_URL,
      citationUrl: HIGGSFIELD_PRICING_URL,
      planSetKey: scalarOrNull(body.plan_set_key),
      billingPeriod: "monthly",
      countryCode: scalarOrNull(body.country_code),
      pricingAcquisitionStatus: models.length > 0 ? "available" : "PRICES_UNPUBLISHED",
      pricingUnits: "native_web_plan_credits",
      observedAmountField: null,
      plans,
      priceCoverageRule: "Only explicit model-generation detail strings become rows. Credits stay native; no currency conversion or price-paid inference is made.",
    },
  });
  return { provider, models };
}

type HiggsfieldOptions = {
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
};

async function readJson(fetchImpl: typeof fetch, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(HIGGSFIELD_COMPARE_URL, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "open-dashboard-mcp catalogue/1.1" },
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const text = await response.text();
    if (text.length > 2 * 1024 * 1024) throw new Error("RESPONSE_SIZE_LIMIT");
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new Error("JSON_INVALID");
    }
  } catch (error) {
    if (controller.signal.aborted) throw new Error("SOURCE_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Collect Higgsfield's public web-plan credit comparison without credentials. */
export async function collectHiggsfieldCatalogue(options: HiggsfieldOptions = {}): Promise<HiggsfieldComparison> {
  const observedAt = (options.now ?? (() => new Date()))().toISOString();
  const timeoutMs = Math.min(Math.max(options.timeoutMs ?? 12000, 1), 30000);
  try {
    return parseHiggsfieldCompare(await readJson(options.fetchImpl ?? fetch, timeoutMs), observedAt);
  } catch (error) {
    const code = error instanceof Error && /^HTTP_(?:404|410)$/.test(error.message)
      ? "PRICES_UNPUBLISHED"
      : error instanceof Error && /^(SOURCE_TIMEOUT|RESPONSE_SIZE_LIMIT|JSON_INVALID|HIGGSFIELD_[A-Z_]+|HTTP_\d+)$/.test(error.message)
        ? error.message
        : "SOURCE_FETCH_OR_SHAPE_FAILED";
    const provider = catalogueProviderSchema.parse({
      provider: "higgsfield",
      status: "unavailable",
      sourceUrl: HIGGSFIELD_COMPARE_URL,
      observedAt,
      population: { listed: null, received: null, retained: null, excluded: null, exclusionRules: [], completeness: "unavailable" },
      requestParameters: {
        sourceApiUrl: HIGGSFIELD_COMPARE_URL,
        citationUrl: HIGGSFIELD_PRICING_URL,
        pricingAcquisitionStatus: code === "PRICES_UNPUBLISHED" ? "PRICES_UNPUBLISHED" : "unknown",
      },
      error: code,
    });
    return { provider, models: [] };
  }
}

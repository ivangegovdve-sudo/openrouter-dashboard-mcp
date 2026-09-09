import { normalizeExactPrice } from "./decimal.js";
import { parseNativeJson } from "./json.js";
import type { CatalogueModel, ExactPrice, MediaKind } from "./schemas.js";

export type NativeRecord = Record<string, unknown>;
export const record = (value: unknown): NativeRecord => value && typeof value === "object" && !Array.isArray(value) ? value as NativeRecord : {};
export const scalar = (value: unknown): string | undefined => typeof value === "string" || (typeof value === "number" && Number.isFinite(value)) ? String(value) : undefined;
export function mediaKind(type: string | undefined): MediaKind {
  if (!type) return "unknown";
  if (/to-video$|video-(?:edit|extend|effects)$|^audio-to-video$/.test(type)) return "video";
  if (/to-image$|^diffusion$/.test(type)) return "image";
  if (/to-audio$|text-to-speech|text-to-music/.test(type)) return "audio";
  if (/to-text$|^text-generation$|^llm$|^vllm$|^embedding/.test(type)) return "text";
  return "other";
}
function pricing(native: unknown, prices: ExactPrice[], reason: string): CatalogueModel["pricing"] {
  return prices.length ? { status: "available", prices, native } : { status: "price_not_available", prices, reason, native };
}
export function normalizeDeepInfra(row: NativeRecord, sourceUrl: string, observedAt: string, sourceIndex: number): CatalogueModel {
  const id = scalar(row.model_name); if (!id) throw new Error("MODEL_ID_MISSING");
  const type = scalar(row.reported_type) ?? scalar(row.type), kind = mediaKind(type);
  const p = record(row.pricing), prices: ExactPrice[] = [];
  let reason = Object.keys(p).length ? "native_billing_unit_not_comparable" : "price_absent_from_collected_source";
  const add = (field: string, unit: ExactPrice["unit"], nativeUnit: string, conditions: NativeRecord = {}) => {
    const value = scalar(p[field]);
    if (value !== undefined) prices.push(normalizeExactPrice({ value, nativeUnit, sourceField: `pricing.${field}`, unit, divisor: "100", sourceUrl, conditions }));
  };
  try {
    if (p.type === "tokens") {
      add("cents_per_input_token", "usd_per_input_token", "cents_per_input_token");
      add("cents_per_output_token", "usd_per_output_token", "cents_per_output_token");
    } else if (p.type === "input_tokens") {
      add("cents_per_input_token", "usd_per_input_token", "cents_per_input_token");
    } else if (p.type === "output_length" && kind === "video") {
      add("cents_per_output_sec", "usd_per_video_second", "cents_per_output_second", { basis: "provider_base_rate", nativePricingTable: p.table ?? null });
    } else if (p.type === "image_units" && kind === "image") {
      // An image unit is the provider's reference image. Preserve its dimensions
      // and iteration count; do not multiply by iterations a second time.
      const conditions = { basis: "provider_reference_image", width: p.default_width ?? null, height: p.default_height ?? null, iterations: p.default_iterations ?? null, usageFromCost: p.usage_from_cost ?? null, nativePricingTable: p.table ?? null };
      if (p.default_price_cents != null) add("default_price_cents", "usd_per_image", "cents_per_default_image", conditions);
      else add("cents_per_image_unit", "usd_per_image", "cents_per_reference_image_unit", conditions);
    } else if (p.type === "time") reason = "compute_second_is_not_output_second_or_image";
    else if (p.type === "frame_units") reason = "frame_unit_requires_output_fps_and_frame_unit_definition";
    else if (p.type === "image_units" && kind === "video") reason = "video_billed_in_image_units_requires_output_duration";
  } catch { prices.length = 0; reason = "invalid_native_decimal"; }
  return { provider: "deepinfra", id, displayName: id, mediaKind: kind, nativeType: type ?? null, pricing: pricing(row.pricing ?? null, prices, reason), provenance: { sourceUrl, observedAt, sourceIndex } };
}

export function normalizeWaveSpeed(row: NativeRecord, sourceUrl: string, observedAt: string, sourceIndex: number): CatalogueModel {
  const id = scalar(row.model_uuid) ?? scalar(row.model_name); if (!id) throw new Error("MODEL_ID_MISSING");
  const type = scalar(row.type) ?? scalar(row.product_type), kind = mediaKind(type);
  let input = row.input;
  if (typeof input === "string") {
    try { input = parseNativeJson(input); } catch { input = {}; }
  }
  const defaults = record(record(input).properties);
  const duration = scalar(record(defaults.duration).default);
  const formula = scalar(row.formula);
  const base = scalar(row.base_price), prices: ExactPrice[] = [];
  let reason = base === undefined ? "price_absent_from_collected_source" : "base_run_quantity_or_pricing_formula_not_observed";
  // Only accept an observed, simple linear formula. Never evaluate provider code
  // or infer a output-second rate from an unrelated duration parameter alone.
  const linear = formula?.match(/^\s*\{\s*"total_price"\s*:\s*base_price\s*\*\s*duration\s*\/\s*(\d+(?:\.\d+)?)\s*\}\s*$/);
  const flat = formula !== undefined && /^\s*\{\s*"total_price"\s*:\s*base_price\s*\}\s*$/.test(formula);
  try {
    if (base !== undefined && kind === "video" && linear && duration !== undefined && duration === linear[1]) {
      prices.push(normalizeExactPrice({ value: base, nativeUnit: "micro_usd_per_base_run", sourceField: "base_price", unit: "usd_per_video_second", multiplier: "0.000001", divisor: duration, sourceUrl,
        conditions: { durationSeconds: duration, basis: "base_price_at_default_duration", nativeFormula: formula, discountApplied: false, resolution: record(defaults.resolution).default ?? record(defaults.size).default ?? null } }));
    } else if (base !== undefined && kind === "image" && flat) {
      const count = scalar(record(defaults.num_images).default ?? record(defaults.num_outputs).default ?? record(defaults.output_count).default);
      // An absent count parameter does not establish a single output image.
      // Unknown names such as batch_size remain unpriced until their contract
      // is checked instead of silently interpreting a run as one image.
      if (count !== undefined) {
        prices.push(normalizeExactPrice({ value: base, nativeUnit: "micro_usd_per_base_run", sourceField: "base_price", unit: "usd_per_image", multiplier: "0.000001", divisor: count, sourceUrl,
          conditions: { outputImages: count, basis: "base_run", nativeFormula: formula, discountApplied: false, size: record(defaults.size).default ?? null } }));
      } else reason = "base_run_output_image_count_not_established";
    } else if (formula !== undefined) reason = "dynamic_formula_requires_parameter_selection";
  } catch { prices.length = 0; reason = "invalid_native_decimal_or_quantity"; }
  return { provider: "wavespeed", id, displayName: scalar(row.model_name) ?? id, mediaKind: kind, nativeType: type ?? null,
    pricing: pricing({ base_price: row.base_price ?? null, currencyUnit: "micro_usd", formula: formula ?? null, durationDefault: duration ?? null, discount_rate: row.discount_rate ?? null }, prices, reason),
    provenance: { sourceUrl, observedAt, sourceIndex } };
}

export type FalPrice = { value: string; unit: string; sourceUrl: string };
/** Parse only explicit model/unit/price table cells, never loose dollar text. */
export function parseFalPricingPage(html: string): Map<string, FalPrice> {
  const prices = new Map<string, FalPrice>();
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1]!);
    const id = /href="\/models\/([^"?#]+)"/.exec(cells[0] ?? "")?.[1];
    const text = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const unit = text(cells[1] ?? ""), price = /^\$\s*(\d+(?:\.\d+)?)$/.exec(text(cells[2] ?? ""))?.[1];
    if (id && price && ["second", "image", "megapixel", "video"].includes(unit)) prices.set(id, { value: price, unit, sourceUrl: "https://fal.ai/pricing" });
  }
  return prices;
}
export function normalizeFal(row: NativeRecord, sourceUrl: string, observedAt: string, sourceIndex: number, published?: FalPrice): CatalogueModel {
  const id = scalar(row.endpoint_id); if (!id) throw new Error("MODEL_ID_MISSING");
  const metadata = record(row.metadata), type = scalar(metadata.category), kind = mediaKind(type), prices: ExactPrice[] = [];
  let reason = published ? "native_unit_requires_output_duration" : "price_not_in_public_pricing_table_individual_page_not_observed";
  if (published && ((kind === "video" && published.unit === "second") || (kind === "image" && ["image", "megapixel"].includes(published.unit)))) {
    prices.push(normalizeExactPrice({ value: published.value, nativeUnit: `usd_per_${published.unit}`, sourceField: "pricing_table.price", unit: kind === "image" ? "usd_per_image" : "usd_per_video_second", sourceUrl: published.sourceUrl,
      conditions: kind === "image" ? { outputImages: "1", outputMegapixels: "1", basis: "published_1MP_reference_image" } : { basis: "published_output_second", referenceResolution: "720p", publishedComparisonMayBeApproximate: true } }));
  }
  return { provider: "fal", id, displayName: scalar(metadata.display_name) ?? id, mediaKind: kind, nativeType: type ?? null,
    pricing: pricing(published ?? null, prices, reason), provenance: { sourceUrl, observedAt, sourceIndex } };
}
/** Explicit output-second contracts checked on fal's own model pages. A generic
 * seconds unit alone may describe GPU execution and is not sufficient. */
const FAL_OUTPUT_SECOND_CONTRACTS: Record<string, { sourceUrl: string; observedAt: string }> = {
  "fal-ai/kling-video/v2.5-turbo/pro/image-to-video": {
    sourceUrl: "https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    observedAt: "2026-09-08", // $0.35 for 5 output seconds; $0.07 each additional second.
  },
};
export function normalizeFalAuthenticated(row: NativeRecord, sourceUrl: string, observedAt: string, sourceIndex: number, nativePrices: NativeRecord[]): CatalogueModel {
  const model = normalizeFal(row, sourceUrl, observedAt, sourceIndex);
  const native = nativePrices, prices: ExactPrice[] = [];
  let reason = native.length ? "native_billing_unit_not_comparable" : "price_not_returned_by_authenticated_source";
  if (native.length > 1) reason = "multiple_native_price_entries_require_selection";
  if (native.length === 1) {
    const p = native[0]!, unit = scalar(p.unit)?.toLowerCase(), value = scalar(p.unit_price);
    const priceSource = "https://api.fal.ai/v1/models/pricing";
    const conditions: NativeRecord = { priceScope: "authenticated_account", accountDiscountMayApply: true, basis: "provider_base_billing_unit", endpointId: model.id };
    let canonical: ExactPrice["unit"] | undefined;
    if (p.currency !== "USD") reason = "native_currency_not_usd";
    else if (unit && /gpu|compute/.test(unit)) reason = "compute_billing_unit_not_output_quantity";
    else if (["image", "images"].includes(unit ?? "") && model.mediaKind === "image") {
      canonical = "usd_per_image"; conditions.outputImages = "1";
    } else if (["megapixel", "megapixels"].includes(unit ?? "") && model.mediaKind === "image") {
      canonical = "usd_per_image"; conditions.outputImages = "1"; conditions.outputMegapixels = "1";
      conditions.basis = "one_megapixel_reference_image";
    } else if (["video_second", "video_seconds", "output_video_second", "output_video_seconds"].includes(unit ?? "") && model.mediaKind === "video") {
      canonical = "usd_per_video_second";
    } else if (["second", "seconds"].includes(unit ?? "")) {
      const contract = Object.hasOwn(FAL_OUTPUT_SECOND_CONTRACTS, model.id) ? FAL_OUTPUT_SECOND_CONTRACTS[model.id] : undefined;
      if (contract && model.mediaKind === "video") {
        canonical = "usd_per_video_second";
        conditions.outputUnitEvidence = contract;
      } else reason = "second_unit_not_established_as_video_output";
    } else if (["video", "videos"].includes(unit ?? "")) reason = "video_unit_requires_verified_output_duration";
    if (canonical && value !== undefined) {
      try { prices.push(normalizeExactPrice({ value, nativeUnit: `USD/${p.unit}`, sourceField: "prices[].unit_price", unit: canonical, sourceUrl: priceSource, conditions })); }
      catch { reason = "invalid_native_decimal"; }
    } else if (canonical) reason = "invalid_native_decimal";
  }
  model.pricing = pricing(native, prices, reason);
  return model;
}
export function normalizeChutes(row: NativeRecord, sourceUrl: string, observedAt: string, sourceIndex: number): CatalogueModel {
  // chute_id is the provider's identity; names can collide across owner/deployment.
  const id = scalar(row.chute_id); if (!id) throw new Error("MODEL_ID_MISSING");
  const type = scalar(row.standard_template), kind = mediaKind(type), prices: ExactPrice[] = [];
  const tokenRates = record(record(row.current_estimated_price).per_million_tokens);
  let reason = row.current_estimated_price ? "compute_second_is_not_output_second_or_image" : "price_absent_from_collected_source";
  try {
    for (const [leg, unit] of [["input", "usd_per_input_token"], ["output", "usd_per_output_token"]] as const) {
      const value = scalar(record(tokenRates[leg]).usd);
      if (value !== undefined) prices.push(normalizeExactPrice({ value, nativeUnit: `usd_per_million_${leg}_tokens`, sourceField: `current_estimated_price.per_million_tokens.${leg}.usd`, unit, divisor: "1000000", sourceUrl }));
    }
  } catch { prices.length = 0; reason = "invalid_native_decimal"; }
  return { provider: "chutes", id, displayName: scalar(row.name) ?? id, mediaKind: kind, nativeType: type ?? null,
    pricing: pricing(row.current_estimated_price ?? null, prices, reason),
    provenance: { sourceUrl, observedAt, sourceIndex } };
}

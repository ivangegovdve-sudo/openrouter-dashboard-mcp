import { parseNativeJson } from "./json.js";
import { normalizePricePoint, pricePoint } from "./price-set.js";
import { exactDecimalRatio } from "./decimal.js";
import type { PricePoint, PriceUnit } from "../contract.js";
import type { CatalogueModel, MediaKind } from "./schemas.js";

export type NativeRecord = Record<string, unknown>;
export const record = (value: unknown): NativeRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as NativeRecord
    : {};
export const scalar = (value: unknown): string | undefined =>
  typeof value === "string" || (typeof value === "number" && Number.isFinite(value))
    ? String(value)
    : undefined;

function microUsdQuantityDivisor(quantity: string): string {
  const scaled = exactDecimalRatio(quantity, "1000000").value;
  if (scaled === undefined) throw new Error("Non-terminating output quantity");
  return scaled;
}

export function mediaKind(type: string | undefined): MediaKind {
  if (!type) return "unknown";
  if (/to-video$|video-(?:edit|extend|effects)$|^audio-to-video$/.test(type)) return "video";
  if (/to-image$|^diffusion$/.test(type)) return "image";
  if (/to-audio$|text-to-speech|text-to-music/.test(type)) return "audio";
  if (/to-text$|^text-generation$|^llm$|^vllm$|^embedding/.test(type)) return "text";
  return "other";
}

function pricing(
  nativePricing: unknown,
  pricePoints: PricePoint[],
  note: string,
  state: "published" | "not_published" | "unknown" = pricePoints.length ? "published" : "not_published",
): Pick<CatalogueModel, "pricePoints" | "pricingState" | "pricingNote" | "nativePricing"> {
  return {
    pricePoints,
    pricingState: state,
    pricingNote: note,
    nativePricing,
  };
}

export function normalizeDeepInfra(
  row: NativeRecord,
  sourceUrl: string,
  observedAt: string,
  sourceIndex: number,
): CatalogueModel {
  const id = scalar(row.model_name);
  if (!id) throw new Error("MODEL_ID_MISSING");
  const type = scalar(row.reported_type) ?? scalar(row.type);
  const kind = mediaKind(type);
  const p = record(row.pricing);
  const pricePoints: PricePoint[] = [];
  let note = Object.keys(p).length ? "native_billing_unit_not_comparable" : "price_absent_from_collected_source";
  const add = (field: string, unit: PriceUnit) => {
    const value = scalar(p[field]);
    if (value !== undefined) {
      pricePoints.push(normalizePricePoint({
        id: `deepinfra:${id}:${unit}`,
        value,
        unit,
        divisor: "100",
        sourceUrl,
        readAt: observedAt,
        provenance: "published",
        measurementOrigin: "catalogue",
        observed: null,
      }));
    }
  };
  try {
    if (p.type === "tokens") {
      add("cents_per_input_token", "token_in");
      add("cents_per_output_token", "token_out");
    } else if (p.type === "input_tokens") {
      add("cents_per_input_token", "token_in");
    } else if (p.type === "output_length" && kind === "video") {
      add("cents_per_output_sec", "video_second");
    } else if (p.type === "image_units" && kind === "image") {
      add(p.default_price_cents != null ? "default_price_cents" : "cents_per_image_unit", "image");
    } else if (p.type === "time") {
      note = "compute_second_is_not_output_second_or_image";
    } else if (p.type === "frame_units") {
      note = "frame_unit_requires_output_fps_and_frame_unit_definition";
    } else if (p.type === "image_units" && kind === "video") {
      note = "video_billed_in_image_units_requires_output_duration";
    }
  } catch {
    pricePoints.length = 0;
    note = "invalid_native_decimal";
  }
  return {
    provider: "deepinfra",
    id,
    displayName: id,
    mediaKind: kind,
    nativeType: type ?? null,
    ...pricing(row.pricing ?? null, pricePoints, note),
    provenance: { sourceUrl, observedAt, sourceIndex },
  };
}

export function normalizeWaveSpeed(
  row: NativeRecord,
  sourceUrl: string,
  observedAt: string,
  sourceIndex: number,
): CatalogueModel {
  const id = scalar(row.model_uuid) ?? scalar(row.model_name);
  if (!id) throw new Error("MODEL_ID_MISSING");
  const type = scalar(row.type) ?? scalar(row.product_type);
  const kind = mediaKind(type);
  let input = row.input;
  if (typeof input === "string") {
    try { input = parseNativeJson(input); } catch { input = {}; }
  }
  const defaults = record(record(input).properties);
  const duration = scalar(record(defaults.duration).default);
  const formula = scalar(row.formula);
  const base = scalar(row.base_price);
  const pricePoints: PricePoint[] = [];
  let note = base === undefined ? "price_absent_from_collected_source" : "base_run_quantity_or_pricing_formula_not_observed";
  const linear = formula?.match(/^\s*\{\s*"total_price"\s*:\s*base_price\s*\*\s*duration\s*\/\s*(\d+(?:\.\d+)?)\s*\}\s*$/);
  const flat = formula !== undefined && /^\s*\{\s*"total_price"\s*:\s*base_price\s*\}\s*$/.test(formula);
  try {
    if (base !== undefined && kind === "video" && linear && duration !== undefined && duration === linear[1]) {
      pricePoints.push(normalizePricePoint({
        id: `wavespeed:${id}:video_second`,
        value: base,
        unit: "video_second",
        divisor: microUsdQuantityDivisor(duration),
        sourceUrl,
        readAt: observedAt,
        provenance: "published",
        measurementOrigin: "catalogue",
        observed: null,
      }));
    } else if (base !== undefined && kind === "image" && flat) {
      const count = scalar(record(defaults.num_images).default ?? record(defaults.num_outputs).default ?? record(defaults.output_count).default);
      if (count !== undefined) {
        pricePoints.push(normalizePricePoint({
          id: `wavespeed:${id}:image`,
          value: base,
          unit: "image",
          divisor: microUsdQuantityDivisor(count),
          sourceUrl,
          readAt: observedAt,
          provenance: "published",
          measurementOrigin: "catalogue",
          observed: null,
        }));
      } else note = "base_run_output_image_count_not_established";
    } else if (formula !== undefined) {
      note = "dynamic_formula_requires_parameter_selection";
    }
  } catch {
    pricePoints.length = 0;
    note = "invalid_native_decimal_or_quantity";
  }
  return {
    provider: "wavespeed",
    id,
    displayName: scalar(row.model_name) ?? id,
    mediaKind: kind,
    nativeType: type ?? null,
    ...pricing({ base_price: row.base_price ?? null, currencyUnit: "micro_usd", formula: formula ?? null }, pricePoints, note),
    provenance: { sourceUrl, observedAt, sourceIndex },
  };
}

export type FalPrice = {
  value: string;
  unit: string;
  sourceUrl: string;
  condition?: PricePoint["condition"];
  provenance?: PricePoint["provenance"];
  sourceText?: string;
};

function proseSource(row: NativeRecord): string | undefined {
  for (const key of ["source_text", "description", "message", "prose"]) {
    const value = scalar(row[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

/** Parse only explicit model/unit/price table cells, never loose dollar text. */
export function parseFalPricingPage(html: string): Map<string, FalPrice> {
  const prices = new Map<string, FalPrice>();
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]!);
    const id = /href="\/models\/([^"?#]+)"/.exec(cells[0] ?? "")?.[1];
    const text = (value: string) => value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const unit = text(cells[1] ?? "");
    const value = /^\$\s*(\d+(?:\.\d+)?)$/.exec(text(cells[2] ?? ""))?.[1];
    if (id && value && ["second", "image", "megapixel", "video"].includes(unit)) {
      prices.set(id, { value, unit, sourceUrl: "https://fal.ai/pricing" });
    }
  }
  return prices;
}

export function normalizeFal(
  row: NativeRecord,
  sourceUrl: string,
  observedAt: string,
  sourceIndex: number,
  published?: FalPrice,
): CatalogueModel {
  const id = scalar(row.endpoint_id);
  if (!id) throw new Error("MODEL_ID_MISSING");
  const metadata = record(row.metadata);
  const type = scalar(metadata.category);
  const kind = mediaKind(type);
  const pricePoints: PricePoint[] = [];
  let note = published ? "native_unit_requires_output_duration" : "price_not_in_public_pricing_table_individual_page_not_observed";
  const canonicalUnit: PriceUnit | null = published === undefined ? null :
    published.unit === "second" && kind === "video" ? "video_second" :
    published.unit === "video" && kind === "video" ? "video" :
    ["image", "megapixel"].includes(published.unit) && kind === "image" ? published.unit as PriceUnit : null;
  if (published && canonicalUnit) {
    try {
      pricePoints.push(normalizePricePoint({
        id: `fal:${id}:${canonicalUnit}`,
        value: published.value,
        unit: canonicalUnit,
        condition: published.condition ?? null,
        sourceUrl: published.sourceUrl,
        readAt: observedAt,
        provenance: published.provenance ?? "published",
        measurementOrigin: "catalogue",
        observed: null,
        ...(published.sourceText === undefined ? {} : { sourceText: published.sourceText }),
      }));
    } catch {
      note = "invalid_native_decimal";
    }
  }
  return {
    provider: "fal",
    id,
    displayName: scalar(metadata.display_name) ?? id,
    mediaKind: kind,
    nativeType: type ?? null,
    ...pricing(published ?? null, pricePoints, note),
    provenance: { sourceUrl, observedAt, sourceIndex },
  };
}

const FAL_OUTPUT_SECOND_CONTRACTS: Record<string, { sourceUrl: string; observedAt: string }> = {
  "fal-ai/kling-video/v2.5-turbo/pro/image-to-video": {
    sourceUrl: "https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    observedAt: "2026-09-08T00:00:00.000Z",
  },
};

export function normalizeFalAuthenticated(
  row: NativeRecord,
  sourceUrl: string,
  observedAt: string,
  sourceIndex: number,
  nativePrices: NativeRecord[],
): CatalogueModel {
  const model = normalizeFal(row, sourceUrl, observedAt, sourceIndex);
  const native = nativePrices;
  const pricePoints: PricePoint[] = [];
  let note = native.length ? "native_billing_unit_not_comparable" : "price_not_returned_by_authenticated_source";
  if (native.length > 1) note = "multiple_native_price_entries_require_selection";
  if (native.length === 1) {
    const p = native[0]!;
    const unit = scalar(p.unit)?.toLowerCase();
    const value = scalar(p.unit_price);
    const sourceText = proseSource(p);
    const priceSource = "https://api.fal.ai/v1/models/pricing";
    let canonical: PriceUnit | undefined;
    // EVERY PRICE ON THIS PATH IS ACCOUNT-SCOPED. These come from the authenticated
    // pricing endpoint and are what this key is charged, not a public list rate. They
    // used to be emitted with `condition: null` -- an assertion that no condition applies
    // -- so nothing downstream could tell them apart from public prices. The id already
    // ended ":account"; the condition now says so too, where the comparison can see it.
    let condition: PricePoint["condition"] = { kind: "price_scope", name: "authenticated_account" };
    if (p.currency !== "USD") note = "native_currency_not_usd";
    else if (unit && /gpu|compute/.test(unit)) {
      canonical = "gpu_hour";
      condition = { kind: "price_scope", name: "authenticated_account", rateClass: p.rate_class === "as_low_as" ? "as_low_as" : "list" };
    } else if (["image", "images"].includes(unit ?? "") && model.mediaKind === "image") canonical = "image";
    else if (["megapixel", "megapixels"].includes(unit ?? "") && model.mediaKind === "image") canonical = "megapixel";
    else if (["video_second", "video_seconds", "output_video_second", "output_video_seconds"].includes(unit ?? "") && model.mediaKind === "video") canonical = "video_second";
    else if (["second", "seconds"].includes(unit ?? "")) {
      const contract = Object.hasOwn(FAL_OUTPUT_SECOND_CONTRACTS, model.id) ? FAL_OUTPUT_SECOND_CONTRACTS[model.id] : undefined;
      if (contract && model.mediaKind === "video") canonical = "video_second";
      else note = "second_unit_not_established_as_video_output";
    } else if (["video", "videos"].includes(unit ?? "")) canonical = "video";
    if (canonical && value !== undefined) {
      try {
        pricePoints.push(normalizePricePoint({
          id: `fal:${model.id}:${canonical}:account`,
          value,
          unit: canonical,
          condition,
          sourceUrl: priceSource,
          readAt: observedAt,
          provenance: sourceText === undefined ? "published" : "parsed_from_prose",
          measurementOrigin: "catalogue",
          observed: null,
          ...(sourceText === undefined ? {} : { sourceText }),
        }));
      } catch {
        note = "invalid_native_decimal";
      }
    }
  }
  return {
    ...model,
    ...pricing(native, pricePoints, note, pricePoints.length ? "published" : "unknown"),
  };
}

export function normalizeChutes(
  row: NativeRecord,
  sourceUrl: string,
  observedAt: string,
  sourceIndex: number,
): CatalogueModel {
  const id = scalar(row.chute_id);
  if (!id) throw new Error("MODEL_ID_MISSING");
  const type = scalar(row.standard_template);
  const kind = mediaKind(type);
  const pricePoints: PricePoint[] = [];
  const tokenRates = record(record(row.current_estimated_price).per_million_tokens);
  let note = row.current_estimated_price ? "compute_second_is_not_output_second_or_image" : "price_absent_from_collected_source";
  try {
    for (const [leg, unit] of [["input", "token_in"], ["output", "token_out"]] as const) {
      const value = scalar(record(tokenRates[leg]).usd);
      if (value !== undefined) {
        pricePoints.push(normalizePricePoint({
          id: `chutes:${id}:${unit}`,
          value,
          unit,
          divisor: "1000000",
          sourceUrl,
          readAt: observedAt,
          provenance: "published",
          measurementOrigin: "catalogue",
          observed: null,
        }));
      }
    }
  } catch {
    pricePoints.length = 0;
    note = "invalid_native_decimal";
  }
  return {
    provider: "chutes",
    id,
    displayName: scalar(row.name) ?? id,
    mediaKind: kind,
    nativeType: type ?? null,
    ...pricing(row.current_estimated_price ?? null, pricePoints, note),
    provenance: { sourceUrl, observedAt, sourceIndex },
  };
}

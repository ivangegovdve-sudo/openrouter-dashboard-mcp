import { pricePointSchema, type MeasurementOrigin, type PriceCondition, type PricePoint, type PriceUnit } from "../contract.js";
import { exactDecimalRatio } from "./decimal.js";

export type SailPricingRow = {
  window: string;
  input: string;
  cached: string;
  output: string;
};

function latencyWindow(value: string): "ASAP" | "Balanced" | "Flex" {
  const normalized = value.toLowerCase();
  if (normalized.includes("asap")) return "ASAP";
  if (normalized.includes("balanced")) return "Balanced";
  if (normalized.includes("flex")) return "Flex";
  throw new Error("Unsupported latency window");
}

function amountPerToken(amountPerMillion: string): string {
  const converted = exactDecimalRatio(amountPerMillion, "1", "1000000").value;
  if (converted === undefined) {
    throw new Error("Price does not have a terminating exact decimal representation");
  }
  return converted;
}

export function pricePoint(args: {
  id: string;
  amount: string;
  unit: PriceUnit;
  condition: PriceCondition;
  sourceUrl: string;
  readAt: string;
  provenance: PricePoint["provenance"];
  measurementOrigin: MeasurementOrigin;
  observed: string | null;
  derivedFrom?: string;
  sourceText?: string;
}): PricePoint {
  return pricePointSchema.parse({
    id: args.id,
    amount: args.amount,
    unit: args.unit,
    observed: args.observed,
    measurement_origin: args.measurementOrigin,
    condition: args.condition,
    source: { url: args.sourceUrl, readAt: args.readAt },
    provenance: args.provenance,
    ...(args.derivedFrom === undefined ? {} : { derivedFrom: args.derivedFrom }),
    ...(args.sourceText === undefined ? {} : { sourceText: args.sourceText }),
  });
}

export function normalizePricePoint(args: {
  id: string;
  value: string;
  unit: PriceUnit;
  condition?: PriceCondition;
  sourceUrl: string;
  readAt: string;
  provenance: PricePoint["provenance"];
  measurementOrigin: MeasurementOrigin;
  observed: string | null;
  derivedFrom?: string;
  divisor?: string;
  sourceText?: string;
}): PricePoint {
  const converted = exactDecimalRatio(args.value, "1", args.divisor ?? "1").value;
  if (converted === undefined) {
    throw new Error("Price does not have a terminating exact decimal representation");
  }
  return pricePoint({
    id: args.id,
    amount: converted,
    unit: args.unit,
    condition: args.condition ?? null,
    sourceUrl: args.sourceUrl,
    readAt: args.readAt,
    provenance: args.provenance,
    measurementOrigin: args.measurementOrigin,
    observed: args.observed,
    ...(args.derivedFrom === undefined ? {} : { derivedFrom: args.derivedFrom }),
    ...(args.sourceText === undefined ? {} : { sourceText: args.sourceText }),
  });
}

export function normalizeSailPricingRows(
  modelId: string,
  rows: SailPricingRow[],
  sourceUrl: string,
  readAt: string,
): PricePoint[] {
  const output: PricePoint[] = [];
  for (const row of rows) {
    const condition = { kind: "latency_window" as const, name: latencyWindow(row.window) };
    const windowId = condition.name.toLowerCase();
    for (const [axis, value, unit] of [
      ["input", row.input, "token_in"],
      ["cached", row.cached, "token_cached"],
      ["output", row.output, "token_out"],
    ] as const) {
      output.push(normalizePricePoint({
        id: `${modelId}:${axis}:${windowId}`,
        value: amountPerToken(value),
        unit,
        condition,
        sourceUrl,
        readAt,
        provenance: "published",
        measurementOrigin: "catalogue",
        observed: null,
      }));
    }
  }
  return output;
}

export type PriceSetCount = {
  provider: string;
  models: number;
  pricePoints: number;
  modelsWithoutPrice: number;
  unknownPricing: number;
};

export function pricePointCountsByProvider(
  models: Array<{
    provider: string;
    id: string;
    pricePoints: PricePoint[];
    pricingState?: "published" | "not_published" | "unknown";
  }>,
): PriceSetCount[] {
  const grouped = new Map<string, PriceSetCount>();
  for (const model of models) {
    const current = grouped.get(model.provider) ?? {
      provider: model.provider,
      models: 0,
      pricePoints: 0,
      modelsWithoutPrice: 0,
      unknownPricing: 0,
    };
    current.models += 1;
    current.pricePoints += model.pricePoints.length;
    if (model.pricePoints.length === 0) current.modelsWithoutPrice += 1;
    if (model.pricingState === "unknown") current.unknownPricing += 1;
    grouped.set(model.provider, current);
  }
  return [...grouped.values()].sort((left, right) => left.provider.localeCompare(right.provider));
}

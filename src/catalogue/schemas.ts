import { z } from "zod";

import { pricePointSchema, type PricePoint } from "../contract.js";
import { responseShapeSchema } from "../providers/response-shape.js";
import { modelOfferingStateSchema, modelPriceStateSchema, providerPriceCoverageResultSchema } from "./price-coverage.js";

export const mediaCatalogueProviderIdSchema = z.enum(["deepinfra", "wavespeed", "fal", "chutes"]);
export type MediaCatalogueProviderId = z.infer<typeof mediaCatalogueProviderIdSchema>;
export const mediaKindSchema = z.enum(["image", "video", "text", "audio", "other", "unknown"]);
export type MediaKind = z.infer<typeof mediaKindSchema>;

export const pricingStateSchema = z.enum(["published", "not_published", "unknown"]);
export type PricingState = z.infer<typeof pricingStateSchema>;

export const catalogueModelSchema = z.object({
  provider: z.string().min(1),
  id: z.string().min(1),
  displayName: z.string(),
  mediaKind: mediaKindSchema,
  nativeType: z.string().nullable(),
  outputModalities: z.array(z.string()).optional(),
  pricePoints: z.array(pricePointSchema),
  pricingState: pricingStateSchema,
  /** Fine-grained source state when a provider page separates offers and prices. */
  modelPriceState: modelPriceStateSchema.optional(),
  /** Keeps a tier/price-table mismatch visible instead of silently reconciling it. */
  modelOfferingState: modelOfferingStateSchema.optional(),
  pricingNote: z.string().optional(),
  nativePricing: z.unknown().optional(),
  /** Context window in tokens, when the native catalogue publishes one. */
  contextLength: z.number().int().positive().optional(),
  /** Where a chat model writes its answer and reasoning, with dated observations. */
  responseShape: responseShapeSchema.optional(),
  provenance: z.object({
    sourceUrl: z.string().url(),
    observedAt: z.string().datetime({ offset: true }),
    sourceIndex: z.number().int().nonnegative(),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.modelPriceState === "priced" && value.pricePoints.length === 0) {
    context.addIssue({ code: "custom", message: "A priced model state requires at least one price point", path: ["pricePoints"] });
  }
  if (value.modelPriceState !== undefined && value.modelPriceState !== "priced" && value.pricePoints.length > 0) {
    context.addIssue({ code: "custom", message: "Only a priced model state may carry price points", path: ["modelPriceState"] });
  }
  const hasCreditPrice = value.pricePoints.some((point) => point.unit.startsWith("credit_"));
  if (!hasCreditPrice) return;
  const hasCurrency = (candidate: unknown, depth = 0): boolean => {
    if (depth > 4 || candidate === null || typeof candidate !== "object") return false;
    if (Array.isArray(candidate)) return candidate.some((item) => hasCurrency(item, depth + 1));
    return Object.entries(candidate).some(([key, item]) =>
      /^(?:currency|currency_code|currencyCode)$/i.test(key) || hasCurrency(item, depth + 1));
  };
  if (hasCurrency(value.nativePricing)) {
    context.addIssue({ code: "custom", message: "Credit-priced providers must not emit a currency field", path: ["nativePricing"] });
  }
});
export type CatalogueModel = z.infer<typeof catalogueModelSchema>;

/** The public pricing projection is now the set itself, never a scalar alias. */
export const cataloguePricingSchema = z.object({
  pricePoints: z.array(pricePointSchema),
  state: pricingStateSchema,
  note: z.string().optional(),
}).strict().superRefine((value, context) => {
  if (value.state === "published" && value.pricePoints.length === 0) {
    context.addIssue({ code: "custom", message: "Published pricing requires at least one price point", path: ["pricePoints"] });
  }
  if (value.state !== "published" && value.pricePoints.length > 0) {
    context.addIssue({ code: "custom", message: "A non-published pricing state cannot carry published price points", path: ["state"] });
  }
});

/** Compatibility for code that only names the old type; it is no longer a public field. */
export type ExactPrice = PricePoint;

export const cataloguePopulationSchema = z.object({
  listed: z.number().int().nonnegative().nullable(),
  received: z.number().int().nonnegative().nullable(),
  retained: z.number().int().nonnegative().nullable(),
  excluded: z.number().int().nonnegative().nullable(),
  exclusionRules: z.array(z.string()),
  completeness: z.enum(["full", "partial", "unknown", "unavailable"]),
}).strict();

export const catalogueProviderSchema = z.object({
  provider: z.string().min(1),
  status: z.enum(["available", "partial", "unavailable"]),
  sourceUrl: z.string().url(),
  observedAt: z.string().datetime({ offset: true }),
  population: cataloguePopulationSchema,
  requestParameters: z.record(z.string(), z.unknown()),
  /** Evidence-bound provider-level publication conclusion, when collected. */
  priceCoverage: providerPriceCoverageResultSchema.optional(),
  error: z.string().optional(),
}).strict();
export type CatalogueProvider = z.infer<typeof catalogueProviderSchema>;

export const mediaCatalogueSchema = z.object({
  providers: z.array(catalogueProviderSchema),
  models: z.array(catalogueModelSchema),
  population: cataloguePopulationSchema,
}).strict();
export type MediaCatalogue = z.infer<typeof mediaCatalogueSchema>;

import { z } from "zod";

import { pricePointSchema, type PricePoint } from "../contract.js";

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
  pricingNote: z.string().optional(),
  nativePricing: z.unknown().optional(),
  provenance: z.object({
    sourceUrl: z.string().url(),
    observedAt: z.string().datetime({ offset: true }),
    sourceIndex: z.number().int().nonnegative(),
  }).strict(),
}).strict();
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
  error: z.string().optional(),
}).strict();
export type CatalogueProvider = z.infer<typeof catalogueProviderSchema>;

export const mediaCatalogueSchema = z.object({
  providers: z.array(catalogueProviderSchema),
  models: z.array(catalogueModelSchema),
  population: cataloguePopulationSchema,
}).strict();
export type MediaCatalogue = z.infer<typeof mediaCatalogueSchema>;

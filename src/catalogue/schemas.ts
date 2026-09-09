import { z } from "zod";

export const mediaCatalogueProviderIdSchema = z.enum(["deepinfra", "wavespeed", "fal", "chutes"]);
export type MediaCatalogueProviderId = z.infer<typeof mediaCatalogueProviderIdSchema>;
export const mediaKindSchema = z.enum(["image", "video", "text", "audio", "other", "unknown"]);
export type MediaKind = z.infer<typeof mediaKindSchema>;
export const exactPriceSchema = z.object({
  unit: z.enum(["usd_per_image", "usd_per_video_second", "usd_per_input_token", "usd_per_output_token"]),
  value: z.string().regex(/^\d+(?:\.\d+)?$/).optional(),
  exact: z.object({ numerator: z.string().regex(/^\d+$/), denominator: z.string().regex(/^[1-9]\d*$/) }).strict(),
  native: z.object({ value: z.string(), unit: z.string(), sourceField: z.string() }).strict(),
  conversion: z.object({ operation: z.literal("multiply_then_divide"), multiplier: z.string(), divisor: z.string(), formula: z.string() }).strict(),
  conditions: z.record(z.string(), z.unknown()),
  sourceUrl: z.string().url(),
  provenance: z.object({ basis: z.literal("derived"), derivedFrom: z.string().url(), observedMultiplier: z.string().regex(/^\d+(?:\.\d+)?$/), observedAt: z.string().date() }).strict().optional(),
}).strict();
export type ExactPrice = z.infer<typeof exactPriceSchema>;
export const cataloguePricingSchema = z.object({
  status: z.enum(["available", "price_not_available"]),
  prices: z.array(exactPriceSchema),
  reason: z.string().optional(),
  native: z.unknown(),
}).strict().superRefine((pricing, context) => {
  if ((pricing.status === "available") !== (pricing.prices.length > 0)) context.addIssue({ code: "custom", message: "available pricing requires a nonempty price list", path: ["status"] });
  if (pricing.status === "price_not_available" && !pricing.reason) context.addIssue({ code: "custom", message: "unavailable pricing requires a reason", path: ["reason"] });
});
export const catalogueModelSchema = z.object({
  provider: z.string(), id: z.string().min(1), displayName: z.string(),
  mediaKind: mediaKindSchema, nativeType: z.string().nullable(),
  outputModalities: z.array(z.string()).optional(),
  pricing: cataloguePricingSchema,
  provenance: z.object({ sourceUrl: z.string().url(), observedAt: z.string().datetime({ offset: true }), sourceIndex: z.number().int().nonnegative() }).strict(),
}).strict();
export type CatalogueModel = z.infer<typeof catalogueModelSchema>;
export const cataloguePopulationSchema = z.object({
  listed: z.number().int().nonnegative().nullable(),
  received: z.number().int().nonnegative().nullable(),
  retained: z.number().int().nonnegative().nullable(),
  excluded: z.number().int().nonnegative().nullable(),
  exclusionRules: z.array(z.string()),
  completeness: z.enum(["full", "partial", "unknown", "unavailable"]),
}).strict();
export const catalogueProviderSchema = z.object({
  provider: z.string(), status: z.enum(["available", "partial", "unavailable"]),
  sourceUrl: z.string().url(), observedAt: z.string().datetime({ offset: true }),
  population: cataloguePopulationSchema,
  requestParameters: z.record(z.string(), z.unknown()),
  error: z.string().optional(),
}).strict();
export type CatalogueProvider = z.infer<typeof catalogueProviderSchema>;
export const mediaCatalogueSchema = z.object({
  providers: z.array(catalogueProviderSchema), models: z.array(catalogueModelSchema),
  population: cataloguePopulationSchema,
}).strict();
export type MediaCatalogue = z.infer<typeof mediaCatalogueSchema>;

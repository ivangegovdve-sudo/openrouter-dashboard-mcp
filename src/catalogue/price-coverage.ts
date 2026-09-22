import { z } from "zod";

/**
 * Provider-level price-publication conclusions. These deliberately describe the
 * evidence acquired, not whether one particular model API happened to include
 * a price property.
 */
export const providerPriceCoverageStateSchema = z.enum([
  "PUBLISHES_PRICES",
  "PRICES_UNPUBLISHED",
  "UNKNOWN",
  "UNREACHABLE",
]);
export type ProviderPriceCoverageState = z.infer<typeof providerPriceCoverageStateSchema>;

/**
 * The outcome of executing a provider-owned pricing page and inspecting its
 * rendered DOM. A page source is evidence only after JavaScript has run.
 */
export const renderedPageEvidenceSchema = z.object({
  url: z.string().url(),
  fetchedAt: z.string().datetime({ offset: true }),
  javascriptExecuted: z.literal(true),
  /** The browser observed a settled DOM rather than a loading shell. */
  domSettled: z.literal(true),
  tableCount: z.number().int().nonnegative(),
  /** A table with model/input/output headings was actually recognized. */
  priceTableCount: z.number().int().nonnegative(),
  priceTableObserved: z.boolean(),
  priceRowCount: z.number().int().nonnegative(),
  /** Visible text explicitly stated that the settled price table has no prices. */
  explicitNoPrices: z.boolean(),
  outcome: z.enum(["rendered_prices_found", "rendered_no_prices"]),
}).strict().superRefine((value, context) => {
  if (value.outcome === "rendered_prices_found" && value.priceRowCount === 0) {
    context.addIssue({ code: "custom", message: "A rendered price finding requires at least one price row", path: ["priceRowCount"] });
  }
  if (value.outcome === "rendered_no_prices" && value.priceRowCount !== 0) {
    context.addIssue({ code: "custom", message: "A rendered no-prices finding cannot carry price rows", path: ["priceRowCount"] });
  }
  if (value.outcome === "rendered_no_prices" && !value.explicitNoPrices) {
    context.addIssue({ code: "custom", message: "A rendered no-prices finding requires visible explicit no-prices text", path: ["explicitNoPrices"] });
  }
  if (value.outcome === "rendered_prices_found" && value.explicitNoPrices) {
    context.addIssue({ code: "custom", message: "A rendered price finding cannot be an explicit no-prices observation", path: ["explicitNoPrices"] });
  }
  if ((value.outcome === "rendered_prices_found" || value.outcome === "rendered_no_prices") && (!value.priceTableObserved || value.priceTableCount === 0)) {
    context.addIssue({ code: "custom", message: "A price conclusion requires a recognized rendered price table", path: ["priceTableObserved"] });
  }
});
export type RenderedPageEvidence = z.infer<typeof renderedPageEvidenceSchema>;

const coverageBase = {
  provider: z.string().min(1),
  /** Number of normalized rows whose prices this conclusion can point to. */
  priceRowCount: z.number().int().nonnegative(),
  /** API acquisition is recorded separately because silence is not a conclusion. */
  apiPriceObservation: z.enum(["prices_found", "no_prices", "not_fetched", "unavailable"]),
};

const renderedNoPricesEvidenceSchema = renderedPageEvidenceSchema.safeExtend({
  outcome: z.literal("rendered_no_prices"),
  explicitNoPrices: z.literal(true),
});
const renderedPricesFoundEvidenceSchema = renderedPageEvidenceSchema.safeExtend({
  outcome: z.literal("rendered_prices_found"),
  explicitNoPrices: z.literal(false),
});

/**
 * A discriminated result makes the false conclusion structurally
 * unrepresentable: PRICES_UNPUBLISHED cannot exist without an actual rendered
 * page URL, fetch timestamp, JavaScript execution marker, settled DOM, and
 * explicit zero-price observation.
 */
export const providerPriceCoverageResultSchema = z.discriminatedUnion("state", [
  z.object({
    ...coverageBase,
    state: z.literal("PUBLISHES_PRICES"),
    renderedPageEvidence: renderedPageEvidenceSchema.optional(),
  }).strict(),
  z.object({
    ...coverageBase,
    state: z.literal("PRICES_UNPUBLISHED"),
    renderedPageEvidence: renderedNoPricesEvidenceSchema,
  }).strict(),
  z.object({
    ...coverageBase,
    state: z.literal("UNKNOWN"),
    renderedPageEvidence: renderedPricesFoundEvidenceSchema.optional(),
  }).strict(),
  z.object({
    ...coverageBase,
    state: z.literal("UNREACHABLE"),
  }).strict(),
]).superRefine((value, context) => {
  if (value.apiPriceObservation === "prices_found" && value.priceRowCount === 0) {
    context.addIssue({
      code: "custom",
      message: "An API price finding requires at least one retained price row",
      path: ["apiPriceObservation"],
    });
  }
  if (value.state === "PUBLISHES_PRICES" && value.priceRowCount === 0) {
    context.addIssue({ code: "custom", message: "PUBLISHES_PRICES requires at least one retained price row", path: ["priceRowCount"] });
  }
  if (value.state !== "PUBLISHES_PRICES" && value.priceRowCount !== 0) {
    context.addIssue({ code: "custom", message: "Only PUBLISHES_PRICES may carry retained price rows", path: ["priceRowCount"] });
  }
});
export type ProviderPriceCoverageResult = z.infer<typeof providerPriceCoverageResultSchema>;

/**
 * A per-model state is intentionally independent of the provider-level
 * conclusion. It preserves, for example, an offered model with no matching
 * table price instead of pretending that it was not offered.
 */
export const modelPriceStateSchema = z.enum([
  "priced",
  "offered_unpriced",
  "not_offered",
  "unknown",
]);
export type ModelPriceState = z.infer<typeof modelPriceStateSchema>;

export const modelOfferingStateSchema = z.enum([
  "listed_as_offered",
  "not_listed_as_offered",
  "unknown",
]);
export type ModelOfferingState = z.infer<typeof modelOfferingStateSchema>;

export function resolveProviderPriceCoverage(input: {
  provider: string;
  apiPriceObservation: "prices_found" | "no_prices" | "not_fetched" | "unavailable";
  apiPriceRowCount?: number;
  renderedPageEvidence?: RenderedPageEvidence;
  sourceReachable?: boolean;
}): ProviderPriceCoverageResult {
  const apiPriceRowCount = input.apiPriceRowCount ?? 0;
  const page = input.renderedPageEvidence;
  const priceRowCount = Math.max(apiPriceRowCount, page?.priceRowCount ?? 0);

  if (priceRowCount > 0) {
    return providerPriceCoverageResultSchema.parse({
      provider: input.provider,
      state: "PUBLISHES_PRICES",
      priceRowCount,
      apiPriceObservation: input.apiPriceObservation,
      ...(page ? { renderedPageEvidence: page } : {}),
    });
  }
  if (page?.outcome === "rendered_no_prices") {
    return providerPriceCoverageResultSchema.parse({
      provider: input.provider,
      state: "PRICES_UNPUBLISHED",
      priceRowCount: 0,
      apiPriceObservation: input.apiPriceObservation,
      renderedPageEvidence: page,
    });
  }
  if (input.sourceReachable === false) {
    return providerPriceCoverageResultSchema.parse({
      provider: input.provider,
      state: "UNREACHABLE",
      priceRowCount: 0,
      apiPriceObservation: input.apiPriceObservation,
    });
  }
  return providerPriceCoverageResultSchema.parse({
    provider: input.provider,
    state: "UNKNOWN",
    priceRowCount: 0,
    apiPriceObservation: input.apiPriceObservation,
    ...(page?.outcome === "rendered_prices_found" ? { renderedPageEvidence: page } : {}),
  });
}

import { z } from "zod";

import { PACKAGE_VERSION } from "./version.js";

const canonicalDecimalSchema = z.string().regex(/^(0|[1-9]\d*)(?:\.\d+)?$/);

export const priceUnitSchema = z.enum([
  "token_in",
  "token_out",
  "token_cached",
  "token_cache_create",
  "image",
  "megapixel",
  "video_second",
  "video",
  "request",
  "gpu_hour",
]);
export type PriceUnit = z.infer<typeof priceUnitSchema>;

const latencyWindowConditionSchema = z
  .object({
    kind: z.literal("latency_window"),
    name: z.enum(["ASAP", "Balanced", "Flex"]),
  })
  .strict();

const timeBandConditionSchema = z
  .object({
    kind: z.literal("time_band"),
    name: z.enum(["peak", "off_peak"]),
    timezone: z.string().min(1),
    hours: z.array(z.string().regex(/^\d{2}:\d{2}-\d{2}:\d{2}$/)),
  })
  .strict();

const tierConditionSchema = z
  .object({
    kind: z.literal("tier"),
    name: z.string().min(1),
    threshold: canonicalDecimalSchema,
  })
  .strict();

const rateClassConditionSchema = z
  .object({
    kind: z.literal("rate_class"),
    name: z.enum(["list", "as_low_as"]),
  })
  .strict();

export const priceConditionSchema = z.union([
  latencyWindowConditionSchema,
  timeBandConditionSchema,
  tierConditionSchema,
  rateClassConditionSchema,
]);
export type PriceCondition = z.infer<typeof priceConditionSchema> | null;

export const pricePointSchema = z
  .object({
    id: z.string().min(1),
    amount: canonicalDecimalSchema,
    unit: priceUnitSchema,
    condition: priceConditionSchema.nullable(),
    source: z
      .object({
        url: z.string().url(),
        readAt: z.string().datetime({ offset: true }),
      })
      .strict(),
    provenance: z.enum([
      "published",
      "derived",
      "parsed_from_prose",
      "unknown",
    ]),
    sourceText: z.string().min(1).optional(),
  })
  .strict();
export type PricePoint = z.infer<typeof pricePointSchema>;

export const normalizedFigureSchema = z
  .object({
    value: canonicalDecimalSchema,
    unit: z.string().min(1),
    assumption: z.string().min(1),
    derived_from: z.string().min(1),
  })
  .strict();
export type NormalizedFigure = z.infer<typeof normalizedFigureSchema>;

export const deprecationNoticeSchema = z
  .object({
    field: z.string().min(1),
    removed_in: z.string().regex(/^\d+\.\d+\.\d+$/),
    replaced_by: z.string().min(1).nullable(),
    reason: z.string().min(1).nullable(),
    since: z.string().date(),
    state: z.enum(["published", "not_published", "unknown"]),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.replaced_by === null && value.reason === null) {
      context.addIssue({
        code: "custom",
        message: "A deprecation without a replacement must explain why",
        path: ["reason"],
      });
    }
  });
export type DeprecationNotice = z.infer<typeof deprecationNoticeSchema>;

export const contractEnvelopeSchema = z
  .object({
    schema_version: z.literal("1.0"),
    package_version: z.string().regex(/^\d+\.\d+\.\d+$/),
    deprecations: z.array(deprecationNoticeSchema),
  })
  .strict();
export type ContractEnvelope = z.infer<typeof contractEnvelopeSchema>;

const DEPRECATIONS: DeprecationNotice[] = [
  {
    field: "pricing.prices",
    removed_in: "1.0.0",
    replaced_by: "pricePoints",
    reason: null,
    since: "2026-09-08",
    state: "published",
  },
];

export function contractEnvelope(): ContractEnvelope {
  return contractEnvelopeSchema.parse({
    schema_version: "1.0",
    package_version: PACKAGE_VERSION,
    deprecations: DEPRECATIONS,
  });
}

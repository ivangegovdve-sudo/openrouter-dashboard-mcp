import { acquireCatalogue } from "./tools/catalogue.js";
import { createDashboardClient } from "./dashboard/client.js";
import { PROVIDER_IDS } from "./providers/registry.js";
import { z } from "zod";
import { catalogueModelSchema, catalogueProviderSchema } from "./catalogue/schemas.js";
import type { RenderedPageFetcher } from "./catalogue/rendered-page.js";
export { fetchRenderedPageWithPlaywright } from "./catalogue/rendered-page.js";
export type { RenderedPageFetcher, RenderedPageSnapshot } from "./catalogue/rendered-page.js";

export { PROVIDER_IDS };
export const publicCatalogueSchema = z.object({
  schemaVersion: z.literal("1.0"), fetchedAt: z.string().datetime(),
  models: z.array(catalogueModelSchema).max(20000).transform(rows => rows.map(({ nativePricing, ...publicRow }) => publicRow)),
  providers: z.array(catalogueProviderSchema.omit({ requestParameters: true }).strip()).max(16),
  inferenceCalls: z.literal(0), inferenceSpendUsd: z.literal("0"),
});

/** Live provider catalogue reads only. No inference, selection rules, or account data. */
export async function readPublicCatalogue(providers: string[] = [...PROVIDER_IDS], options: { fetchImpl?: typeof fetch; renderedPageFetcher?: RenderedPageFetcher } = {}) {
  if (!providers.length || providers.some(id => !PROVIDER_IDS.includes(id as typeof PROVIDER_IDS[number]))) {
    throw new Error("INVALID_PROVIDER");
  }
  const acquired = await acquireCatalogue({ providers }, { client: createDashboardClient({ cache: false }), ...options });
  return publicCatalogueSchema.parse({
    schemaVersion: "1.0" as const,
    fetchedAt: new Date().toISOString(),
    // Project explicitly: council configuration must never cross this boundary.
    models: acquired.models,
    providers: acquired.providers,
    inferenceCalls: 0 as const,
    inferenceSpendUsd: "0" as const,
  });
}


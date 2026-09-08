import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { DashboardClient } from "../dashboard/client.js";
import { collectDashboardCatalogue } from "../dashboard/catalogue.js";
import { collectMediaCatalogue } from "../catalogue/index.js";
import { catalogueModelSchema, catalogueProviderSchema, mediaCatalogueProviderIdSchema, mediaKindSchema, type MediaCatalogue } from "../catalogue/schemas.js";
import { PROVIDER_IDS, describeProvider, providerDescriptorSchema } from "../providers/registry.js";
import { READ_ONLY_TOOL_ANNOTATIONS, toolResult } from "./shared.js";

export const catalogueInputSchema = z.object({
  providers: z.array(z.string().min(1)).min(1).max(30).optional(),
  mediaKind: mediaKindSchema.optional(),
  modelIds: z.array(z.string().min(1).max(300)).min(1).max(20).optional(),
  offset: z.number().int().nonnegative().max(1_000_000).default(0),
  limit: z.number().int().min(1).max(500).default(100),
}).strict();
export const catalogueOutputSchema = z.object({
  status: z.enum(["ok", "partial", "unavailable"]),
  summary: z.string(),
  models: z.array(catalogueModelSchema),
  providers: z.array(catalogueProviderSchema),
  providerMetadata: z.array(providerDescriptorSchema.extend({ id: z.string().min(1) })),
  population: z.object({ acquired: z.number().int(), matched: z.number().int(), returned: z.number().int(),
    excludedByMediaKind: z.number().int(), excludedByModelId: z.number().int(), omittedByPagination: z.number().int(), offset: z.number().int(),
    limit: z.number().int(), nextOffset: z.number().int().nullable(),
    rule: z.string(),
  }).strict(),
}).strict();
export type CatalogueInput = z.infer<typeof catalogueInputSchema>;
export type CatalogueOutput = z.infer<typeof catalogueOutputSchema>;
export type CatalogueDependencies = { client: DashboardClient; fetchImpl?: typeof fetch; now?: () => Date };

export async function runCatalogue(input: CatalogueInput, dependencies: CatalogueDependencies): Promise<CatalogueOutput> {
  const ids = [...new Set(input.providers ?? PROVIDER_IDS)];
  const direct = ids.filter(id => mediaCatalogueProviderIdSchema.safeParse(id).success) as z.infer<typeof mediaCatalogueProviderIdSchema>[];
  const legacy = ids.filter(id => !direct.includes(id as typeof direct[number]));
  const results: MediaCatalogue[] = [];
  // Bounded serial source groups avoid a fan-out across every provider on one call.
  if (legacy.length) results.push(await collectDashboardCatalogue({ client: dependencies.client, providers: legacy, ...(dependencies.now ? { now: dependencies.now } : {}) }));
  if (direct.length) results.push(await collectMediaCatalogue({ providers: direct, ...(input.modelIds ? { enrichIds: input.modelIds } : {}), ...(dependencies.fetchImpl ? { fetchImpl: dependencies.fetchImpl } : {}), ...(dependencies.now ? { now: dependencies.now } : {}) }));
  const providers = results.flatMap(result => result.providers);
  const all = results.flatMap(result => result.models).sort((a, b) => a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id));
  const mediaMatched = all.filter(row => input.mediaKind === undefined || row.mediaKind === input.mediaKind || row.outputModalities?.includes(input.mediaKind));
  const matched = mediaMatched.filter(row => input.modelIds === undefined || input.modelIds.includes(row.id));
  const models = matched.slice(input.offset, input.offset + input.limit);
  const hasData = providers.some(provider => provider.status !== "unavailable");
  const complete = providers.every(provider => provider.status === "available" && provider.population.completeness === "full");
  return catalogueOutputSchema.parse({
    status: !hasData ? "unavailable" : complete ? "ok" : "partial",
    summary: `${models.length} of ${matched.length} matching identities returned; ${all.length} acquired. Unpriced models remain in the catalogue. Native denominators and acquisition limits are reported per provider.`,
    models, providers, providerMetadata: ids.map(describeProvider),
    population: { acquired: all.length, matched: matched.length, returned: models.length,
      excludedByMediaKind: all.length - mediaMatched.length, excludedByModelId: mediaMatched.length - matched.length, omittedByPagination: matched.length - models.length,
      offset: input.offset, limit: input.limit, nextOffset: input.offset + input.limit < matched.length ? input.offset + input.limit : null,
      rule: "Select requested providers, optionally filter mediaKind and modelIds, then paginate in provider/id order. Never exclude an identity because its price is unavailable. Counts cover acquired records; unknown or unavailable native populations are not zero.",
    },
  });
}

export function registerCatalogue(server: McpServer, dependencies: CatalogueDependencies): void {
  server.registerTool("dashboard_catalogue", {
    title: "Provider model catalogue and comparable media prices",
    description: "List model identities including price_not_available rows, provider pitches and structured caveats. Image prices are USD/image; video prices USD/second, with native values, exact conversions and configuration conditions. Each source reports its population, exclusions and acquisition limits. Other prices retain their native billing axis. Paginate with offset/limit; filter providers, mediaKind or modelIds. modelIds also requests WaveSpeed price detail (20 IDs maximum). This never generates media or makes a paid inference call.",
    inputSchema: catalogueInputSchema, outputSchema: catalogueOutputSchema, annotations: READ_ONLY_TOOL_ANNOTATIONS,
  }, async input => toolResult(await runCatalogue(input, dependencies)));
}

import type { DashboardClient } from "./client.js";
import { liveModelsResponseSchema, type liveModelSchema } from "./schemas/live-models.js";
import { safeDashboardError } from "../tools/shared.js";
import type { z } from "zod";
import type { CatalogueModel, CatalogueProvider, MediaCatalogue } from "../catalogue/schemas.js";
import { normalizeExactPrice } from "../catalogue/decimal.js";
import { dashboardBaseUrl } from "../config.js";
import { freshnessOf } from "./cache.js";

const endpoint = "/api/public/v2/live-models";
const pageSize = 500;
const maxPages = 10;

/** Retain the dashboard's identities; never assert its legacy token filter is a full native inventory. */
export async function collectDashboardCatalogue({ client, providers, now = () => new Date() }: {
  client: DashboardClient; providers: string[]; now?: () => Date;
}): Promise<MediaCatalogue> {
  const observedAt = now().toISOString();
  const sourceUrl = client.sourceUrl?.(endpoint) ?? new URL(endpoint, dashboardBaseUrl()).href;
  const rows = new Map<string, z.infer<typeof liveModelSchema>>();
  const knownSources = new Set<string>();
  let cursor: string | null = null;
  let pages = 0;
  let complete = false;
  let failure: string | undefined;
  const seenCursors = new Set<string>();
  let stale = false;
  const confirmations = new Map<string, string>();
  if (!providers.length) return { models: [], providers: [], population: { listed: 0, received: 0, retained: 0, excluded: 0, exclusionRules: [], completeness: "full" } };
  try {
    do {
      const query = new URLSearchParams({ limit: String(pageSize) });
      if (cursor !== null) query.set("cursor", cursor);
      const response = await client.get(endpoint, query, liveModelsResponseSchema);
      pages++;
      stale ||= response.stale || freshnessOf(response)?.state === "expired";
      for (const evidence of response.provenance) {
        const provider = evidence.sourceId === "models_current" ? "openrouter" : evidence.sourceId.replace(/_models_current$/, "");
        knownSources.add(provider);
        confirmations.set(provider, evidence.fetchedAt);
      }
      for (const row of response.data) {
        if (providers.includes(row.provider)) rows.set(JSON.stringify([row.provider, row.id]), row);
      }
      cursor = response.cursor;
      if (!response.completeness.acquisitionComplete || response.completeness.populationCompleteness === "partial_or_unknown") failure = "Dashboard reports incomplete acquisition.";
      if (cursor === null) { complete = !failure; break; }
      if (seenCursors.has(cursor)) { failure = "Dashboard cursor repeated; acquisition stopped with partial data."; break; }
      seenCursors.add(cursor);
    } while (pages < maxPages);
    if (cursor !== null && !failure) failure = "Dashboard pagination bound reached; acquisition is partial.";
  } catch (error) { failure = safeDashboardError(error).message; }

  const models: CatalogueModel[] = [...rows.values()].map((row, sourceIndex) => {
    const native = row.pricing;
    const prices = (Object.entries(native) as Array<[keyof typeof native, string | null]>).flatMap(([field, value]) => {
      if (value === null) return [];
      return [normalizeExactPrice({ value, unit: field === "promptUsdPerToken" ? "usd_per_input_token" : "usd_per_output_token", nativeUnit: "USD/token", sourceField: `pricing.${field}`, sourceUrl, conditions: { leg: field === "promptUsdPerToken" ? "input" : "output", ...(row.pricingWindow ? { pricingWindow: row.pricingWindow } : {}) } })];
    });
    const modality = row.outputModalities?.[0];
    const mediaKind = ["text", "image", "video", "audio"].includes(modality ?? "") ? modality as "text" | "image" | "video" | "audio" : "unknown";
    return {
      provider: row.provider, id: row.id, displayName: row.displayName ?? row.id,
      mediaKind, nativeType: row.outputModalities?.join(",") ?? null,
      ...(row.outputModalities ? { outputModalities: row.outputModalities } : {}),
      pricing: { status: prices.length ? "available" : "price_not_available", prices, native,
        ...(!prices.length ? { reason: "price_not_available: the collected dashboard record contains no usable price; this does not establish provider-wide non-publication." } : {}),
      },
      provenance: { sourceUrl, observedAt: row.lastConfirmedAt, sourceIndex },
    };
  });
  const reports: CatalogueProvider[] = providers.map(provider => {
    const received = models.filter(row => row.provider === provider).length;
    const present = received > 0 || knownSources.has(provider);
    const available = pages > 0 && present;
    return {
      provider, status: !available ? "unavailable" : complete && !stale ? "available" : "partial",
      sourceUrl, observedAt: confirmations.get(provider) ?? observedAt,
      population: { listed: null, received: available ? received : null, retained: available ? received : null, excluded: null,
        exclusionRules: ["Legacy dashboard response does not expose the native collector denominator or exclusion rules; native population is unknown."],
        completeness: available ? "unknown" : "unavailable",
      },
      requestParameters: { endpoint, pageSize, maxPages, pagesRead: pages, cursorRemaining: cursor, requestedProvider: provider,
        localFilter: "provider identity only; retain priced and unpriced models", localExcluded: 0,
        denominatorBasis: "native_provider_count_unreported", dashboardPaginationComplete: complete, stale,
      },
      ...(!available || failure ? { error: failure ?? "Provider has no published source in the dashboard response; availability is unknown." } : {}),
    };
  });
  return { models, providers: reports, population: { listed: null, received: pages ? models.length : null, retained: pages ? models.length : null, excluded: null,
    exclusionRules: ["Native collector denominator is not exposed by the dashboard."], completeness: pages ? "unknown" : "unavailable" } };
}

import { z } from "zod";

import { schemaVersionV2 } from "./common.js";

/**
 * GitHub trending is a LIVE resource, not an archived published dataset.
 *
 * Every other route this server reads serves rows a collector published, with a
 * run id and provenance behind them. Trending is scraped at request time,
 * because GitHub publishes no API for it. The shape reflects that rather than
 * dressing it in an envelope it does not have.
 */

export const trendingSinceSchema = z.enum(["daily", "weekly", "monthly"]);

export const trendingRepoSchema = z
  .object({
    fullName: z.string().min(1),
    owner: z.string().min(1),
    name: z.string().min(1),
    description: z.string().nullable(),
    language: z.string().nullable(),
    stars: z.number().int().nonnegative(),
    forks: z.number().int().nonnegative(),
    /** Null where GitHub's markup carried no gained-stars figure for the row. */
    starsGained: z.number().int().nullable(),
    url: z.string().url(),
  })
  .strict();

export const trendingResponseSchema = z
  .object({
    schemaVersion: schemaVersionV2,
    data: z.array(trendingRepoSchema),
    /**
     * When the underlying page was actually retrieved, not when the response was
     * assembled. GitHub trending moves through the day, so a consumer holding a
     * list without this cannot tell a fresh one from a three-day-old one.
     */
    collectedAt: z.string().datetime({ offset: true }),
    since: trendingSinceSchema,
    language: z.string().nullable(),
    /** Which path served the rows: the free direct scrape, or the paid fallback. */
    source: z.enum(["direct", "firecrawl"]),
    /** Why the direct scrape was abandoned, when it was. Null on the happy path. */
    fallbackReason: z.string().nullable(),
  })
  .strict();

export type TrendingResponse = z.infer<typeof trendingResponseSchema>;

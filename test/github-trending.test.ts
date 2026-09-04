import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardClient } from "../src/dashboard/client.js";
import {
  GITHUB_TRENDING_DEFAULT_LIMIT,
  GITHUB_TRENDING_STALE_AFTER_HOURS,
  githubTrendingInputSchema,
  githubTrendingOutputSchema,
  runGitHubTrending,
} from "../src/tools/github-trending.js";

const endpoint = "/api/public/v2/github/trending";

function repo(name: string, starsGained: number | null = 42) {
  return {
    fullName: `acme/${name}`,
    owner: "acme",
    name,
    description: "A thing",
    language: "TypeScript",
    stars: 1234,
    forks: 56,
    starsGained,
    url: `https://github.com/acme/${name}`,
  };
}

function clientReturning(
  body: unknown,
  seen: { path: string; query: string }[] = [],
): DashboardClient {
  return {
    get: (async (path: string, params: URLSearchParams) => {
      seen.push({ path, query: params.toString() });
      return body;
    }) as DashboardClient["get"],
  } as DashboardClient;
}

const collectedAt = "2026-09-03T12:00:00.000Z";

function response(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "2.0",
    data: [repo("one"), repo("two")],
    collectedAt,
    since: "daily",
    language: null,
    source: "direct",
    fallbackReason: null,
    ...overrides,
  };
}

test("carries the collection timestamp rather than the time the tool ran", async () => {
  // GitHub trending turns over through the day. A list without a collection
  // time cannot be told apart from a three-day-old one, which is the entire
  // reason this field exists.
  const result = await runGitHubTrending(githubTrendingInputSchema.parse({}), {
    client: clientReturning(response()),
    now: () => new Date("2026-09-03T13:00:00.000Z"),
  });

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.collectedAt, collectedAt);
  assert.equal(result.ageHours, 1);
  assert.equal(result.stale, false);
  assert.match(result.summary, /collected 2026-09-03T12:00:00\.000Z/);
  githubTrendingOutputSchema.parse(result);
});

test("says so when the list is older than the freshness window", async () => {
  const result = await runGitHubTrending(githubTrendingInputSchema.parse({}), {
    client: clientReturning(response()),
    now: () =>
      new Date(
        Date.parse(collectedAt) + (GITHUB_TRENDING_STALE_AFTER_HOURS + 1) * 3_600_000,
      ),
  });

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.stale, true);
  assert.ok(
    result.warnings.some((warning) => /collected .* hours ago/.test(warning)),
    "a stale list must say so unprompted",
  );
});

test("surfaces the paid fallback and why the free path was abandoned", async () => {
  // A fallback nobody is told about is how you end up on the paid backup for
  // months without knowing the primary died.
  const result = await runGitHubTrending(githubTrendingInputSchema.parse({}), {
    client: clientReturning(
      response({
        source: "firecrawl",
        fallbackReason: "github.com/trending returned 403",
      }),
    ),
    now: () => new Date(collectedAt),
  });

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.source, "firecrawl");
  assert.equal(result.fallbackReason, "github.com/trending returned 403");
  assert.ok(
    result.warnings.some((warning) => /Firecrawl fallback/.test(warning)),
    "the paid path must be reported, not silently substituted",
  );
});

test("forwards the slice and reports when the limit truncated the list", async () => {
  const seen: { path: string; query: string }[] = [];
  const many = Array.from({ length: 20 }, (_, index) => repo(`repo-${index}`));
  const result = await runGitHubTrending(
    githubTrendingInputSchema.parse({ since: "weekly", language: "Rust", limit: 3 }),
    { client: clientReturning(response({ data: many, since: "weekly", language: "Rust" }), seen) },
  );

  assert.equal(seen[0]?.path, endpoint);
  assert.match(seen[0]?.query ?? "", /since=weekly/);
  assert.match(seen[0]?.query ?? "", /language=Rust/);
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.repositories.length, 3);
  assert.equal(result.cap.reached, true);
});

test("defaults to the daily all-languages slice the dashboard actually exercises", () => {
  const parsed = githubTrendingInputSchema.parse({});
  assert.equal(parsed.since, "daily");
  assert.equal(parsed.language, undefined);
  assert.equal(parsed.limit, GITHUB_TRENDING_DEFAULT_LIMIT);
});

test("reports an empty slice rather than presenting it as a normal answer", async () => {
  const result = await runGitHubTrending(githubTrendingInputSchema.parse({}), {
    client: clientReturning(response({ data: [] })),
    now: () => new Date(collectedAt),
  });

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.repositories.length, 0);
  assert.ok(result.warnings.some((warning) => /no rows/.test(warning)));
});

import assert from "node:assert/strict";
import { setImmediate as delayUntilImmediate } from "node:timers/promises";
import test from "node:test";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import type { McpServer } from "@modelcontextprotocol/server";

import type { DashboardClient } from "../src/dashboard/client.js";
import { DashboardRequestError } from "../src/dashboard/errors.js";
import { createServer } from "../src/server.js";
import {
  FREE_MODELS_CAPABILITY_MESSAGE,
  freeModelsInputSchema,
  freeModelsOutputSchema,
  runFreeModels,
} from "../src/tools/free-models.js";
import {
  liveModelFixture,
  manifestFixture,
  modelFixture,
  opaqueCursor,
  publicCompleteness,
  publicProvenance,
  publicWindow,
} from "./fixtures.js";

const manifestEndpoint = "/api/public/v2/manifest";
const liveModelsEndpoint = "/api/public/v2/live-models";
const freeModelsEndpoint = "/api/public/v2/free-models";
const freeFrontiersEndpoint = "/api/public/v2/free-frontiers";

type Request = { path: string; query: URLSearchParams };

const freeLiveModel = {
  ...liveModelFixture,
  provider: "openrouter",
  id: "openrouter/free-text",
  displayName: "Free Text",
  pricing: {
    promptUsdPerToken: "0",
    completionUsdPerToken: "0",
  },
  isFree: true,
  freeKind: "concrete_free",
  outputModalities: ["text"],
  availability: "available",
} as const;

const freeCatalogueModel = {
  ...modelFixture,
  id: "openrouter/free-text",
  canonicalSlug: "openrouter/free-text",
  name: "Free Text",
  pricing: { prompt: "0", completion: "0" },
  freeKind: "concrete_free",
} as const;

function collection<T>(data: readonly T[], cursor: string | null = null) {
  return {
    schemaVersion: "2.0",
    data: [...data],
    cursor,
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  } as const;
}

function freeModelsResponse() {
  return {
    ...collection([freeCatalogueModel]),
    router: null,
    concreteFreeCount: "1",
  } as const;
}

function frontierResponse(
  x: "benchmarkQuality" | "contextLength",
  y: "medianThroughput" | "weeklyPopularityRank",
) {
  return collection([
    {
      ruleVersion: "openrouter-free-pareto-v1",
      dimensions: {
        x,
        y,
        xDirection: "max",
        yDirection: y === "weeklyPopularityRank" ? "min" : "max",
      },
      members: [{ modelId: "openrouter/free-text", x: "80", y: "100" }],
      excluded: [{ modelId: "openrouter/incomplete", reason: `missing_${x}` }],
    },
  ]);
}

async function connectTestClient(server: McpServer): Promise<Client> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "free-models-test-client", version: "1.0.0" });
  await client.connect(clientTransport);
  return client;
}

test("bounds the caller-visible result limit to the public endpoint contract", () => {
  assert.deepEqual(freeModelsInputSchema.parse({}), {
    outputModality: "text",
    limit: 50,
  });
  assert.throws(() => freeModelsInputSchema.parse({ limit: 0 }));
  assert.throws(() => freeModelsInputSchema.parse({ limit: 201 }));
});

test("defaults to text and performs the four bounded free-model reads concurrently", async () => {
  const requests: Request[] = [];
  let activeFanoutRequests = 0;
  let maximumActiveFanoutRequests = 0;
  const client: DashboardClient = {
    async get(path, query, schema) {
      requests.push({ path, query: new URLSearchParams(query) });
      if (path === manifestEndpoint) return schema.parse(manifestFixture);

      activeFanoutRequests += 1;
      maximumActiveFanoutRequests = Math.max(
        maximumActiveFanoutRequests,
        activeFanoutRequests,
      );
      await delayUntilImmediate();
      try {
        if (path === liveModelsEndpoint) {
          return schema.parse(collection([freeLiveModel]));
        }
        if (path === freeModelsEndpoint) {
          return schema.parse(freeModelsResponse());
        }
        if (path === freeFrontiersEndpoint) {
          const x = query.get("x");
          const y = query.get("y");
          if (x === "benchmarkQuality" && y === "medianThroughput") {
            return schema.parse(frontierResponse(x, y));
          }
          if (x === "contextLength" && y === "weeklyPopularityRank") {
            return schema.parse(frontierResponse(x, y));
          }
        }
        throw new Error(`Unexpected test request: ${path}?${query.toString()}`);
      } finally {
        activeFanoutRequests -= 1;
      }
    },
  };

  const output = await runFreeModels({}, { client });

  assert.equal(output.status, "ok");
  if (output.status !== "ok") return;
  assert.deepEqual(output.query, {
    outputModality: "text",
    outputModalityDefaulted: true,
    limit: 50,
  });
  assert.deepEqual(
    output.liveCandidates.data.map((row) => row.id),
    ["openrouter/free-text"],
  );
  assert.deepEqual(
    output.openRouterCatalogue.data.map((row) => row.id),
    ["openrouter/free-text"],
  );
  assert.equal(
    "description" in (output.openRouterCatalogue.data[0] ?? {}),
    false,
  );
  assert.equal(output.frontiers.qualityThroughput.status, "available");
  assert.equal(output.frontiers.contextPopularity.status, "available");
  assert.deepEqual(
    output.evidence.map((entry) => entry.endpoint),
    [
      manifestEndpoint,
      liveModelsEndpoint,
      freeModelsEndpoint,
      freeFrontiersEndpoint,
      freeFrontiersEndpoint,
    ],
  );
  assert.deepEqual(output.liveCandidates.cap, {
    requestedLimit: 50,
    examinedCount: 1,
    returnedCount: 1,
    nextCursor: null,
    capped: false,
    excludedUnavailableCount: 0,
    excludedNotFreeCount: 0,
    excludedUnknownPriceCount: 0,
    excludedModalityCount: 0,
  });
  assert.deepEqual(output.openRouterCatalogue.cap, {
    requestedLimit: 50,
    examinedCount: 1,
    returnedCount: 1,
    nextCursor: null,
    capped: false,
  });
  if (output.frontiers.qualityThroughput.status === "available") {
    assert.deepEqual(output.frontiers.qualityThroughput.cap, {
      requestedInputLimit: 200,
      frontierCount: 1,
      memberCount: 1,
      excludedCount: 1,
      nextCursor: null,
      capped: false,
    });
  }
  assert.deepEqual(output.warnings, []);
  assert.equal(maximumActiveFanoutRequests, 4);

  assert.deepEqual(
    requests.map(({ path, query }) => [path, query.toString()]),
    [
      [manifestEndpoint, ""],
      [
        liveModelsEndpoint,
        "availability=available&free=true&outputModality=text&limit=50",
      ],
      [freeModelsEndpoint, "modality=text&limit=50"],
      [
        freeFrontiersEndpoint,
        "x=benchmarkQuality&y=medianThroughput&limit=200",
      ],
      [
        freeFrontiersEndpoint,
        "x=contextLength&y=weeklyPopularityRank&limit=200",
      ],
    ],
  );
});

test("keeps only upstream-free candidates with published prices and the requested modality", async () => {
  const unknownPrice = {
    ...freeLiveModel,
    id: "cerebras/unknown-price",
    provider: "cerebras",
    pricing: {
      promptUsdPerToken: null,
      completionUsdPerToken: null,
    },
    isFree: null,
    freeKind: "paid_or_unknown",
  } as const;
  const inconsistentNullPrice = {
    ...freeLiveModel,
    id: "openrouter/inconsistent-null-price",
    pricing: {
      promptUsdPerToken: "0",
      completionUsdPerToken: null,
    },
  } as const;
  const perImagePriced = {
    ...freeLiveModel,
    id: "openrouter/per-image-priced",
    pricing: {
      promptUsdPerToken: "0",
      completionUsdPerToken: "0",
    },
    isFree: false,
    freeKind: "paid_or_unknown",
  } as const;
  const audioOnly = {
    ...freeLiveModel,
    id: "openrouter/audio-only",
    outputModalities: ["audio"],
  } as const;
  const disappeared = {
    ...freeLiveModel,
    id: "openrouter/disappeared",
    availability: "disappeared",
    disappearedAt: "2026-08-19T06:00:00.000Z",
    absenceStreak: "1",
  } as const;
  const liveRows = [
    freeLiveModel,
    unknownPrice,
    inconsistentNullPrice,
    perImagePriced,
    audioOnly,
    disappeared,
  ];
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === manifestEndpoint) return schema.parse(manifestFixture);
      if (path === liveModelsEndpoint) {
        return collection(liveRows) as never;
      }
      if (path === freeModelsEndpoint) {
        return schema.parse(freeModelsResponse());
      }
      if (query.get("x") === "benchmarkQuality") {
        return schema.parse(
          frontierResponse("benchmarkQuality", "medianThroughput"),
        );
      }
      return schema.parse(
        frontierResponse("contextLength", "weeklyPopularityRank"),
      );
    },
  };

  const output = await runFreeModels({}, { client });

  assert.equal(output.status, "ok");
  if (output.status !== "ok") return;
  assert.deepEqual(
    output.liveCandidates.data.map((row) => row.id),
    ["openrouter/free-text"],
  );
  assert.equal(output.liveCandidates.data[0]?.isFree, true);
  assert.deepEqual(output.liveCandidates.data[0]?.pricing, {
    promptUsdPerToken: "0",
    completionUsdPerToken: "0",
  });
  assert.deepEqual(output.liveCandidates.cap, {
    requestedLimit: 50,
    examinedCount: 6,
    returnedCount: 1,
    nextCursor: null,
    capped: false,
    excludedUnavailableCount: 1,
    excludedNotFreeCount: 2,
    excludedUnknownPriceCount: 1,
    excludedModalityCount: 1,
  });
});

test("free-model tool excludes contradictory live freeness while preserving the catalogue free router", async () => {
  const contradictory = {
    ...freeLiveModel,
    id: "openrouter/contradictory-free",
    pricing: {
      promptUsdPerToken: "0.000001",
      completionUsdPerToken: "0",
    },
    isFree: true,
    freeKind: "paid_or_unknown" as const,
  };
  const freeRouter = {
    ...freeCatalogueModel,
    id: "openrouter/free",
    canonicalSlug: "openrouter/free",
    name: "Free Router",
    freeKind: "free_router" as const,
  };
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === manifestEndpoint) return schema.parse(manifestFixture);
      if (path === liveModelsEndpoint) {
        return collection([contradictory, freeLiveModel]) as never;
      }
      if (path === freeModelsEndpoint) {
        return schema.parse({ ...freeModelsResponse(), router: freeRouter });
      }
      if (query.get("x") === "benchmarkQuality") {
        return schema.parse(
          frontierResponse("benchmarkQuality", "medianThroughput"),
        );
      }
      return schema.parse(
        frontierResponse("contextLength", "weeklyPopularityRank"),
      );
    },
  };

  const output = await runFreeModels({}, { client });

  assert.equal(output.status, "ok");
  if (output.status !== "ok") return;
  assert.deepEqual(
    output.liveCandidates.data.map((row) => row.id),
    ["openrouter/free-text"],
  );
  assert.equal(output.liveCandidates.cap.excludedNotFreeCount, 1);
  assert.equal(output.openRouterCatalogue.router?.freeKind, "free_router");
});

test("preserves endpoint staleness, opaque cursors, caps, and warnings", async () => {
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === manifestEndpoint) return schema.parse(manifestFixture);
      if (path === liveModelsEndpoint) {
        return schema.parse({
          ...collection([freeLiveModel], opaqueCursor),
          stale: true,
        });
      }
      if (path === freeModelsEndpoint) {
        return schema.parse({
          ...freeModelsResponse(),
          cursor: opaqueCursor,
          stale: true,
        });
      }
      const response =
        query.get("x") === "benchmarkQuality"
          ? frontierResponse("benchmarkQuality", "medianThroughput")
          : frontierResponse("contextLength", "weeklyPopularityRank");
      return schema.parse({
        ...response,
        cursor: opaqueCursor,
        stale: true,
      });
    },
  };

  const output = await runFreeModels({}, { client });

  assert.equal(output.status, "ok");
  if (output.status !== "ok") return;
  assert.equal(output.stale, true);
  assert.equal(output.liveCandidates.cap.nextCursor, opaqueCursor);
  assert.equal(output.liveCandidates.cap.capped, true);
  assert.equal(output.openRouterCatalogue.cap.nextCursor, opaqueCursor);
  assert.equal(output.openRouterCatalogue.cap.capped, true);
  assert.deepEqual(output.liveCandidates.warnings, [
    `Data from ${liveModelsEndpoint} is stale.`,
    `${liveModelsEndpoint} has more rows; only the first bounded page was fetched.`,
  ]);
  assert.deepEqual(output.openRouterCatalogue.warnings, [
    `Data from ${freeModelsEndpoint} is stale.`,
    `${freeModelsEndpoint} has more rows; only the first bounded page was fetched.`,
  ]);
  assert.ok(
    output.warnings.includes(`Data from ${freeFrontiersEndpoint} is stale.`),
  );
  assert.ok(
    output.warnings.includes(
      `${freeFrontiersEndpoint} has more rows; only the first bounded page was fetched.`,
    ),
  );
});

test("declines with the exact capability message before any fallback request", async () => {
  const requests: Request[] = [];
  const client: DashboardClient = {
    async get(path, query, schema) {
      requests.push({ path, query: new URLSearchParams(query) });
      assert.equal(path, manifestEndpoint);
      return schema.parse({
        ...manifestFixture,
        routes: [
          manifestEndpoint,
          freeModelsEndpoint,
          freeFrontiersEndpoint,
        ],
      });
    },
  };

  const output = await runFreeModels({}, { client });

  assert.equal(output.status, "unavailable");
  if (output.status !== "unavailable") return;
  assert.equal(output.summary, FREE_MODELS_CAPABILITY_MESSAGE);
  assert.equal(
    output.summary,
    "This tool needs /api/public/v2/live-models, which is not yet deployed. It ships with PR #24. Until then, ask about deprecations or history instead.",
  );
  assert.equal(output.missingCapability, liveModelsEndpoint);
  assert.deepEqual(
    requests.map(({ path, query }) => [path, query.toString()]),
    [[manifestEndpoint, ""]],
  );
});

test("keeps usable candidates when one frontier returns HTTP 503", async () => {
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === manifestEndpoint) return schema.parse(manifestFixture);
      if (path === liveModelsEndpoint) {
        return schema.parse(collection([freeLiveModel]));
      }
      if (path === freeModelsEndpoint) {
        return schema.parse(freeModelsResponse());
      }
      if (query.get("x") === "benchmarkQuality") {
        throw new DashboardRequestError(
          "http_error",
          "The dashboard catalogue returned HTTP 503.",
          { retryable: true, status: 503 },
        );
      }
      return schema.parse(
        frontierResponse("contextLength", "weeklyPopularityRank"),
      );
    },
  };

  const output = await runFreeModels({}, { client });

  assert.equal(output.status, "partial");
  if (output.status !== "partial") return;
  assert.deepEqual(
    output.liveCandidates.data.map((row) => row.id),
    ["openrouter/free-text"],
  );
  assert.deepEqual(
    output.openRouterCatalogue.data.map((row) => row.id),
    ["openrouter/free-text"],
  );
  assert.deepEqual(output.frontiers.qualityThroughput, {
    status: "unavailable",
    endpoint: freeFrontiersEndpoint,
    requestedDimensions: {
      x: "benchmarkQuality",
      y: "medianThroughput",
    },
    error: {
      kind: "http_error",
      message: "The dashboard catalogue returned HTTP 503.",
      retryable: true,
      status: 503,
    },
    warnings: [
      "The benchmarkQuality/medianThroughput free frontier is unavailable: The dashboard catalogue returned HTTP 503.",
    ],
    cap: { requestedInputLimit: 200 },
  });
  assert.equal(output.frontiers.contextPopularity.status, "available");
  assert.ok(
    output.warnings.includes(
      "The benchmarkQuality/medianThroughput free frontier is unavailable: The dashboard catalogue returned HTTP 503.",
    ),
  );
  assert.equal(
    output.evidence.filter(
      (entry) => entry.endpoint === freeFrontiersEndpoint,
    ).length,
    1,
  );
});

test("returns a safe structured error when a mandatory catalogue read fails", async () => {
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path === manifestEndpoint) return schema.parse(manifestFixture);
      if (path === liveModelsEndpoint) {
        return schema.parse(collection([freeLiveModel]));
      }
      if (path === freeModelsEndpoint) {
        throw new DashboardRequestError(
          "http_error",
          "The dashboard catalogue returned HTTP 503.",
          { retryable: true, status: 503 },
        );
      }
      if (query.get("x") === "benchmarkQuality") {
        return schema.parse(
          frontierResponse("benchmarkQuality", "medianThroughput"),
        );
      }
      return schema.parse(
        frontierResponse("contextLength", "weeklyPopularityRank"),
      );
    },
  };

  const output = await runFreeModels({}, { client });

  assert.deepEqual(output, {
    status: "error",
    summary: "The dashboard catalogue returned HTTP 503.",
    error: {
      kind: "http_error",
      message: "The dashboard catalogue returned HTTP 503.",
      retryable: true,
      status: 503,
    },
  });
});

test("registers a read-only free-model tool with matching structured and JSON output", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(String(input));
    let body: unknown;
    if (url.pathname === manifestEndpoint) body = manifestFixture;
    else if (url.pathname === liveModelsEndpoint) body = collection([freeLiveModel]);
    else if (url.pathname === freeModelsEndpoint) body = freeModelsResponse();
    else if (url.searchParams.get("x") === "benchmarkQuality") {
      body = frontierResponse("benchmarkQuality", "medianThroughput");
    } else {
      body = frontierResponse("contextLength", "weeklyPopularityRank");
    }
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    });
  };
  const server = createServer({
    baseUrl: "https://catalogue.test/",
    fetchImpl,
  });
  const client = await connectTestClient(server);

  try {
    const listed = await client.listTools();
    const tool = listed.tools.find(
      (candidate) => candidate.name === "dashboard_free_models",
    );
    assert.ok(tool);
    assert.deepEqual(tool.annotations, {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: true,
    });
    assert.ok(tool.inputSchema);
    assert.ok(tool.outputSchema);

    const result = await client.callTool({
      name: "dashboard_free_models",
      arguments: {},
    });
    assert.equal(result.isError, undefined);
    assert.ok(result.structuredContent);
    freeModelsOutputSchema.parse(result.structuredContent);
    const text = result.content.find((item) => item.type === "text");
    assert.ok(text && text.type === "text");
    assert.deepEqual(JSON.parse(text.text), result.structuredContent);
  } finally {
    await client.close();
  }
});

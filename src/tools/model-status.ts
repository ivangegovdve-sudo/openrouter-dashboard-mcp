import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import {
  entityHistoryResponseSchema,
} from "../dashboard/schemas/history.js";
import {
  liveModelSchema,
  liveModelsResponseSchema,
} from "../dashboard/schemas/live-models.js";
import {
  deprecationsResponseSchema,
  manifestSchema,
  modelDetailResponseSchema,
  publicDeprecationSchema,
  publicModelSchema,
} from "../dashboard/schemas/openrouter.js";
import {
  READ_ONLY_TOOL_ANNOTATIONS,
  safeDashboardError,
  safeDashboardErrorSchema,
  sourceEvidence,
  sourceEvidenceSchema,
  toolResult,
} from "./shared.js";

const MANIFEST_ENDPOINT = "/api/public/v2/manifest";
const LIVE_MODELS_ENDPOINT = "/api/public/v2/live-models";
const DEPRECATIONS_ENDPOINT = "/api/public/v2/deprecations";
const MODELS_ENDPOINT = "/api/public/v2/models";

export const MODEL_STATUS_CAPABILITY_MESSAGE =
  "This tool needs /api/public/v2/live-models, which is not yet deployed. It ships with PR #24. Until then, ask about deprecations or history instead.";

export const MODEL_STATUS_LIVE_PAGE_LIMIT = 2;
export const MODEL_STATUS_LIVE_PAGE_SIZE = 500;
export const MODEL_STATUS_LIVE_ITEM_LIMIT = 1_000;
export const MODEL_STATUS_DEPRECATION_PAGE_LIMIT = 2;
export const MODEL_STATUS_DEPRECATION_PAGE_SIZE = 200;
export const MODEL_STATUS_DEPRECATION_ITEM_LIMIT = 400;
export const MODEL_STATUS_SUGGESTION_LIMIT = 12;

export const modelStatusInputSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(240)
      .refine((value) => value.trim().length > 0, "slug must not be blank"),
  })
  .strict();

const liveScanCapSchema = z
  .object({
    pageLimit: z.literal(MODEL_STATUS_LIVE_PAGE_LIMIT),
    itemLimit: z.literal(MODEL_STATUS_LIVE_ITEM_LIMIT),
    pagesScanned: z.number().int().min(0).max(MODEL_STATUS_LIVE_PAGE_LIMIT),
    itemsScanned: z.number().int().min(0).max(MODEL_STATUS_LIVE_ITEM_LIMIT),
    reached: z.boolean(),
    nextCursor: z.string().nullable(),
  })
  .strict();

const deprecationScanCapSchema = z
  .object({
    pageLimit: z.literal(MODEL_STATUS_DEPRECATION_PAGE_LIMIT),
    itemLimit: z.literal(MODEL_STATUS_DEPRECATION_ITEM_LIMIT),
    pagesScanned: z
      .number()
      .int()
      .min(0)
      .max(MODEL_STATUS_DEPRECATION_PAGE_LIMIT),
    itemsScanned: z
      .number()
      .int()
      .min(0)
      .max(MODEL_STATUS_DEPRECATION_ITEM_LIMIT),
    reached: z.boolean(),
    nextCursor: z.string().nullable(),
  })
  .strict();

const auxiliaryErrorSchema = z
  .object({
    endpoint: z.string().min(1),
    error: safeDashboardErrorSchema,
  })
  .strict();

const openRouterDetailSchema = publicModelSchema.pick({
  id: true,
  canonicalSlug: true,
  name: true,
  contextLength: true,
  pricing: true,
  expirationDate: true,
  lifecycleState: true,
  freeKind: true,
  weeklyRank: true,
});

const auxiliarySchema = z
  .object({
    status: z.enum(["complete", "partial"]),
    deprecation: publicDeprecationSchema.nullable(),
    detail: openRouterDetailSchema.nullable(),
    history: entityHistoryResponseSchema.nullable(),
    deprecationsCap: deprecationScanCapSchema.nullable(),
    errors: z.array(auxiliaryErrorSchema),
  })
  .strict();

const modelStatusSuccessSchema = z
  .object({
    status: z.literal("ok"),
    summary: z.string(),
    verdict: z.string(),
    model: liveModelSchema,
    auxiliary: auxiliarySchema,
    evidence: z.array(sourceEvidenceSchema),
    warnings: z.array(z.string()),
    cap: liveScanCapSchema,
  })
  .strict();

const modelStatusNotFoundSchema = z
  .object({
    status: z.literal("not_found"),
    summary: z.string(),
    model: z.null(),
    suggestions: z.array(z.string()).max(MODEL_STATUS_SUGGESTION_LIMIT),
    evidence: z.array(sourceEvidenceSchema),
    warnings: z.array(z.string()),
    cap: liveScanCapSchema,
  })
  .strict();

const modelStatusUnavailableSchema = z
  .object({
    status: z.literal("unavailable"),
    summary: z.literal(MODEL_STATUS_CAPABILITY_MESSAGE),
    message: z.literal(MODEL_STATUS_CAPABILITY_MESSAGE),
    missingCapability: z.literal(LIVE_MODELS_ENDPOINT),
    evidence: z.array(sourceEvidenceSchema),
    warnings: z.array(z.string()),
  })
  .strict();

const modelStatusErrorSchema = z
  .object({
    status: z.literal("error"),
    summary: z.string(),
    error: safeDashboardErrorSchema,
  })
  .strict();

export const modelStatusOutputSchema = z.discriminatedUnion("status", [
  modelStatusSuccessSchema,
  modelStatusNotFoundSchema,
  modelStatusUnavailableSchema,
  modelStatusErrorSchema,
]);

export type ModelStatusInput = z.infer<typeof modelStatusInputSchema>;
export type ModelStatusOutput = z.infer<typeof modelStatusOutputSchema>;

export type ModelStatusDependencies = {
  client: DashboardClient;
};

type LiveModel = z.infer<typeof liveModelSchema>;
type Evidence = z.infer<typeof sourceEvidenceSchema>;
type LiveScanCap = z.infer<typeof liveScanCapSchema>;
type DeprecationScanCap = z.infer<typeof deprecationScanCapSchema>;

type LiveScan = {
  found: LiveModel | null;
  rows: LiveModel[];
  evidence: Evidence[];
  warnings: string[];
  cap: LiveScanCap;
};

type DeprecationScan = {
  match: z.infer<typeof publicDeprecationSchema> | null;
  evidence: Evidence[];
  warnings: string[];
  cap: DeprecationScanCap;
};

function staleWarning(endpoint: string, stale: boolean): string[] {
  return stale ? [`Data from ${endpoint} is stale.`] : [];
}

async function scanLiveModels(
  client: DashboardClient,
  slug: string,
): Promise<LiveScan> {
  const rows: LiveModel[] = [];
  const evidence: Evidence[] = [];
  const warnings: string[] = [];
  let cursor: string | null = null;
  let pagesScanned = 0;
  let found: LiveModel | null = null;

  while (
    pagesScanned < MODEL_STATUS_LIVE_PAGE_LIMIT &&
    rows.length < MODEL_STATUS_LIVE_ITEM_LIMIT
  ) {
    const query = new URLSearchParams({
      limit: String(MODEL_STATUS_LIVE_PAGE_SIZE),
    });
    if (cursor !== null) query.set("cursor", cursor);

    const page = await client.get(
      LIVE_MODELS_ENDPOINT,
      query,
      liveModelsResponseSchema,
    );
    pagesScanned += 1;
    const remaining = MODEL_STATUS_LIVE_ITEM_LIMIT - rows.length;
    const boundedRows = page.data.slice(0, remaining);
    rows.push(...boundedRows);
    evidence.push(sourceEvidence(LIVE_MODELS_ENDPOINT, page));
    warnings.push(...staleWarning(LIVE_MODELS_ENDPOINT, page.stale));
    found = boundedRows.find((row) => row.id === slug) ?? null;
    cursor = page.cursor;

    if (found !== null || cursor === null) break;
  }

  return {
    found,
    rows,
    evidence,
    warnings,
    cap: {
      pageLimit: MODEL_STATUS_LIVE_PAGE_LIMIT,
      itemLimit: MODEL_STATUS_LIVE_ITEM_LIMIT,
      pagesScanned,
      itemsScanned: rows.length,
      reached:
        rows.length >= MODEL_STATUS_LIVE_ITEM_LIMIT ||
        (cursor !== null && pagesScanned >= MODEL_STATUS_LIVE_PAGE_LIMIT),
      nextCursor: cursor,
    },
  };
}

function suggestionScore(slug: string, model: LiveModel): number {
  const needle = slug.toLocaleLowerCase();
  const id = model.id.toLocaleLowerCase();
  const displayName = model.displayName?.toLocaleLowerCase() ?? "";
  if (id.includes(needle)) return 100;
  if (displayName.includes(needle)) return 90;

  const tokens = needle.split(/[^a-z0-9]+/).filter((token) => token.length > 1);
  return tokens.reduce(
    (score, token) =>
      score + (id.includes(token) ? 3 : 0) + (displayName.includes(token) ? 1 : 0),
    0,
  );
}

function suggestionsFor(slug: string, rows: LiveModel[]): string[] {
  return rows
    .map((model) => ({ id: model.id, score: suggestionScore(slug, model) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .filter(
      (entry, index, entries) =>
        entries.findIndex((candidate) => candidate.id === entry.id) === index,
    )
    .slice(0, MODEL_STATUS_SUGGESTION_LIMIT)
    .map((entry) => entry.id);
}

async function scanDeprecations(
  client: DashboardClient,
  slug: string,
): Promise<DeprecationScan> {
  const evidence: Evidence[] = [];
  const warnings: string[] = [];
  let itemsScanned = 0;
  let pagesScanned = 0;
  let cursor: string | null = null;
  let match: z.infer<typeof publicDeprecationSchema> | null = null;

  while (
    pagesScanned < MODEL_STATUS_DEPRECATION_PAGE_LIMIT &&
    itemsScanned < MODEL_STATUS_DEPRECATION_ITEM_LIMIT
  ) {
    const query = new URLSearchParams({
      limit: String(MODEL_STATUS_DEPRECATION_PAGE_SIZE),
    });
    if (cursor !== null) query.set("cursor", cursor);
    const page = await client.get(
      DEPRECATIONS_ENDPOINT,
      query,
      deprecationsResponseSchema,
    );
    pagesScanned += 1;
    const remaining = MODEL_STATUS_DEPRECATION_ITEM_LIMIT - itemsScanned;
    const boundedRows = page.data.slice(0, remaining);
    itemsScanned += boundedRows.length;
    match = boundedRows.find((row) => row.modelId === slug) ?? null;
    evidence.push(sourceEvidence(DEPRECATIONS_ENDPOINT, page));
    warnings.push(...staleWarning(DEPRECATIONS_ENDPOINT, page.stale));
    cursor = page.cursor;
    if (match !== null || cursor === null) break;
  }

  return {
    match,
    evidence,
    warnings,
    cap: {
      pageLimit: MODEL_STATUS_DEPRECATION_PAGE_LIMIT,
      itemLimit: MODEL_STATUS_DEPRECATION_ITEM_LIMIT,
      pagesScanned,
      itemsScanned,
      reached:
        itemsScanned >= MODEL_STATUS_DEPRECATION_ITEM_LIMIT ||
        (cursor !== null && pagesScanned >= MODEL_STATUS_DEPRECATION_PAGE_LIMIT),
      nextCursor: cursor,
    },
  };
}

function dateOnly(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function dateDaysBefore(date: string, days: number): string {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return new Date(timestamp - days * 86_400_000).toISOString().slice(0, 10);
}

function modelEndpoint(slug: string): string {
  return `${MODELS_ENDPOINT}/${encodeURIComponent(slug)}`;
}

function verdictFor(model: LiveModel): string {
  const provider =
    model.provider.slice(0, 1).toLocaleUpperCase() + model.provider.slice(1);
  const laterCompleteRead =
    Date.parse(model.lastConfirmedAt) > Date.parse(model.lastSeenAt);

  if (model.availability === "disappeared" && laterCompleteRead) {
    const count = model.absenceStreak;
    return `Disappeared from ${provider}'s catalogue. Last present ${dateOnly(model.lastSeenAt)}; the catalogue has been read completely ${count} time${count === "1" ? "" : "s"} since without it.`;
  }
  if (model.availability === "disappeared") {
    return `Reported as disappeared from ${provider}'s catalogue, but lastConfirmedAt is not later than lastSeenAt, so a positive observation of absence is not established.`;
  }
  if (laterCompleteRead) {
    return `Reported as available in ${provider}'s catalogue, but lastConfirmedAt is later than lastSeenAt; treat the upstream availability evidence as inconsistent.`;
  }
  return `Available in ${provider}'s catalogue. It was last seen and last confirmed at ${model.lastConfirmedAt}.`;
}

function auxiliaryFailure(
  endpoint: string,
  reason: PromiseRejectedResult,
): z.infer<typeof auxiliaryErrorSchema> {
  return { endpoint, error: safeDashboardError(reason.reason) };
}

function trimOpenRouterDetail(
  detail: z.infer<typeof publicModelSchema>,
): z.infer<typeof openRouterDetailSchema> {
  return openRouterDetailSchema.parse({
    id: detail.id,
    canonicalSlug: detail.canonicalSlug,
    name: detail.name,
    contextLength: detail.contextLength,
    pricing: detail.pricing,
    expirationDate: detail.expirationDate,
    lifecycleState: detail.lifecycleState,
    freeKind: detail.freeKind,
    weeklyRank: detail.weeklyRank,
  });
}

export async function runModelStatus(
  input: ModelStatusInput,
  { client }: ModelStatusDependencies,
): Promise<ModelStatusOutput> {
  try {
    const manifest = await client.get(
      MANIFEST_ENDPOINT,
      new URLSearchParams(),
      manifestSchema,
    );
    const manifestEvidence = sourceEvidence(MANIFEST_ENDPOINT, manifest);

    if (!manifest.routes.includes(LIVE_MODELS_ENDPOINT)) {
      return {
        status: "unavailable",
        summary: MODEL_STATUS_CAPABILITY_MESSAGE,
        message: MODEL_STATUS_CAPABILITY_MESSAGE,
        missingCapability: LIVE_MODELS_ENDPOINT,
        evidence: [manifestEvidence],
        warnings: [],
      };
    }

    const liveScan = await scanLiveModels(client, input.slug);
    const evidence = [manifestEvidence, ...liveScan.evidence];
    const warnings = [...liveScan.warnings];

    if (liveScan.found === null) {
      const suggestions = suggestionsFor(input.slug, liveScan.rows);
      const suggestionText =
        suggestions.length === 0
          ? "No close ids were found in the bounded scan."
          : `Did you mean one of these: ${suggestions.join(", ")}?`;
      return {
        status: "not_found",
        summary: `The exact model id ${JSON.stringify(input.slug)} is not in the scanned catalogue. ${suggestionText}`,
        model: null,
        suggestions,
        evidence,
        warnings,
        cap: liveScan.cap,
      };
    }

    const model = liveScan.found;
    const detailEndpoint = modelEndpoint(input.slug);
    const historyEndpoint = `${detailEndpoint}/history`;
    const historyTo = dateOnly(model.lastConfirmedAt);
    const historyQuery = new URLSearchParams({
      fact_kind: "usage",
      from: dateDaysBefore(historyTo, 89),
      to: historyTo,
      limit: "90",
    });
    const [deprecationResult, detailResult, historyResult] =
      await Promise.allSettled([
        scanDeprecations(client, input.slug),
        client.get(
          detailEndpoint,
          new URLSearchParams(),
          modelDetailResponseSchema,
        ),
        client.get(historyEndpoint, historyQuery, entityHistoryResponseSchema),
      ]);

    const errors: Array<z.infer<typeof auxiliaryErrorSchema>> = [];
    let deprecation: z.infer<typeof publicDeprecationSchema> | null = null;
    let deprecationsCap: DeprecationScanCap | null = null;
    if (deprecationResult.status === "fulfilled") {
      deprecation = deprecationResult.value.match;
      deprecationsCap = deprecationResult.value.cap;
      evidence.push(...deprecationResult.value.evidence);
      warnings.push(...deprecationResult.value.warnings);
      if (deprecationResult.value.cap.reached && deprecation === null) {
        warnings.push(
          "The deprecation scan reached its declared bound before the collection ended.",
        );
      }
    } else {
      errors.push(auxiliaryFailure(DEPRECATIONS_ENDPOINT, deprecationResult));
    }

    let detail: z.infer<typeof openRouterDetailSchema> | null = null;
    if (detailResult.status === "fulfilled") {
      detail = trimOpenRouterDetail(detailResult.value.data);
      evidence.push(sourceEvidence(detailEndpoint, detailResult.value));
      warnings.push(...staleWarning(detailEndpoint, detailResult.value.stale));
    } else {
      errors.push(auxiliaryFailure(detailEndpoint, detailResult));
    }

    let history: z.infer<typeof entityHistoryResponseSchema> | null = null;
    if (historyResult.status === "fulfilled") {
      history = historyResult.value;
      evidence.push(sourceEvidence(historyEndpoint, historyResult.value));
      warnings.push(...staleWarning(historyEndpoint, historyResult.value.stale));
    } else {
      errors.push(auxiliaryFailure(historyEndpoint, historyResult));
    }

    const verdict = verdictFor(model);
    return {
      status: "ok",
      summary: verdict,
      verdict,
      model,
      auxiliary: {
        status:
          errors.length > 0 ||
          (deprecationsCap?.reached === true && deprecation === null)
            ? "partial"
            : "complete",
        deprecation,
        detail,
        history,
        deprecationsCap,
        errors,
      },
      evidence,
      warnings,
      cap: liveScan.cap,
    };
  } catch (error) {
    const safeError = safeDashboardError(error);
    return {
      status: "error",
      summary: safeError.message,
      error: safeError,
    };
  }
}

export function registerModelStatus(
  server: McpServer,
  dependencies: ModelStatusDependencies,
): void {
  server.registerTool(
    "dashboard_model_status",
    {
      title: "Dashboard model status",
      description:
        "Diagnose an exact model id across providers. lastSeenAt is the last complete provider listing that contained the model; lastConfirmedAt is the latest complete provider listing whether or not it contained the model. A later lastConfirmedAt is positive evidence of absence.",
      inputSchema: modelStatusInputSchema,
      outputSchema: modelStatusOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runModelStatus(input, dependencies)),
  );
}

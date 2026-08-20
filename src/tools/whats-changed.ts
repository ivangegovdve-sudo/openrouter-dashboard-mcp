import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import {
  overviewHistoryResponseSchema,
  publicOverviewHistoryBucketSchema,
} from "../dashboard/schemas/history.js";
import {
  liveModelSchema,
  liveModelsResponseSchema,
} from "../dashboard/schemas/live-models.js";
import {
  deprecationsResponseSchema,
  manifestSchema,
  publicDeprecationSchema,
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
const HISTORY_ENDPOINT = "/api/public/v2/history";
const DEPRECATIONS_ENDPOINT = "/api/public/v2/deprecations";
const LIVE_MODELS_ENDPOINT = "/api/public/v2/live-models";

export const DEPRECATION_PAGE_LIMIT = 2;
export const DEPRECATION_PAGE_SIZE = 200;
export const DEPRECATION_ITEM_LIMIT = 400;
export const CHANGE_LIVE_PAGE_LIMIT = 2;
export const CHANGE_LIVE_PAGE_SIZE = 500;
export const CHANGE_LIVE_ITEM_LIMIT = 1_000;
export const WHATS_CHANGED_DEFAULT_LIMIT = 10;
export const WHATS_CHANGED_MAX_LIMIT = 25;

export const whatsChangedInputSchema = z
  .object({
    since: z.string().date().optional(),
    limit: z
      .number()
      .int()
      .min(1)
      .max(WHATS_CHANGED_MAX_LIMIT)
      .default(WHATS_CHANGED_DEFAULT_LIMIT),
  })
  .strict();

const deprecationCapSchema = z
  .object({
    pageLimit: z.literal(DEPRECATION_PAGE_LIMIT),
    itemLimit: z.literal(DEPRECATION_ITEM_LIMIT),
    pagesScanned: z.number().int().min(0).max(DEPRECATION_PAGE_LIMIT),
    itemsScanned: z.number().int().min(0).max(DEPRECATION_ITEM_LIMIT),
    reached: z.boolean(),
    nextCursor: z.string().nullable(),
  })
  .strict();

const liveCapSchema = z
  .object({
    pageLimit: z.literal(CHANGE_LIVE_PAGE_LIMIT),
    itemLimit: z.literal(CHANGE_LIVE_ITEM_LIMIT),
    pagesScanned: z.number().int().min(0).max(CHANGE_LIVE_PAGE_LIMIT),
    itemsScanned: z.number().int().min(0).max(CHANGE_LIVE_ITEM_LIMIT),
    reached: z.boolean(),
    nextCursor: z.string().nullable(),
  })
  .strict();

const availableModelChangesSchema = z
  .object({
    status: z.literal("available"),
    items: z.array(liveModelSchema),
    omitted: z.number().int().nonnegative(),
  })
  .strict();

const partialModelChangesSchema = z
  .object({
    status: z.literal("partial"),
    items: z.array(liveModelSchema),
    omitted: z.null(),
    reason: z.string(),
  })
  .strict();

const unavailableSectionSchema = z
  .object({
    status: z.literal("unavailable"),
    reason: z.string(),
  })
  .strict();

const modelChangesSchema = z.discriminatedUnion("status", [
  availableModelChangesSchema,
  partialModelChangesSchema,
  unavailableSectionSchema,
]);

const rankMovementSchema = z
  .object({
    modelId: z.string().min(1),
    label: z.string().min(1),
    previousRank: z.number().int().positive(),
    currentRank: z.number().int().positive(),
    direction: z.enum(["up", "down"]),
    previousValue: z.string().nullable(),
    currentValue: z.string().nullable(),
  })
  .strict();

const availableRankMovementsSchema = z
  .object({
    status: z.literal("available"),
    baselineDate: z.string().date(),
    currentDate: z.string().date(),
    items: z.array(rankMovementSchema),
    omitted: z.number().int().nonnegative(),
  })
  .strict();

const rankMovementsSchema = z.discriminatedUnion("status", [
  availableRankMovementsSchema,
  unavailableSectionSchema,
]);

const availableDeprecationsSchema = z
  .object({
    status: z.literal("available"),
    items: z.array(publicDeprecationSchema),
    omitted: z.number().int().nonnegative(),
  })
  .strict();

const partialDeprecationsSchema = z
  .object({
    status: z.literal("partial"),
    items: z.array(publicDeprecationSchema),
    omitted: z.null(),
    reason: z.string(),
  })
  .strict();

const newDeprecationsSchema = z.discriminatedUnion("status", [
  availableDeprecationsSchema,
  partialDeprecationsSchema,
  unavailableSectionSchema,
]);

const priceChangesSchema = z
  .object({
    status: z.literal("unsupported_by_public_api"),
    reason: z.string(),
  })
  .strict();

const whatsChangedSuccessSchema = z
  .object({
    status: z.enum(["ok", "partial"]),
    summary: z.string(),
    since: z.string().date(),
    through: z.string().date(),
    sinceSource: z.enum(["input", "previous_complete_history_bucket"]),
    modelAppearances: modelChangesSchema,
    modelDisappearances: modelChangesSchema,
    newDeprecations: newDeprecationsSchema,
    priceChanges: priceChangesSchema,
    rankMovements: rankMovementsSchema,
    evidence: z.array(sourceEvidenceSchema),
    warnings: z.array(z.string()),
    caps: z
      .object({
        liveModels: liveCapSchema.nullable(),
        deprecations: deprecationCapSchema.nullable(),
      })
      .strict(),
  })
  .strict();

const whatsChangedUnavailableWindowSchema = z
  .object({
    status: z.literal("partial"),
    summary: z.string(),
    since: z.null(),
    through: z.null(),
    sinceSource: z.literal("unavailable"),
    modelAppearances: unavailableSectionSchema,
    modelDisappearances: unavailableSectionSchema,
    newDeprecations: unavailableSectionSchema,
    priceChanges: priceChangesSchema,
    rankMovements: unavailableSectionSchema,
    evidence: z.array(sourceEvidenceSchema),
    warnings: z.array(z.string()),
    caps: z
      .object({
        liveModels: z.null(),
        deprecations: z.null(),
      })
      .strict(),
  })
  .strict();

const whatsChangedErrorSchema = z
  .object({
    status: z.literal("error"),
    summary: z.string(),
    error: safeDashboardErrorSchema,
  })
  .strict();

export const whatsChangedOutputSchema = z.union([
  whatsChangedSuccessSchema,
  whatsChangedUnavailableWindowSchema,
  whatsChangedErrorSchema,
]);

export type WhatsChangedInput = z.input<typeof whatsChangedInputSchema>;
export type WhatsChangedOutput = z.infer<typeof whatsChangedOutputSchema>;

export type WhatsChangedDependencies = {
  client: DashboardClient;
};

type Evidence = z.infer<typeof sourceEvidenceSchema>;
type HistoryBucket = z.infer<typeof publicOverviewHistoryBucketSchema>;
type LiveModel = z.infer<typeof liveModelSchema>;
type OverviewHistory = z.infer<typeof overviewHistoryResponseSchema>;

type DeprecationScan = {
  rows: Array<z.infer<typeof publicDeprecationSchema>>;
  evidence: Evidence[];
  warnings: string[];
  cap: z.infer<typeof deprecationCapSchema>;
};

type LiveScan = {
  rows: LiveModel[];
  evidence: Evidence[];
  warnings: string[];
  cap: z.infer<typeof liveCapSchema>;
};

const PRICE_CHANGES = {
  status: "unsupported_by_public_api",
  reason:
    "The public API does not publish historical prices, so price changes cannot be determined and are not inferred.",
} as const;

function staleWarning(endpoint: string, stale: boolean): string[] {
  return stale ? [`Data from ${endpoint} is stale.`] : [];
}

function unavailable(reason: string): z.infer<typeof unavailableSectionSchema> {
  return { status: "unavailable", reason };
}

function timestampInComparisonWindow(
  timestamp: string,
  since: string,
  through: string,
): boolean {
  const observedAt = Date.parse(timestamp);
  const afterBaselineDay = Date.parse(`${since}T00:00:00Z`) + 86_400_000;
  const afterThroughDay = Date.parse(`${through}T00:00:00Z`) + 86_400_000;
  return observedAt >= afterBaselineDay && observedAt < afterThroughDay;
}

async function scanDeprecations(
  client: DashboardClient,
): Promise<DeprecationScan> {
  const rows: Array<z.infer<typeof publicDeprecationSchema>> = [];
  const evidence: Evidence[] = [];
  const warnings: string[] = [];
  let cursor: string | null = null;
  let pagesScanned = 0;

  while (
    pagesScanned < DEPRECATION_PAGE_LIMIT &&
    rows.length < DEPRECATION_ITEM_LIMIT
  ) {
    const query = new URLSearchParams({ limit: String(DEPRECATION_PAGE_SIZE) });
    if (cursor !== null) query.set("cursor", cursor);
    const page = await client.get(
      DEPRECATIONS_ENDPOINT,
      query,
      deprecationsResponseSchema,
    );
    pagesScanned += 1;
    rows.push(...page.data.slice(0, DEPRECATION_ITEM_LIMIT - rows.length));
    evidence.push(sourceEvidence(DEPRECATIONS_ENDPOINT, page));
    warnings.push(...staleWarning(DEPRECATIONS_ENDPOINT, page.stale));
    cursor = page.cursor;
    if (cursor === null) break;
  }

  return {
    rows,
    evidence,
    warnings,
    cap: {
      pageLimit: DEPRECATION_PAGE_LIMIT,
      itemLimit: DEPRECATION_ITEM_LIMIT,
      pagesScanned,
      itemsScanned: rows.length,
      reached:
        rows.length >= DEPRECATION_ITEM_LIMIT ||
        (cursor !== null && pagesScanned >= DEPRECATION_PAGE_LIMIT),
      nextCursor: cursor,
    },
  };
}

async function scanLiveModels(client: DashboardClient): Promise<LiveScan> {
  const rows: LiveModel[] = [];
  const evidence: Evidence[] = [];
  const warnings: string[] = [];
  let cursor: string | null = null;
  let pagesScanned = 0;

  while (
    pagesScanned < CHANGE_LIVE_PAGE_LIMIT &&
    rows.length < CHANGE_LIVE_ITEM_LIMIT
  ) {
    const query = new URLSearchParams({ limit: String(CHANGE_LIVE_PAGE_SIZE) });
    if (cursor !== null) query.set("cursor", cursor);
    const page = await client.get(
      LIVE_MODELS_ENDPOINT,
      query,
      liveModelsResponseSchema,
    );
    pagesScanned += 1;
    rows.push(...page.data.slice(0, CHANGE_LIVE_ITEM_LIMIT - rows.length));
    evidence.push(sourceEvidence(LIVE_MODELS_ENDPOINT, page));
    warnings.push(...staleWarning(LIVE_MODELS_ENDPOINT, page.stale));
    cursor = page.cursor;
    if (cursor === null) break;
  }

  return {
    rows,
    evidence,
    warnings,
    cap: {
      pageLimit: CHANGE_LIVE_PAGE_LIMIT,
      itemLimit: CHANGE_LIVE_ITEM_LIMIT,
      pagesScanned,
      itemsScanned: rows.length,
      reached:
        rows.length >= CHANGE_LIVE_ITEM_LIMIT ||
        (cursor !== null && pagesScanned >= CHANGE_LIVE_PAGE_LIMIT),
      nextCursor: cursor,
    },
  };
}

function completeBuckets(
  buckets: HistoryBucket[],
): HistoryBucket[] {
  return buckets
    .filter((bucket) => bucket.complete)
    .sort((left, right) => left.date.localeCompare(right.date));
}

function baselineBucketFor(
  buckets: HistoryBucket[],
  since: string,
): HistoryBucket | null {
  return buckets.find((bucket) => bucket.date === since) ?? null;
}

function rankMovementItems(
  baseline: HistoryBucket,
  current: HistoryBucket,
  limit: number,
): {
  items: Array<z.infer<typeof rankMovementSchema>>;
  omitted: number;
} {
  const priorById = new Map(baseline.rows.map((row) => [row.id, row]));
  const all = current.rows.flatMap((row) => {
    const prior = priorById.get(row.id);
    if (
      prior === undefined ||
      prior.rank === null ||
      row.rank === null ||
      prior.rank === row.rank
    ) {
      return [];
    }
    return [
      {
        modelId: row.id,
        label: row.label,
        previousRank: prior.rank,
        currentRank: row.rank,
        direction: row.rank < prior.rank ? ("up" as const) : ("down" as const),
        previousValue: prior.value,
        currentValue: row.value,
      },
    ];
  });
  all.sort(
    (left, right) =>
      Math.abs(right.previousRank - right.currentRank) -
        Math.abs(left.previousRank - left.currentRank) ||
      left.modelId.localeCompare(right.modelId),
  );
  return { items: all.slice(0, limit), omitted: Math.max(0, all.length - limit) };
}

function availableItemCount(
  section:
    | z.infer<typeof modelChangesSchema>
    | z.infer<typeof newDeprecationsSchema>
    | z.infer<typeof rankMovementsSchema>,
): number {
  return section.status === "available" || section.status === "partial"
    ? section.items.length
    : 0;
}

export async function runWhatsChanged(
  rawInput: WhatsChangedInput,
  { client }: WhatsChangedDependencies,
): Promise<WhatsChangedOutput> {
  try {
    const input = whatsChangedInputSchema.parse(rawInput);
    const [manifestResult, historyResult] = await Promise.allSettled([
      client.get(MANIFEST_ENDPOINT, new URLSearchParams(), manifestSchema),
      client.get(
        HISTORY_ENDPOINT,
        new URLSearchParams({
          window: "365d",
          limit: String(input.limit),
        }),
        overviewHistoryResponseSchema,
      ),
    ]);

    if (manifestResult.status === "rejected") throw manifestResult.reason;
    const manifest = manifestResult.value;

    const evidence: Evidence[] = [sourceEvidence(MANIFEST_ENDPOINT, manifest)];
    const warnings: string[] = [];
    let history: OverviewHistory | null = null;
    let historyUnavailableReason: string | null = null;
    if (historyResult.status === "rejected") {
      const error = safeDashboardError(historyResult.reason);
      historyUnavailableReason = `Overview history is unavailable: ${error.message}`;
      warnings.push(historyUnavailableReason);
    } else {
      history = historyResult.value;
    }
    if (history?.status === "available") {
      evidence.push(sourceEvidence(HISTORY_ENDPOINT, history));
      warnings.push(...staleWarning(HISTORY_ENDPOINT, history.stale));
    } else if (history?.status === "unavailable") {
      historyUnavailableReason =
        "Overview history is unavailable because there is insufficient history.";
    }

    const buckets =
      history?.status === "available"
        ? completeBuckets(history.data.modelUsage)
        : [];
    const currentBucket = buckets.at(-1) ?? null;
    const defaultBaseline = buckets.length >= 2 ? buckets.at(-2) ?? null : null;
    const effectiveSince = input.since ?? defaultBaseline?.date ?? null;
    const through =
      currentBucket?.date ??
      (input.since === undefined ? null : manifest.window.end);

    if (effectiveSince === null || through === null) {
      const reason =
        historyUnavailableReason !== null
          ? `${historyUnavailableReason} The prior complete ingestion bucket cannot be determined.`
          : "Fewer than two complete model-usage buckets are available, so the prior complete ingestion bucket cannot be determined.";
      const section = unavailable(reason);
      return {
        status: "partial",
        summary: reason,
        since: null,
        through: null,
        sinceSource: "unavailable",
        modelAppearances: section,
        modelDisappearances: section,
        newDeprecations: section,
        priceChanges: PRICE_CHANGES,
        rankMovements: section,
        evidence,
        warnings,
        caps: { liveModels: null, deprecations: null },
      };
    }

    const sinceSource =
      input.since === undefined
        ? ("previous_complete_history_bucket" as const)
        : ("input" as const);
    const baseline =
      input.since === undefined
        ? defaultBaseline
        : baselineBucketFor(buckets, effectiveSince);

    let rankMovements: z.infer<typeof rankMovementsSchema>;
    if (historyUnavailableReason !== null) {
      rankMovements = unavailable(historyUnavailableReason);
    } else if (baseline === null || currentBucket === null) {
      rankMovements = unavailable(
        `No complete model-usage bucket exists on or before ${effectiveSince}.`,
      );
    } else {
      const movement = rankMovementItems(baseline, currentBucket, input.limit);
      rankMovements = {
        status: "available",
        baselineDate: baseline.date,
        currentDate: currentBucket.date,
        items: movement.items,
        omitted: movement.omitted,
      };
    }

    const hasDeprecations = manifest.routes.includes(DEPRECATIONS_ENDPOINT);
    const hasLiveModels = manifest.routes.includes(LIVE_MODELS_ENDPOINT);
    const deprecationPromise = hasDeprecations
      ? scanDeprecations(client)
      : Promise.resolve<DeprecationScan | null>(null);
    const livePromise = hasLiveModels
      ? scanLiveModels(client)
      : Promise.resolve<LiveScan | null>(null);
    const [deprecationResult, liveResult] = await Promise.allSettled([
      deprecationPromise,
      livePromise,
    ]);

    let newDeprecations: z.infer<typeof newDeprecationsSchema>;
    let deprecationsCap: z.infer<typeof deprecationCapSchema> | null = null;
    if (deprecationResult.status === "rejected") {
      const error = safeDashboardError(deprecationResult.reason);
      newDeprecations = unavailable(error.message);
      warnings.push(`Deprecation changes are unavailable: ${error.message}`);
    } else if (deprecationResult.value === null) {
      newDeprecations = unavailable(
        `${DEPRECATIONS_ENDPOINT} is not listed by the dashboard manifest.`,
      );
    } else {
      const scan = deprecationResult.value;
      const allNew = scan.rows.filter((notice) =>
        timestampInComparisonWindow(
          notice.firstObservedAt,
          effectiveSince,
          through,
        ),
      );
      const items = allNew.slice(0, input.limit);
      newDeprecations =
        scan.cap.nextCursor === null
          ? {
              status: "available",
              items,
              omitted: Math.max(0, allNew.length - input.limit),
            }
          : {
              status: "partial",
              items,
              omitted: null,
              reason:
                "The deprecation scan reached its declared bound with more evidence unscanned.",
            };
      deprecationsCap = scan.cap;
      evidence.push(...scan.evidence);
      warnings.push(...scan.warnings);
      if (scan.cap.reached && scan.cap.nextCursor !== null) {
        warnings.push(
          "The deprecation scan reached its declared bound before the collection ended.",
        );
      }
    }

    let modelAppearances: z.infer<typeof modelChangesSchema>;
    let modelDisappearances: z.infer<typeof modelChangesSchema>;
    let liveCap: z.infer<typeof liveCapSchema> | null = null;
    if (liveResult.status === "rejected") {
      const error = safeDashboardError(liveResult.reason);
      modelAppearances = unavailable(error.message);
      modelDisappearances = unavailable(error.message);
      warnings.push(`Model appearance and disappearance are unavailable: ${error.message}`);
    } else if (liveResult.value === null) {
      const reason = `${LIVE_MODELS_ENDPOINT} is not yet deployed; model appearance and disappearance are unavailable.`;
      modelAppearances = unavailable(reason);
      modelDisappearances = unavailable(reason);
    } else {
      const scan = liveResult.value;
      const appearances = scan.rows.filter((model) =>
        timestampInComparisonWindow(model.firstSeenAt, effectiveSince, through),
      );
      const disappearances = scan.rows.filter(
        (model) =>
          model.disappearedAt !== null &&
          timestampInComparisonWindow(
            model.disappearedAt,
            effectiveSince,
            through,
          ),
      );
      const appearanceItems = appearances.slice(0, input.limit);
      const disappearanceItems = disappearances.slice(0, input.limit);
      if (scan.cap.nextCursor === null) {
        modelAppearances = {
          status: "available",
          items: appearanceItems,
          omitted: Math.max(0, appearances.length - input.limit),
        };
        modelDisappearances = {
          status: "available",
          items: disappearanceItems,
          omitted: Math.max(0, disappearances.length - input.limit),
        };
      } else {
        const reason =
          "The live-model scan reached its declared bound with more evidence unscanned.";
        modelAppearances = {
          status: "partial",
          items: appearanceItems,
          omitted: null,
          reason,
        };
        modelDisappearances = {
          status: "partial",
          items: disappearanceItems,
          omitted: null,
          reason,
        };
      }
      liveCap = scan.cap;
      evidence.push(...scan.evidence);
      warnings.push(...scan.warnings);
      if (scan.cap.reached && scan.cap.nextCursor !== null) {
        warnings.push(
          "The live-model scan reached its declared bound before the collection ended.",
        );
      }
    }

    const sections = [
      modelAppearances,
      modelDisappearances,
      newDeprecations,
      rankMovements,
    ];
    const changeCount = sections.reduce(
      (count, section) => count + availableItemCount(section),
      0,
    );
    const unavailableCount = sections.filter(
      (section) => section.status === "unavailable",
    ).length;
    const incompleteCount = sections.filter(
      (section) => section.status === "partial",
    ).length;
    let summary: string;
    if (incompleteCount > 0 && changeCount === 0) {
      summary = `No changes were found in the scanned evidence since ${effectiveSince}, but the comparison is incomplete.`;
    } else if (incompleteCount > 0) {
      summary = `${changeCount} change${changeCount === 1 ? "" : "s"} found in scanned evidence since ${effectiveSince}; the comparison is incomplete.`;
    } else if (changeCount === 0) {
      summary = `Nothing changed in the available comparisons since ${effectiveSince}.`;
    } else {
      summary = `${changeCount} change${changeCount === 1 ? "" : "s"} found since ${effectiveSince}.`;
    }

    return {
      status:
        unavailableCount === 0 && incompleteCount === 0 ? "ok" : "partial",
      summary,
      since: effectiveSince,
      through,
      sinceSource,
      modelAppearances,
      modelDisappearances,
      newDeprecations,
      priceChanges: PRICE_CHANGES,
      rankMovements,
      evidence,
      warnings,
      caps: {
        liveModels: liveCap,
        deprecations: deprecationsCap,
      },
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

export function registerWhatsChanged(
  server: McpServer,
  dependencies: WhatsChangedDependencies,
): void {
  server.registerTool(
    "dashboard_whats_changed",
    {
      title: "Dashboard changes",
      description:
        "Report bounded model appearance, disappearance, deprecation, and public ecosystem token-usage rank changes since a complete ingestion bucket. Historical price changes are explicitly unsupported by the public API.",
      inputSchema: whatsChangedInputSchema,
      outputSchema: whatsChangedOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runWhatsChanged(input, dependencies)),
  );
}

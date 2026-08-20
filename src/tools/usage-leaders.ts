import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import type { DashboardClient } from "../dashboard/client.js";
import {
  overviewHistoryResponseSchema,
  publicOverviewHistoryBucketSchema,
} from "../dashboard/schemas/history.js";
import {
  appModelMatrixResponseSchema,
  appModelsResponseSchema,
  appsResponseSchema,
} from "../dashboard/schemas/openrouter.js";
import {
  READ_ONLY_TOOL_ANNOTATIONS,
  safeDashboardError,
  safeDashboardErrorSchema,
  sourceEvidence,
  sourceEvidenceSchema,
  toolResult,
} from "./shared.js";

const HISTORY_ENDPOINT = "/api/public/v2/history";
const APPS_ENDPOINT = "/api/public/v2/apps";
const MATRIX_ENDPOINT = "/api/public/v2/app-model-matrix";

export const USAGE_LEADERS_DEFAULT_WINDOW_DAYS = 30;
export const USAGE_LEADERS_MAX_WINDOW_DAYS = 182;
export const USAGE_LEADERS_DEFAULT_LIMIT = 5;
export const USAGE_LEADERS_MAX_LIMIT = 10;
export const USAGE_HISTORY_CANDIDATE_LIMIT = 25;
export const USAGE_APP_MODELS_LIMIT = 100;
export const USAGE_MATRIX_AXIS_LIMIT = 10;

export const usageLeadersInputSchema = z
  .object({
    windowDays: z
      .number()
      .int()
      .min(1)
      .max(USAGE_LEADERS_MAX_WINDOW_DAYS)
      .default(USAGE_LEADERS_DEFAULT_WINDOW_DAYS),
    limit: z
      .number()
      .int()
      .min(1)
      .max(USAGE_LEADERS_MAX_LIMIT)
      .default(USAGE_LEADERS_DEFAULT_LIMIT),
  })
  .strict();

const intervalEvidenceGapSchema = z
  .object({
    date: z.string().date(),
    modelId: z.string().min(1),
    reason: z.enum([
      "non_integer_value",
      "missing_value",
      "duplicate_bucket",
      "reserved_other_missing",
    ]),
  })
  .strict();

const calendarIntervalSchema = z
  .object({
    start: z.string().date(),
    end: z.string().date(),
    expectedDays: z.number().int().min(1).max(USAGE_LEADERS_MAX_WINDOW_DAYS),
    observedCompleteDays: z
      .number()
      .int()
      .min(0)
      .max(USAGE_LEADERS_MAX_WINDOW_DAYS),
    missingDates: z.array(z.string().date()),
    incompleteDates: z.array(z.string().date()),
    evidenceGaps: z.array(intervalEvidenceGapSchema),
    evidenceComplete: z.boolean(),
  })
  .strict();

const modelLeaderSchema = z
  .object({
    modelId: z.string().min(1),
    label: z.string().min(1),
    currentRank: z.number().int().positive(),
    previousRank: z.number().int().positive().nullable(),
    rankMovement: z.number().int().nullable(),
    ecosystemTokenVolume: z.string().regex(/^(?:0|[1-9]\d*)$/),
    previousEcosystemTokenVolume: z
      .string()
      .regex(/^(?:0|[1-9]\d*)$/)
      .nullable(),
  })
  .strict();

const unidentifiedLongTailSchema = z
  .object({
    modelId: z.literal("other"),
    label: z.string().min(1).nullable(),
    ecosystemTokenVolume: z.string().regex(/^(?:0|[1-9]\d*)$/).nullable(),
    previousEcosystemTokenVolume: z
      .string()
      .regex(/^(?:0|[1-9]\d*)$/)
      .nullable(),
  })
  .strict();

const modelSectionBase = {
  endpoint: z.literal(HISTORY_ENDPOINT),
  periodSemantics: z.literal("requested_calendar_window"),
  populationScope: z.literal(
    "named_models_observed_in_published_daily_top_25_slice",
  ),
  observedSliceValueSemantics: z.literal(
    "sum_of_published_daily_values_only_absence_not_zero",
  ),
  upstreamHistoryWindow: z.enum(["30d", "90d", "365d"]),
  requestedWindowDays: z
    .number()
    .int()
    .min(1)
    .max(USAGE_LEADERS_MAX_WINDOW_DAYS),
};

const availableModelSectionSchema = z
  .object({
    status: z.enum(["available", "partial"]),
    ...modelSectionBase,
    currentInterval: calendarIntervalSchema,
    previousInterval: calendarIntervalSchema,
    leaders: z.array(modelLeaderSchema).max(USAGE_LEADERS_MAX_LIMIT),
    unidentifiedLongTail: unidentifiedLongTailSchema,
    evidence: sourceEvidenceSchema,
    warnings: z.array(z.string()),
    cap: z
      .object({
        historyCandidateLimit: z.literal(USAGE_HISTORY_CANDIDATE_LIMIT),
        outputLimit: z.number().int().min(1).max(USAGE_LEADERS_MAX_LIMIT),
        namedCandidatesObserved: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

const unavailableModelSectionSchema = z
  .object({
    status: z.literal("unavailable"),
    ...modelSectionBase,
    reason: z.string(),
    error: safeDashboardErrorSchema.nullable(),
    warnings: z.array(z.string()),
  })
  .strict();

const modelSectionSchema = z.discriminatedUnion("status", [
  availableModelSectionSchema,
  unavailableModelSectionSchema,
]);

const appLeaderSchema = z
  .object({
    appId: z.string().regex(/^(?:0|[1-9]\d*)$/),
    appName: z.string().min(1),
    publishedRank: z.number().int().positive(),
    rolling30DayEcosystemTokenVolume: z.string().regex(/^(?:0|[1-9]\d*)$/),
    rolling30DayRequestCount: z.string().regex(/^(?:0|[1-9]\d*)$/),
    ecosystemTokenVolumeMovement: z.null(),
  })
  .strict();

const availableAppsSectionSchema = z
  .object({
    status: z.literal("available"),
    endpoint: z.literal(APPS_ENDPOINT),
    periodSemantics: z.literal("rolling_30_day"),
    leaders: z.array(appLeaderSchema).max(USAGE_LEADERS_MAX_LIMIT),
    evidence: sourceEvidenceSchema,
    warnings: z.array(z.string()),
    cap: z
      .object({
        requestedLimit: z.number().int().min(1).max(USAGE_LEADERS_MAX_LIMIT),
        returnedCount: z.number().int().nonnegative(),
        nextCursor: z.string().nullable(),
        capped: z.boolean(),
      })
      .strict(),
  })
  .strict();

const unavailableAppsSectionSchema = z
  .object({
    status: z.literal("unavailable"),
    endpoint: z.literal(APPS_ENDPOINT),
    periodSemantics: z.literal("rolling_30_day"),
    reason: z.string(),
    error: safeDashboardErrorSchema.nullable(),
    warnings: z.array(z.string()),
  })
  .strict();

const appsSectionSchema = z.discriminatedUnion("status", [
  availableAppsSectionSchema,
  unavailableAppsSectionSchema,
]);

const appLatestDayItemSchema = z
  .object({
    appId: z.string().regex(/^(?:0|[1-9]\d*)$/),
    appName: z.string().min(1),
    endpoint: z.string().startsWith(`${APPS_ENDPOINT}/`).endsWith("/models"),
    status: z.enum(["available", "unavailable", "error"]),
    response: appModelsResponseSchema.nullable(),
    error: safeDashboardErrorSchema.nullable(),
    warnings: z.array(z.string()),
  })
  .strict();

const appLatestDayModelsSectionSchema = z
  .object({
    periodSemantics: z.literal("latest_observed_day"),
    populationCompleteness: z.literal("partial_or_unknown"),
    items: z.array(appLatestDayItemSchema).max(USAGE_LEADERS_MAX_LIMIT),
    warnings: z.array(z.string()),
    cap: z
      .object({
        perAppModelLimit: z.literal(USAGE_APP_MODELS_LIMIT),
        appLimit: z.number().int().min(1).max(USAGE_LEADERS_MAX_LIMIT),
      })
      .strict(),
  })
  .strict();

const matrixSectionSchema = z
  .object({
    status: z.enum(["available", "unavailable", "error"]),
    endpoint: z.literal(MATRIX_ENDPOINT),
    periodSemantics: z.literal("latest_common_complete_day"),
    selectionSemantics: z.literal(
      "producer_selected_top_10_axes_not_caller_selected_ids",
    ),
    response: appModelMatrixResponseSchema.nullable(),
    error: safeDashboardErrorSchema.nullable(),
    warnings: z.array(z.string()),
    cap: z
      .object({
        appLimit: z.literal(USAGE_MATRIX_AXIS_LIMIT),
        modelLimit: z.literal(USAGE_MATRIX_AXIS_LIMIT),
        cellLimit: z.literal(100),
      })
      .strict(),
  })
  .strict();

const usageLeadersSuccessSchema = z
  .object({
    status: z.enum(["ok", "partial"]),
    schemaVersion: z.literal("2.0"),
    summary: z.string(),
    query: z
      .object({
        windowDays: z
          .number()
          .int()
          .min(1)
          .max(USAGE_LEADERS_MAX_WINDOW_DAYS),
        limit: z.number().int().min(1).max(USAGE_LEADERS_MAX_LIMIT),
      })
      .strict(),
    modelRequestedWindow: modelSectionSchema,
    appsRolling30Day: appsSectionSchema,
    appLatestDayModels: appLatestDayModelsSectionSchema,
    producerSelectedTopAxisMatrix: matrixSectionSchema,
    warnings: z.array(z.string()),
  })
  .strict();

const usageLeadersErrorSchema = z
  .object({
    status: z.literal("error"),
    summary: z.string(),
    error: safeDashboardErrorSchema,
  })
  .strict();

export const usageLeadersOutputSchema = z.discriminatedUnion("status", [
  usageLeadersSuccessSchema,
  usageLeadersErrorSchema,
]);

export type UsageLeadersInput = z.input<typeof usageLeadersInputSchema>;
export type UsageLeadersOutput = z.infer<typeof usageLeadersOutputSchema>;
export type UsageLeadersDependencies = { client: DashboardClient };

type HistoryBucket = z.infer<typeof publicOverviewHistoryBucketSchema>;
type ModelSection = z.infer<typeof modelSectionSchema>;
type AppsSection = z.infer<typeof appsSectionSchema>;
type LatestDaySection = z.infer<typeof appLatestDayModelsSectionSchema>;
type MatrixSection = z.infer<typeof matrixSectionSchema>;

const INTEGER_TOKEN_VALUE = /^(?:0|[1-9]\d*)$/;
const MILLIS_PER_DAY = 86_400_000;

function addUtcDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * MILLIS_PER_DAY)
    .toISOString()
    .slice(0, 10);
}

function expectedDates(start: string, days: number): string[] {
  return Array.from({ length: days }, (_, index) => addUtcDays(start, index));
}

function upstreamHistoryWindow(windowDays: number): "30d" | "90d" | "365d" {
  const comparisonDays = windowDays * 2;
  if (comparisonDays <= 30) return "30d";
  if (comparisonDays <= 90) return "90d";
  return "365d";
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

type Aggregate = {
  totals: Map<string, bigint>;
  labels: Map<string, { label: string; date: string }>;
  otherTotal: bigint | null;
  otherLabel: string | null;
  interval: z.infer<typeof calendarIntervalSchema>;
};

function aggregateInterval(
  buckets: readonly HistoryBucket[],
  start: string,
  end: string,
  days: number,
): Aggregate {
  const dates = expectedDates(start, days);
  const bucketsByDate = new Map<string, HistoryBucket[]>();
  for (const bucket of buckets) {
    if (bucket.date < start || bucket.date > end) continue;
    const sameDate = bucketsByDate.get(bucket.date) ?? [];
    sameDate.push(bucket);
    bucketsByDate.set(bucket.date, sameDate);
  }

  const totals = new Map<string, bigint>();
  const labels = new Map<string, { label: string; date: string }>();
  const missingDates: string[] = [];
  const incompleteDates: string[] = [];
  const evidenceGaps: Array<z.infer<typeof intervalEvidenceGapSchema>> = [];
  let observedCompleteDays = 0;
  let otherTotal = 0n;
  let otherObserved = false;
  let otherLabel: string | null = null;

  for (const date of dates) {
    const sameDate = bucketsByDate.get(date) ?? [];
    if (sameDate.length === 0) {
      missingDates.push(date);
      continue;
    }
    if (sameDate.length > 1) {
      evidenceGaps.push({ date, modelId: "other", reason: "duplicate_bucket" });
      continue;
    }
    const bucket = sameDate[0];
    if (bucket === undefined) continue;
    if (!bucket.complete) {
      incompleteDates.push(date);
      continue;
    }
    observedCompleteDays += 1;
    let reservedOtherSeen = false;
    for (const row of bucket.rows) {
      if (row.id === "other") reservedOtherSeen = true;
      if (row.value === null) {
        evidenceGaps.push({
          date,
          modelId: row.id,
          reason: "missing_value",
        });
        continue;
      }
      if (!INTEGER_TOKEN_VALUE.test(row.value)) {
        evidenceGaps.push({
          date,
          modelId: row.id,
          reason: "non_integer_value",
        });
        continue;
      }
      const value = BigInt(row.value);
      if (row.id === "other") {
        otherTotal += value;
        otherObserved = true;
        otherLabel = row.label;
        continue;
      }
      totals.set(row.id, (totals.get(row.id) ?? 0n) + value);
      const knownLabel = labels.get(row.id);
      if (knownLabel === undefined || knownLabel.date <= date) {
        labels.set(row.id, { label: row.label, date });
      }
    }
    if (!reservedOtherSeen) {
      evidenceGaps.push({
        date,
        modelId: "other",
        reason: "reserved_other_missing",
      });
    }
  }

  return {
    totals,
    labels,
    otherTotal: otherObserved ? otherTotal : null,
    otherLabel,
    interval: {
      start,
      end,
      expectedDays: days,
      observedCompleteDays,
      missingDates,
      incompleteDates,
      evidenceGaps,
      evidenceComplete:
        missingDates.length === 0 &&
        incompleteDates.length === 0 &&
        evidenceGaps.length === 0,
    },
  };
}

function rankedTotals(totals: ReadonlyMap<string, bigint>) {
  return [...totals.entries()]
    .map(([modelId, total]) => ({ modelId, total }))
    .sort(
      (left, right) =>
        (left.total === right.total ? 0 : left.total > right.total ? -1 : 1) ||
        left.modelId.localeCompare(right.modelId),
    );
}

function unavailableModelSection(
  requestedWindowDays: number,
  historyWindow: "30d" | "90d" | "365d",
  reason: string,
  error: ReturnType<typeof safeDashboardError> | null,
): z.infer<typeof unavailableModelSectionSchema> {
  return {
    status: "unavailable",
    endpoint: HISTORY_ENDPOINT,
    periodSemantics: "requested_calendar_window",
    populationScope: "named_models_observed_in_published_daily_top_25_slice",
    observedSliceValueSemantics:
      "sum_of_published_daily_values_only_absence_not_zero",
    upstreamHistoryWindow: historyWindow,
    requestedWindowDays,
    reason,
    error,
    warnings: [reason],
  };
}

function modelSection(
  response: z.infer<typeof overviewHistoryResponseSchema>,
  windowDays: number,
  limit: number,
  historyWindow: "30d" | "90d" | "365d",
): ModelSection {
  if (response.status === "unavailable") {
    return unavailableModelSection(
      windowDays,
      historyWindow,
      "Public model history is unavailable because the published history is insufficient.",
      null,
    );
  }
  const end = response.window.end;
  if (end === null) {
    return unavailableModelSection(
      windowDays,
      historyWindow,
      "Public model history does not provide a response-window end date.",
      null,
    );
  }

  const currentStart = addUtcDays(end, -(windowDays - 1));
  const previousEnd = addUtcDays(end, -windowDays);
  const previousStart = addUtcDays(end, -(windowDays * 2 - 1));
  const current = aggregateInterval(
    response.data.modelUsage,
    currentStart,
    end,
    windowDays,
  );
  const previous = aggregateInterval(
    response.data.modelUsage,
    previousStart,
    previousEnd,
    windowDays,
  );
  const currentRanks = rankedTotals(current.totals);
  const previousRanks = rankedTotals(previous.totals);
  const previousRankById = new Map(
    previousRanks.map((entry, index) => [entry.modelId, index + 1]),
  );
  const comparable =
    current.interval.evidenceComplete && previous.interval.evidenceComplete;
  const leaders = currentRanks.slice(0, limit).map((entry, index) => {
    const previousRank = comparable
      ? previousRankById.get(entry.modelId) ?? null
      : null;
    const previousTotal = comparable
      ? previous.totals.get(entry.modelId) ?? null
      : null;
    return {
      modelId: entry.modelId,
      label: current.labels.get(entry.modelId)?.label ?? entry.modelId,
      currentRank: index + 1,
      previousRank,
      rankMovement:
        previousRank === null ? null : previousRank - (index + 1),
      ecosystemTokenVolume: entry.total.toString(),
      previousEcosystemTokenVolume: previousTotal?.toString() ?? null,
    };
  });
  const warnings = [
    ...(response.stale ? [`Data from ${HISTORY_ENDPOINT} is stale.`] : []),
    ...(!current.interval.evidenceComplete
      ? [
          "The current requested calendar window has missing, incomplete, or non-integer evidence; totals are partial.",
        ]
      : []),
    ...(!comparable
      ? [
          "Previous rank movement is unknown because both exact calendar windows do not have complete evidence.",
        ]
      : []),
  ];

  return {
    status: comparable ? "available" : "partial",
    endpoint: HISTORY_ENDPOINT,
    periodSemantics: "requested_calendar_window",
    populationScope: "named_models_observed_in_published_daily_top_25_slice",
    observedSliceValueSemantics:
      "sum_of_published_daily_values_only_absence_not_zero",
    upstreamHistoryWindow: historyWindow,
    requestedWindowDays: windowDays,
    currentInterval: current.interval,
    previousInterval: previous.interval,
    leaders,
    unidentifiedLongTail: {
      modelId: "other",
      label: current.otherLabel ?? previous.otherLabel,
      ecosystemTokenVolume: current.otherTotal?.toString() ?? null,
      previousEcosystemTokenVolume:
        previous.otherTotal?.toString() ?? null,
    },
    evidence: sourceEvidence(HISTORY_ENDPOINT, response),
    warnings,
    cap: {
      historyCandidateLimit: USAGE_HISTORY_CANDIDATE_LIMIT,
      outputLimit: limit,
      namedCandidatesObserved: currentRanks.length,
    },
  };
}

function unavailableAppsSection(
  reason: string,
  error: ReturnType<typeof safeDashboardError> | null,
): z.infer<typeof unavailableAppsSectionSchema> {
  return {
    status: "unavailable",
    endpoint: APPS_ENDPOINT,
    periodSemantics: "rolling_30_day",
    reason,
    error,
    warnings: [reason],
  };
}

function appsSection(
  response: z.infer<typeof appsResponseSchema>,
  limit: number,
): z.infer<typeof availableAppsSectionSchema> {
  const warnings = [
    ...(response.stale ? [`Data from ${APPS_ENDPOINT} is stale.`] : []),
    ...(response.cursor === null
      ? []
      : [
          "The rolling-30-day app view has more rows; only the bounded requested slice is returned.",
        ]),
  ];
  return {
    status: "available",
    endpoint: APPS_ENDPOINT,
    periodSemantics: "rolling_30_day",
    leaders: response.data.slice(0, limit).map((app) => ({
      appId: app.appId,
      appName: app.appName,
      publishedRank: app.rank,
      rolling30DayEcosystemTokenVolume: app.totalTokens,
      rolling30DayRequestCount: app.totalRequests,
      ecosystemTokenVolumeMovement: null,
    })),
    evidence: sourceEvidence(APPS_ENDPOINT, response),
    warnings,
    cap: {
      requestedLimit: limit,
      returnedCount: Math.min(response.data.length, limit),
      nextCursor: response.cursor,
      capped: response.cursor !== null,
    },
  };
}

async function latestDayItem(
  client: DashboardClient,
  app: z.infer<typeof appLeaderSchema>,
): Promise<z.infer<typeof appLatestDayItemSchema>> {
  const endpoint = `${APPS_ENDPOINT}/${encodeURIComponent(app.appId)}/models`;
  try {
    const response = await client.get(
      endpoint,
      new URLSearchParams({ limit: String(USAGE_APP_MODELS_LIMIT) }),
      appModelsResponseSchema,
    );
    const warnings = [
      ...(response.stale ? [`Data from ${endpoint} is stale.`] : []),
      ...(response.status === "unavailable"
        ? [`${endpoint} is unavailable: ${response.reason}.`]
        : []),
      ...(response.status === "available" &&
      response.coverage.observedModels > response.data.length
        ? [
            `${endpoint} omits observed models beyond its fixed bounded response.`,
          ]
        : []),
    ];
    return {
      appId: app.appId,
      appName: app.appName,
      endpoint,
      status: response.status,
      response,
      error: null,
      warnings,
    };
  } catch (error) {
    const safeError = safeDashboardError(error);
    return {
      appId: app.appId,
      appName: app.appName,
      endpoint,
      status: "error",
      response: null,
      error: safeError,
      warnings: [`${endpoint} is unavailable: ${safeError.message}`],
    };
  }
}

async function matrixSection(client: DashboardClient): Promise<MatrixSection> {
  try {
    const response = await client.get(
      MATRIX_ENDPOINT,
      new URLSearchParams({
        appLimit: String(USAGE_MATRIX_AXIS_LIMIT),
        modelLimit: String(USAGE_MATRIX_AXIS_LIMIT),
        window: "latest-complete",
      }),
      appModelMatrixResponseSchema,
    );
    const warnings = [
      ...(response.stale ? [`Data from ${MATRIX_ENDPOINT} is stale.`] : []),
      ...(response.status === "unavailable"
        ? [`${MATRIX_ENDPOINT} is unavailable: ${response.reason}.`]
        : []),
      ...(response.status === "available" &&
      response.cells.some((cell) => cell.state === "unknown")
        ? ["The producer-selected matrix includes unknown cells; they are not zero."]
        : []),
    ];
    return {
      status: response.status,
      endpoint: MATRIX_ENDPOINT,
      periodSemantics: "latest_common_complete_day",
      selectionSemantics:
        "producer_selected_top_10_axes_not_caller_selected_ids",
      response,
      error: null,
      warnings,
      cap: { appLimit: 10, modelLimit: 10, cellLimit: 100 },
    };
  } catch (error) {
    const safeError = safeDashboardError(error);
    return {
      status: "error",
      endpoint: MATRIX_ENDPOINT,
      periodSemantics: "latest_common_complete_day",
      selectionSemantics:
        "producer_selected_top_10_axes_not_caller_selected_ids",
      response: null,
      error: safeError,
      warnings: [`${MATRIX_ENDPOINT} is unavailable: ${safeError.message}`],
      cap: { appLimit: 10, modelLimit: 10, cellLimit: 100 },
    };
  }
}

async function runUsageLeadersUnsafe(
  rawInput: UsageLeadersInput,
  { client }: UsageLeadersDependencies,
): Promise<UsageLeadersOutput> {
  const input = usageLeadersInputSchema.parse(rawInput);
  const historyWindow = upstreamHistoryWindow(input.windowDays);
  const [historyResult, appsResult] = await Promise.allSettled([
    client.get(
      HISTORY_ENDPOINT,
      new URLSearchParams({
        window: historyWindow,
        limit: String(USAGE_HISTORY_CANDIDATE_LIMIT),
      }),
      overviewHistoryResponseSchema,
    ),
    client.get(
      APPS_ENDPOINT,
      new URLSearchParams({
        period: "30d",
        sort: "popular",
        limit: String(input.limit),
      }),
      appsResponseSchema,
    ),
  ]);

  let models: ModelSection;
  if (historyResult.status === "fulfilled") {
    models = modelSection(
      historyResult.value,
      input.windowDays,
      input.limit,
      historyWindow,
    );
  } else {
    const safeError = safeDashboardError(historyResult.reason);
    models = unavailableModelSection(
      input.windowDays,
      historyWindow,
      `Public model history is unavailable: ${safeError.message}`,
      safeError,
    );
  }

  let apps: AppsSection;
  if (appsResult.status === "fulfilled") {
    apps = appsSection(appsResult.value, input.limit);
  } else {
    const safeError = safeDashboardError(appsResult.reason);
    apps = unavailableAppsSection(
      `The rolling-30-day public app slice is unavailable: ${safeError.message}`,
      safeError,
    );
  }

  const appLeaders = apps.status === "available" ? apps.leaders : [];
  const latestItemPromises = appLeaders.map((app) => latestDayItem(client, app));
  const matrixPromise = matrixSection(client);
  const [latestItemResults, matrixResults] = await Promise.all([
    Promise.allSettled(latestItemPromises),
    Promise.allSettled([matrixPromise]),
  ]);
  const latestItems = latestItemResults
    .map((result, index) => {
      if (result.status === "fulfilled") return result.value;
      const app = appLeaders[index];
      if (app === undefined) return null;
      const safeError = safeDashboardError(result.reason);
      const endpoint = `${APPS_ENDPOINT}/${encodeURIComponent(app.appId)}/models`;
      return {
        appId: app.appId,
        appName: app.appName,
        endpoint,
        status: "error" as const,
        response: null,
        error: safeError,
        warnings: [`${endpoint} is unavailable: ${safeError.message}`],
      };
    })
    .filter((item): item is z.infer<typeof appLatestDayItemSchema> => item !== null);
  const latestWarnings = latestItems.flatMap((item) => item.warnings);
  const latestDayModels: LatestDaySection = {
    periodSemantics: "latest_observed_day",
    populationCompleteness: "partial_or_unknown",
    items: latestItems,
    warnings: latestWarnings,
    cap: {
      perAppModelLimit: USAGE_APP_MODELS_LIMIT,
      appLimit: input.limit,
    },
  };
  const settledMatrix = matrixResults[0];
  const matrix =
    settledMatrix?.status === "fulfilled"
      ? settledMatrix.value
      : await matrixSection({
          async get() {
            throw settledMatrix?.reason;
          },
        });
  const warnings = uniqueStrings([
    ...models.warnings,
    ...apps.warnings,
    ...latestDayModels.warnings,
    ...matrix.warnings,
  ]);
  const partial =
    models.status !== "available" ||
    apps.status !== "available" ||
    latestItems.some((item) => item.status !== "available") ||
    matrix.status !== "available";
  const namedLeaderCount =
    models.status === "unavailable" ? 0 : models.leaders.length;
  const appLeaderCount = apps.status === "available" ? apps.leaders.length : 0;

  return {
    status: partial ? "partial" : "ok",
    schemaVersion: "2.0",
    summary: `Public OpenRouter-wide token volume: ${namedLeaderCount} observed named model leader${namedLeaderCount === 1 ? "" : "s"} for the requested calendar window and ${appLeaderCount} rolling-30-day app leader${appLeaderCount === 1 ? "" : "s"}.`,
    query: { windowDays: input.windowDays, limit: input.limit },
    modelRequestedWindow: models,
    appsRolling30Day: apps,
    appLatestDayModels: latestDayModels,
    producerSelectedTopAxisMatrix: matrix,
    warnings,
  };
}

export async function runUsageLeaders(
  rawInput: UsageLeadersInput,
  dependencies: UsageLeadersDependencies,
): Promise<UsageLeadersOutput> {
  try {
    const output = await runUsageLeadersUnsafe(rawInput, dependencies);
    return usageLeadersOutputSchema.parse(output);
  } catch (error) {
    const safeError = safeDashboardError(error);
    return {
      status: "error",
      summary: safeError.message,
      error: safeError,
    };
  }
}

export function registerUsageLeaders(
  server: McpServer,
  dependencies: UsageLeadersDependencies,
): void {
  server.registerTool(
    "dashboard_usage_leaders",
    {
      title: "Dashboard public ecosystem usage leaders",
      description:
        "Rank named models observed in the published daily top-25 slice by exact public OpenRouter-wide ecosystem token volume for a caller-selected calendar window. Rolling-30-day app totals, latest-observed-day app-model rows, and the producer-selected top-axis matrix remain separate labelled evidence sections.",
      inputSchema: usageLeadersInputSchema,
      outputSchema: usageLeadersOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (input) => toolResult(await runUsageLeaders(input, dependencies)),
  );
}

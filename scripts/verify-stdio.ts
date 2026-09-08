import { isDeepStrictEqual } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import type { ZodType } from "zod";

import {
  freeModelsInputSchema,
  freeModelsOutputSchema,
  type FreeModelsOutput,
} from "../src/tools/free-models.js";
import { benchmarksOutputSchema } from "../src/tools/benchmarks.js";
import { githubMoversOutputSchema } from "../src/tools/github-movers.js";
import { githubTrendingOutputSchema } from "../src/tools/github-trending.js";
import { keyInventoryOutputSchema } from "../src/tools/key-inventory.js";
import { modelEconomicsOutputSchema } from "../src/tools/model-economics.js";
import { matrixOutputSchema } from "../src/tools/matrix.js";
import {
  modelStatusInputSchema,
  modelStatusOutputSchema,
  type ModelStatusOutput,
} from "../src/tools/model-status.js";
import {
  resolveModelInputSchema,
  resolveModelOutputSchema,
  type ResolveModelOutput,
} from "../src/tools/resolve-model.js";
import { sourceHealthOutputSchema } from "../src/tools/source-health.js";
import { usageLeadersOutputSchema } from "../src/tools/usage-leaders.js";
import { whatsChangedOutputSchema } from "../src/tools/whats-changed.js";

import {
  allocateDeadDashboardUrl,
  startFixtureDashboard,
  type FixtureDashboard,
} from "./fixture-dashboard.js";

export type VerificationMode =
  | "live"
  | "fixture"
  | "offline"
  | "html"
  | "alien-cwd";

type ToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

type ToolCallEvidence = ToolCall & {
  elapsedMs: number;
  structuredContent: unknown;
};

type VerificationEvidence = {
  mode: VerificationMode;
  startedAt: string;
  finishedAt: string;
  elapsedMs: number;
  timings: {
    connectMs: number;
    initialListMs: number;
    finalListMs: number;
    closeMs: number;
  };
  toolDefinitions: unknown[];
  calls: ToolCallEvidence[];
};

export const EXPECTED_TOOL_NAMES = [
  "dashboard_benchmarks",
  "dashboard_catalogue",
  "dashboard_free_models",
  "dashboard_github_movers",
  "dashboard_github_trending",
  "dashboard_key_inventory",
  "dashboard_matrix",
  "dashboard_model_economics",
  "dashboard_model_status",
  "dashboard_resolve_model",
  "dashboard_source_health",
  "dashboard_usage_leaders",
  "dashboard_whats_changed",
] as const;

export const STANDARD_CALLS = [
  { name: "dashboard_benchmarks", arguments: { limit: 50 } },
  {
    name: "dashboard_resolve_model",
    arguments: {
      intent: "any_available",
      constraints: { outputModality: "text" },
      fallbackDepth: 3,
      verbose: true,
    },
  },
  {
    name: "dashboard_model_status",
    arguments: { slug: "groq/llama-3.3-70b-versatile" },
  },
  {
    name: "dashboard_whats_changed",
    arguments: { since: "2026-08-18", limit: 5 },
  },
  {
    name: "dashboard_free_models",
    arguments: { outputModality: "text", limit: 5 },
  },
  {
    name: "dashboard_usage_leaders",
    arguments: { windowDays: 7, limit: 5 },
  },
  { name: "dashboard_source_health", arguments: {} },
  {
    name: "dashboard_github_movers",
    arguments: { category: "mcp", windowDays: 7, limit: 5 },
  },
  {
    name: "dashboard_github_trending",
    arguments: { since: "daily", limit: 5 },
  },
  {
    name: "dashboard_model_economics",
    arguments: { outputModality: "text", limit: 5, discountEnrichment: 2 },
  },
  { name: "dashboard_key_inventory", arguments: {} },
  { name: "dashboard_matrix", arguments: {} },
] as const satisfies readonly ToolCall[];

export const DIAGNOSTIC_CALLS = [
  { name: "dashboard_benchmarks", arguments: { source: "openrouter", limit: 50 } },
  {
    name: "dashboard_resolve_model",
    arguments: {
      intent: "cheapest_capable",
      constraints: {
        free: true,
        minContext: "90071992547409930002",
        outputModality: "text",
      },
      fallbackDepth: 3,
      verbose: false,
    },
  },
  {
    name: "dashboard_model_status",
    arguments: { slug: "fixture/no-such-model" },
  },
  {
    name: "dashboard_whats_changed",
    arguments: { since: "2026-08-18", limit: 5 },
  },
  {
    name: "dashboard_free_models",
    arguments: { outputModality: "text", limit: 5 },
  },
  {
    name: "dashboard_usage_leaders",
    arguments: { windowDays: 7, limit: 3 },
  },
  { name: "dashboard_source_health", arguments: {} },
  {
    name: "dashboard_github_movers",
    arguments: { category: "mcp", windowDays: 7, limit: 3 },
  },
  {
    name: "dashboard_github_trending",
    arguments: { since: "daily", limit: 3 },
  },
  {
    name: "dashboard_model_economics",
    arguments: {
      // Keep the synthetic matrix confined to its three fixture providers;
      // otherwise the runtime also retrieves Sail's live pricing document.
      providers: ["openrouter", "groq", "cerebras"],
      ids: [
        "fixture/discounted",
        "fixture-groq/priced",
        "fixture-cerebras/bare",
        "fixture/no-such-model",
      ],
      discountEnrichment: 3,
    },
  },
  { name: "dashboard_key_inventory", arguments: {} },
  { name: "dashboard_matrix", arguments: {} },
] as const satisfies readonly ToolCall[];

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = fileURLToPath(new URL("../", import.meta.url));
const ENTRY_PATH = fileURLToPath(new URL("../build/index.js", import.meta.url));
const EVIDENCE_DIRECTORY = fileURLToPath(
  new URL("../verification/raw/", import.meta.url),
);
const LIVE_EVIDENCE_PATH = fileURLToPath(
  new URL("../verification/raw/live.json", import.meta.url),
);

const CONNECT_TIMEOUT_MS = 10_000;
const LIST_TIMEOUT_MS = 5_000;
const NEGATIVE_CALL_TIMEOUT_MS = 15_000;
const LIVE_CALL_TIMEOUT_MS = 60_000;
const CLOSE_TIMEOUT_MS = 7_000;
const OFFLINE_MAX_ELAPSED_MS = 11_500;
const MAX_RESULT_BYTES = 512 * 1024;
const MAX_DEFINITIONS_BYTES = 512 * 1024;
const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
const MAX_STDERR_BYTES = 64 * 1024;
const CAPABILITY_MESSAGE =
  "This tool needs /api/public/v2/live-models, which the dashboard is not currently publishing. Ask about deprecations or history instead, and check dashboard_source_health for which collector is failing.";

const OUTPUT_SCHEMAS_BY_TOOL = new Map<string, ZodType>([
  ["dashboard_benchmarks", benchmarksOutputSchema],
  ["dashboard_resolve_model", resolveModelOutputSchema],
  ["dashboard_model_status", modelStatusOutputSchema],
  ["dashboard_whats_changed", whatsChangedOutputSchema],
  ["dashboard_free_models", freeModelsOutputSchema],
  ["dashboard_usage_leaders", usageLeadersOutputSchema],
  ["dashboard_source_health", sourceHealthOutputSchema],
  ["dashboard_github_movers", githubMoversOutputSchema],
  ["dashboard_github_trending", githubTrendingOutputSchema],
  ["dashboard_model_economics", modelEconomicsOutputSchema],
  ["dashboard_key_inventory", keyInventoryOutputSchema],
  ["dashboard_matrix", matrixOutputSchema],
]);

const CREDENTIAL_FIELD_ALLOWLIST = new Set([
  "categorytokenshare",
  "completionusdpermilliontokens",
  "completionusdpertoken",
  "ecosystemtokenvolume",
  "ecosystemtokenvolumemovement",
  "previousecosystemtokenvolume",
  "promptusdpermilliontokens",
  "promptusdpertoken",
  "rolling30dayecosystemtokenvolume",
  // A Secret Manager resource NAME, never a value. The value-level scanner below
  // still applies to it, so a real key appearing here is still caught.
  "secretname",
  "tokenizer",
  "totaltokens",
]);

const CREDENTIAL_FIELD_NAME_PATTERN =
  /authorization|authentication|auth(?:token|header|key|secret|credential)|apikey|credential|password|passwd|secret|cookie|token|(?:access|private|client|signing|encryption)key|session(?:id|key|token|secret)/;

const FORBIDDEN_EVIDENCE_FIELDS = new Set([
  "body",
  "requestbody",
  "responsebody",
  "rawbody",
  "stack",
  "cause",
  "rawcause",
  "headers",
  "requestheaders",
  "responseheaders",
  "environment",
  "env",
]);

function normalizedFieldName(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
}

function credentialLikeValue(value: string): boolean {
  return (
    /\b(?:bearer|basic)\s+\S+/i.test(value) ||
    /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*\S+/i.test(
      value,
    ) ||
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value) ||
    /\bsk-[A-Za-z0-9_-]{16,}\b/.test(value) ||
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/.test(value) ||
    /\bAIza[A-Za-z0-9_-]{20,}\b/.test(value)
  );
}

export function assertEvidenceCredentialSafe(value: unknown): void {
  const visit = (current: unknown, pathParts: string[]): void => {
    if (typeof current === "string") {
      if (credentialLikeValue(current)) {
        throw new Error(`credential-like evidence value at ${pathParts.join(".")}`);
      }
      return;
    }
    if (current === null || typeof current !== "object") return;
    if (Array.isArray(current)) {
      current.forEach((entry, index) => visit(entry, [...pathParts, String(index)]));
      return;
    }
    for (const [key, entry] of Object.entries(current)) {
      const normalized = normalizedFieldName(key);
      if (
        !CREDENTIAL_FIELD_ALLOWLIST.has(normalized) &&
        CREDENTIAL_FIELD_NAME_PATTERN.test(normalized)
      ) {
        throw new Error(`credential-bearing evidence field at ${[...pathParts, key].join(".")}`);
      }
      visit(entry, [...pathParts, key]);
    }
  };
  visit(value, ["evidence"]);
}

function sanitizedUrl(value: string): string {
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
}

export function validateEvidenceValue(value: unknown): unknown {
  const validate = (current: unknown, pathParts: string[]): void => {
    if (current === null || typeof current !== "object") return;
    if (Array.isArray(current)) {
      current.forEach((entry, index) =>
        validate(entry, [...pathParts, String(index)]),
      );
      return;
    }
    for (const [key, entry] of Object.entries(current)) {
      if (FORBIDDEN_EVIDENCE_FIELDS.has(normalizedFieldName(key))) {
        throw new Error(
          `forbidden evidence field at ${[...pathParts, key].join(".")}`,
        );
      }
      validate(entry, [...pathParts, key]);
    }
  };
  validate(value, ["evidence"]);
  assertEvidenceCredentialSafe(value);
  return value;
}

function elapsedSince(started: number): number {
  return Math.round((performance.now() - started) * 100) / 100;
}

function withDeadline<T>(
  label: string,
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} exceeded ${timeoutMs}ms`)),
      timeoutMs,
    );
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function timed<T>(
  label: string,
  operation: () => Promise<T>,
  timeoutMs: number,
): Promise<{ value: T; elapsedMs: number }> {
  const started = performance.now();
  const value = await withDeadline(label, operation(), timeoutMs);
  return { value, elapsedMs: elapsedSince(started) };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value as Record<string, unknown>;
}

function containsFieldValue(
  value: unknown,
  key: string,
  expected: unknown,
): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((entry) => containsFieldValue(entry, key, expected));
  }
  const record = value as Record<string, unknown>;
  if (record[key] === expected) return true;
  return Object.values(record).some((entry) =>
    containsFieldValue(entry, key, expected),
  );
}

function containsForbiddenDiagnosticField(value: unknown): boolean {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) {
    return value.some((entry) => containsForbiddenDiagnosticField(entry));
  }
  for (const [key, entry] of Object.entries(value)) {
    if (FORBIDDEN_EVIDENCE_FIELDS.has(normalizedFieldName(key))) return true;
    if (containsForbiddenDiagnosticField(entry)) return true;
  }
  return false;
}

export function assertToolDefinitions(tools: unknown[]): void {
  const records = tools.map((tool, index) => asRecord(tool, `tool ${index}`));
  const names = records
    .map((tool) => String(tool.name))
    .sort((left, right) => left.localeCompare(right));
  if (!isDeepStrictEqual(names, [...EXPECTED_TOOL_NAMES])) {
    throw new Error(`unexpected tool names: ${JSON.stringify(names)}`);
  }
  for (const tool of records) {
    if (
      !isDeepStrictEqual(tool.annotations, {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      })
    ) {
      throw new Error(`unexpected annotations for ${String(tool.name)}`);
    }
    if (tool.inputSchema === undefined || tool.outputSchema === undefined) {
      throw new Error(`missing schema for ${String(tool.name)}`);
    }
  }
  if (Buffer.byteLength(JSON.stringify(tools)) > MAX_DEFINITIONS_BYTES) {
    throw new Error("tool definitions exceed the evidence cap");
  }
}

export function assertMatchingTextContent(
  result: Record<string, unknown>,
  structuredContent: unknown,
): void {
  const content = result.content;
  if (!Array.isArray(content)) throw new Error("tool result content is not an array");
  const text = content.find(
    (item) =>
      item !== null &&
      typeof item === "object" &&
      (item as Record<string, unknown>).type === "text",
  ) as Record<string, unknown> | undefined;
  if (text === undefined || typeof text.text !== "string") {
    throw new Error("tool result has no JSON text content");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.text) as unknown;
  } catch {
    throw new Error("tool text content is not JSON");
  }
  if (!isDeepStrictEqual(parsed, structuredContent)) {
    throw new Error("tool text and structuredContent differ");
  }
}

export function assertFixtureResult(name: string, structuredContent: unknown): void {
  const schema = OUTPUT_SCHEMAS_BY_TOOL.get(name);
  if (schema === undefined) throw new Error(`no output schema for ${name}`);
  const parsed = schema.safeParse(structuredContent);
  if (!parsed.success) {
    throw new Error(`${name} failed its exported output schema`);
  }
  const output = asRecord(parsed.data, `${name} structuredContent`);
  if (output.status === "error") throw new Error(`${name} fixture returned error`);

  if (name === "dashboard_benchmarks") {
    const response = asRecord(output.response, "fixture benchmark response");
    const rows = Array.isArray(response.data) ? response.data : [];
    if (rows.length !== 1 || response.stale !== true) {
      throw new Error("fixture benchmarks lost their row or stale evidence");
    }
    const row = asRecord(rows[0], "fixture benchmark row");
    if (row.modelPermaslug !== "fixture/benchmark-unknown" || row.source !== "openrouter") {
      throw new Error("fixture benchmark identity or source changed");
    }
    if (row.primaryScore !== null || row.accuracy !== null) {
      throw new Error("fixture replaced an unknown benchmark score");
    }
  }
  if (name === "dashboard_github_trending") {
    if (output.collectedAt !== "2026-08-19T06:00:00.000Z") {
      throw new Error("fixture trending changed the collection time");
    }
    const rows = Array.isArray(output.repositories) ? output.repositories : [];
    const cap = asRecord(output.cap, "fixture trending cap");
    if (rows.length !== cap.limit || cap.reached !== true) {
      throw new Error("fixture trending did not apply its result limit");
    }
    if (rows.some((entry, index) => {
      const row = asRecord(entry, "fixture trending row");
      return row.fullName !== `fixture/trending-${index + 1}` || row.starsGained !== null;
    })) {
      throw new Error("fixture trending changed row order or invented gained stars");
    }
  }
  if (name === "dashboard_resolve_model") {
    if (output.unsatisfiable !== true) throw new Error("fixture resolver is satisfiable");
    if (!Array.isArray(output.resolved) || output.resolved.length !== 0) {
      throw new Error("fixture resolver selected a candidate");
    }
    if (!Array.isArray(output.excluded) || output.excluded.length === 0) {
      throw new Error("fixture resolver did not explain exclusions");
    }
    if (
      !containsFieldValue(output.excluded, "reason", "disappeared") ||
      !containsFieldValue(output.excluded, "reason", "pricing_not_published")
    ) {
      throw new Error("fixture resolver omitted unknown/disappeared exclusions");
    }
  }
  if (name === "dashboard_model_economics") {
    const models = Array.isArray(output.models) ? output.models : [];
    const byId = new Map(
      models.map((entry) => {
        const record = asRecord(entry, "economics model");
        return [String(record.id), record];
      }),
    );

    // All three providers must survive into one comparable answer. A tool that
    // silently returns only OpenRouter is the exact failure this server exists
    // to avoid, so it is asserted rather than assumed.
    const providers = Array.isArray(output.providers) ? output.providers : [];
    const providerIds = providers
      .map((entry) => String(asRecord(entry, "provider report").provider))
      .sort();
    if (!isDeepStrictEqual(providerIds, ["cerebras", "groq", "openrouter"])) {
      throw new Error("fixture economics did not report all three providers");
    }

    const discounted = byId.get("fixture/discounted");
    if (discounted === undefined) {
      throw new Error("fixture economics omitted the discounted model");
    }
    if (discounted.discountCoverage !== "discounted") {
      throw new Error("fixture economics did not report the published discount");
    }
    const discount = asRecord(discounted.bestDiscount, "fixture discount");
    if (
      discount.percentOff !== "43.2" ||
      discount.providerName !== "FixtureProvider" ||
      discount.expiresAt !== null ||
      discount.expiryPublished !== false
    ) {
      throw new Error("fixture economics misreported the discount or invented an expiry");
    }

    // Groq publishes a price but no lifecycle, so its risk must read as
    // unforeseeable rather than as a reassuring "none".
    const groq = byId.get("fixture-groq/priced");
    if (groq === undefined) throw new Error("fixture economics omitted the Groq model");
    if (groq.priceComparable !== true) {
      throw new Error("fixture economics failed to rank a priced Groq model");
    }
    if (groq.retirementRisk !== "not_published_by_provider") {
      throw new Error("fixture economics claimed a lifecycle Groq does not publish");
    }
    if (groq.discountCoverage !== "not_published_by_provider") {
      throw new Error("fixture economics implied Groq publishes discounts");
    }
    if (groq.supportsTools !== null) {
      throw new Error("fixture economics claimed tool support Groq does not publish");
    }

    // This fixture represents the current Cerebras connector's unpriced rows:
    // keep and explain them, without treating them as free.
    const cerebras = byId.get("fixture-cerebras/bare");
    if (cerebras === undefined) {
      throw new Error("fixture economics dropped the unpriced Cerebras model");
    }
    if (cerebras.priceComparable !== false || cerebras.genuinelyFree !== false) {
      throw new Error("fixture economics treated an unpriced model as rankable or free");
    }
    if (cerebras.emitsText !== null) {
      throw new Error("fixture economics invented a modality absent from the Cerebras fixture");
    }
    if (typeof cerebras.unrankableReason !== "string" || cerebras.unrankableReason === "") {
      throw new Error("fixture economics left an unpriced model unexplained");
    }

    // Priced rows rank ahead of unrankable ones.
    const cheapest = asRecord(models[0], "cheapest economics model");
    if (cheapest.id !== "fixture-groq/priced") {
      throw new Error("fixture economics did not rank the cheapest priced model first");
    }
    if (String(asRecord(models[models.length - 1], "last model").id) !== "fixture-cerebras/bare") {
      throw new Error("fixture economics did not place the unrankable model last");
    }

    const comparability = asRecord(output.comparability, "comparability");
    if (comparability.priceComparable !== 2 || comparability.priceUnknown !== 1) {
      throw new Error("fixture economics miscounted price comparability");
    }

    if (!Array.isArray(output.missingIds) || !output.missingIds.includes("fixture/no-such-model")) {
      throw new Error("fixture economics did not name the vanished pinned id");
    }
  }
  if (name === "dashboard_whats_changed") {
    const price = asRecord(output.priceChanges, "price changes");
    if (price.status !== "available") {
      throw new Error(`fixture price changes were not available (${String(price.status)})`);
    }
    const becamePaid = Array.isArray(price.becamePaid) ? price.becamePaid : [];
    const ids = becamePaid.map((entry) => asRecord(entry, "became paid").modelId);
    if (!isDeepStrictEqual(ids, ["fixture/was-free"])) {
      throw new Error("fixture did not surface the model that left free");
    }
    const row = asRecord(becamePaid[0], "became paid row");
    if (row.wasFree !== true || row.isFree !== false) {
      throw new Error("fixture misreported the free-to-paid transition");
    }
    // A price decrease must not be filed under the money-losing bucket.
    const other = Array.isArray(price.otherChanges) ? price.otherChanges : [];
    if (!isDeepStrictEqual(other.map((entry) => asRecord(entry, "other").modelId), ["fixture/got-cheaper"])) {
      throw new Error("fixture mixed other price movement into becamePaid");
    }
  }
  if (name === "dashboard_key_inventory") {
    if (output.status !== "unconfigured") {
      throw new Error("fixture key inventory must stay dormant without configured keys");
    }
  }
  if (name === "dashboard_model_status") {
    if (output.status !== "not_found") throw new Error("fixture model unexpectedly found");
    if (!Array.isArray(output.suggestions) || output.suggestions.length === 0) {
      throw new Error("fixture model status has no suggestions");
    }
  }
  if (name === "dashboard_free_models") {
    const liveCandidates = asRecord(output.liveCandidates, "liveCandidates");
    const data = liveCandidates.data;
    if (!Array.isArray(data) || data.length !== 1) {
      throw new Error("fixture free-model filter returned the wrong count");
    }
    const model = asRecord(data[0], "free model");
    if (
      model.id !== "fixture/free-text" ||
      model.availability !== "available" ||
      model.isFree !== true
    ) {
      throw new Error("fixture free-model filter selected an invalid row");
    }
  }
  if (name === "dashboard_source_health") {
    if (!containsFieldValue(output, "sourceId", "benchmarks_current")) {
      throw new Error("fixture source health omitted benchmark evidence");
    }
    if (!containsFieldValue(output, "stale", true)) {
      throw new Error("fixture source health omitted stale evidence");
    }
  }
}

function assertResolveModelLiveInvariants(
  output: ResolveModelOutput,
  inputArguments: Record<string, unknown>,
): void {
  if (output.status !== "ok") return;
  const input = resolveModelInputSchema.parse(inputArguments);
  const { minContext, ...otherConstraints } = input.constraints;
  const expectedConstraints = {
    ...otherConstraints,
    ...(minContext === undefined ? {} : { minContext: String(minContext) }),
  };
  if (
    output.intent !== input.intent ||
    !isDeepStrictEqual(output.constraints, expectedConstraints)
  ) {
    throw new Error("resolver output does not match the requested intent/constraints");
  }
  if (
    output.resolved.length !==
      Math.min(output.cap.eligibleCount, input.fallbackDepth) ||
    output.cap.resolvedLimit !== input.fallbackDepth ||
    output.cap.resolvedCount !== output.resolved.length ||
    output.cap.excludedCount !== output.excluded.length ||
    output.cap.eligibleCount < output.resolved.length ||
    output.cap.fallbackTruncated !==
      (output.cap.eligibleCount > output.resolved.length) ||
    output.unsatisfiable !== (output.resolved.length === 0)
  ) {
    throw new Error("resolver output violates requested bounds or count invariants");
  }

  const resolvedKeys = new Set<string>();
  for (const [index, model] of output.resolved.entries()) {
    const key = `${model.provider}\u0000${model.id}`;
    if (resolvedKeys.has(key) || model.rank !== index + 1) {
      throw new Error("resolver output repeats or misranks a resolved model");
    }
    resolvedKeys.add(key);
    if (model.availability !== "available") {
      throw new Error("resolver output contains a non-available resolved model");
    }
    if (
      input.constraints.free !== undefined &&
      model.isFree !== input.constraints.free
    ) {
      throw new Error("resolver output selected unknown or mismatched pricing");
    }
    if (minContext !== undefined) {
      if (
        model.contextLength === null ||
        BigInt(model.contextLength) < BigInt(String(minContext))
      ) {
        throw new Error("resolver output selected unknown or insufficient context");
      }
    }
    if (
      input.constraints.providers !== undefined &&
      !input.constraints.providers.includes(model.provider)
    ) {
      throw new Error("resolver output selected an unrequested provider");
    }
    const needsConstraintDetails =
      input.constraints.outputModality !== undefined ||
      input.constraints.reasoning !== undefined ||
      input.constraints.requireProviderActive !== undefined;
    if (needsConstraintDetails) {
      const details = model.details;
      if (
        details === undefined ||
        details.id !== model.id ||
        details.provider !== model.provider
      ) {
        throw new Error("resolver output cannot prove requested candidate constraints");
      }
      if (
        input.constraints.outputModality !== undefined &&
        !details.outputModalities?.includes(input.constraints.outputModality)
      ) {
        throw new Error("resolver output selected the wrong output modality");
      }
      if (
        input.constraints.reasoning !== undefined &&
        (input.constraints.reasoning === false ||
          details.reasoningEfforts === null)
      ) {
        throw new Error("resolver output selected a reasoning mismatch");
      }
      if (
        input.constraints.requireProviderActive !== undefined &&
        details.providerActive !== true
      ) {
        throw new Error("resolver output selected an inactive or unknown provider");
      }
    }
  }
  for (const model of output.excluded) {
    if (resolvedKeys.has(`${model.provider}\u0000${model.id}`)) {
      throw new Error("resolver output selected an excluded model");
    }
  }
}

function assertModelStatusLiveInvariants(
  output: ModelStatusOutput,
  inputArguments: Record<string, unknown>,
): void {
  const input = modelStatusInputSchema.parse(inputArguments);
  if (output.status === "ok" && output.model.id !== input.slug) {
    throw new Error("model status returned a different model than requested");
  }
  if (
    output.status === "not_found" &&
    output.suggestions.includes(input.slug)
  ) {
    throw new Error("model status suggested the exact supposedly missing model");
  }
}

function isZeroExactDecimal(value: string | null): boolean {
  return value !== null && /^0(?:\.0+)?$/.test(value);
}

function assertFreeModelsLiveInvariants(
  output: FreeModelsOutput,
  inputArguments: Record<string, unknown>,
): void {
  if (output.status !== "ok" && output.status !== "partial") return;
  const input = freeModelsInputSchema.parse(inputArguments);
  if (
    output.query.outputModality !== input.outputModality ||
    output.query.limit !== input.limit ||
    output.query.outputModalityDefaulted !==
      (inputArguments.outputModality === undefined)
  ) {
    throw new Error("free-model output does not match the requested query");
  }
  const live = output.liveCandidates;
  const excludedCount =
    live.cap.excludedUnavailableCount +
    live.cap.excludedNotFreeCount +
    live.cap.excludedUnknownPriceCount +
    live.cap.excludedModalityCount;
  if (
    live.data.length > input.limit ||
    live.cap.requestedLimit !== input.limit ||
    live.cap.returnedCount !== live.data.length ||
    live.cap.examinedCount !== live.data.length + excludedCount
  ) {
    throw new Error("free-model live candidates violate requested bounds or counts");
  }
  for (const model of live.data) {
    if (
      model.availability !== "available" ||
      model.isFree !== true ||
      model.freeKind !== "concrete_free" ||
      !isZeroExactDecimal(model.pricing.promptUsdPerToken) ||
      !isZeroExactDecimal(model.pricing.completionUsdPerToken) ||
      !model.outputModalities?.includes(input.outputModality)
    ) {
      throw new Error("free-model output contains an unavailable or non-free row");
    }
  }

  const catalogue = output.openRouterCatalogue;
  if (
    catalogue.data.length > input.limit ||
    catalogue.cap.requestedLimit !== input.limit ||
    catalogue.cap.returnedCount !== catalogue.data.length ||
    catalogue.data.some((model) => model.freeKind !== "concrete_free") ||
    (catalogue.router !== null && catalogue.router.freeKind !== "free_router")
  ) {
    throw new Error("free-model catalogue violates requested bounds or free classes");
  }
}

export function assertModeResult(
  mode: VerificationMode,
  name: string,
  structuredContent: unknown,
  elapsedMs: number,
  inputArguments: Record<string, unknown> = {},
): void {
  const schema = OUTPUT_SCHEMAS_BY_TOOL.get(name);
  if (schema === undefined) throw new Error(`no output schema for ${name}`);
  const parsed = schema.safeParse(structuredContent);
  if (!parsed.success) {
    throw new Error(`${name} failed its exported output schema`);
  }
  const schemaValidatedContent = parsed.data;

  // The key inventory is the one tool that does not read DASHBOARD_BASE_URL, so
  // pointing the dashboard at a dead or HTML-serving host says nothing about it.
  // It must still parse its own schema — asserted above — but demanding dashboard
  // failure evidence from a tool that never called the dashboard would be testing
  // a claim the tool does not make. It is exercised by its own unit tests instead.
  const readsDashboard = name !== "dashboard_key_inventory";

  if (mode === "offline") {
    if (!readsDashboard) return;
    if (!containsFieldValue(schemaValidatedContent, "kind", "unreachable")) {
      throw new Error(`${name} did not return structured unreachable evidence`);
    }
    if (elapsedMs >= OFFLINE_MAX_ELAPSED_MS) {
      throw new Error(`${name} offline call exceeded ${OFFLINE_MAX_ELAPSED_MS}ms`);
    }
    return;
  }
  if (mode === "html") {
    if (!readsDashboard) return;
    if (!containsFieldValue(schemaValidatedContent, "kind", "non_json")) {
      throw new Error(`${name} did not return structured non_json evidence`);
    }
    const serialized = JSON.stringify(structuredContent);
    if (
      serialized.includes("fixture-html-body") ||
      serialized.includes("<p>") ||
      containsForbiddenDiagnosticField(structuredContent)
    ) {
      throw new Error(`${name} leaked HTML or diagnostic internals`);
    }
    return;
  }
  if (mode === "fixture") {
    assertFixtureResult(name, schemaValidatedContent);
    return;
  }

  const output = asRecord(parsed.data, `${name} structuredContent`);
  if (output.status === "error") {
    throw new Error(`${name} live verification returned a top-level error`);
  }
  if (
    [
      "dashboard_resolve_model",
      "dashboard_model_status",
      "dashboard_free_models",
    ].includes(name) &&
    output.status === "unavailable" &&
    (output.missingCapability !== "/api/public/v2/live-models" ||
      output.summary !== CAPABILITY_MESSAGE ||
      output.message !== CAPABILITY_MESSAGE)
  ) {
    throw new Error(`${name} returned the wrong live-models capability decline`);
  }
  if (name === "dashboard_resolve_model") {
    assertResolveModelLiveInvariants(
      parsed.data as ResolveModelOutput,
      inputArguments,
    );
  } else if (name === "dashboard_model_status") {
    assertModelStatusLiveInvariants(
      parsed.data as ModelStatusOutput,
      inputArguments,
    );
  } else if (name === "dashboard_free_models") {
    assertFreeModelsLiveInvariants(
      parsed.data as FreeModelsOutput,
      inputArguments,
    );
  }
}

function toolDefinitionForEvidence(tool: unknown): unknown {
  const record = asRecord(tool, "tool definition");
  return {
    name: record.name,
    title: record.title,
    description: record.description,
    inputSchema: record.inputSchema,
    outputSchema: record.outputSchema,
    annotations: record.annotations,
  };
}

function topLevelShape(value: unknown): unknown {
  const record = asRecord(value, "structuredContent");
  return {
    keys: Object.keys(record).sort((left, right) => left.localeCompare(right)),
    status: typeof record.status === "string" ? record.status : null,
  };
}

async function assertAlienMatchesLive(calls: ToolCallEvidence[]): Promise<void> {
  const live = JSON.parse(await readFile(LIVE_EVIDENCE_PATH, "utf8")) as unknown;
  const liveRecord = asRecord(live, "live evidence");
  if (!Array.isArray(liveRecord.calls)) throw new Error("live evidence has no calls");
  const liveCalls = liveRecord.calls.map((call) => asRecord(call, "live call"));
  if (liveCalls.length !== calls.length) throw new Error("alien/live call count differs");
  for (let index = 0; index < calls.length; index += 1) {
    const alienCall = calls[index];
    const liveCall = liveCalls[index];
    if (alienCall === undefined || liveCall === undefined) {
      throw new Error("alien/live call matrix differs");
    }
    if (alienCall.name !== liveCall.name) throw new Error("alien/live tool order differs");
    if (
      !isDeepStrictEqual(
        topLevelShape(alienCall.structuredContent),
        topLevelShape(liveCall.structuredContent),
      )
    ) {
      throw new Error(`${alienCall.name} alien/live result shape differs`);
    }
  }
}

function reviewStderr(chunks: Buffer[], overflowed: boolean): string {
  if (overflowed) throw new Error("child stderr exceeded its evidence cap");
  const bytes = Buffer.concat(chunks);
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("child stderr is not valid UTF-8");
  }
  const withoutAnsi = text.replace(/\u001b\[[0-9;]*m/g, "");
  const scrubbed = withoutAnsi.replace(/https?:\/\/[^\s)\]}]+/g, (match) =>
    sanitizedUrl(match),
  );
  assertEvidenceCredentialSafe({ reviewedStderr: scrubbed });
  return scrubbed;
}

async function writeEvidence(
  evidence: VerificationEvidence,
  reviewedStderr: string,
): Promise<string> {
  const validatedEvidence = validateEvidenceValue(evidence);
  const serialized = `${JSON.stringify(validatedEvidence, null, 2)}\n`;
  if (Buffer.byteLength(serialized) > MAX_EVIDENCE_BYTES) {
    throw new Error("verification evidence exceeds its total cap");
  }
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  const evidencePath = path.join(EVIDENCE_DIRECTORY, `${evidence.mode}.json`);
  const stderrPath = path.join(
    EVIDENCE_DIRECTORY,
    `${evidence.mode}.stderr.txt`,
  );
  await writeFile(evidencePath, serialized, "utf8");
  await writeFile(stderrPath, reviewedStderr, "utf8");
  return evidencePath;
}

function callMatrix(mode: VerificationMode): readonly ToolCall[] {
  return mode === "fixture" ? DIAGNOSTIC_CALLS : STANDARD_CALLS;
}

function childCwd(mode: VerificationMode): string | undefined {
  if (mode !== "alien-cwd") return undefined;
  const root = path.parse(process.execPath).root;
  if (path.resolve(root).toLocaleLowerCase() === path.resolve(PROJECT_ROOT).toLocaleLowerCase()) {
    throw new Error("alien cwd is not distinct from the project root");
  }
  return root;
}

async function prepareMode(mode: VerificationMode): Promise<{
  fixture: FixtureDashboard | undefined;
  baseUrl: string | undefined;
}> {
  if (mode === "fixture" || mode === "html") {
    const fixture = await withDeadline(
      `${mode} fixture startup`,
      startFixtureDashboard({ mode }),
      CONNECT_TIMEOUT_MS,
    );
    return { fixture, baseUrl: fixture.baseUrl };
  }
  if (mode === "offline") {
    return {
      fixture: undefined,
      baseUrl: await withDeadline(
        "offline port allocation",
        allocateDeadDashboardUrl(),
        CONNECT_TIMEOUT_MS,
      ),
    };
  }
  return { fixture: undefined, baseUrl: undefined };
}

export async function runVerification(mode: VerificationMode): Promise<string> {
  const startedAt = new Date();
  const overallStarted = performance.now();
  const prepared = await prepareMode(mode);
  const cwd = childCwd(mode);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [ENTRY_PATH],
    ...(prepared.baseUrl === undefined
      ? {}
      : { env: { DASHBOARD_BASE_URL: prepared.baseUrl } }),
    ...(cwd === undefined ? {} : { cwd }),
    stderr: "pipe",
  });
  const stderrChunks: Buffer[] = [];
  let stderrBytes = 0;
  let stderrOverflowed = false;
  transport.stderr?.on("data", (chunk: unknown) => {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    stderrBytes += bytes.length;
    if (stderrBytes > MAX_STDERR_BYTES) {
      stderrOverflowed = true;
      void transport.close();
      return;
    }
    stderrChunks.push(bytes);
  });

  const client = new Client({
    name: "dashboard-stdio-verifier",
    version: "0.1.0",
  });
  const timings = {
    connectMs: 0,
    initialListMs: 0,
    finalListMs: 0,
    closeMs: 0,
  };
  const calls: ToolCallEvidence[] = [];
  let toolDefinitions: unknown[] = [];
  let operationError: unknown;

  try {
    const connected = await timed(
      "MCP connect",
      () =>
        client.connect(transport, {
          timeout: CONNECT_TIMEOUT_MS,
          maxTotalTimeout: CONNECT_TIMEOUT_MS,
        }),
      CONNECT_TIMEOUT_MS,
    );
    timings.connectMs = connected.elapsedMs;

    const initialList = await timed(
      "initial tools/list",
      () =>
        client.listTools(undefined, {
          timeout: LIST_TIMEOUT_MS,
          maxTotalTimeout: LIST_TIMEOUT_MS,
        }),
      LIST_TIMEOUT_MS,
    );
    timings.initialListMs = initialList.elapsedMs;
    toolDefinitions = initialList.value.tools;
    assertToolDefinitions(toolDefinitions);

    const callTimeoutMs =
      mode === "live" || mode === "alien-cwd"
        ? LIVE_CALL_TIMEOUT_MS
        : NEGATIVE_CALL_TIMEOUT_MS;
    for (const call of callMatrix(mode)) {
      const result = await timed(
        `${call.name} tools/call`,
        () =>
          client.callTool(
            { name: call.name, arguments: call.arguments },
            { timeout: callTimeoutMs, maxTotalTimeout: callTimeoutMs },
          ),
        callTimeoutMs,
      );
      const resultRecord = asRecord(result.value, `${call.name} result`);
      if (resultRecord.isError === true) {
        throw new Error(`${call.name} returned MCP isError`);
      }
      if (resultRecord.structuredContent === undefined) {
        throw new Error(`${call.name} returned no structuredContent`);
      }
      assertMatchingTextContent(resultRecord, resultRecord.structuredContent);
      const resultBytes = Buffer.byteLength(
        JSON.stringify(resultRecord.structuredContent),
      );
      if (resultBytes > MAX_RESULT_BYTES) {
        throw new Error(`${call.name} structuredContent exceeds the evidence cap`);
      }
      assertModeResult(
        mode,
        call.name,
        resultRecord.structuredContent,
        result.elapsedMs,
        call.arguments,
      );
      calls.push({
        name: call.name,
        arguments: call.arguments,
        elapsedMs: result.elapsedMs,
        structuredContent: resultRecord.structuredContent,
      });
    }

    const finalList = await timed(
      "final tools/list",
      () =>
        client.listTools(undefined, {
          timeout: LIST_TIMEOUT_MS,
          maxTotalTimeout: LIST_TIMEOUT_MS,
        }),
      LIST_TIMEOUT_MS,
    );
    timings.finalListMs = finalList.elapsedMs;
    assertToolDefinitions(finalList.value.tools);
    const finalNames = finalList.value.tools
      .map((tool) => tool.name)
      .sort((left, right) => left.localeCompare(right));
    const initialNames = toolDefinitions
      .map((tool) => asRecord(tool, "tool").name)
      .sort((left, right) => String(left).localeCompare(String(right)));
    if (!isDeepStrictEqual(finalNames, initialNames)) {
      throw new Error("tool list changed during verification");
    }

    if (mode === "alien-cwd") await assertAlienMatchesLive(calls);
  } catch (error) {
    operationError = error;
  } finally {
    const closeStarted = performance.now();
    try {
      await withDeadline("MCP close", client.close(), CLOSE_TIMEOUT_MS);
    } catch (error) {
      if (operationError === undefined) operationError = error;
      try {
        await withDeadline(
          "transport close fallback",
          transport.close(),
          CLOSE_TIMEOUT_MS,
        );
      } catch {
        // Preserve the first close or operation failure.
      }
    }
    timings.closeMs = elapsedSince(closeStarted);
    if (prepared.fixture !== undefined) {
      try {
        await withDeadline(
          `${mode} fixture close`,
          prepared.fixture.close(),
          CLOSE_TIMEOUT_MS,
        );
      } catch (error) {
        if (operationError === undefined) operationError = error;
      }
    }
  }

  if (operationError !== undefined) throw operationError;
  const reviewedStderr = reviewStderr(stderrChunks, stderrOverflowed);
  const finishedAt = new Date();
  const evidence: VerificationEvidence = {
    mode,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    elapsedMs: elapsedSince(overallStarted),
    timings,
    toolDefinitions: toolDefinitions.map((tool) => toolDefinitionForEvidence(tool)),
    calls,
  };
  return writeEvidence(evidence, reviewedStderr);
}

function parseMode(argv: readonly string[]): VerificationMode {
  const index = argv.indexOf("--mode");
  const value =
    index === -1
      ? argv.find((argument) => argument.startsWith("--mode="))?.slice(7)
      : argv[index + 1];
  if (
    value !== "live" &&
    value !== "fixture" &&
    value !== "offline" &&
    value !== "html" &&
    value !== "alien-cwd"
  ) {
    throw new Error("--mode must be live, fixture, offline, html, or alien-cwd");
  }
  return value;
}

function isMainModule(): boolean {
  const invokedPath = process.argv[1];
  if (invokedPath === undefined) return false;
  const normalize = (value: string) =>
    path.normalize(value).toLocaleLowerCase();
  return normalize(invokedPath) === normalize(SCRIPT_PATH);
}

if (isMainModule()) {
  runVerification(parseMode(process.argv.slice(2))).then(
    (evidencePath) => {
      process.stderr.write(`stdio verification evidence: ${evidencePath}\n`);
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`stdio verification failed: ${message}\n`);
      process.exitCode = 1;
    },
  );
}

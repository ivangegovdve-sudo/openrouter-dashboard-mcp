import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import { READ_ONLY_TOOL_ANNOTATIONS, toolResult } from "./shared.js";

/**
 * dashboard_resolve_seat -- a thin, read-only advisory client of the model-router's
 * POST /v1/seats/resolve. The router (github.com/ivangegovdve-sudo/model-router) is the single
 * authority on which provider/seat fills a role; this tool never re-implements that decision and
 * never falls back to dashboard_resolve_model when the router is unreachable -- it says so.
 * No inference and no spend happens on the returned seat.
 */

/** Pool order, mirrored from the router; test/fixtures/seat-pool.json is the shared fixture. */
export const SEAT_POOL = ["sail", "codex", "antigravity", "local", "openrouter"] as const;
/** Never selected under any policy: Claude (Dispatch chat) and Cerebras (Chloe). */
export const SEAT_EXCLUDED = ["claude", "anthropic", "cerebras"] as const;
export const SEAT_ROLES = ["review", "fix", "rebase", "council", "general"] as const;
export const SEAT_POLICIES = ["cheapest", "free-only"] as const;
export const DEFAULT_ROUTER_URL = "http://127.0.0.1:7480";
export const ROUTER_TIMEOUT_MS = 30_000;

export const resolveSeatInputSchema = z.object({
  consumer: z.string().min(1).max(64).describe("glass-solver | private-council | public-council. Policy is server config per consumer."),
  role: z.enum(SEAT_ROLES).default("general"),
  policy: z.enum(SEAT_POLICIES).optional().describe("May tighten the consumer's policy to free-only; can never loosen it."),
  excludeFamilies: z.array(z.string().min(1)).max(16).default([]).describe("Base-weight families to avoid, e.g. the PR author's. Unknown family counts as a conflict."),
  excludeSeats: z.array(z.string().min(1)).max(32).default([]),
  needsTools: z.boolean().default(false),
  minContext: z.number().int().positive().optional(),
  maxUsdPerM: z.number().positive().optional(),
  task: z.string().max(4000).optional().describe("Bounded task summary for the Jev switching layer; treated as data."),
}).strict();

const consideredSchema = z.object({
  seat: z.string(), verdict: z.string(), because: z.string(),
  tier: z.number().int(), family: z.string().nullable(), usd_per_mtok: z.string().nullable(),
}).passthrough();

export const resolveSeatOutputSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("seat"),
    policy: z.enum(SEAT_POLICIES),
    seat: z.string(), provider: z.string(), family: z.string().nullable(), tier: z.number().int(),
    costBasis: z.string(), usdPerMtok: z.string().nullable(),
    invoke: z.record(z.string(), z.unknown()),
    because: z.string(), jev: z.record(z.string(), z.unknown()),
    decisionId: z.string(), considered: z.array(consideredSchema),
    pool: z.object({ order: z.array(z.string()), excluded: z.array(z.string()) }).strict(),
  }).strict(),
  z.object({
    status: z.literal("unavailable"),
    policy: z.enum(SEAT_POLICIES), because: z.string(), decisionId: z.string().nullable(),
    considered: z.array(consideredSchema),
    note: z.string(),
  }).strict(),
  z.object({
    status: z.literal("router_unreachable"),
    routerUrl: z.string(), detail: z.string(), note: z.string(),
  }).strict(),
  z.object({
    status: z.literal("rejected"), httpStatus: z.number().int(), detail: z.string(),
  }).strict(),
]);
export type ResolveSeatOutput = z.infer<typeof resolveSeatOutputSchema>;

export interface ResolveSeatOptions {
  fetchImpl?: typeof fetch;
  routerUrl?: string;
  /** Bearer token for a router that requires one. Read from env by the caller; never logged. */
  token?: string;
}

export async function runResolveSeat(raw: z.input<typeof resolveSeatInputSchema>, options: ResolveSeatOptions = {}): Promise<ResolveSeatOutput> {
  const input = resolveSeatInputSchema.parse(raw);
  const routerUrl = (options.routerUrl ?? process.env.MODEL_ROUTER_URL ?? DEFAULT_ROUTER_URL).replace(/\/+$/, "");
  const token = options.token ?? process.env.MODEL_ROUTER_TOKEN;
  const doFetch = options.fetchImpl ?? fetch;
  const body = {
    consumer: input.consumer, role: input.role, policy: input.policy,
    exclude_families: input.excludeFamilies, exclude_seats: input.excludeSeats,
    need: { tools: input.needsTools, min_context: input.minContext },
    max_usd_per_m: input.maxUsdPerM, task: input.task,
  };
  let res: Response;
  try {
    res = await doFetch(`${routerUrl}/v1/seats/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(ROUTER_TIMEOUT_MS),
    });
  } catch (error) {
    return resolveSeatOutputSchema.parse({
      status: "router_unreachable", routerUrl,
      detail: error instanceof Error ? error.name : "error",
      note: "The model-router is the only authority for seat selection. No seat was guessed and dashboard_resolve_model was not substituted.",
    });
  }
  const json = await res.json().catch(() => null) as Record<string, any> | null;
  if (res.status === 422 && json?.detail?.type === "seat_unavailable") {
    const d = json.detail;
    return resolveSeatOutputSchema.parse({
      status: "unavailable", policy: d.policy, because: d.because, decisionId: d.decision_id ?? null,
      considered: d.considered ?? [],
      note: d.policy === "free-only" ? "free-only never falls back to a paid seat." : "No seat satisfies the constraints.",
    });
  }
  if (!res.ok || json === null) {
    return resolveSeatOutputSchema.parse({ status: "rejected", httpStatus: res.status, detail: String(json?.detail?.message ?? json?.detail ?? "router refused the request").slice(0, 300) });
  }
  return resolveSeatOutputSchema.parse({
    status: "seat", policy: json.policy, seat: json.seat, provider: json.provider, family: json.family ?? null,
    tier: json.tier, costBasis: json.cost_basis, usdPerMtok: json.usd_per_mtok ?? null,
    invoke: json.invoke ?? {}, because: json.because, jev: json.jev ?? {},
    decisionId: json.decision_id, considered: json.considered ?? [],
    pool: { order: [...SEAT_POOL], excluded: [...SEAT_EXCLUDED] },
  });
}

export function registerResolveSeat(server: McpServer, options: ResolveSeatOptions = {}): void {
  server.registerTool("dashboard_resolve_seat", {
    title: "Resolve the provider seat for a role",
    description: "Ask the model-router which provider/seat should fill a role (review, fix, rebase, council) under a consumer policy and a cross-family constraint. Pool order: Sail, Codex, Antigravity, local GPU, OpenRouter last; cheapest live seat within a tier. Policy 'cheapest' serves the Glass solver and private council; 'free-only' serves the public council and returns status 'unavailable' rather than any paid seat. Claude and Cerebras are never selected. A Jev layer picks the cheapest sufficient seat among eligible ones. Advisory and read-only: no inference or spend on the returned seat. If the router is unreachable the status is 'router_unreachable'; nothing is guessed.",
    inputSchema: resolveSeatInputSchema,
    outputSchema: resolveSeatOutputSchema,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
  }, async (input) => toolResult(await runResolveSeat(input, options)));
}

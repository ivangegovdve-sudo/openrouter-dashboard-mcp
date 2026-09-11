import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  generationCostCollectionSchema,
  generationCostObservationSchema,
} from "../generation-cost.js";
import type { DashboardClient } from "../dashboard/client.js";
import { READ_ONLY_TOOL_ANNOTATIONS, toolResult } from "./shared.js";

const GENERATION_COSTS_ENDPOINT = "/api/public/v2/generation-costs";

export const generationCostsInputSchema = z.object({
  provider: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
}).strict();

export const generationCostsOutputSchema = z.object({
  status: z.literal("ok"),
  endpoint: z.literal(GENERATION_COSTS_ENDPOINT),
  observations: z.array(generationCostObservationSchema),
  evidence: z.object({
    endpoint: z.string(),
    sourceUrl: z.string().url().nullable(),
    stale: z.boolean().nullable(),
    provenance: z.array(z.unknown()),
  }).strict(),
  note: z.string(),
}).strict();

export async function runGenerationCosts(
  rawInput: z.input<typeof generationCostsInputSchema>,
  args: { client: DashboardClient },
): Promise<z.infer<typeof generationCostsOutputSchema>> {
  const input = generationCostsInputSchema.parse(rawInput);
  const query = new URLSearchParams();
  if (input.provider) query.set("provider", input.provider);
  if (input.model) query.set("model", input.model);
  const page = await args.client.get(GENERATION_COSTS_ENDPOINT, query, generationCostCollectionSchema);
  const observations = page.data.filter((row) =>
    (input.provider === undefined || row.provider === input.provider) &&
    (input.model === undefined || row.model === input.model),
  );
  return generationCostsOutputSchema.parse({
    status: "ok",
    endpoint: GENERATION_COSTS_ENDPOINT,
    observations,
    evidence: {
      endpoint: GENERATION_COSTS_ENDPOINT,
      sourceUrl: args.client.sourceUrl?.(GENERATION_COSTS_ENDPOINT) ?? null,
      stale: page.stale,
      provenance: page.provenance,
    },
    note: "Measured costs come only from an authoritative provider response field. Published catalogue arithmetic is not a generation cost; blocked and unknown values remain non-numeric.",
  });
}

export function registerGenerationCosts(server: McpServer, args: { client: DashboardClient }): void {
  server.registerTool(
    "dashboard_generation_costs",
    {
      title: "Measured generation costs",
      description: "Show provider-reported per-generation costs with routed upstream provider, token counts, workload, vantage point, timestamp and provenance. Catalogue rates are never substituted for a missing cost; LAG is not zero.",
      inputSchema: generationCostsInputSchema,
      outputSchema: generationCostsOutputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async (rawInput) => {
      return toolResult(await runGenerationCosts(rawInput, args));
    },
  );
}

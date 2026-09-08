import type { McpServer } from "@modelcontextprotocol/server";
import { priceComparisonInputSchema, priceComparisonOutputSchema, runPriceComparison, type PriceComparisonDependencies } from "../catalogue/compare.js";
import { READ_ONLY_TOOL_ANNOTATIONS, toolResult } from "./shared.js";

export function registerPriceComparison(server: McpServer, dependencies: PriceComparisonDependencies = {}): void {
  server.registerTool("dashboard_price_comparison", {
    title: "Shared-model aggregator price comparison",
    description: "Compare exact Crazyrouter model aliases with OpenRouter public input/output token quotes and available dated direct-provider references. Native author evidence establishes alias matching, not identical immutable snapshots. Retains unpriced and unmatched identities with source populations and filter/pagination counts. Exact decimal savings assess the attributed, dated Crazyrouter discount claim where a direct reference is available; contradictions remain visible. Public default-group quotes are not measured account charges. Optional modelIds selects up to 20 Crazyrouter IDs; offset/limit paginate all acquired identities. Read-only metadata calls; no inference, account mutation or spend reading.",
    inputSchema: priceComparisonInputSchema,
    outputSchema: priceComparisonOutputSchema,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
  }, async input => toolResult(await runPriceComparison(input, dependencies)));
}

import {
  McpServer,
  type McpRequestContext,
} from "@modelcontextprotocol/server";

import {
  createDashboardClient,
  type DashboardClientOptions,
} from "./dashboard/client.js";
import { registerFreeModels } from "./tools/free-models.js";
import { registerBenchmarks } from "./tools/benchmarks.js";
import { registerGithubMovers } from "./tools/github-movers.js";
import { registerKeyInventory } from "./tools/key-inventory.js";
import { registerModelEconomics } from "./tools/model-economics.js";
import { registerModelStatus } from "./tools/model-status.js";
import { registerMatrix } from "./tools/matrix.js";
import { registerResolveModel } from "./tools/resolve-model.js";
import { registerGitHubTrending } from "./tools/github-trending.js";
import { registerSourceHealth } from "./tools/source-health.js";
import { registerUsageLeaders } from "./tools/usage-leaders.js";
import { registerWhatsChanged } from "./tools/whats-changed.js";
import { SERVER_VERSION } from "./version.js";
import { registerCatalogue } from "./tools/catalogue.js";
import type { RenderedPageFetcher } from "./catalogue/rendered-page.js";
import { registerPriceComparison } from "./tools/price-comparison.js";
import { registerContract } from "./tools/contract.js";
import { registerSpeed } from "./tools/speed.js";
import { registerGenerationCosts } from "./tools/generation-costs.js";
import {
  registerCapabilityState,
  type FunctionalityLedgerEntry,
  type ModelCapabilityLedgerEntry,
  type ModelLineageLedgerEntry,
} from "./tools/capability-state.js";

export type CreateServerOptions = DashboardClientOptions & {
  /** Install-time allowlist. Omitted means the complete built-in tool set. */
  selectedTools?: string[];
  /** Install-time provider allowlist used by provider-bearing tools. */
  selectedProviders?: string[];
  /** Optional dated per-slug functionality ledger supplied by the collector. */
  functionalityLedger?: FunctionalityLedgerEntry[];
  /** Optional dated per-slug model-family/base-weight lineage ledger. */
  modelLineageLedger?: ModelLineageLedgerEntry[];
  /** Optional dated per-slug tool/input-modality capability ledger. */
  modelCapabilityLedger?: ModelCapabilityLedgerEntry[];
  /** Use native provider price sources from dashboard_catalogue (default true). */
  useNativePriceSources?: boolean;
  /** Optional rendered-page adapter for deterministic/offline catalogue collection. */
  renderedPageFetcher?: RenderedPageFetcher;
};

function csv(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
}

export function createServer(
  optionsOrContext: CreateServerOptions | McpRequestContext = {},
): McpServer {
  const options: CreateServerOptions =
    "era" in optionsOrContext ? {} : optionsOrContext;
  const selectedTools = options.selectedTools ?? csv(process.env.OPEN_DASHBOARD_TOOLS);
  const selectedProviders = options.selectedProviders ?? csv(process.env.OPEN_DASHBOARD_PROVIDERS);
  const enabled = (name: string) => selectedTools === undefined || selectedTools.includes(name);
  const server = new McpServer({
    name: "open-dashboard-mcp",
    version: SERVER_VERSION,
  });
  const client = createDashboardClient(options);
  if (enabled("dashboard_source_health")) registerSourceHealth(server, { client });
  if (enabled("dashboard_benchmarks")) registerBenchmarks(server, { client });
  if (enabled("dashboard_github_trending")) registerGitHubTrending(server, { client });
  if (enabled("dashboard_free_models")) registerFreeModels(server, { client, ...(selectedProviders ? { allowedProviders: selectedProviders } : {}) });
  if (enabled("dashboard_resolve_model")) registerResolveModel(server, { client, ...(selectedProviders ? { allowedProviders: selectedProviders } : {}) });
  if (enabled("dashboard_model_status")) registerModelStatus(server, { client, ...(selectedProviders ? { allowedProviders: selectedProviders } : {}) });
  if (enabled("dashboard_model_economics")) registerModelEconomics(server, { client, ...(selectedProviders ? { allowedProviders: selectedProviders } : {}) });
  if (enabled("dashboard_whats_changed")) registerWhatsChanged(server, { client });
  if (enabled("dashboard_usage_leaders")) registerUsageLeaders(server, { client });
  if (enabled("dashboard_matrix")) registerMatrix(server, { client });
  if (enabled("dashboard_github_movers")) registerGithubMovers(server, { client });
  if (enabled("dashboard_key_inventory")) registerKeyInventory(server);
  if (enabled("dashboard_catalogue")) registerCatalogue(server, { client, ...(selectedProviders ? { allowedProviders: selectedProviders } : {}), ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}), ...(options.renderedPageFetcher ? { renderedPageFetcher: options.renderedPageFetcher } : {}), useNativePriceSources: options.useNativePriceSources ?? true });
  if (enabled("dashboard_price_comparison") && (selectedProviders === undefined || (selectedProviders.includes("openrouter") && selectedProviders.includes("crazyrouter")))) registerPriceComparison(server, { ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) });
  if (enabled("dashboard_contract")) registerContract(server);
  if (enabled("dashboard_speed")) registerSpeed(server);
  if (enabled("dashboard_generation_costs")) registerGenerationCosts(server, { client });
  if (enabled("dashboard_capability_state")) registerCapabilityState(server, {
    client,
    ...(selectedProviders ? { allowedProviders: selectedProviders } : {}),
    ...(options.functionalityLedger ? { functionalityLedger: options.functionalityLedger } : {}),
    ...(options.modelLineageLedger ? { modelLineageLedger: options.modelLineageLedger } : {}),
    ...(options.modelCapabilityLedger ? { modelCapabilityLedger: options.modelCapabilityLedger } : {}),
  });
  return server;
}

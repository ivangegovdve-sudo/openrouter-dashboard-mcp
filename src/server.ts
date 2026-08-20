import {
  McpServer,
  type McpRequestContext,
} from "@modelcontextprotocol/server";

import {
  createDashboardClient,
  type DashboardClientOptions,
} from "./dashboard/client.js";
import { registerFreeModels } from "./tools/free-models.js";
import { registerGithubMovers } from "./tools/github-movers.js";
import { registerModelStatus } from "./tools/model-status.js";
import { registerResolveModel } from "./tools/resolve-model.js";
import { registerSourceHealth } from "./tools/source-health.js";
import { registerUsageLeaders } from "./tools/usage-leaders.js";
import { registerWhatsChanged } from "./tools/whats-changed.js";

export type CreateServerOptions = DashboardClientOptions;

export function createServer(
  optionsOrContext: CreateServerOptions | McpRequestContext = {},
): McpServer {
  const options =
    "era" in optionsOrContext ? {} : optionsOrContext;
  const server = new McpServer({
    name: "openrouter-dashboard-mcp",
    version: "0.1.0",
  });
  const client = createDashboardClient(options);
  registerSourceHealth(server, { client });
  registerFreeModels(server, { client });
  registerResolveModel(server, { client });
  registerModelStatus(server, { client });
  registerWhatsChanged(server, { client });
  registerUsageLeaders(server, { client });
  registerGithubMovers(server, { client });
  return server;
}

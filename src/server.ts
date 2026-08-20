import {
  McpServer,
  type McpRequestContext,
} from "@modelcontextprotocol/server";

import {
  createDashboardClient,
  type DashboardClientOptions,
} from "./dashboard/client.js";
import { registerSourceHealth } from "./tools/source-health.js";

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
  return server;
}

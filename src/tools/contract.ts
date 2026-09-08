import type { McpServer } from "@modelcontextprotocol/server";

import { contractEnvelope, contractEnvelopeSchema } from "../contract.js";
import { READ_ONLY_TOOL_ANNOTATIONS, toolResult } from "./shared.js";

export const contractOutputSchema = contractEnvelopeSchema;

export function registerContract(server: McpServer): void {
  server.registerTool("dashboard_contract", {
    title: "MCP schema and deprecation contract",
    description: "Return the response schema version, installed package version, and every field or tool announced for removal. A deprecation is published before the removal release; when no replacement exists, the notice includes the reason. The 1.0.0 notice is necessarily retrospective for 0.9.0 changes because 0.9.0 shipped before this mechanism existed.",
    inputSchema: {},
    outputSchema: contractOutputSchema,
    annotations: READ_ONLY_TOOL_ANNOTATIONS,
  }, async () => toolResult(contractEnvelope()));
}

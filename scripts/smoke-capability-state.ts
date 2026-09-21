import { Client, InMemoryTransport } from "@modelcontextprotocol/client";

import { startFixtureDashboard } from "./fixture-dashboard.js";
import { createServer } from "../src/server.js";
import { capabilityStateOutputSchema } from "../src/tools/capability-state.js";

function maxRowsFromArgs(): number {
  const value = process.argv[2] ?? "1";
  if (!/^\d+$/.test(value)) {
    throw new Error("Usage: npm run smoke:capability-state -- [max_rows]");
  }
  const maxRows = Number(value);
  if (!Number.isSafeInteger(maxRows) || maxRows < 1) {
    throw new Error("max_rows must be a positive safe integer");
  }
  return maxRows;
}

async function main(): Promise<void> {
  const maxRows = maxRowsFromArgs();
  const fixture = await startFixtureDashboard({ mode: "fixture" });
  const server = createServer({ baseUrl: fixture.baseUrl, cache: false });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "open-dashboard-smoke", version: "1.0.0" });
  await client.connect(clientTransport);

  try {
    const result = await client.callTool({
      name: "dashboard_capability_state",
      arguments: { max_rows: maxRows },
    });
    const state = capabilityStateOutputSchema.parse(result.structuredContent);
    if (state.status !== "ok") {
      process.stdout.write(JSON.stringify({ input: { max_rows: maxRows }, state }, null, 2) + "\n");
      return;
    }
    process.stdout.write(JSON.stringify({
      input: { max_rows: maxRows },
      mcp_tool: "dashboard_capability_state",
      status: state.status,
      source_endpoints: state.source_endpoints,
      pagination: state.pagination,
      public_council: {
        decision_state: state.queries.public_council.decision_state,
        considered_rows: state.queries.public_council.considered_rows,
        candidate_rows: state.queries.public_council.candidate_rows,
        elimination_counts: state.queries.public_council.elimination_breakdown.counts,
      },
      first_row: state.rows[0] === undefined ? null : {
        slug: state.rows[0].slug,
        generation_cost_state: state.rows[0].generation_cost.state,
        public_selection: state.rows[0].selection.public_council.state,
      },
      http_requests: fixture.requests,
    }, null, 2) + "\n");
  } finally {
    await client.close();
    await fixture.close();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "smoke failed"}\n`);
  process.exitCode = 1;
});

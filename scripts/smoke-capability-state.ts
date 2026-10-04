import { Client, InMemoryTransport } from "@modelcontextprotocol/client";

import { startFixtureDashboard } from "./fixture-dashboard.js";
import { createServer } from "../src/server.js";
import { CAPABILITY_STATE_MAX_ROWS, capabilityStateOutputSchema } from "../src/tools/capability-state.js";

type SmokeScenario = "blocked" | "measured";

function inputFromArgs(): { scenario: SmokeScenario; maxRows: number; freshnessTtlSeconds?: number; generationCostTtlSeconds?: number } {
  const first = process.argv[2] ?? "1";
  const scenario: SmokeScenario = first === "measured" ? "measured" : "blocked";
  const value = scenario === "measured" ? (process.argv[3] ?? "6") : first;
  if (!/^\d+$/.test(value)) {
    throw new Error("Usage: npm run smoke:capability-state -- [max_rows] | measured [max_rows]");
  }
  const maxRows = Number(value);
  if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > CAPABILITY_STATE_MAX_ROWS) {
    throw new Error(`max_rows must be a positive safe integer no greater than ${CAPABILITY_STATE_MAX_ROWS}`);
  }
  return scenario === "measured"
    ? { scenario, maxRows, freshnessTtlSeconds: 31_536_000, generationCostTtlSeconds: 31_536_000 }
    : { scenario, maxRows };
}

async function main(): Promise<void> {
  const input = inputFromArgs();
  const fixture = await startFixtureDashboard({ mode: "fixture" });
  const server = createServer({ baseUrl: fixture.baseUrl, cache: false });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "open-dashboard-smoke", version: "1.0.0" });
  await client.connect(clientTransport);

  try {
    const result = await client.callTool({
      name: "dashboard_capability_state",
      arguments: {
        max_rows: input.maxRows,
        ...(input.freshnessTtlSeconds === undefined ? {} : { freshness_ttl_seconds: input.freshnessTtlSeconds }),
        ...(input.generationCostTtlSeconds === undefined ? {} : { generation_cost_ttl_seconds: input.generationCostTtlSeconds }),
      },
    });
    const state = capabilityStateOutputSchema.parse(result.structuredContent);
    if (state.status !== "ok") {
      process.stdout.write(JSON.stringify({ input, state }, null, 2) + "\n");
      return;
    }
    if (input.scenario === "measured" && (state.queries.public_council.decision_state !== "decidable" || state.queries.public_council.selected === null)) {
      throw new Error("measured smoke scenario did not produce a public council selection");
    }
    process.stdout.write(JSON.stringify({
      input,
      mcp_tool: "dashboard_capability_state",
      status: state.status,
      source_endpoints: state.source_endpoints,
      pagination: state.pagination,
      public_council: {
        decision_state: state.queries.public_council.decision_state,
        considered_rows: state.queries.public_council.considered_rows,
        candidate_rows: state.queries.public_council.candidate_rows,
        elimination_counts: state.queries.public_council.elimination_breakdown.counts,
        selected: state.queries.public_council.selected,
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

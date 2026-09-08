import test from "node:test";
import assert from "node:assert/strict";

import { probeSpeed, promptHash } from "../src/speed.js";
import { runSpeed } from "../src/tools/speed.js";

test("speed probe streams 700 tokens, discards run one, and reports median plus range", async () => {
  const requests: Array<{ prompt: string; maxTokens: 700; stream: true }> = [];
  const runs = [
    { ttftMs: 900, outputTokens: 700, elapsedMs: 1000 },
    { ttftMs: 300, outputTokens: 700, elapsedMs: 700 },
    { ttftMs: 200, outputTokens: 700, elapsedMs: 500 },
    { ttftMs: 400, outputTokens: 700, elapsedMs: 800 },
  ];
  const result = await probeSpeed({ provider: "cerebras", model: "gpt-oss-120b", prompt: "fixed", vantagePoint: "Sofia public internet", observedAt: "2026-09-08T15:00:00Z", invoke: async (request) => { requests.push(request); return runs[requests.length - 1]!; } });
  assert.equal(requests.length, 4);
  assert.ok(requests.every((request) => request.stream && request.maxTokens === 700));
  assert.equal(result.promptHash, promptHash("fixed"));
  assert.deepEqual(result.ttft_ms, { median: "300", min: "200", max: "400" });
  assert.deepEqual(result.sustained_tps, { median: "1000", min: "875", max: "1400" });
  assert.equal(result.discardedRuns, 1);
});

test("speed metadata shows published and historical measured values separately", () => {
  const result = runSpeed({});
  const cerebras = result.observations.filter((observation) => observation.provider === "cerebras");
  assert.deepEqual(cerebras.map((observation) => observation.state), ["published", "measured"]);
  assert.deepEqual(cerebras[1]?.sustained_tps, { median: "1022", min: "867", max: "1108" });
  assert.equal(cerebras[1]?.promptHash, null);
  assert.match(cerebras[1]?.note ?? "", /not retained/);
});

test("speed metadata keeps absent provider observations explicitly unknown", () => {
  const result = runSpeed({ provider: "novita", model: "missing" });
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0]?.state, "unknown");
  assert.equal(result.observations[0]?.sustained_tps, null);
});

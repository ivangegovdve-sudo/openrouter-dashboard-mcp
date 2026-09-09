import test from "node:test";
import assert from "node:assert/strict";

import { probeSpeed, promptHash, speedObservationSchema } from "../src/speed.js";
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
  // WAS ["published", "measured"]. The "published" 3000 tokens/second was attributed to
  // https://www.cerebras.ai/pricing, which was re-read on 2026-09-09 and carries no
  // per-model rate at all. A claim its own cited source does not make is withdrawn, not
  // re-dated, so the first observation is now explicitly unknown.
  assert.deepEqual(cerebras.map((observation) => observation.state), ["unknown", "measured"]);
  // The record's rates were 867 / 1022 / 1108, but the tokens they counted were
  // never retained. A measured rate whose basis is unknown is not publishable,
  // so it is withheld rather than shown -- the figures stay in the note.
  assert.equal(cerebras[1]?.sustained_tps, null);
  assert.equal(cerebras[1]?.token_basis, "unknown");
  assert.equal(cerebras[1]?.promptHash, null);
  assert.match(cerebras[1]?.note ?? "", /not retained/);
  assert.match(cerebras[1]?.note ?? "", /867 \/ 1022 \/ 1108/);
});

test("speed metadata keeps absent provider observations explicitly unknown", () => {
  const result = runSpeed({ provider: "novita", model: "missing" });
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0]?.state, "unknown");
  assert.equal(result.observations[0]?.sustained_tps, null);
});

test("a measured rate may not be published without naming the tokens it counted", () => {
  // The whole point of token_basis: a producer that does not know the basis must
  // not be able to emit a rate anyway. Required, not optional, for this reason.
  assert.throws(() => speedObservationSchema.parse({
    state: "measured", provider: "cerebras", model: "gpt-oss-120b",
    observedAt: "2026-09-08T15:00:00Z", vantagePoint: "Sofia public internet",
    promptHash: null, tokenCount: 700, token_basis: "unknown",
    requestedRuns: 4, discardedRuns: 1, retainedRuns: 3,
    ttft_ms: null, sustained_tps: { median: "1022", min: "867", max: "1108" },
    attribution: null, sourceUrl: null, note: null,
  }), /name the tokens it counted/);
});

test("a real probe records the basis it actually used", async () => {
  const runs = [
    { ttftMs: 900, outputTokens: 700, elapsedMs: 1000 },
    { ttftMs: 300, outputTokens: 700, elapsedMs: 700 },
    { ttftMs: 200, outputTokens: 700, elapsedMs: 500 },
    { ttftMs: 250, outputTokens: 700, elapsedMs: 600 },
  ];
  let i = 0;
  const result = await probeSpeed({ provider: "cerebras", model: "gpt-oss-120b", prompt: "fixed", vantagePoint: "Sofia public internet", observedAt: "2026-09-08T15:00:00Z", invoke: async () => runs[i++]! });
  // sustained_tps divides run.outputTokens, so the basis is visible output and
  // the response must say so rather than leaving the reader to assume.
  assert.equal(result.token_basis, "visible_output");
  assert.notEqual(result.sustained_tps, null);
});

test("no speed observation publishes a rate this package cannot source", () => {
  // THE REGRESSION THIS EXISTS TO CATCH. dashboard_speed shipped Groq's 8,000
  // tokens-per-MINUTE free-plan quota as 8,000 tokens per SECOND of throughput -- a 60x
  // overstatement attributed to Groq by name, from https://groq.com/, a page that does
  // not state it. src/providers/evidence.ts already stored the same number correctly as
  // `unit: "tokens/minute"` with the scope "this is not tokens per second or an
  // inference-speed ceiling", so the repository contradicted itself in two files.
  // A rate may be emitted only in the `published` state, and that state requires a
  // source URL and attribution; nothing here may carry a rate without both.
  for (const observation of runSpeed({}).observations) {
    if (observation.sustained_tps === null) continue;
    assert.equal(observation.state, "published", `${observation.provider}: only a published claim may carry a rate`);
    assert.ok(observation.sourceUrl, `${observation.provider}: a published rate must name the page it was read from`);
    assert.ok(observation.attribution, `${observation.provider}: a published rate must name who published it`);
  }
});

test("the withdrawn Groq throughput ceiling does not come back", () => {
  const groq = runSpeed({}).observations.filter((observation) => observation.provider === "groq");
  assert.equal(groq.length, 1);
  assert.equal(groq[0]?.state, "unknown");
  assert.equal(groq[0]?.sustained_tps, null);
  // The note must keep saying WHY, so the next person to see "8000" in the provider
  // registry does not restore it here as a speed.
  assert.match(groq[0]?.note ?? "", /per MINUTE/);
});

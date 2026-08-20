# Dashboard Intelligence MCP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-credential, embeddable TypeScript stdio MCP server exposing exactly the seven question-oriented dashboard tools specified in `docs/BRIEF.md`.

**Architecture:** A lazy, timeout-bounded dashboard client validates the public API's several real response families with Zod and converts network/HTTP/non-JSON/schema failures into structured catalogue errors. Seven focused tool modules compose bounded endpoint fan-outs and retain endpoint-specific provenance; `src/server.ts` registers them synchronously so startup and `tools/list` never touch the network. A compiled official MCP client drives the built server over stdio for live, fixture, offline, captive-portal, stdout-purity, and alien-cwd verification.

**Tech Stack:** Node.js >=20, TypeScript ESM, `@modelcontextprotocol/server@^2.0.0`, `@modelcontextprotocol/client@^2.0.0`, Zod v4, Node's test runner through `tsx`.

**Spec:** `docs/BRIEF.md`

## Global Constraints

- Register exactly: `dashboard_resolve_model`, `dashboard_model_status`, `dashboard_whats_changed`, `dashboard_free_models`, `dashboard_usage_leaders`, `dashboard_source_health`, `dashboard_github_movers`.
- `ecosystemTokenVolume` always means public ecosystem-wide OpenRouter volume and must never imply personal spend, cost, budget, or key usage.
- `/live-models`-dependent tools register offline but return the exact actionable PR #24 capability message when the manifest omits the route.
- An unsatisfied resolver returns `unsatisfiable: true`, `resolved: []`; it never emits a near miss.
- Unknown price/context/performance is never favourable. Null performance is retained, ranked last, and labelled `unmeasured`.
- Disappeared models are never resolver results.
- No credentials, auth headers, secret loading, interactive prompts, browser opening, cwd assumptions, or filesystem writes are permitted in production code.
- `DASHBOARD_BASE_URL` is the only product configuration and defaults to `https://openrouter-github-dashboard.vercel.app`.
- Every fetch uses an explicit `AbortController` and a production timeout of 10,000 ms.
- Startup and `tools/list` perform no network I/O.
- stdout is exclusively MCP JSON-RPC. Production diagnostics are absent by default and any fatal entrypoint diagnostic goes only to stderr.
- Each tool advertises a Zod `inputSchema`, Zod `outputSchema`, returns matching `structuredContent` plus a JSON text block, and sets `readOnlyHint:true`, `destructiveHint:false`, `openWorldHint:true`.
- Every successful or partial answer surfaces endpoint-specific `window`, `completeness`, `stale`, watermark/provenance, warnings, and caps. Opaque cursors are passed through unchanged.
- Do not auto-page unbounded collections. Each bounded scan declares its item/page cap and whether it was reached.
- Errors distinguish unreachable/timeout, HTTP failure, non-JSON response, invalid upstream payload, and missing capability without crashing the MCP connection.
- Use TDD for every production behavior: add one focused failing test, observe the expected failure, implement minimally, then run the focused and full suites.
- Do not modify, commit, or switch the dashboard repository. Its verified contract ref is `feat/live-model-availability-api` at `7c32f8910db2742d421267560cf3bac3977fe120`.

## Verified Contract Rulings

- The brief's `@modelcontextprotocol/typescript-sdk` is a repository name, not an npm package. Use the official stable v2 split server/client packages.
- Production currently omits `/api/public/v2/live-models`; Tools 1, 2, and 4 are the three hard-dependent tools and decline. Tool 3 uses it opportunistically and reports model-catalogue subsections unavailable when absent.
- The public API does not share one universal envelope. Validate common collections/singletons, manifest, history unions, app-model unions, GitHub envelopes, and public errors separately.
- `/models/{id}/history` contains only usage/rank facts, not prices or availability. `dashboard_whats_changed.priceChanges` must explicitly report `unsupported_by_public_api`; never infer complete price changes.
- `/apps` is a rolling 30-day aggregate; app-model data is one exact day and may be `collection_disabled`. Keep those periods separate and surface disabled joins.
- GitHub momentum may be unavailable for some windows. Do not substitute adoption ranking and call it momentum.
- Upstream `live-models?sort=price-asc` currently coalesces null prices to zero. For unrestricted cheapest resolution, scan a bounded unranked candidate set and rank only known-price rows locally; still use upstream ranked queries for the other intents.

## File Map

- `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore` — build/test/bin metadata and generated-path exclusions.
- `src/config.ts` — lazy base-URL validation and immutable production timeout.
- `src/dashboard/errors.ts` — safe error taxonomy and structured serialization.
- `src/dashboard/client.ts` — timeout-bounded zero-auth fetch, JSON/content-type/schema checks, opaque query construction.
- `src/dashboard/schemas/common.ts` — shared window/completeness/provenance/source-status schemas.
- `src/dashboard/schemas/live-models.ts` — exact live-model query/row/envelope schemas.
- `src/dashboard/schemas/openrouter.ts` — manifest, model, deprecation, free, app, matrix schemas.
- `src/dashboard/schemas/history.ts` — overview/entity history status unions.
- `src/dashboard/schemas/github.ts` — rankings/repositories/history/enrichment contracts.
- `src/tools/shared.ts` — annotations, capability message, source evidence, safe result/error helpers, cap metadata.
- `src/tools/*.ts` — one module per requested tool, exporting schemas, a directly testable runner, and registration.
- `src/server.ts` — synchronous factory that registers exactly seven tools.
- `src/index.ts` — `serveStdio(createServer)` entrypoint with no startup fetch.
- `test/fixtures.ts` — deterministic valid upstream payload builders and fetch router.
- `test/*.test.ts` — focused unit/contract tests.
- `scripts/fixture-dashboard.ts` — local HTTP fixture modes for success, missing capability, HTML, errors, and hangs.
- `scripts/verify-stdio.ts` — official MCP client verification and evidence writer.
- `scripts/verify-stdout.ts` — raw stdio capture/parser asserting every stdout line is a JSON-RPC frame.
- `evals/dashboard-intelligence.xml` — ten stable, independent evaluation questions.
- `README.md` — install/config/Electron embedding and tool reference.
- `docs/verification-report.md` — commands, timings, and captured payloads required by brief sections 6 and 9.

---

### Task 1: Project Foundation and Dashboard Client

**Files:**
- Create: `.gitignore`, `package.json`, `package-lock.json`, `tsconfig.json`
- Create: `src/config.ts`, `src/dashboard/errors.ts`, `src/dashboard/client.ts`
- Create: `src/dashboard/schemas/common.ts`, `src/dashboard/schemas/live-models.ts`, `src/dashboard/schemas/openrouter.ts`, `src/dashboard/schemas/history.ts`, `src/dashboard/schemas/github.ts`
- Create: `test/fixtures.ts`, `test/client.test.ts`, `test/schemas.test.ts`

**Interfaces:**
- Produces: `createDashboardClient(options?: { baseUrl?: string; timeoutMs?: number; fetchImpl?: typeof fetch }): DashboardClient`
- Produces: `DashboardClient.get(path: string, query: URLSearchParams, schema: z.ZodType<T>): Promise<T>`
- Produces: `DashboardRequestError` with `kind: "unreachable"|"timeout"|"http_error"|"non_json"|"invalid_payload"|"configuration_error"`, safe `message`, `retryable`, and optional `status`.
- Produces: exact exported upstream response schemas used by later tasks.

- [ ] **Step 1: Create build metadata and install exact dependency families**

Create ESM scripts for `build`, `test`, `test:watch`, `verify:stdio`, and a `bin` pointing at `build/index.js`. Declare Node `>=20`. Install only the official v2 server/client packages, Zod v4, TypeScript, `tsx`, and Node types.

Run: `npm install`

Expected: lockfile resolves `@modelcontextprotocol/server` and `@modelcontextprotocol/client` 2.x; no credential package or dotenv dependency exists.

- [ ] **Step 2: Write the failing HTTP-client tests**

```ts
test('times out a hung fetch and classifies it as unreachable', async () => {
  const client = createDashboardClient({ baseUrl: 'https://catalogue.test', timeoutMs: 20, fetchImpl: hangingFetch });
  await assert.rejects(() => client.get('/api/public/v2/manifest', new URLSearchParams(), manifestSchema),
    (error: unknown) => error instanceof DashboardRequestError && error.kind === 'timeout');
});

test('rejects a reachable HTML response without exposing its body', async () => {
  const client = createDashboardClient({ fetchImpl: htmlFetch });
  await assert.rejects(() => client.get('/api/public/v2/manifest', new URLSearchParams(), manifestSchema),
    (error: unknown) => error instanceof DashboardRequestError && error.kind === 'non_json' && !error.message.includes('<html'));
});
```

- [ ] **Step 3: Run the focused tests and verify RED**

Run: `npm test -- test/client.test.ts test/schemas.test.ts`

Expected: FAIL because the client, error class, and mirrored schemas do not exist.

- [ ] **Step 4: Implement the minimal client and exact upstream schemas**

Use `new URL(path, baseUrl)`, `URLSearchParams`, an explicit `AbortController`, `setTimeout`, `Accept: application/json`, status checks before parsing, content-type checks, `JSON.parse`, then Zod parsing. Never include response bodies in errors. Preserve exact decimal/count strings and cursor strings.

- [ ] **Step 5: Verify GREEN and build**

Run: `npm test -- test/client.test.ts test/schemas.test.ts`

Expected: PASS with timeout, HTTP, HTML, invalid JSON/schema, URL encoding, and successful envelope coverage.

Run: `npm run build`

Expected: TypeScript compiles with no errors.

- [ ] **Step 6: Commit the foundation**

```powershell
git add .gitignore package.json package-lock.json tsconfig.json src/config.ts src/dashboard test/fixtures.ts test/client.test.ts test/schemas.test.ts
git commit -m "feat: add zero-auth dashboard client core"
```

### Task 2: Source Health and Offline-Safe MCP Registration

**Files:**
- Create: `src/tools/shared.ts`, `src/tools/source-health.ts`, `src/server.ts`, `src/index.ts`
- Create: `test/source-health.test.ts`, `test/server.test.ts`

**Interfaces:**
- Produces: `sourceEvidence(endpoint, upstream): SourceEvidence` and `toolResult(output): CallToolResult`.
- Produces: `runSourceHealth(input, { client }): Promise<SourceHealthOutput>`.
- Produces: `createServer(options?): McpServer`; it performs zero fetches until a handler runs.

- [ ] **Step 1: Write failing tests for health, annotations, and lazy startup**

```ts
test('registers source health without fetching during construction', async () => {
  const fetchImpl = failIfCalled();
  const server = createServer({ fetchImpl });
  assert.ok(server);
  assert.equal(fetchImpl.calls, 0);
});

test('surfaces a stale failed collector in the response body', async () => {
  const result = await runSourceHealth({}, depsWithStaleBenchmarks);
  assert.equal(result.status, 'ok');
  assert.equal(result.sources.find(s => s.sourceId === 'benchmarks_current')?.stale, true);
  assert.match(result.summary, /stale/i);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- test/source-health.test.ts test/server.test.ts`

Expected: FAIL because registration and health composition do not exist.

- [ ] **Step 3: Implement source health and the server entrypoint**

Fetch manifest and source status concurrently only inside the handler. Preserve the six-source limitation and manifest route list. Register tool annotations exactly. `src/index.ts` calls only `serveStdio(createServer)` and never prints to stdout.

- [ ] **Step 4: Verify GREEN, full suite, and build**

Run: `npm test -- test/source-health.test.ts test/server.test.ts`

Run: `npm test`

Run: `npm run build`

Expected: all pass; constructing the server made zero fetches.

- [ ] **Step 5: Commit source health**

```powershell
git add src/tools/shared.ts src/tools/source-health.ts src/server.ts src/index.ts test/source-health.test.ts test/server.test.ts
git commit -m "feat: add source health MCP surface"
```

### Task 3: Model Status and Change Intelligence

**Files:**
- Create: `src/tools/model-status.ts`, `src/tools/whats-changed.ts`
- Modify: `src/server.ts`
- Create: `test/model-status.test.ts`, `test/whats-changed.test.ts`

**Interfaces:**
- Produces: `runModelStatus({ slug }, deps): Promise<ModelStatusOutput>`.
- Produces: `runWhatsChanged({ since?, limit? }, deps): Promise<WhatsChangedOutput>`.
- Consumes: lazy manifest capability detection, bounded live-model scan (max 2 pages / 1,000 rows), deprecations, current OpenRouter detail, overview history.

- [ ] **Step 1: Write failing timestamp/verdict and actionable-not-found tests**

```ts
test('explains positive observed absence using both timestamps', async () => {
  const result = await runModelStatus({ slug: 'groq/retired-model' }, disappearedDeps);
  assert.match(result.verdict, /catalogue has been read completely 4 times since/i);
  assert.equal(result.model?.lastSeenAt, '2026-08-03T06:00:00.000Z');
  assert.equal(result.model?.lastConfirmedAt, '2026-08-19T06:00:00.000Z');
});

test('suggests bounded fuzzy matches instead of exposing a 404', async () => {
  const result = await runModelStatus({ slug: 'llama-3.3' }, missingModelDeps);
  assert.equal(result.status, 'not_found');
  assert.ok(result.suggestions.length <= 12);
  assert.doesNotMatch(result.summary, /404/);
});
```

- [ ] **Step 2: Write failing change-window honesty tests**

Assert the default `since` is the prior complete ingestion bucket, an empty diff says `nothing changed`, missing live-models marks appearance/disappearance unavailable without failing rank/deprecation changes, and `priceChanges.status` is always `unsupported_by_public_api`.

- [ ] **Step 3: Run and verify RED**

Run: `npm test -- test/model-status.test.ts test/whats-changed.test.ts`

Expected: FAIL because both tool modules are absent.

- [ ] **Step 4: Implement both tools minimally**

Manifest missing `/live-models` makes model status return the exact PR #24 message. When present, scan only until the exact id is found or the 1,000-row cap is reached. Treat OpenRouter-only detail/deprecation/history calls as auxiliary partial evidence for non-OpenRouter slugs. For changes, derive the default date from complete history buckets and keep unsupported/partial sections explicit.

- [ ] **Step 5: Verify GREEN and regression suite**

Run: `npm test -- test/model-status.test.ts test/whats-changed.test.ts`

Run: `npm test`

Run: `npm run build`

- [ ] **Step 6: Commit status and changes**

```powershell
git add src/tools/model-status.ts src/tools/whats-changed.ts src/server.ts test/model-status.test.ts test/whats-changed.test.ts
git commit -m "feat: add model status and change intelligence"
```

### Task 4: Intent Resolver

**Files:**
- Create: `src/tools/resolve-model.ts`
- Modify: `src/server.ts`
- Create: `test/resolve-model.test.ts`

**Interfaces:**
- Produces: `runResolveModel(input, deps): Promise<ResolveModelOutput>`.
- Input: `intent`, strict `constraints`, `fallbackDepth` default 3/max 10, `verbose` default false.
- Output: ranked `resolved`, visible `excluded`, `unsatisfiable`, measurement labels, cap metadata, provenance.

- [ ] **Step 1: Write one failing test per non-negotiable**

```ts
test('returns no near miss when constraints are unsatisfiable', async () => {
  const result = await runResolveModel(impossibleRequest, resolverDeps);
  assert.equal(result.unsatisfiable, true);
  assert.deepEqual(result.resolved, []);
  assert.ok(result.excluded.length > 0);
});

test('unknown is never favourable and disappeared is never resolved', async () => {
  const result = await runResolveModel(cheapestRequest, depsWithNullAndDisappeared);
  assert.ok(result.resolved.every(row => row.isFree !== null && row.availability === 'available'));
  assert.ok(result.excluded.some(row => row.reason === 'pricing_not_published'));
});
```

Also test: constraint-specific exclusion reasons, provider ordering for `any_available`, context numeric ordering without number overflow, throughput nulls ranked last but retained as `unmeasured`, fallback-depth truncation, exact capability message, and cursor never combined with `sort`.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- test/resolve-model.test.ts`

Expected: FAIL because resolver is absent.

- [ ] **Step 3: Implement bounded candidate audit and ranking**

Always query `availability=available`. Map non-price intents to upstream sort. For unrestricted cheapest selection, page an unranked set up to 1,000 rows, exclude null prices, and sort known decimal strings safely; do not trust upstream null-coalescing. Apply constraints client-side too so `excluded` is complete within the declared cap. Return no result outside constraints.

- [ ] **Step 4: Verify GREEN and full suite**

Run: `npm test -- test/resolve-model.test.ts`

Run: `npm test`

Run: `npm run build`

- [ ] **Step 5: Re-read and mechanically check the four resolver rules**

Run: `rg -n "unsatisfiable|excluded|pricing_not_published|context_not_published|disappeared|unmeasured" src/tools/resolve-model.ts test/resolve-model.test.ts`

Expected: implementation and tests visibly cover all four rules.

- [ ] **Step 6: Commit resolver**

```powershell
git add src/tools/resolve-model.ts src/server.ts test/resolve-model.test.ts
git commit -m "feat: add intent-based model resolution"
```

### Task 5: Usable Free Models

**Files:**
- Create: `src/tools/free-models.ts`
- Modify: `src/server.ts`
- Create: `test/free-models.test.ts`

**Interfaces:**
- Produces: `runFreeModels(input, deps): Promise<FreeModelsOutput>`.
- Defaults: `outputModality:"text"`, bounded `limit`; live-models is mandatory.
- Separates cross-provider live candidates, OpenRouter catalogue metadata, and frontier availability.

- [ ] **Step 1: Write failing modality/freeness/capability tests**

Assert default query sends `outputModality=text`, only upstream `isFree:true` rows are usable, null prices never enter results, per-image-priced zero-token rows are not recomputed as free, and missing live-models declines with the exact PR #24 message.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- test/free-models.test.ts`

- [ ] **Step 3: Implement the bounded fan-out**

Fetch live free candidates, `/free-models`, and two explicitly dimensioned `/free-frontiers` queries concurrently only after capability succeeds. A frontier 503 yields a partial subsection and warning, not a false empty frontier. Preserve upstream `isFree`; never recompute it.

- [ ] **Step 4: Verify GREEN, full suite, and build**

Run: `npm test -- test/free-models.test.ts`

Run: `npm test`

Run: `npm run build`

- [ ] **Step 5: Commit free models**

```powershell
git add src/tools/free-models.ts src/server.ts test/free-models.test.ts
git commit -m "feat: add usable free model intelligence"
```

### Task 6: Ecosystem Usage Leaders and GitHub Movers

**Files:**
- Create: `src/tools/usage-leaders.ts`, `src/tools/github-movers.ts`
- Modify: `src/server.ts`
- Create: `test/usage-leaders.test.ts`, `test/github-movers.test.ts`

**Interfaces:**
- Produces: `runUsageLeaders({ windowDays, limit }, deps): Promise<UsageLeadersOutput>`.
- Produces: `runGithubMovers({ category?, windowDays, limit }, deps): Promise<GithubMoversOutput>`.
- Model usage sums exact daily public volume across complete buckets; app totals remain explicitly rolling-30-day; app-model cells remain explicitly latest-complete-day and partial.
- GitHub defaults to a supported 7-day momentum window, fan-outs categories when omitted, and enriches only the final bounded leaders.

- [ ] **Step 1: Write failing semantic-label and period-separation tests**

```ts
test('never presents ecosystem volume as personal spend', async () => {
  const result = await runUsageLeaders({ windowDays: 30, limit: 5 }, usageDeps);
  const serialized = JSON.stringify(result).toLowerCase();
  assert.match(serialized, /ecosystemtokenvolume/);
  assert.doesNotMatch(serialized, /your spend|personal spend|your cost/);
});
```

Assert incomplete daily buckets are excluded, rolling app totals are not summed as daily facts, `collection_disabled` matrix/model joins are surfaced, and previous-window movement is null when evidence is missing.

- [ ] **Step 2: Write failing GitHub bounded-mover tests**

Assert star/fork deltas stay separate, new entrants require a missing baseline or baseline `as_of` absence, rank movement compares two publications, 30/90 momentum 503 is not replaced with adoption, category fan-out is capped, and repository/enrichment calls run only for final leaders.

- [ ] **Step 3: Run and verify RED**

Run: `npm test -- test/usage-leaders.test.ts test/github-movers.test.ts`

- [ ] **Step 4: Implement both tools and register all seven**

Use `BigInt` for exact token/count arithmetic and serialize totals as strings. Preserve each dataset's period semantics. Use `Promise.allSettled` for independent auxiliary enrichments and turn failures into per-section warnings/evidence gaps.

- [ ] **Step 5: Assert final tool registration metadata**

Extend `test/server.test.ts` to connect an in-memory official client, list tools, assert exactly seven names, and assert every input/output schema and all three required annotation values.

- [ ] **Step 6: Verify GREEN, full suite, and build**

Run: `npm test -- test/usage-leaders.test.ts test/github-movers.test.ts test/server.test.ts`

Run: `npm test`

Run: `npm run build`

- [ ] **Step 7: Commit usage and GitHub tools**

```powershell
git add src/tools/usage-leaders.ts src/tools/github-movers.ts src/server.ts test/usage-leaders.test.ts test/github-movers.test.ts test/server.test.ts
git commit -m "feat: add ecosystem usage and GitHub movers"
```

### Task 7: Real stdio Verification, Evaluation Set, and Embedding Documentation

**Files:**
- Create: `scripts/fixture-dashboard.ts`, `scripts/verify-stdio.ts`, `scripts/verify-stdout.ts`
- Create: `evals/dashboard-intelligence.xml`, `README.md`, `docs/verification-report.md`
- Modify: `package.json`, `tsconfig.json`
- Create: `test/verification-harness.test.ts`

**Interfaces:**
- `npm run verify:stdio -- --mode live|offline|html|fixture|alien-cwd` launches `node <absolute build/index.js>` through `StdioClientTransport`, performs initialize/list/call/close, and writes bounded evidence.
- Raw purity verifier parses every non-empty stdout frame as JSON-RPC and fails on any other byte line.

- [ ] **Step 1: Write failing harness tests**

Test that the fixture server can emit valid JSON, a 500 JSON error, HTML, and a hung response; evidence serialization redacts response bodies and never contains credential-like field names. Test that the expected seven-call matrix is complete.

- [ ] **Step 2: Run and verify RED**

Run: `npm test -- test/verification-harness.test.ts`

- [ ] **Step 3: Implement the scripted official stdio client and raw capture**

Use absolute paths derived from `import.meta.url`, never cwd. Capture tool definitions and actual structured payloads. Make every client call timeout-bounded. Keep raw stdout separate from stderr and assert all frames parse as JSON-RPC.

- [ ] **Step 4: Add the 10-question XML evaluation set**

Each `<case>` has one stable archived-date question, expected tool, arguments, and machine-checkable criteria. Include all seven tools; avoid today's mutable rankings except capability/health assertions.

- [ ] **Step 5: Run mandatory build and full tests**

Run: `npm run build`

Run: `npm test`

Run: `git diff --check`

Expected: all succeed with no warnings or whitespace errors.

- [ ] **Step 6: Run live stdio verification and capture every tool payload**

Run: `npm run verify:stdio -- --mode live`

Expected: seven registered tools; Tools 1/2/4 return the exact live-model capability message; Tools 3/5/6/7 return real production data or explicit endpoint-specific partial/unavailable sections; stale benchmark source appears in payload.

- [ ] **Step 7: Run deliberate failure and embedded checks**

Run: `npm run verify:stdio -- --mode fixture`

Expected: nonexistent model returns suggestions; impossible resolver is unsatisfiable with exclusions; fixture live-model success obeys unknown/disappeared rules.

Run: `npm run verify:stdio -- --mode offline`

Expected: `tools/list` returns all seven offline; every tool returns `unreachable` within the 10-second production timeout; server remains connected.

Run: `npm run verify:stdio -- --mode html`

Expected: every tool returns a clean `non_json` result without a parse stack or HTML body.

Run: `npm run verify:stdout`

Expected: zero stray stdout lines/bytes; every captured line is a JSON-RPC frame.

Run: `npm run verify:stdio -- --mode alien-cwd`

Expected: spawned with `cwd=C:\`, all seven tools list and live calls behave identically.

- [ ] **Step 8: Write the verification report and README**

Paste the bounded actual `structuredContent` payload for every live tool call plus failure evidence/timings into `docs/verification-report.md`. Include all brief inaccuracies, a zero-credentials statement, and the Electron paragraph: spawn the compiled `build/index.js` with Node, optionally set only `DASHBOARD_BASE_URL`, speak MCP over stdin/stdout, consume stderr separately, and handle structured unavailable/stale results without killing the child.

- [ ] **Step 9: Run credential/stdout/cwd static guards**

Run: `rg -n "console\.log|process\.cwd|readline|prompt\(|open\(|Authorization|Bearer|API_KEY|TOKEN|SECRET|dotenv" src scripts test README.md docs/verification-report.md`

Expected: no production stdout, cwd, prompt, auth, secret-loading, or dotenv use; any fixture/test matches are reviewed and explained.

- [ ] **Step 10: Commit verification and documentation**

```powershell
git add package.json package-lock.json tsconfig.json scripts test/verification-harness.test.ts evals README.md docs/verification-report.md
git commit -m "test: verify dashboard MCP over stdio"
```

### Task 8: Cross-Model Review and Final Evidence Audit

**Files:**
- Modify: only files required by validated review findings
- Update: `docs/verification-report.md`

**Interfaces:**
- Consumes: complete feature-branch diff, brief, plan, and verification report.
- Produces: Claude or Gemini review evidence from a model with different base weights, plus resolved findings.

- [ ] **Step 1: Request the mandatory cross-model review**

Give the reviewer `docs/BRIEF.md`, this plan, `git diff`/commit range, and verification evidence. Ask specifically for protocol framing, output-schema validity, zero-secret/embedded safety, non-negotiable compliance, source-semantic honesty, and missing failure paths.

- [ ] **Step 2: Convert every Important/Critical finding into a failing regression test**

Run the focused test and observe RED before changing production code.

- [ ] **Step 3: Implement minimal fixes and verify GREEN**

Run focused tests, then `npm test`, `npm run build`, live stdio verification, offline verification, and stdout purity again.

- [ ] **Step 4: Record review disposition and final branch state**

Append reviewer identity/model family, findings, fixes, residual limitations, final commands/output, branch name, and commit SHAs to `docs/verification-report.md`.

- [ ] **Step 5: Commit reviewed fixes without merging**

```powershell
git add <reviewed-files> docs/verification-report.md
git commit -m "fix: address cross-model MCP review"
```

Expected: branch remains `feat/dashboard-intelligence-mcp`; no merge or push is performed without an explicit user request.

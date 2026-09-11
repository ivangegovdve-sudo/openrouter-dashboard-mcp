# Open Dashboard 1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record one real OpenRouter generation with authoritative cost and complete performance provenance, expose it through the API and MCP, and render it in the owning explorer UI without deployment or publication.

**Architecture:** The MCP owns the shared Zod contract and a new read-only generation-cost tool. The dashboard API owns a validated local observation ledger and exposes it as a public v2 collection, also attaching observations to matching live-model rows when the catalogue database is available. The explorer loads the collection independently of the catalogue so a real observation remains visible even when the local catalogue database is unavailable.

**Tech Stack:** TypeScript, Zod, Next.js route handlers, Drizzle/Postgres-compatible API types, Node test runner, browser ES modules, and the existing MCP DashboardClient.

**Spec:** `docs/superpowers/specs/2026-09-11-open-dashboard-1-1.md`

## Global Constraints

- Catalogue arithmetic is published rate-card evidence, never a generation cost.
- Every cost observation has state, provenance, provenance date, source URL, provider, model, timestamp, workload, vantage point, token counts, and authoritative field when present.
- A zero balance delta is LAG, not zero cost.
- OpenRouter is MEASURED from its authoritative per-generation response cost; Nous is BLOCKED; Sail is BLOCKED and any balance/run figure is DERIVED.
- TTFT, round trip, and sustained throughput are separate and each carries workload, vantage, token budgets, n, percentile method, and date.
- Keep 186 OpenRouter endpoint rows as endpoint evidence; do not turn them into named integrations.
- Remove the `wavespeedai` UI duplicate and add Nous as provider 13.
- Preserve existing dirty worktrees; do not deploy, publish, release, restart services, or merge into main/master.

### Task 1: Lock the shared cost/performance contract in the MCP

**Files:**
- Create: `src/generation-cost.ts`
- Modify: `src/contract.ts`, `src/speed.ts`, `src/dashboard/schemas/live-models.ts`
- Test: `src/generation-cost.test.ts`, `src/speed.test.ts`, `src/dashboard/schemas/live-models.test.ts`

**Interfaces:**
- Produce `generationCostObservationSchema`, `generationCostCollectionSchema`, `costStateSchema`, `costProvenanceSchema`, and `generationCostObservation` TypeScript types.
- Add `generationCosts` to the live-model object with an empty-array default for old dashboard responses.
- Add `roundTripMs` beside `ttftMs` and `sustainedTps`; keep the three metrics independent.

- [ ] Write failing schema tests for a measured OpenRouter observation, a LAG observation with no numeric cost, and rejection of a catalogue estimate pretending to be measured.
- [ ] Write failing speed tests proving round trip is emitted separately and that workload, vantage, token budgets, n, percentile method, and date are required for numeric figures.
- [ ] Implement the schemas and strict cross-field refinements.
- [ ] Implement the minimum speed-probe changes while preserving the four-run/one-discard/three-retained protocol.
- [ ] Run the focused MCP tests and commit the contract slice on `codex/open-dashboard-mcp-1.1`.

### Task 2: Extend provider registry and MCP generation-cost tool

**Files:**
- Modify: `src/providers/registry.ts`, provider registry tests, `src/server.ts`, generated README inputs
- Create: `src/tools/generation-costs.ts`, `src/tools/generation-costs.test.ts`

**Interfaces:**
- Produce `dashboard_generation_costs`, calling `/api/public/v2/generation-costs` through `DashboardClient` and returning validated observations plus source evidence.
- Add `nous` to the 13-provider registry with `BLOCKED` cost visibility; keep Sail's derived balance note distinct from per-generation cost.

- [ ] Test provider count, Nous state, Sail state, and the new tool's source/provenance output.
- [ ] Implement tool registration and documentation text that calls catalogue values published rates rather than paid cost.
- [ ] Run provider, contract, tool, build, and generated-doc checks and commit.

### Task 3: Add API observation schema, local ledger, and v2 route

**Files:**
- Create: `src/lib/public-api-v2/generation-cost-schemas.ts`, `src/lib/public-api-v2/generation-cost-read.ts`, `src/app/api/public/v2/generation-costs/route.ts`, `src/data/generation-cost-observations.json`
- Modify: API public schema exports and route tests

**Interfaces:**
- `readGenerationCostObservations()` reads and parses the checked-in ledger, filters by provider/model/limit, and returns `{schemaVersion:"2.0",data,cursor:null,window,...}`.
- `GET /api/public/v2/generation-costs` returns the same collection and never manufactures a cost from catalogue prices or balance deltas.

- [ ] Test measured, blocked, derived, unknown, and LAG records and prove a zero delta cannot become a zero cost.
- [ ] Implement the ledger reader and route with the existing API response conventions.
- [ ] Keep the initial ledger empty until a real OpenRouter capture is recorded in Task 6.
- [ ] Run focused API tests and commit.

### Task 4: Attach observations to live-model API rows and extend performance fields

**Files:**
- Modify: `src/lib/public-api-v2/live-model-schemas.ts`, `src/lib/public-api-v2/live-model-read.ts`, `src/db/public-api/enrichment-views.ts`, related API tests

**Interfaces:**
- Add `generationCosts` to each live-model row and merge ledger records matching exact provider/model identity.
- Extend `performance` with independent `ttftMsP50`, `roundTripMsP50`, `sustainedThroughputTps`, workload, vantage point, token budget, n, percentile method, and observed date; retain legacy scalar fields only for backward compatibility and never relabel them.

- [ ] Add schema tests that accept old rows with null/empty new fields and require provenance context for any numeric performance value.
- [ ] Implement read-time merge and preserve null for unmeasured values.
- [ ] Keep the existing endpoint observation query as endpoint evidence; do not join OpenRouter upstream names into the provider registry.
- [ ] Run API typecheck/tests/build and commit.

### Task 5: Correct explorer provider data and render generation evidence

**Files:**
- Modify: `web/open-dashboard/explorer-data.js`, `web/open-dashboard/explorer.js`, `web/open-dashboard/index.html`, `web/open-dashboard/explorer-data.test.js`, UI tests

**Interfaces:**
- Remove `wavespeedai` from `PROVIDERS` and `DIRECT_PROVIDER_IDS`; add `nous` with blocked cost copy.
- Add an API-base query override for local verification without changing the production default.
- Load `/generation-costs` independently and render a “Measured generation evidence” panel showing cost state/provenance/date, upstream provider, exact model slug, token counts, workload, vantage point, authoritative field, and separate TTFT/round trip/throughput details.
- Replace the “Example workload · USD” catalogue-cost axis with a published-rate label and make any rate-card arithmetic visibly an estimate, never a measured cost.

- [ ] Test duplicate provider removal, Nous presence, cost-state rendering text, and no catalogue-derived generation-cost label.
- [ ] Implement the panel and local API override using existing escape/link helpers.
- [ ] Run the full explorer test suite and build/static checks and commit.

### Task 6: Capture a real OpenRouter generation and verify the full path

**Files:**
- Create: `scripts/record-openrouter-generation.mjs` or the repository's established equivalent
- Modify: `src/data/generation-cost-observations.json` only with the sanitized real response evidence

**Interfaces:**
- The recorder calls OpenRouter with a vaulted key, captures the routed upstream provider, model slug, usage token counts, authoritative cost field, timestamp, workload, vantage point, round trip, and (when streaming) TTFT, then writes a schema-valid observation without persisting credentials or prompt content.

- [ ] Run one real, low-token OpenRouter generation using the approved read-only secret path; confirm response success and authoritative cost field.
- [ ] Record the sanitized observation in the API ledger and validate it with both the API and MCP schemas.
- [ ] Start the local API and explorer servers, load the UI with the local API override, and confirm the real row and provenance label are visible in browser DOM/text.
- [ ] Run the MCP generation-cost tool against the same local API and confirm the exact row, then run all MCP/API/UI verification commands.
- [ ] Commit the recorded evidence and verification harnesses on feature branches; do not push to main, publish, or deploy.

### Task 7: Final cross-repository verification

**Files:**
- Test only; no source changes unless a verification defect is found.

- [ ] Verify each worktree branch, tree status, commit hash, and absence of deployment/publication commands.
- [ ] Verify API JSON, MCP tool output, and rendered UI all contain the same provider/model/cost/timestamp/token/workload/vantage row.
- [ ] Verify wavespeed duplicate is absent from provider data while endpoint evidence remains separately labelled.
- [ ] Report once with exact commands, results, local URLs, and any remaining non-deployed limitation.

# OpenRouter Dashboard MCP

Read-only MCP access to the public OpenRouter GitHub Dashboard intelligence API. The server exposes nine bounded tools over stdio and returns the same machine-readable value in `structuredContent` and JSON text content.

## Build and run

Requires Node.js 20 or newer.

```powershell
npm install
npm run build
node .\build\index.js
```

The compiled executable remains `build/index.js`. By default it reads the public dashboard at `https://openrouter-github-dashboard.vercel.app` with zero credentials. To point the child at another compatible deployment, set only `DASHBOARD_BASE_URL` to an absolute HTTP(S) URL without URL credentials.

The server speaks MCP newline-delimited JSON over stdin/stdout. Stdout is protocol-only; application diagnostics belong on stderr.

## Tools

| Tool | Purpose |
|---|---|
| `dashboard_resolve_model` | Resolve bounded, evidence-backed model fallbacks from intent and capability constraints. |
| `dashboard_model_status` | Check an exact model id, lifecycle evidence, and bounded suggestions. |
| `dashboard_whats_changed` | Summarize appearances, disappearances, deprecations, and rank movements since an archived date. |
| `dashboard_free_models` | List usable free models and public frontier evidence without treating unknown prices as free. |
| `dashboard_usage_leaders` | Compare bounded public model/app usage and latest complete app-model evidence. |
| `dashboard_source_health` | Report public route, freshness, completeness, and latest-attempt source health. |
| `dashboard_github_movers` | Compare category-scoped GitHub project-family momentum with explicit baseline coverage. |
| `dashboard_model_economics` | Compare models on price per token and per million tokens, published provider discounts, context, modality, tool/reasoning support and retirement risk. Cheapest first. |
| `dashboard_key_inventory` | Report configured OpenRouter keys by Secret Manager name with spend, ceiling and rate limit, and name the keys with no ceiling. Opt-in; read-only. |

Every tool is read-only, non-destructive, and open-world. Results preserve exact integer/decimal strings, provenance, stale markers, caps, and explicit unavailable/partial states. A tool-level upstream failure is returned as structured data and does not terminate the MCP connection.

`/api/public/v2/live-models` is deployed and serving as of 2026-08-27. If the dashboard stops publishing it, model resolution, exact model status, and usable-free-model queries return an explicit capability decline pointing at `dashboard_source_health` instead of fabricating catalogue data.

## Discounts

OpenRouter publishes a discount as a **provider-endpoint** fact, not a model fact — measured 2026-08-19, zero of 550 models carry a `discount` key while 272 of 272 provider endpoints do. `dashboard_model_economics` therefore reads `/api/public/v2/models/{id}/providers` per model and reports the best published discount with the provider named, so the number is checkable.

Three distinctions the tool refuses to collapse:

- **`no_discount`** — endpoints were read and every one published nothing or zero. The only value that means full price.
- **`unavailable`** — the dashboard holds no endpoint observation for that model. Upstream observes endpoints under a daily request budget, so most of the catalogue is unobserved at any moment. Unknown, never full price.
- **`not_checked`** — the per-call enrichment bound was reached. Also unknown.

**No expiry is published.** OpenRouter exposes a discount ratio and no end date, so `expiresAt` is always `null` with `expiryPublished: false`. That is an absence of upstream data, not a claim that the discount is permanent.

There is no public route listing all discounted models, so discovery is per model and bounded by `discountEnrichment`.

## Free versus rate-limited free

`freeKind` separates `concrete_free` (a real zero-priced model) from `free_router` (OpenRouter's rate-limited free routing tier, usable for a probe but not a workload) from `paid_or_unknown` (which includes providers publishing no price at all — unknown, and never treated as free). `genuinelyFree` is true only for `concrete_free`. `emitsText` gates out zero-priced audio and video models, without which the cheapest free model is a music generator.

## Auditing pinned model slugs

Pass `ids` to `dashboard_model_economics` with the slugs a config hardcodes. Ids absent from the catalogue come back in `missingIds` — the 404 a config is about to hit, observed before it happens — and surviving ids carry current price, discount and `retirementRisk`.

## Key inventory

`dashboard_key_inventory` is the only tool that touches a credential, and it is opt-in so the zero-credential default survives for everything else. Unconfigured, it returns `unconfigured`, which is a normal outcome rather than an error.

Set `OPENROUTER_KEY_SOURCES` to comma-separated `secretManagerName=ENV_VAR` pairs and provide each named environment variable:

```
OPENROUTER_KEY_SOURCES=openrouter-council=OR_COUNCIL,openrouter-anycloudllm-gift=OR_GIFT
```

Only the Secret Manager names are ever reported. Key values are never returned, logged, or written to evidence. The tool issues GET requests only and contains no code path that can mint, modify, or revoke a key — provisioning stays with `openrouter-management-key` and a separate tool.

`usdLimit: null` with `uncapped: true` is the finding worth acting on: a key with no spend ceiling can spend without bound if it leaks.

## Verification

Build first, then run the real compiled child through the official SDK client:

```powershell
npm run verify:stdio -- --mode live
npm run verify:stdio -- --mode fixture
npm run verify:stdio -- --mode offline
npm run verify:stdio -- --mode html
npm run verify:stdout
npm run verify:stdio -- --mode alien-cwd
```

All six modes pass as of 2026-08-27. `live` and `alien-cwd` use the public zero-credential default. `fixture`, `offline`, `html`, and `verify:stdout` use loopback-only test infrastructure. Evidence is written under ignored `verification/raw/` only after validation. The raw verifier is separate because the official stdio transport does not expose child stdout and therefore cannot prove byte purity on its own.

The ten independent archived-date evaluation cases are in `evals/dashboard-intelligence.xml`. The latest checked payloads and timings are recorded in `docs/verification-report.md`.

## Embedding in Electron

An Electron host should spawn the compiled absolute `build/index.js` path with the Node executable, optionally set only `DASHBOARD_BASE_URL`, speak MCP over the child's stdin/stdout, and consume stderr separately. Treat structured unavailable, partial, stale, and endpoint-specific error results as normal tool outcomes; do not kill the child when an upstream source is unavailable.

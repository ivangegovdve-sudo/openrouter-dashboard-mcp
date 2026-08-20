# OpenRouter Dashboard MCP

Read-only MCP access to the public OpenRouter GitHub Dashboard intelligence API. The server exposes seven bounded tools over stdio and returns the same machine-readable value in `structuredContent` and JSON text content.

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

Every tool is read-only, non-destructive, and open-world. Results preserve exact integer/decimal strings, provenance, stale markers, caps, and explicit unavailable/partial states. A tool-level upstream failure is returned as structured data and does not terminate the MCP connection.

The deployed public manifest may not yet include `/api/public/v2/live-models`. In that state, model resolution, exact model status, and usable-free-model queries return the exact PR #24 capability decline instead of fabricating catalogue data.

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

`live` and `alien-cwd` use the public zero-credential default. `fixture`, `offline`, `html`, and `verify:stdout` use loopback-only test infrastructure. Evidence is written under ignored `verification/raw/` only after validation. The raw verifier is separate because the official stdio transport does not expose child stdout and therefore cannot prove byte purity on its own.

The ten independent archived-date evaluation cases are in `evals/dashboard-intelligence.xml`. The latest checked payloads and timings are recorded in `docs/verification-report.md`.

## Embedding in Electron

An Electron host should spawn the compiled absolute `build/index.js` path with the Node executable, optionally set only `DASHBOARD_BASE_URL`, speak MCP over the child's stdin/stdout, and consume stderr separately. Treat structured unavailable, partial, stale, and endpoint-specific error results as normal tool outcomes; do not kill the child when an upstream source is unavailable.

# Open Dashboard MCP

Read-only MCP access to the public Open Dashboard intelligence API, covering **OpenRouter, Groq and Cerebras** in one comparable shape. The server exposes nine bounded tools over stdio and returns the same machine-readable value in `structuredContent` and JSON text content.

OpenRouter ships its own MCP server. It is single-vendor by construction, which makes it unable to answer the question this one exists for: *of the providers I actually hold keys with, which is the cheapest capable option right now.*

## Install

```bash
npx -y open-dashboard-mcp
```

That runs the server directly with no install step. To add it to Claude Code:

```bash
claude mcp add open-dashboard -- npx -y open-dashboard-mcp
```

For Claude Desktop, add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "open-dashboard": {
      "command": "npx",
      "args": ["-y", "open-dashboard-mcp"]
    }
  }
}
```

Requires Node.js 20 or newer. No API key is needed for any tool except the optional key inventory.

### Where the data comes from

Every tool reads a **public, zero-credential HTTP API** that ingests OpenRouter, Groq, Cerebras and GitHub daily and republishes the result. By default that is `https://openrouter-github-dashboard.vercel.app`, a deployment run by this project's author on a hobby-tier host. It is public and needs no credentials, but it is **not a service with an uptime guarantee**, and every user of this package reads from the same instance.

Point it at your own compatible deployment with `DASHBOARD_BASE_URL`:

```json
{
  "mcpServers": {
    "open-dashboard": {
      "command": "npx",
      "args": ["-y", "open-dashboard-mcp"],
      "env": { "DASHBOARD_BASE_URL": "https://your-deployment.example.com" }
    }
  }
}
```

When a source is unavailable the tools say so as structured data — `unavailable`, `partial`, `stale` — rather than failing or inventing a value. That is the intended behaviour, not an error.

## Providers

| | catalogue | pricing | context | modality | lifecycle | discounts | spend API |
|---|---|---|---|---|---|---|---|
| OpenRouter | 560+ | most | yes | yes | yes | per endpoint | yes |
| Groq | 13 | some | yes | yes | **no** | no | **no** |
| Cerebras | 2 | **no** | **no** | **no** | **no** | no | **no** |

Measured 2026-08-27. The catalogues disagree about almost everything, and **normalising them is the work** — the API calls are the easy part.

Three rules follow from that table, and the tools enforce all three:

- **An unpriced model is cost-unknown, never free.** Cerebras publishes no prices at all; Groq publishes them for part of its catalogue. Those rows keep their place in the answer with `priceComparable: false` and a stated `unrankableReason`, listed after the ranked rows rather than dropped — otherwise "cheapest across everything" silently means "cheapest among the rows that happened to carry a number".
- **No lifecycle signal is not the same as no risk.** Only OpenRouter publishes deprecation. Groq and Cerebras models report `retirementRisk: "not_published_by_provider"`, because `"none"` would be a false reassurance. For those two, a model vanishing from the list is the only retirement notice there is — so `availability: "disappeared"` is treated as imminent.
- **Every null cites the provider that withheld it.** [`src/providers/registry.ts`](src/providers/registry.ts) declares, per provider, what is published `always`, `partial` or `never`. Adding a fourth provider is a new entry there plus its id in `providerIdSchema`; nothing else in this server enumerates providers.

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
| `dashboard_model_economics` | Compare models **across all three providers** on price per token and per million tokens, discounts, context, modality, tool/reasoning support, measured throughput/latency and retirement risk. Cheapest priced first. |
| `dashboard_key_inventory` | Report configured OpenRouter, Groq and Cerebras keys by Secret Manager name: liveness for all three, spend and ceiling for OpenRouter. Opt-in; read-only. |
| `dashboard_resolve_model` | Resolve bounded, evidence-backed model fallbacks from intent and capability constraints. |
| `dashboard_model_status` | Check an exact model id, lifecycle evidence, and bounded suggestions. |
| `dashboard_whats_changed` | Summarize appearances, disappearances, deprecations, and rank movements since an archived date. |
| `dashboard_free_models` | List usable free models and public frontier evidence without treating unknown prices as free. |
| `dashboard_usage_leaders` | Compare bounded public model/app usage and latest complete app-model evidence. |
| `dashboard_source_health` | Report public route, freshness, completeness, and latest-attempt source health. |
| `dashboard_github_movers` | Compare category-scoped GitHub project-family momentum with explicit baseline coverage. |

Every tool is read-only, non-destructive, and open-world. Results preserve exact integer/decimal strings, provenance, stale markers, caps, and explicit unavailable/partial states. A tool-level upstream failure is returned as structured data and does not terminate the MCP connection.

`/api/public/v2/live-models` — the cross-provider catalogue — is deployed and serving as of 2026-08-27. If the dashboard stops publishing it, model resolution, exact model status, and usable-free-model queries return an explicit capability decline pointing at `dashboard_source_health` instead of fabricating catalogue data.

## Discounts

Of the three providers, **only OpenRouter publishes discounts at all**, and it publishes them as a **provider-endpoint** fact rather than a model fact — measured 2026-08-19, zero of 550 models carry a `discount` key while 272 of 272 provider endpoints do. `dashboard_model_economics` therefore reads `/api/public/v2/models/{id}/providers` per model and reports the best published discount with the provider named, so the number is checkable. Groq and Cerebras rows report `not_published_by_provider` and cost no upstream request.

Four distinctions the tool refuses to collapse:

- **`discounted`** — a non-zero published discount was found.
- **`no_discount`** — endpoints were read and every one published nothing or zero. The only value that means full price.
- **`unavailable`** — the dashboard holds no endpoint observation for that model. Upstream observes endpoints under a daily request budget, so most of the catalogue is unobserved at any moment. Unknown, never full price.
- **`not_published_by_provider`** — this provider has no discount concept at all. Nothing to look up.
- **`not_checked`** — the per-call enrichment bound was reached. Also unknown.

**No expiry is published by any provider.** OpenRouter exposes a discount ratio and no end date; Groq and Cerebras expose no discounts at all. So `expiresAt` is always `null` with `expiryPublished: false`, and the registry records `discountExpiry: "never"` for all three. That is an absence of upstream data, not a claim that a discount is permanent.

There is no public route listing all discounted models, so discovery is per model and bounded by `discountEnrichment`.

## Free versus rate-limited free

`freeKind` separates `concrete_free` (a real zero-priced model) from `free_router` (a rate-limited free routing tier, usable for a probe but not a workload) from `paid_or_unknown` (which includes every provider that publishes no price — unknown, and never treated as free). `genuinelyFree` is true only for `concrete_free`.

`emitsText` is `true`, `false`, or `null` where the provider publishes no modality. Without it the cheapest free model is a music generator. `includeUnknownCapability` (default true) decides whether rows with unpublished capability take part; set it false when a hard guarantee is needed, at the cost of excluding Cerebras entirely.

## Auditing pinned model slugs

Pass `ids` to `dashboard_model_economics` with the slugs a config hardcodes, across any provider. Ids absent from **every** provider catalogue come back in `missingIds` — the 404 a config is about to hit, observed before it happens — and surviving ids carry current price, discount and `retirementRisk`.

## Key inventory

`dashboard_key_inventory` is the only tool that touches a credential, and it is opt-in so the zero-credential default survives for everything else. Unconfigured, it returns `unconfigured`, which is a normal outcome rather than an error.

Set `OPEN_DASHBOARD_KEY_SOURCES` to comma-separated `provider:secretManagerName=ENV_VAR` triples and provide each named environment variable:

```
OPEN_DASHBOARD_KEY_SOURCES=openrouter:my-openrouter-key=OPENROUTER_API_KEY,groq:my-groq-key=GROQ_API_KEY,cerebras:my-cerebras-key=CEREBRAS_API_KEY
```

Only the Secret Manager names are ever reported. Key values are never returned, logged, or written to evidence — a test asserts the serialized result contains no key material. The tool issues GET requests only and contains no code path that can mint, modify, or revoke a key. Keep provisioning with a separate, privileged key that this server never sees.

**Spend is not uniformly readable, and the tool says so rather than leaving a blank.** OpenRouter exposes per-key usage and ceiling. Groq and Cerebras expose **no billing API at all**, so their keys report `spendReadability: "no_billing_api"` with `usdSpent: null` and a stated reason. A blank money field reads as zero, and zero is a different claim.

`usdLimit: null` with `uncapped: true` is the finding worth acting on: a key with no spend ceiling can spend without bound if it leaks.

### Edge block versus dead key

A `401`/`403` carrying Cloudflare code **1010** means the request was rejected at the edge before reaching the provider — usually for sending no User-Agent — and says nothing about whether the key is valid. Reported as `edge_blocked` with `alive: null`, distinct from `rejected`, because treating it as a dead key has caused wrong rotations before. Every probe sends a User-Agent for this reason.

Verified 2026-08-27 from a Windows host: Groq answers `401 invalid_api_key` and Cerebras `403 {"detail":"Not authenticated"}`, with and without a User-Agent — ordinary credential errors, no 1010. The 1010 case is real but host-specific, so it is detected from the body rather than assumed from the status.

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

All six modes pass as of 2026-08-27. The fixture mode asserts that all three providers survive into one answer, that a priced Groq model ranks while an unpriced Cerebras model is kept and explained, and that no discount expiry is invented.

`live` and `alien-cwd` use the public zero-credential default. `fixture`, `offline`, `html`, and `verify:stdout` use loopback-only test infrastructure. Evidence is written under ignored `verification/raw/` only after validation. The raw verifier is separate because the official stdio transport does not expose child stdout and therefore cannot prove byte purity on its own.

The ten independent archived-date evaluation cases are in `evals/dashboard-intelligence.xml`. The latest checked payloads and timings are recorded in `docs/verification-report.md`.

## Embedding in Electron

An Electron host should spawn the compiled absolute `build/index.js` path with the Node executable, optionally set only `DASHBOARD_BASE_URL`, speak MCP over the child's stdin/stdout, and consume stderr separately. Treat structured unavailable, partial, stale, and endpoint-specific error results as normal tool outcomes; do not kill the child when an upstream source is unavailable.

The key inventory must stay **off** in a distributed build: leave `OPEN_DASHBOARD_KEY_SOURCES` unset and it reports `unconfigured`. The zero-credential default is what makes embedding possible at all — OpenRouter's own MCP server mints a real API key over OAuth and therefore cannot ship inside a distributed desktop app.

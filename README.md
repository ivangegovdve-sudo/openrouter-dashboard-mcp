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

## Freshness, and what happens when the source is slow

Every tool reads a **public, zero-credential HTTP API** at query time. That host is a hobby-tier deployment with no uptime obligation, and it is a dependency of every answer. Two things follow, and both are visible in the response rather than assumed.

**Responses are cached, and every answer carries its own age.** A single `dashboard_model_economics` call can make two dozen upstream requests; reading live every time would put avoidable load on that host. Each `evidence[]` entry carries `freshness`:

```json
"freshness": {
  "state": "cached",
  "fetchedAt": "2026-08-27T20:21:52.494Z",
  "ageSeconds": 30,
  "expiresAt": "2026-08-27T20:26:52.494Z"
}
```

`state` is `live` (fetched during this call), `cached` (inside its expiry), or `expired`. Default TTL is five minutes; pass `cache: { ttlMs: 0 }` to read live every time, or `cache: false` to disable it.

**When the host is slow or down, you get an honest answer, never a silent fallback.** With nothing cached, the upstream failure is returned as structured data — `unavailable` with a reason. With an expired entry in hand, the last-known value *is* returned, but marked:

```json
"freshness": {
  "state": "expired",
  "fetchedAt": "2026-08-27T20:21:52.494Z",
  "ageSeconds": 3600,
  "note": "Upstream could not be reached, so this is the last known value,
           measured 2026-08-27T20:21:52.494Z (3600s ago). It is not current."
}
```

Stale pricing is the exact harm this tool exists to prevent, so a number is never handed back as current when it is not. **Unmeasured is not zero, and stale is not fresh** — the age arrives with the answer so a caller can refuse it.

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
| `dashboard_whats_changed` | Summarize appearances, disappearances, deprecations, **models that stopped being free**, and rank movements since an archived date. Price movement states the window it was actually compared over. |
| `dashboard_free_models` | List usable free models and public frontier evidence without treating unknown prices as free. |
| `dashboard_usage_leaders` | Compare bounded public model/app usage and latest complete app-model evidence. |
| `dashboard_source_health` | Report public route, freshness, completeness, and latest-attempt source health. |
| `dashboard_github_movers` | Compare category-scoped GitHub project-family momentum with explicit baseline coverage. |

Every tool is read-only, non-destructive, and open-world. Results preserve exact integer/decimal strings, provenance, stale markers, caps, and explicit unavailable/partial states. A tool-level upstream failure is returned as structured data and does not terminate the MCP connection.

`/api/public/v2/live-models` — the cross-provider catalogue — is deployed and serving as of 2026-08-27. If the dashboard stops publishing it, model resolution, exact model status, and usable-free-model queries return an explicit capability decline pointing at `dashboard_source_health` instead of fabricating catalogue data.

## Models that stopped being free

A free model does not announce itself when it starts charging. Its id does not change, it stays listed, and nothing else in a catalogue moves. The bill is the notification.

`dashboard_whats_changed` compares the two most recent archived catalogue runs and reports price movement, with models that **left free** in their own bucket:

```json
"priceChanges": {
  "status": "available",
  "becamePaid": [
    {
      "modelId": "vendor/was-free",
      "transition": "became_paid",
      "basePromptPrice": "0", "headPromptPrice": "0.0000004",
      "wasFree": true, "isFree": false,
      "note": "vendor/was-free was free and now charges 0.0000004 per prompt
               token. Nothing about its id changed, so a pinned config keeps
               calling it and starts paying."
    }
  ],
  "otherChanges": [],
  "headPublishedOn": "2026-08-26",
  "coverage": {
    "status": "indeterminate",
    "reason": "The producer identifies this comparison by run id and publishes no
               date for either run, so how far back it reaches is not published.
               Whether it covers 2026-08-18 to 2026-08-25 cannot be determined
               from this response, so an empty result is not evidence that
               nothing started charging."
  },
  "comparison": { "baseRunId": "…", "headRunId": "…" }
}
```

The comparison is the archive's own run chain, not a date you choose, so the answer is always "since the last collection" and cannot straddle a missed run and present a stale delta as fresh. Prices are compared as exact decimals — never floats — because a rounding error in a price comparison would invent or hide a change. Zero is recognised semantically, so `0`, `0.0` and `0.00000000000000000000` are all free; a **null price is not free**, it means nothing was published.

### The window you asked for is not the window prices were compared over

Every other section of `dashboard_whats_changed` honours the `since` you pass. Price movement cannot: the public route takes no window parameter and always compares the two most recent archived runs. An empty `becamePaid` inside a month-wide response would otherwise read as a month-wide all-clear it never was.

**And the comparison's span is not published.** The route identifies its two runs by id and carries no date for either. The response envelope does have a `window`, but that is the *head publication date*, not the span — measured against production on 2026-08-27, `window.start === window.end === 2026-08-26` while `baseRunId !== headRunId` on a daily collection cadence, so the real comparison covers at least two days and the envelope calls it one. Reading it as the span understates the comparison and invents a coverage answer.

So the section reports only what the payload supports:

- **`headPublishedOn`** — the newest catalogue state examined, named for what it is.
- **`coverage.status`** is `incomplete` or `indeterminate`, and **never `complete`.** Complete coverage would require the base run's date, which is not published. `incomplete` is the one verdict the response does support: nothing after the head run was examined, so a `headPublishedOn` earlier than the report's `through` proves the tail of your window went unchecked — the lagging-collector case, and the days a reader most assumes are covered.
- **`coverage.reason`** says which of the two it is and why, and the same sentence is pushed into the response `warnings` every time, because a field nobody reads is not a disclosure.

`indeterminate` is not a softer way of saying fine. It means an empty result is not evidence about your window.

**An inverted window is stated, not silently satisfied.** `since` is yours and `through` is derived from the newest complete bucket, so the two can cross. Every window-scoped section then reports nothing — which is exactly what a satisfied query looks like — so the report says the window describes no interval.

**The summary can no longer read as an all-clear while prices moved.** It leads with the money — `1 model stopped being free in the comparison ending 2026-08-26` — and price movement with no free-to-paid row still gets its own sentence rather than passing unmentioned. Where the summary used to say *no changes* and *nothing changed*, it says *no other changes* and *nothing else changed* whenever the price section reports movement.

**The two counts are never added together.** Price rows come from the producer's comparison, not from your window, so a single total would state a number for a window some of the counted items sit outside. Each sentence carries its own count and its own comparison instead.

**A capped price page is a floor, not a total.** `/price-changes` paginates and the section reads one page of 100 mixed rows, so when `cap.capped` is true the counts are qualified — `At least 2 models stopped being free …, and the price comparison was capped at 100 rows with more unread`. A capped page also may not rule the transition *out*: where an uncapped page says `none of them a model leaving free`, a capped one says `None of the rows read was a model leaving free, but … an unread row still could be`. The categorical zero is the expensive claim here, and only a complete read earns it.

**A price section that failed to read degrades the report.** A `whats_changed` whose price section is `unavailable` or `unsupported_by_public_api` returns `status: "partial"`, never `"ok"`, and the summary says the failure is not evidence that nothing started charging.

**Three failure states, none of which is an empty list.** An empty `becamePaid` means nothing left free in what was compared. If the deployment does not serve the endpoint, you get `unsupported_by_public_api`; if it could not be read, `unavailable` with the reason. Returning an empty list on failure would read as *nothing started charging you*, which is the most expensive wrong answer this server could give.

Only models present in **both** runs are compared. A model that appeared or vanished is a different question, answered by the appearance and disappearance sections — folding it in here would report a brand-new model as having started charging.

## Discounts

**Discount coverage is rich for OpenRouter and absent everywhere else.** Of the three providers, **only OpenRouter publishes discounts at all** — Groq and Cerebras rows always report `not_published_by_provider`, which is a fact about those providers and not a gap this server can close. Do not read the discount features as working equally across providers; they do not.

OpenRouter publishes discounts as a **provider-endpoint** fact rather than a model fact — measured 2026-08-19, zero of 550 models carry a `discount` key while 272 of 272 provider endpoints do. `dashboard_model_economics` therefore reads `/api/public/v2/models/{id}/providers` per model and reports the best published discount with the provider named, so the number is checkable. Groq and Cerebras rows report `not_published_by_provider` and cost no upstream request.

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

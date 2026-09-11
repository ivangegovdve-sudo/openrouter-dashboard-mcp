# Open Dashboard MCP

Agents need live model IDs and price provenance because stale slugs break prompts and catalogue prices cannot tell them what a routed generation will cost.

Read-only MCP access to live model catalogues, published media prices, and GitHub trending repositories.

open-dashboard-mcp gives an agent live model IDs and published prices across OpenRouter, Groq, Cerebras, Sail, QwenCloud, DeepInfra, Novita, SambaNova, Chutes, WaveSpeedAI, fal, Crazyrouter, and Nous Research. The catalogue covers text, image, video, and audio, and each figure carries its source and check date so a published rate is not mistaken for measured request cost.

It also surfaces daily trending GitHub repos.

Read only, free, no account.

# Use it

## Install

```bash
npx -y open-dashboard-mcp
```

That runs the server directly with no install step. To add it to Claude Code:

```bash
claude mcp add open-dashboard -- npx -y open-dashboard-mcp
```

### Installing only the tools you want

All seventeen tools are enabled by default. To install a subset, set
`OPEN_DASHBOARD_TOOLS` to a comma-separated allowlist in the server's environment.
Deselected tools are **absent from `tools/list` entirely** — not present and failing —
so a client never sees a tool it cannot use:

```json
{
  "mcpServers": {
    "open-dashboard": {
      "command": "npx",
      "args": ["-y", "open-dashboard-mcp"],
      "env": {
        "OPEN_DASHBOARD_TOOLS": "dashboard_catalogue,dashboard_price_comparison,dashboard_contract"
      }
    }
  }
}
```

`OPEN_DASHBOARD_PROVIDERS` does the same for providers: deselected ones are absent from
provider-bearing responses rather than appearing as empty catalogues. Leave either unset
to get everything.

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

Dashboard-backed tools read a **public, zero-credential HTTP API** that collects provider catalogues and GitHub daily and republishes the result. The catalogue tool additionally reads public provider sources; optional key inventory has its own opt-in credential path. QwenCloud's native catalogue requires a credential held by the collector; MCP users read the public archived result. The MCP also reads Sail's pinned pricing document directly. By default the dashboard is `https://openrouter-github-dashboard.vercel.app`, a deployment run by this project's author on a hobby-tier host. It is public and needs no credentials, but it is **not a service with an uptime guarantee**, and every user of this package reads from the same instance.

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

## Build and run

Requires Node.js 20 or newer.

```powershell
npm install
npm run build
node .\build\index.js
```

The compiled executable remains `build/index.js`. By default it reads the public dashboard at `https://openrouter-github-dashboard.vercel.app` with zero credentials. To point the child at another compatible deployment, set only `DASHBOARD_BASE_URL` to an absolute HTTP(S) URL without URL credentials.

The server speaks MCP newline-delimited JSON over stdin/stdout. Stdout is protocol-only; application diagnostics belong on stderr.

The summary, provider declarations, pitches, caveats and tool table are generated from the package registry and a real in-memory `tools/list` handshake. `npm run build` regenerates them; `npm run docs:check` fails if committed README facts differ. `npm run docs:generate` refreshes the marked `generated-do-not-edit` blocks. The companion site pins the same package export to an immutable source commit so its release candidate documentation can be reviewed before npm publication.

## Embedding in Electron

An Electron host should spawn the compiled absolute `build/index.js` path with the Node executable, optionally set only `DASHBOARD_BASE_URL`, speak MCP over the child's stdin/stdout, and consume stderr separately. Treat structured unavailable, partial, stale, and endpoint-specific error results as normal tool outcomes; do not kill the child when an upstream source is unavailable.

The key inventory must stay **off** in a distributed build: leave `OPEN_DASHBOARD_KEY_SOURCES` unset and it reports `unconfigured`. The zero-credential default is what makes embedding possible at all — OpenRouter's own MCP server mints a real API key over OAuth and therefore cannot ship inside a distributed desktop app.

# What it covers

<!-- summary:begin generated-do-not-edit -->

Read-only MCP access to public model and GitHub evidence, covering **OpenRouter, Groq, Cerebras, Sail, Nous Research, QwenCloud, DeepInfra, Novita, SambaNova, Chutes, WaveSpeedAI, fal, Crazyrouter**. Version **1.1.0** registers **13 providers** and exposes seventeen bounded tools over stdio. Results use the same machine-readable value in `structuredContent` and JSON text content.

<!-- summary:end -->

**What you actually get:**

- **One catalogue across thirteen named providers** — OpenRouter, Groq, Cerebras, Sail,
  Nous Research, QwenCloud, DeepInfra, Novita, SambaNova, Chutes, WaveSpeedAI, fal and
  Crazyrouter.
- **Prices you can compare, or a refusal.** Two prices are compared only when they share a
  unit *and* a condition. Otherwise you get `not_comparable` and the reason — never a
  number that looks right and is not.
- **Every figure carries its provenance** — the page it was read from, the timestamp, and
  whether it was published, derived, or parsed out of prose.
- **Generation cost stays auditable.** Numeric per-generation cost is shown only when the
  provider returns an authoritative field. OpenRouter observations retain `usage.cost`;
  Nous Research and Sail remain `BLOCKED` when no such field exists, and short samples
  remain `INSUFFICIENT EVIDENCE` rather than becoming a single-looking estimate.
- **Unknown stays unknown.** A price nobody publishes is not zero, and a rate this package
  cannot source is not printed as a number.
- **No credentials needed to start.** It reads public endpoints by default; keys only
  widen what it can see.

**What it is not:** not a proxy, not a router, not a billing dashboard. It answers
questions about models and prices. It never sends inference traffic, and it never writes
anything anywhere.

## Tools

<!-- tools:begin generated-do-not-edit -->

**17 read-only tools**, read from the server's actual MCP `tools/list` registration graph without calling any tool.

| Tool | Purpose |
|---|---|
| `dashboard_benchmarks` | Dashboard benchmark observations |
| `dashboard_catalogue` | Provider model catalogue and comparable media prices |
| `dashboard_contract` | MCP schema and deprecation contract |
| `dashboard_free_models` | Dashboard usable free models |
| `dashboard_generation_costs` | Measured generation costs |
| `dashboard_github_movers` | Dashboard public GitHub momentum movers |
| `dashboard_github_trending` | GitHub trending repositories |
| `dashboard_key_inventory` | Open Dashboard key inventory |
| `dashboard_matrix` | Dashboard app-model matrix |
| `dashboard_model_economics` | Open Dashboard model economics |
| `dashboard_model_status` | Dashboard model status |
| `dashboard_price_comparison` | Shared-model aggregator price comparison |
| `dashboard_resolve_model` | Dashboard resolve model |
| `dashboard_source_health` | Dashboard source health |
| `dashboard_speed` | Provider speed claims and probe protocol |
| `dashboard_usage_leaders` | Dashboard public ecosystem usage leaders |
| `dashboard_whats_changed` | Dashboard changes |

<!-- tools:end -->

Every tool is read-only, non-destructive, and open-world. Results preserve exact integer/decimal strings, provenance, stale markers, caps, and explicit unavailable/partial states. A tool-level upstream failure is returned as structured data and does not terminate the MCP connection.

`/api/public/v2/live-models` — the cross-provider catalogue — is deployed and serving as of 2026-08-27. If the dashboard stops publishing it, model resolution, exact model status, and usable-free-model queries return an explicit capability decline pointing at `dashboard_source_health` instead of fabricating catalogue data.

## Providers

<!-- providers:begin generated-do-not-edit -->

Generated from the package registry: **13 providers** in **open-dashboard-mcp 1.1.0**. Publication declarations describe the named connector; they are not fresh measurements or a full provider inventory.

| Provider | Sources | Pricing | Context | Modality | Lifecycle | Discounts | Spend visibility |
|---|---|---|---|---|---|---|---|
| <span data-provider-id="openrouter">OpenRouter</span><br>Multi-provider aggregator | [Catalogue](https://openrouter.ai/api/v1/models) · [Documentation](https://openrouter.ai/docs/api/api-reference/models/get-models) | Some collected models | All collected models | All collected models | All collected models | Some collected models | Billing API |
| <span data-provider-id="groq">Groq</span> | [Catalogue](https://api.groq.com/openai/v1/models) · [Documentation](https://console.groq.com/docs/api-reference#models-list) | Some collected models | All collected models | All collected models | Not published in this connector | Not published in this connector | No billing API |
| <span data-provider-id="cerebras">Cerebras</span> | [Catalogue](https://api.cerebras.ai/v1/models) · [Documentation](https://inference-docs.cerebras.ai/api-reference/models) | Some collected models | Not published in this connector | Not published in this connector | Not published in this connector | Not published in this connector | No billing API |
| <span data-provider-id="sail">Sail</span> | [Catalogue](https://api.sailresearch.com/v1/models) · [Documentation](https://docs.sailresearch.com/pricing.md) | Some collected models | Not published in this connector | Not published in this connector | Not published in this connector | Not published in this connector | Not established |
| <span data-provider-id="nous">Nous Research</span><br>Model provider | [Catalogue](https://nousresearch.com/) · [Documentation](https://nousresearch.com/) | Some collected models | Not established | Not established | Not established | Not established | Not established |
| <span data-provider-id="qwencloud">QwenCloud</span> | [Catalogue](https://dashscope-intl.aliyuncs.com/api/v1/models) · [Documentation](https://dashscope-intl.aliyuncs.com/api/v1/models) | Some collected models | Some collected models | Some collected models | Not published in this connector | Not published in this connector | No billing API |
| <span data-provider-id="deepinfra">DeepInfra</span> | [Catalogue](https://api.deepinfra.com/models/list) · [Documentation](https://deepinfra.com/models) | All collected models | Some collected models | Not published in this connector | Some collected models | Not published in this connector | No billing API |
| <span data-provider-id="novita">Novita</span> | [Catalogue](https://api.novita.ai/v3/openai/models) · [Documentation](https://novita.ai/docs/api-reference/model-apis-llm-list-models) | Some collected models | All collected models | All collected models | Not published in this connector | Some collected models | No billing API |
| <span data-provider-id="sambanova">SambaNova</span> | [Catalogue](https://api.sambanova.ai/v1/models) · [Documentation](https://docs.sambanova.ai/cloud/api-reference/endpoints/models) | All collected models | All collected models | Not published in this connector | Not published in this connector | Not published in this connector | No billing API |
| <span data-provider-id="chutes">Chutes</span> | [Catalogue](https://llm.chutes.ai/v1/models) · [Documentation](https://chutes.ai/app/api) | All collected models | All collected models | All collected models | Not published in this connector | Not published in this connector | No billing API |
| <span data-provider-id="wavespeed">WaveSpeedAI</span><br>Media generation platform | [Catalogue](https://wavespeed.ai/api/models) · [Documentation](https://wavespeed.ai/) | Some collected models | Not published in this connector | Some collected models | Not published in this connector | Not published in this connector | Not established |
| <span data-provider-id="fal">fal</span><br>Media generation platform | [Catalogue](https://api.fal.ai/v1/models) · [Documentation](https://fal.ai/docs/documentation) | Some collected models | Not published in this connector | Some collected models | Not published in this connector | Not published in this connector | Not established |
| <span data-provider-id="crazyrouter">Crazyrouter</span><br>Multi-provider aggregator | [Catalogue](https://api.crazyrouter.com/v1/models) · [Documentation](https://docs.crazyrouter.com/en/chat/openai/models) | Some collected models | Not established | Some collected models | Not established | Some collected models | Not established |

### Provider pitches and structured caveats

Quotations are the providers' words. Caveats record published limits, including scope and units; they do not claim measured inference speed or a caller's current quota. An absent caveat is accompanied by its research status, never a null placeholder.

**OpenRouter**

> “The Unified Interface For Every Model” — [OpenRouter](https://openrouter.ai/), observed 2026-09-08.

- **rate_limit: 20 requests/minute.** Free model variants (IDs ending in :free), regardless of account status; paid variants are outside this limit. This is the published platform quota, not the caller's remaining allowance. [Provider source](https://openrouter.ai/docs/api_reference/limits), observed 2026-09-08; basis: `provider_published`.

**Groq**

> “Groq makes inference work at scale.” — [Groq](https://groq.com/), observed 2026-09-08.

- **rate_limit: 8000 tokens/minute.** Free Plan summary, openai/gpt-oss-120b, organization-level combined token quota. Cached tokens are excluded. Exact organization limits can differ; this is not tokens per second or an inference-speed ceiling. [Provider source](https://console.groq.com/docs/rate-limits), observed 2026-09-08; basis: `provider_published`.

**Cerebras**

> “Build Products that Others Can't” — [Cerebras](https://www.cerebras.ai/), observed 2026-09-08.

- **trial_expiry: 30 days.** Free Trial credits expire 30 days after they are granted. This is the published trial policy, not this caller's credit balance or expiry date. [Provider source](https://inference-docs.cerebras.ai/support/rate-limits), observed 2026-09-08; basis: `provider_published`.

**Sail**

> “Sail is the most cost-efficient API for the best open-source models.” — [Sail Research](https://www.sailresearch.com/), observed 2026-09-08.

Caveats: Not found in checked sources. No numeric operating limit was established from this checked platform page. This limited check does not establish that the provider publishes none elsewhere. [Source](https://www.sailresearch.com/); checked 2026-09-08.

**Nous Research**

> “Published API rate: $0.072/M” — [Nous Research published pricing claim](https://nousresearch.com/), observed 2026-09-11.

Caveats: Not found in checked sources. No numeric operating limit was established from this checked platform page. This limited check does not establish that the provider publishes none elsewhere. [Source](https://nousresearch.com/); checked 2026-09-11.

**QwenCloud**

> “Foundation for AI Innovation” — [Alibaba Cloud Model Studio](https://modelstudio.alibabacloud.com/), observed 2026-09-08.

Caveats: Not found in checked sources. No numeric operating limit was established from this checked platform page. This limited check does not establish that the provider publishes none elsewhere. [Source](https://modelstudio.alibabacloud.com/); checked 2026-09-08.

**DeepInfra**

> “Accelerate your AI with developer-friendly APIs designed for performance and cost-efficiency.” — [DeepInfra](https://deepinfra.com/), observed 2026-09-08.

- **concurrency_limit: 200 concurrent_requests.** Default account limit per model; not requests per minute. An account can request a higher limit, and a busy model can still return 429 below the default. [Provider source](https://docs.deepinfra.com/account/rate-limits), observed 2026-09-08; basis: `provider_published`.

**Novita**

> “Run models, scale GPUs, and build AI agents, all on one platform.” — [Novita AI](https://novita.ai/), observed 2026-09-08.

Caveats: Not found in checked sources. No numeric operating limit was established from this checked platform page. This limited check does not establish that the provider publishes none elsewhere. [Source](https://novita.ai/); checked 2026-09-08.

**SambaNova**

> “The fastest AI inference on the largest models” — [SambaNova, SambaCloud](https://sambanova.ai/products/sambacloud), observed 2026-09-08.

Caveats: Not found in checked sources. No numeric operating limit was established from this checked platform page. This limited check does not establish that the provider publishes none elsewhere. [Source](https://sambanova.ai/products/sambacloud); checked 2026-09-08.

**Chutes**

> “Breakthrough Serverless Compute for AI, at Scale.” — [Chutes](https://chutes.ai/), observed 2026-09-08.

Caveats: Not found in checked sources. No numeric operating limit was established from this checked platform page. This limited check does not establish that the provider publishes none elsewhere. [Source](https://chutes.ai/); checked 2026-09-08.

**WaveSpeedAI**

> “WaveSpeedAI is the ultimate AI media generation platform — easy to use, affordable, scalable, and fast.” — [WaveSpeedAI](https://wavespeed.ai/), observed 2026-09-08.

Caveats: Not found in checked sources. No numeric operating limit was established from this checked platform page. This limited check does not establish that the provider publishes none elsewhere. [Source](https://wavespeed.ai/); checked 2026-09-08.

**fal**

> “The generative media platform powering the world’s top AI apps.” — [fal](https://fal.ai/docs/documentation), observed 2026-09-08.

Caveats: Not found in checked sources. No numeric operating limit was established from this checked platform page. This limited check does not establish that the provider publishes none elsewhere. [Source](https://fal.ai/docs/documentation); checked 2026-09-08.

**Crazyrouter**

> “Same OpenAI-style workflow. More models. Lower pricing. Easier experimentation.” — [Crazyrouter](https://crazyrouter.com/tools/), observed 2026-09-08.

Caveats: Not found in checked sources. No numeric operating limit was established from this checked platform page. This limited check does not establish that the provider publishes none elsewhere. [Source](https://crazyrouter.com/tools/); checked 2026-09-08.

<!-- providers:end -->

DeepInfra, Novita, SambaNova and Chutes publish their collected catalogues without a credential. QwenCloud requires the collector's region-bound international key. Both paths produce public dashboard data that this MCP reads without credentials. Mistral, xAI, Together, Fireworks, Nebius, Hyperbolic and Parasail returned 401 in the earlier catalogue probes; that observation describes those endpoints, not what the providers publish elsewhere.

**QwenCloud's native `/api/v1/models` catalogue is paginated.** The collection completed at 2026-09-08 13:47:21 UTC with **255 identities: 249 native and six compatibility-only supplements**. The old catalogue shares 159 of its 165 ids with the native source; retaining the other six prevents false disappearance when switching endpoints. Of the 249 native models, **242 have price blocks**: 306 outer blocks contain 893 inner price entries. Native metadata adds 59 comparable prompt/completion price pairs, 134 usable context values, 247 nonempty response-modality lists and 72 explicit reasoning capabilities. The 893 entries comprise 738 per-token entries and **155 non-token price entries**: 94 per second, 38 per image, 20 per 10,000 characters and 3 per voice. Those 155 entries are excluded from token comparisons and counted in collection metadata; no model identities are dropped for having media prices. Media-only models, the seven native models without price blocks and the six identity-only supplements remain `paid_or_unknown`.

The raw archive preserves all native prices, token ranges and time bands; **the current API does not publish the bands**. Flat rates are deliberately withheld for 39 models: 37 with multiple ranges and two with distinct peak/offpeak bands. Entries contain 782 standard, 99 unset, six peak and six offpeak bands. Flat prompt/completion prices are exposed only for an unambiguous default general input/output rate requiring no range or band selection. Other rates remain null with a selection-required `missingFields` marker, rather than silently quoting one band. The 72 explicit Reasoning capabilities become `reasoningEfforts: []`, meaning support without named effort levels; numeric reasoning limits remain in the raw archive, and absent positive capability evidence stays null.

The token catalogue observations below were measured on 2026-09-08. **DeepInfra** priced on eight different axes and only 219 of its 372 models were priced per token; other axes were excluded from token comparisons. The media catalogue now reports their native axes separately and normalizes comparable image/video prices. Its `deprecated` field is a *retirement date*, not a flag, and 114 of the 219 already carry one -- a concrete retirement date and successor are stronger evidence than a missing field. **Novita**'s flat price field is not a consistent tier: it is the cheapest band on one model and the dearest on another, and two tiered models publish no flat price at all, so prices here are the first tier with the full bands retained. The catalogues disagree about almost everything, and **normalising them is the work** — the API calls are the easy part.

**Cerebras's current `/v1/models` connector** supplies only ids and owners. A separate public native source returned richer metadata for three of three models on 2026-09-08; integrating it is pending, so those values are not yet returned here. The current connector's gaps do not establish provider-wide absence.

**Sail publishes [prices](https://docs.sailresearch.com/pricing.md) and [model context information](https://docs.sailresearch.com/models).** This MCP quotes prices only after verifying its pinned document and does not collect the documented context values. Sail also documents [usage and billing routes](https://docs.sailresearch.com/usage-endpoints.md); this integration has not probed or read them, so its registry reports spend visibility as unknown. See [Sail pricing](#sail-pricing-a-pinned-document-not-an-api) for the existing document verification.

Four rules follow from that table, and the tools enforce all four:

- **An unpriced model is cost-unknown, never free.** A missing comparable token price can reflect a connector gap, absent upstream pricing, a media billing unit or a required range/band choice. Rows satisfying the requested capability filters keep their place with `priceComparable: false` and a stated `unrankableReason`, listed after the ranked rows rather than dropped.
- **No lifecycle signal is not the same as no risk.** OpenRouter and DeepInfra carry lifecycle declarations; coverage varies by connector. Groq, Cerebras and Sail models report `retirementRisk: "not_published_by_provider"`, because `"none"` would be a false reassurance. For those three, a model vanishing from the list is the only retirement notice there is — so `availability: "disappeared"` is treated as imminent.
- **Every null has source context.** [`src/providers/registry.ts`](src/providers/registry.ts) describes the known sources and connector limits with `always`, `partial` or `never`; an unfamiliar provider receives `unknown`. A null does not establish that a provider withheld information.
- **A price read from a document is only as good as the document.** Sail's prices come from a pinned pricing page rather than an API, so the server verifies the document before quoting from it and declines rather than guessing when it has changed.

## Full catalogue and comparable media prices

`dashboard_catalogue` keeps acquired model identities even when no comparable price is available. DeepInfra, WaveSpeedAI and Chutes use public native sources. fal uses authenticated model/pricing sources when `FAL_API_KEY` is supplied, and public catalogue/summary pricing otherwise. Crazyrouter uses key-visible identities when `CRAZYROUTER_API_KEY` is supplied, and public pricing identities otherwise. Other providers retain their dashboard archive. All requests are read-only metadata requests.

For example, request WaveSpeed video detail with:

```json
{
  "providers": ["wavespeed"],
  "mediaKind": "video",
  "modelIds": ["wavespeed-ai/wan-2.2/t2v-720p"],
  "offset": 0,
  "limit": 20
}
```

| Input | Meaning |
|---|---|
| `providers` | Optional list of provider IDs, at most 30; defaults to the package registry. |
| `mediaKind` | Optional `image`, `video`, `text`, `audio`, `other` or `unknown` filter. |
| `modelIds` | Optional exact model IDs, at most 20. Also requests WaveSpeed pricing detail for those IDs. |
| `offset` | Offset into matching acquired rows, default 0, maximum 1,000,000. |
| `limit` | Rows per answer, default 100, maximum 500. Follow `population.nextOffset` until null. |

Filtering happens after acquisition, in stable provider/id order. `population` reports acquired, matched and returned counts, exclusions by media kind and model ID, and rows omitted by pagination. Each provider separately reports `listed`, `received`, `retained`, `excluded`, `exclusionRules`, `completeness` and the applied `requestParameters`. A missing native denominator stays null with an explanation; unavailable and unknown populations never become zero. These counters describe the rows actually acquired, not a claim that every provider's entire global inventory was observed.

Pricing state is separate from the points: `published` requires at least one point, while `not_published` and `unknown` carry an empty list and an explanatory `pricingNote`. A missing or non-comparable price is never represented as zero. Every normalized summary figure uses `{ value, unit, assumption, derived_from }`; an assumption cannot be omitted.

Token prices retain token units; compute rental, character, voice and other unsupported billing axes remain native data rather than being relabelled as image or video generation prices. Structured provider pitches and scoped caveats accompany the response in `providerMetadata`.

Coverage has specific limits. The dashboard's legacy archive does not expose every native population denominator. WaveSpeed enriches its default four video IDs plus up to 20 requested IDs; list-only prices whose formula or output quantity is unknown remain unavailable. Isolated detail failures are recorded and do not prevent later requested model lookups; shared service or access failures stop the batch. Authenticated fal pricing is requested in batches of 50 under a fixed request/time budget; a 429 stops the batch without retry. Native price units can describe compute time, so generic seconds do not become output-video seconds without explicit evidence. Its public fallback checks only the summary pricing table. Crazyrouter preserves its native billing formulas; unsupported tiered or media formulas stay unpriced for comparison. The exact GPT-4o, GPT-4o mini and GPT-4.1 default-group figures that are exactly 0.65x OpenAI list prices carry derived provenance and are excluded from competition comparisons. A failed source read is distinct from a successfully checked missing row, and neither means provider-wide nonpublication. Complete identity counts remain intact when price coverage is partial. Chutes compute rental prices are not generation prices.

## Shared-model price comparison

`dashboard_price_comparison` joins Crazyrouter aliases to OpenRouter using exact IDs and explicit native author evidence. It retains unmatched and unpriced Crazyrouter identities, records each source's population, and reports filters and pagination separately. Optional `modelIds` selects up to 20 exact Crazyrouter IDs; `offset` defaults to 0 and `limit` to 50 (maximum 500).

```json
{"modelIds":["gpt-4o","gpt-4o-mini","gpt-4.1"],"limit":20}
```

The response presents every compatible input/output price point and condition side by side and computes savings with exact decimal fractions. If units or conditions do not match, that leg is `not_comparable` with a reason; it never picks one rate silently. Crazyrouter quotes are its public default pricing group; the caller's billing group and settled charges are unverified. Per-model discount badges are retained as `derived` points with their model-specific factor and source text; there is no global `0.65` assumption. OpenRouter quotes are collected during the call for rows that remain eligible. Available direct-provider references are explicitly dated published-price observations, not live account prices. Exact API aliases do not establish that two services resolve to the same immutable model snapshot.

Crazyrouter's dated claim is attributed and checked only where an independently comparable direct-provider reference exists. Derived rate-card matches are retained as evidence but excluded from that assessment; a quote outside the claimed range is reported as a discrepancy, and absent direct prices remain unknown. A few compared aliases do not prove a statement about most models. The tool makes no inference request and measures no latency or model quality.

Supply optional `FAL_API_KEY` and `CRAZYROUTER_API_KEY` through the host's environment. Startup and tool discovery remain credential-free. This package does not read Secret Manager itself, write keys, or modify an account. Account spend remains unread by these collectors.

Install-time selection of tools and providers belongs to 1.0. Set `OPEN_DASHBOARD_TOOLS` and/or `OPEN_DASHBOARD_PROVIDERS` to comma-separated allowlists before startup. Deselected tools are absent from `tools/list`; provider-bearing tools omit deselected providers, and the price comparison tool is omitted unless both `openrouter` and `crazyrouter` are selected. Request filters still select output within the installed surface.

## Discounts

**Discount coverage varies by connector.** OpenRouter publishes endpoint discounts and Novita publishes effective versus original prices. The original Groq, Cerebras and Sail token connectors report `not_published_by_provider`; this is scoped to their collected data. Use the generated registry table for current publication declarations.

OpenRouter publishes discounts as a **provider-endpoint** fact rather than a model fact — measured 2026-08-19, zero of 550 models carry a `discount` key while 272 of 272 provider endpoints do. `dashboard_model_economics` therefore reads `/api/public/v2/models/{id}/providers` per model and reports the best published discount with the provider named, so the number is checkable. Groq, Cerebras and Sail rows report `not_published_by_provider` and cost no upstream request.

Four distinctions the tool refuses to collapse:

- **`discounted`** — a non-zero published discount was found.
- **`no_discount`** — endpoints were read and every one published nothing or zero. The only value that means full price.
- **`unavailable`** — the dashboard holds no endpoint observation for that model. Upstream observes endpoints under a daily request budget, so most of the catalogue is unobserved at any moment. Unknown, never full price.
- **`not_published_by_provider`** — this provider has no discount concept at all. Nothing to look up.
- **`not_checked`** — the per-call enrichment bound was reached. Also unknown.

**A missing expiry does not mean a permanent discount.** The original OpenRouter endpoint integration exposes a discount ratio and no end date; the original Groq, Cerebras and Sail connectors expose no discount expiry. These rows carry `expiresAt: null` with `expiryPublished: false`. Current connector declarations remain in the registry rather than a manually maintained provider count here.

There is no public route listing all discounted models, so discovery is per model and bounded by `discountEnrichment`.

## GitHub trending

`dashboard_github_trending` reads `/api/public/v2/github/trending`, which scrapes `github.com/trending` because GitHub publishes no API for it.

GitHub's trending board turns over through the day, so **a list without a collection time is not interpretable**: a fresh one and a three-day-old one look identical. Every answer therefore carries:

- `collectedAt` — when the upstream page was actually retrieved, taken from the origin's `Date` header. **Not** when the tool ran, and not when the response was assembled; the underlying fetch is cached, so those would overstate freshness by up to three hours.
- `ageHours` and `stale` — computed against a six-hour window, well inside one turnover. An unparseable timestamp reads as maximally stale rather than fresh.
- `source` — `direct` or `firecrawl`, recorded rather than inferred.
- `fallbackReason` — why the free direct scrape was abandoned, when it was. Null on the happy path.

The direct scrape is the primary path and carries production traffic. A paid Firecrawl fallback exists for the day GitHub blocks the scrape or changes its markup; when it serves, the tool says so unprompted, because a fallback nobody is told about is how you end up on the paid path for months without knowing the free one died.

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

The comparison is the archive's own run chain, not a date you choose, so the answer is always "since the last collection" and cannot straddle a missed run and present a stale delta as fresh. Prices are compared as exact decimals — never floats — because a rounding error in a price comparison would invent or hide a change. Zero is recognised semantically, so `0`, `0.0` and `0.00000000000000000000` are all free; a **null price is not free**, it means no comparable price is available in that field.

### The window you asked for is not the window prices were compared over

Every other section of `dashboard_whats_changed` honours the `since` you pass. Price movement cannot: the public route takes no window parameter and always compares the two most recent archived runs. An empty `becamePaid` inside a month-wide response would otherwise read as a month-wide all-clear it never was.

**And the comparison's span is not published.** The route identifies its two runs by id and carries no date for either. The response envelope does have a `window`, but that is the *head publication date*, not the span — measured against production on 2026-08-27, `window.start === window.end === 2026-08-26` while `baseRunId !== headRunId` on a daily collection cadence, so the real comparison covers at least two days and the envelope calls it one. Reading it as the span understates the comparison and invents a coverage answer.

So the section reports only what the payload supports:

- **`headPublishedOn`** — the newest catalogue state examined, named for what it is.
- **`coverage.status`** is `incomplete` or `indeterminate`, and **never `complete`.** Complete coverage would require the base run's date, which is not published. `incomplete` is the one verdict the response does support: nothing after the head run was examined, so a `headPublishedOn` earlier than the report's `through` proves the tail of your window went unchecked — the lagging-collector case, and the days a reader most assumes are covered.
- **`coverage.reason`** says which of the two it is and why, and the same sentence is pushed into the response `warnings` every time, because a field nobody reads is not a disclosure.

`indeterminate` is not a softer way of saying fine. It means an empty result is not evidence about your window.

**So `dashboard_whats_changed` does not return `"ok"`.** While the route stays undated, an available price section can never establish that it covered what you asked about, and a status of `ok` beside `Nothing changed` would claim it did. The tool returns `partial`, and the summary carries the caveat rather than leaving it to a warning — because the summary is the line a caller relays:

> 5 changes found in scanned evidence since 2026-08-18; the comparison is incomplete. **Price movement could not be shown to cover 2026-08-18 to 2026-08-25, so this is not an all-clear on models that started charging.**

Measured against production, 2026-08-27.

To be exact about what that costs: **`ok` is unreachable in this version.** A readable price section can never establish coverage, and an unreadable one is degraded — either way a *successful* report is `partial`. Do not write a branch waiting for `ok`. Making it reachable would need the producer to publish dates for the runs it compares *and* this client to read them; neither exists today, and this README will not guess at the shape of either.

This is about successful reports only. A read that fails outright — bad input, or a manifest that cannot be fetched — still returns `status: "error"` with the safe error attached. Handle three: `partial`, `error`, and `ok` for completeness even though nothing produces it.

**An inverted window is an outcome, not a warning.** `since` is yours and `through` is derived from the newest complete bucket, so the two can cross. Every window-scoped section would then report nothing — which is exactly what a satisfied query looks like. A warning beside a normal summary does not fix that, because the summary is the line a caller relays and it would read *Nothing changed since 2027-01-01*. So an inverted range returns `status: "partial"` with the window-scoped sections `unavailable` and a summary that names the inversion. Price movement is independent of your window, so it still reports.

**The summary can no longer read as an all-clear while prices moved.** It leads with the money — `1 model stopped being free in the comparison ending 2026-08-26` — and price movement with no free-to-paid row still gets its own sentence rather than passing unmentioned. Where the summary used to say *no changes* and *nothing changed*, it says *no other changes* and *nothing else changed* whenever the price section reports movement.

**The two counts are never added together.** Price rows come from the producer's comparison, not from your window, so a single total would state a number for a window some of the counted items sit outside. Each sentence carries its own count and its own comparison instead.

**A capped price page is a floor, not a total.** `/price-changes` paginates and the section reads one page of 100 mixed rows, so when `cap.capped` is true **both** counts are qualified, because an unread row can be either kind — `At least 2 models stopped being free …, alongside at least 3 other price moves; the price comparison was capped at 100 rows with more unread`. A capped page also may not rule the transition *out*: where an uncapped page says `none of them a model leaving free`, a capped one says `None of the rows read was a model leaving free, but … an unread row still could be`. The categorical zero is the expensive claim here, and only a complete read earns it.

**A price section that failed to read degrades the report.** A `whats_changed` whose price section is `unavailable` or `unsupported_by_public_api` returns `status: "partial"`, never `"ok"`, and the summary says the failure is not evidence that nothing started charging.

**Three failure states, none of which is an empty list.** An empty `becamePaid` means nothing left free in what was compared. If the deployment does not serve the endpoint, you get `unsupported_by_public_api`; if it could not be read, `unavailable` with the reason. Returning an empty list on failure would read as *nothing started charging you*, which is the most expensive wrong answer this server could give.

Only models present in **both** runs are compared. A model that appeared or vanished is a different question, answered by the appearance and disappearance sections — folding it in here would report a brand-new model as having started charging.

## Key inventory

`dashboard_key_inventory` is the only tool that touches a credential, and it is opt-in so the zero-credential default survives for everything else. Unconfigured, it returns `unconfigured`, which is a normal outcome rather than an error.

Set `OPEN_DASHBOARD_KEY_SOURCES` to comma-separated `provider:secretManagerName=ENV_VAR` triples and provide each named environment variable:

```
OPEN_DASHBOARD_KEY_SOURCES=openrouter:my-openrouter-key=OPENROUTER_API_KEY,groq:my-groq-key=GROQ_API_KEY,cerebras:my-cerebras-key=CEREBRAS_API_KEY
```

Only the Secret Manager names are ever reported. Key values are never returned, logged, or written to evidence — a test asserts the serialized result contains no key material. The tool issues GET requests only and contains no code path that can mint, modify, or revoke a key. Keep provisioning with a separate, privileged key that this server never sees.

**Spend is not uniformly readable, and the tool says so rather than leaving a blank.** OpenRouter exposes per-key usage and ceiling. Groq and Cerebras retain the registry's `no_billing_api` classification. Sail documents billing routes that this integration does not read: its keys report `spendReadability: "unread"`, its registry reports spend visibility `unknown`, and `usdSpent` remains null. No billing request is added. A blank money field must not read as zero.

`usdLimit: null` with `uncapped: true` is the finding worth acting on: a key with no spend ceiling can spend without bound if it leaks.

### Edge block versus dead key

A `401`/`403` carrying Cloudflare code **1010** means the request was rejected at the edge before reaching the provider — usually for sending no User-Agent — and says nothing about whether the key is valid. Reported as `edge_blocked` with `alive: null`, distinct from `rejected`, because treating it as a dead key has caused wrong rotations before. Every probe sends a User-Agent for this reason.

Verified 2026-08-27 from a Windows host: Groq answers `401 invalid_api_key` and Cerebras `403 {"detail":"Not authenticated"}`, with and without a User-Agent — ordinary credential errors, no 1010. The 1010 case is real but host-specific, so it is detected from the body rather than assumed from the status.

## Auditing pinned model slugs

Pass `ids` to `dashboard_model_economics` with the slugs a config hardcodes, across any provider. Ids absent from **every** provider catalogue come back in `missingIds` — the 404 a config is about to hit, observed before it happens — and surviving ids carry current price, discount and `retirementRisk`.

# Caveats

## Freshness, and what happens when the source is slow

Dashboard-backed tools read a **public, zero-credential HTTP API** at query time. That host is a hobby-tier deployment with no uptime obligation, and dashboard-backed answers depend on it. Two things follow, and both are visible in the response rather than assumed.

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

## Free versus rate-limited free

`freeKind` separates `concrete_free` (a real zero-priced model) from `free_router` (a rate-limited free routing tier, usable for a probe but not a workload) from `paid_or_unknown` (which includes every provider that publishes no price — unknown, and never treated as free). `genuinelyFree` is true only for `concrete_free`.

`emitsText` is `true`, `false`, or `null` where the provider publishes no modality. Without it the cheapest free model is a music generator. `includeUnknownCapability` (default true) decides whether rows with unpublished capability take part; set it false when a hard guarantee is needed, at the cost of excluding Cerebras entirely.

## Sail pricing: a pinned document, not an API

Sail's catalogue API returns model ids and nothing else — no price, no context length, no modality. Its prices live in a human-readable pricing page, `https://docs.sailresearch.com/pricing.md`.

A page is not an API. It can be restructured, reworded or repriced without warning, and a parser that keeps reading it regardless will keep returning numbers that look exactly as confident as they did when they were right. So the server hashes the document and compares it to a pinned digest before quoting anything from it:

- **Digest matches** — prices are parsed and Sail models join the ranking.
- **Digest differs** — Sail models are **omitted**, and the answer carries `PRICES ARE STALE`, naming both digests. It does not fall back to the last known prices, because a price that was true last week is not a price.

The trade is deliberate: the tool goes quiet about Sail rather than quoting a number it cannot stand behind. What it costs is availability — every legitimate upstream change also silences Sail until the pin is reconciled against the live document.

That is not hypothetical. Between two captures the document grew about 10% and Sail's catalogue gained a model (`google/gemma-4-12B-it`, 9 → 10) while `zai-org/GLM-5.3` held at $1.40 / $4.40 per million. **A digest that changes tells you the document moved. It cannot tell you whether the prices did.**

The fixture used in tests is byte-identical to the live document and is marked `-text` in `.gitattributes`, because `core.autocrlf` will otherwise rewrite its line endings on checkout and change the hash — which looks precisely like an upstream price change and is not one.

## 1.0.0 skips 0.9.0

**There is no 0.9.0 on npm and there never was.** The previously published release is **0.8.0**, so 1.0.0 is the next version you can install and the breaking changes below are the 0.8.0 → 1.0.0 jump. 0.9.0 was built and verified in the repository but never published; if you track version numbers, you have not missed a release. See [the 1.0.0 release notes](docs/release-1.0.0.md).

OpenRouter ships its own MCP server. It is single-vendor by construction, which makes it unable to answer the question this one exists for: *of the providers I actually hold keys with, which is the cheapest capable option right now.*

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

The original six harness modes passed on 2026-08-27. That historical fixture asserts that its original OpenRouter, Groq, Cerebras and Sail rows survive into one answer, that a priced Groq model ranks while an unpriced Cerebras model is kept and explained, that Sail is injected only when its pinned document verifies, and that no discount expiry is invented.

`live` and `alien-cwd` use the public zero-credential default. `fixture`, `offline`, `html`, and `verify:stdout` use loopback-only test infrastructure. Evidence is written under ignored `verification/raw/` only after validation. The raw verifier is separate because the official stdio transport does not expose child stdout and therefore cannot prove byte purity on its own.

The ten independent archived-date evaluation cases are in `evals/dashboard-intelligence.xml`. The latest checked payloads and timings are recorded in `docs/verification-report.md`.

# Semantics

## How prices and speed are modelled

Everything above rests on these definitions. Read this when a number surprises you.

<!-- contract:begin generated-do-not-edit -->

A model does not have *a* price. It has a **set** of price points, each valid only under a stated condition, and the set is the unit this package publishes.

A point is `{ amount, unit, condition, source: { url, readAt }, provenance }`. Amounts are exact decimal strings, never floats, so a sub-cent per-token rate survives a round trip. `source` names the page it was read from and when; a price whose read time cannot be established is not emitted at all.

**Units** (10): `token_in`, `token_out`, `token_cached`, `token_cache_create`, `image`, `megapixel`, `video_second`, `video`, `request`, `gpu_hour`.

**Condition kinds** (five): `latency_window`, `time_band`, `tier`, `rate_class`, `price_scope`. A rate is never detached from the choice that produced it: a latency window, a time of day, a volume tier, a rate class, or whose price it is. `price_scope` distinguishes a rate quoted to an authenticated account from a public list rate -- without it the two look identical and compare as though they were the same quantity.

**Provenance**: `published`, `derived`, `parsed_from_prose`, `unknown`. A `derived` point names `derivedFrom`; a `parsed_from_prose` point retains the `sourceText` it was read out of. `unknown` is a real answer and is never rounded to a number.

**The refusal rule.** A comparison returns every compatible pair or it refuses. Two points compare only under the same unit AND the same condition; mismatched units, mismatched conditions, or a zero baseline refuse, always with a reason. The refusal surfaces under two names, one per layer: the price-set primitive returns `status: "refused"`, and a tool response carries that through as a comparison leg with `status: "not_comparable"` and the same reason. Nothing is coerced to make a comparison possible, because a comparison across conditions is not a weaker answer, it is a wrong one.

**Speed carries its own conditions.** `dashboard_speed` observations are `measured`, `published`, `unknown`. A rate names `token_basis` (`visible_output`, `billed_total`, `unknown`) because a reasoning model emits tokens that never reach content, so a visible-output rate and a billed rate differ by multiples. Every observation carries a `vantagePoint`: latency is a property of a provider *and* where it was measured from, so a figure without one flatters whoever is nearest the benchmark host. A claim this package cannot source is published as `unknown`, not as a number.

**Deprecations.** `dashboard_contract` returns `schema_version`, the installed `package_version`, and every field or tool announced for removal. A notice names `replaced_by`, or gives a plain `reason` when the capability is gone with no replacement. From 1.0.0 onward a removal is announced before the release that performs it; the 1.0.0 notices are retrospective because no earlier published release carried this mechanism.

<!-- contract:end -->

## Speed claims and measurement

`dashboard_speed` keeps publisher claims and measurements in separate observations. The fixed probe protocol is a streaming prompt with `maxTokens: 700`, four runs, the first discarded, and median/min/max over the remaining three. A measured observation records provider, model, timestamp (or explicit `unknown`), vantage point, prompt hash, token count, TTFT and sustained tokens per second. A published claim has provider attribution and source URL but no fabricated measurement. The current metadata includes Cerebras's published approximately 3,000 tokens/second claim alongside the retained 2026-08-28 measured 867/1,022/1,108 tokens/second record, and Groq's published 8,000-token/minute ceiling; the units and states remain distinct. Missing observations are `unknown`.

## Contract versioning and deprecations

`dashboard_contract` is the explicit MCP contract endpoint. It returns `schema_version`, the installed `package_version`, and `deprecations[]`. Each notice names the field or tool being retired, the release that removes it, its replacement (or a plain reason when there is none), and the date the notice first appeared. A known future removal with no reliable release date uses `removed_in: "unknown"`; it is never guessed.

Version 1.0 introduces this notice mechanism. Therefore it could not preannounce the 0.9-to-1.0 removals: the 1.0 release notes state that exception once, and those notices are necessarily retrospective. Future removals will be announced in an earlier release; a field is not repurposed under an old name.

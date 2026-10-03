# Live refresh audit — 3 October 2026

This is a branch/PR result and headless local preview, not a production deployment. No npm publication or production Vercel deployment was performed. Jev Council identity remains unverified; the status page reports unconfigured instead of inventing seats. Regional continuous collectors need installation and HTTPS URLs before production regional selections can answer.

## Root cause

The public website is https://www.sdforest.site/web/open-dashboard/, served by **orchestrator-gpt**, not the Next repository. The Next repository supplies https://openrouter-github-dashboard.vercel.app. This third repository was necessary to fix the page Ivan actually sees.

The production landing already served the comparison studio; its Connect and ecosystem child pages had the older shell. The all-unknown decision-evidence view rendered measured generation-cost fields, which were unknown, instead of the available published provider catalogue rates. It also rendered public/private selection-policy queries from capability-state.json. Supplementary providers and claim comparisons fell back to dated build JSON. This was primarily a website data/render boundary problem, not an empty MCP catalogue.

A separate MCP bug was found in QwenCloud: the live API's model field was discarded, and its default 20-row pagination slice was labelled complete. The fix retains the native model name and acquires all 270 reported records, with a bounded read budget and duplicate-page rejection.

Direct MCP tools/call dashboard_catalogue proof (source-only, no inference) is in mcp-protocol-samples.json. On the final real read:

| Provider / exact model | Input | Output / native unit |
|---|---:|---:|
| OpenRouter aion-labs/aion-2.0 | $0.80 / million tokens | $1.60 / million tokens |
| OpenRouter openai/gpt-oss-120b | $0.037 / million tokens | $0.17 / million tokens |
| KIE Black Forest Labs Flux 2 Flex, image to image, 1.0s-1K | — | $0.07 / image |
| io.net deepseek-ai/DeepSeek-R1-0528 | $0.56775 / million tokens | $2.279 / million tokens |

Original amounts are retained as per-token decimal strings; the million-token numbers above are exact unit conversions for readability.

## Three-location results

Each location returned **5,492 identities, 2,601 with published price points**. All **41 repeated priced model reads** per location matched in amount, unit and condition (123/123 matches total). These are catalogue/price-table availability reads, not inference reachability claims. No paid inference probes were made; spend and cap were both **$0**.

| Location | Actual hostname | Last capture UTC | Identities / priced | Rechecks |
|---|---|---|---|---|
| bulgaria-desktop | DESKTOP-AF1NPD3 | 2026-10-03T13:48:52.197Z | 5492 / 2601 | 41, all match |
| kvm2-europe | srv1722904 | 2026-10-03T13:49:07.085Z | 5492 / 2601 | 41, all match |
| oracle-us | forest-a1-v3 | 2026-10-03T13:49:32.655Z | 5492 / 2601 | 41, all match |

The following results were the same at all three locations. Every per-model price, condition and source timestamp is retained separately in the three compressed evidence captures; these files are audit records and are never used as UI fallbacks.

| Provider | Catalogue status | Identities | Priced | Rechecked | Real sample price points |
|---|---|---:|---:|---:|---|
| openrouter | available | 466 | 459 | 3 | ~anthropic/claude-fable-latest: $0.00001/token_in; $0.00005/token_out; $0.00000025/token_cached; $0.0000125/token_cache_create |
| groq | available | 11 | 8 | 3 | canopylabs/orpheus-arabic-saudi: $0.00004/token_in; $0.00002/token_cached; $0/request |
| cerebras | available | 2 | 2 | 2 | gpt-oss-120b: $0.00000035/token_in; $0.00000075/token_out |
| sail | partial / PRICING_STALE | 12 | 0 | 0 | unknown — PRICING_STALE |
| nous | available | 425 | 425 | 3 | ~anthropic/claude-fable-latest: $0.00001/token_in; $0.00005/token_out; $0.00000025/token_cached; $0.0000125/token_cache_create |
| deepinfra | available | 386 | 336 | 3 | allenai/Olmo-3.1-32B-Instruct: $0.0000002/token_in; $0.0000006/token_out |
| novita | available | 121 | 117 | 3 | apodex/apodex-1.1-mini: $0/token_in; $0/token_out |
| sambanova | available | 6 | 6 | 3 | DeepSeek-V3.1: $0.000003/token_in; $0.0000045/token_out |
| chutes | available | 491 | 476 | 3 | 0026710d-5456-5bbb-87e8-3ed446204a5d: $0.0000000489/token_in; $0.0000001957/token_out |
| wavespeed | available | 1054 | 4 | 3 | wavespeed-ai/wan-2.2/i2v-720p: $0.06/video_second |
| fal | partial | 1503 | 0 | 0 | unknown — source has no supported authoritative price |
| kie | available | 524 | 468 | 3 | Black Forest Labs Flux 2 Flex, image to image, 1.0s-1K: $0.07/image |
| crazyrouter | available | 175 | 98 | 3 | claude-fable-5: $0.0000065/token_in; $0.0000325/token_out |
| akashml | available | 7 | 7 | 3 | meta-llama/Llama-3.3-70B-Instruct: $0.0000002/token_in; $0.00000052/token_out; $0.0000001/token_cached |
| ionet | available | 39 | 39 | 3 | deepseek-ai/DeepSeek-R1-0528: $0.00000056775/token_in; $0.000002279/token_out; $0.000000283875/token_cached |
| qwencloud | available | 270 | 156 | 3 | decision-model-preview: $0/token_in |

QwenCloud now returns 270 identities, 156 with comparable Default-range prices. Other ranges/unsupported units remain unknown rather than flattened into guessed rates. Sail PRICING_STALE is deliberately unknown until its independent pinned rate document is reconciled. fal public model identities are live, but no supported public price observations were acquired; its prices remain unknown. WaveSpeed and other providers retain listed unpriced identities.

Initial KVM2/Oracle Cerebras reads failed because the isolated probe runtime lacked Chromium. Installing the headless renderer and re-reading both resolved the runtime error; it was not reported as a region restriction. No production services were changed.

## Page inventory and design audit

All seven OpenDashboard HTML routes were enumerated from source and visited headlessly. Existing root comparison studio styling is preserved; the child shell is brought into that same plum/paper sidebar system.

| Public path under /web/open-dashboard/ | Before | After |
|---|---|---|
| / | Current studio; stale supplementary fallback and policy-driven state view | Current studio; direct live adapters; published prices view; location selector |
| /mcp/ (Connect your agents) | Older shell, dated numeric price example | Current shared studio, live price example, no dated rate range |
| /github/ | Older shell | Current shared studio |
| /catalogues/ | Legacy redirect shim to explorer | Current shared fallback shell; preserves redirect/query |
| /openrouter/ | Legacy redirect shim to apps view | Current shared fallback shell; preserves redirect/query |
| /matrix/ | Legacy redirect shim to connections | Current shared fallback shell; preserves redirect/query |
| /council/ | Absent | Current shared studio, live status reader, honestly unconfigured |

Root query views overview, models, apps, history, benchmarks, changes and state share the current studio. Historical usage/benchmark evidence retains its own observation dates; catalogue prices use the live provider reads. Existing /web/open-overview aliases redirect into these current routes. The new council route is explicitly registered with the static route owner; the global Forest route boundary has 79 HTML pages. Unrelated Forest apps are outside this dashboard design scope.

The Next website has eight user-facing pages: /, /openrouter, /github, /trending, /models/discounted, /catalogue, /connect and /council. All now use a shared current studio nav and skin. Root and /openrouter use only the new MCP live catalogue for model prices; deprecated archive/registry model tables are no longer their price source. Discounted and Trending model enrichment read OpenRouter without the old one-hour revalidation cache. API routes are inventoried in route-inventory.json and have no design state.

Next before/after: the existing /, /openrouter, /github, /trending and /models/discounted pages used the previous Next shell; all five now use the shared studio nav/skin. /catalogue, /connect and /council are new current-shell routes. No old design remains on the audited dashboard routes in the branch preview. Production will retain its existing bundle until the manual deployment described below. Unknown is still displayed where a source genuinely does not supply a usable price, or a regional/council endpoint is unconfigured/unavailable.

## Council discovery and boundary

On KVM2 the real council-open service answers GET http://127.0.0.1:18082/info. It reports proposers upstage/solar-pro4 and openai/gpt-5.6-luna, and chairman upstage/solar-pro4. Private and glass councils also exist; neither exposes a verified Jev identity. The public port 8082 did not answer from Bulgaria.

Oracle has Chloe Council at https://chloe.blumenkraft.cloud/council/relay (POST relay). Its probed /council/info and /council/health routes returned 404. That service has not been relabelled Jev. Repository Jev routing examples are selection evidence examples, not a callable council endpoint. No vault secret name identified a Jev service.

The new GET /api/live/council-status reads JEV_COUNCIL_STATUS_URL and optional token only on the server. It projects name, status and seats (id, role, model); policies, prompts, memory and authentication are stripped. It does not invoke a paid deliberation. A real identified Jev status endpoint/adapter is still required, so this part is explicitly incomplete.

The leaked labels originated in the capability-state export queries and renderCapabilityState. Both the builder and UI now expose model/price evidence only. MCP routing/selection config remains in the council/MCP configuration and is not changed. The public catalogue schema removes nativePricing and requestParameters, drops arbitrary envelope properties and validates models. Regional envelopes reject wrong location/provider, expired timestamps, credential reflection and unsafe endpoint URLs.

## Verification

Headless Chrome visited all seven static routes: current studio/sidebar on each, zero page exceptions, zero leaked selection-policy labels. Mobile Connect menu expands and there is no horizontal overflow. The live state table displayed Aion 2.0 exactly as $0.0000008/token_in and $0.0000016/token_out, matching a separate live MCP read. Browser transport was redirected to the local branch API; provider reads were real network acquisitions, not fixtures. Screenshots and before/after route captures are attached as evidence. The deployed production page was not changed.

MCP: 411 tests pass. Next: production build, TypeScript and lint pass; final test totals are in the PR verification record. Production dependency audit reports zero vulnerabilities; nine development-tool advisories remain (4 moderate/5 high) and no force downgrade was used. Static dashboard loader/setup/contract tests pass; registry validation and build pass. The wider Forest source contract suite has one pre-existing unrelated AI-kit fallback-count failure: committed test expects 108 rows, committed HTML contains 113 (baseline 46fd7985). The build-backed foundation tests pass 6/6.

Independent Gemini 3.5 Flash review via OpenRouter is recorded in gemini-review.json. Gemini 3.5 Flash approved the final implementation after adjudicating its two late findings: the search guard was added, and the relative-source-URL concern was invalid because the native endpoint is a fixed absolute HTTPS URL. Both the raw review and resolution are recorded. OpenRouter reported four review charges, total $0.293067; each request stayed under the $0.50 ceiling.

Final browser API/UI comparison: 16 provider selections tested; all 14 supported-price providers matched displayed amount/unit against a separate uncached read. Sail/fal had no price to compare. All eight Next page routes return HTTP 200, including an honest archive-unavailable GitHub page when its archive feature is disabled.

All seven root query views were visited headlessly after the final changes: overview, models, apps, history, benchmarks, changes and state. Each used the current studio and had zero page exceptions or leaked policy labels. Final Next tests: 1157 pass, 2 intentionally skipped; static dashboard tests: 135 pass.

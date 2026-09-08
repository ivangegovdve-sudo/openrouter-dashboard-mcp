# 0.9.0 release verification

This is an unmerged release candidate. Different-family review and the companion site merge are required before npm publication. The package branch builds on MCP PR #10, which corrects QwenCloud and other connector descriptions. The site branch builds on site PR #522, which already introduced generated pages for npm 0.8.0.

## Implemented

- Eleven provider descriptors expose attributed, verbatim pitches and research states. Measured numeric caveats are optional structured fields, never null placeholders. Unknown, not researched, not found in checked sources, and explicit non-publication remain distinct.
- `dashboard_catalogue` is the thirteenth read-only tool. It preserves unpriced identities, provides exact canonical image/video/token prices with native values, conditions and conversion arithmetic, and reports source population and local filtering/pagination separately.
- DeepInfra, WaveSpeed, fal and Chutes use bounded native public catalogue readers. Legacy providers retain their dashboard identities and prices. No price filter is applied during acquisition.
- README facts derive from the registry and a real MCP `tools/list`. CI checks committed facts before the build regenerates them. The companion site pins this source commit and facts digest, with candidate facts distinguished from the currently published npm dependency.

## Measured 2026-09-08

- Clean starting package suite: **224 passed**. Initial integration suite: **271 passed**. Review follow-up suite: **279 passed, zero failures/cancellations/skips** in the built local checkout; ten compiled provider tests are additionally discovered there. Build and harness TypeScript checks passed. Current-head clean CI results are recorded on the PR.
- First Linux Node 22 CI run exposed an unreferenced request timeout: the hung-fetch test and its remaining file tests were cancelled when the event loop exited. The deadline now remains referenced until the existing `finally` clears it. The observed failing CI is the regression evidence; final CI status is recorded on the PR.
- Live compiled stdio session, 15:21:15–15:21:31 UTC: handshake **0.9.0**, **13 tools**, **11 provider reports**. It acquired **4,422 identities**, returned the requested first **500**, and reported **3,922 omitted by pagination**, with next offset 500. A second real `tools/call` selected and verified prices from DeepInfra, WaveSpeed and fal.
- Four native sources: **3,375 listed/received/retained, zero excluded**. DeepInfra 372; WaveSpeed 1,015; fal 1,493; Chutes 495. There were **813 models with canonical prices**, including **74 with media prices**. See [the detailed source and arithmetic evidence](media-price-evidence.md).
- Independent provider-page comparison script: **6/6 comparisons across 3 providers**. DeepInfra FLUX 1.1 Pro **0.04 USD/image**; WaveSpeed Wan 2.2 **0.06 USD/video-second** (two variants) and **0.02** (two ultra-fast variants); fal Seedream V4 **0.03 USD/image**.
- An extracted npm tarball installed production dependencies and completed its own in-memory MCP handshake with **0.9.0 / 11 providers / 13 tools**. No source checkout imports were used by the extracted server.
- Supplemental same-family review found and fixed source attribution, pricing-window retention, offset timestamps, multi-modality filtering, overwritten fal totals, assumed image quantities, and Chutes token rates. These checks do not satisfy the required different-family release review.

## Baseline corrections and remaining gates

The initial npm version, registry size and tool count were correct: **0.8.0 / 9 / 12**. The site already had an open generated-page PR (#522), and MCP already had provider corrections in #10. Groq's worked example was wrong: the checked provider page says **8,000 tokens/minute** for a scoped free-plan organization/model quota, not an inference ceiling of 8,000 tokens/second. DeepInfra's dated 371-model/218-token population had become 372/219.

The legacy dashboard does **not** expose its original native population denominator or collector exclusion rules. Those counts remain null with a named reason, rather than being reconstructed from an incomplete transformed dataset. Sail had no published source in the live dashboard response and is reported unavailable, not empty. Other legacy source counts received were OpenRouter 612, Groq 14, Cerebras 3, QwenCloud 255, Novita 156 and SambaNova 7. These acquisition limitations make the aggregate result `partial` even when all native public readers are complete.

Full identity coverage is distinct from price coverage: WaveSpeed enriches four established models plus up to 20 requested IDs; fal reads its bounded public pricing table. Unchecked quantity/formula/model-page data is reported explicitly. Compute time, unknown image counts, video frame units without a frame contract, and whole-video prices without duration are not converted into unsupported output rates.

The older aggregate `verify:stdio -- --mode fixture` harness initially failed at its absent `/api/public/v2/benchmarks` fixture route. Review follow-up added explicit synthetic benchmark and trending routes, preserving unknown scores and collection timestamps, and restricted diagnostic economics to its three fixture providers to avoid a live Sail-document fetch. The rebuilt server now passes its twelve diagnostic calls while exposing all thirteen tool definitions. This is synthetic behavior verification; the separate catalogue stdio verifier checks actual public data. Harness tests include negative assertions rejecting invented scores and timestamps.

## Review follow-up

The rebuilt live stdio rerun at **15:50:19–15:50:33 UTC** reported 13 tools and all 11 provider reports, acquired **4,423 identities**, returned 500 and recorded 3,923 pagination omissions. Native retention was **3,376/3,376, zero excluded**: DeepInfra 372, WaveSpeed 1,015, fal 1,494 and Chutes 495. fal had gained one model since the earlier 15:20 observation. The three selected canonical-price tool checks passed again; prior six-way provider-page comparisons remain the separately timestamped evidence above.

Two automated package findings were reproduced as failing behavioral tests before correction. A fal pricing-source failure previously left an apparent checked-but-absent price and could return `ok`. It now records the failed pricing source and a safe error, marks affected prices `pricing_source_unavailable`, and returns partial provider/tool status while preserving a fully acquired identity denominator. A successful pricing-table read with a missing model retains the distinct checked-absence reason.

WaveSpeed no longer abandons a caller's later model because an earlier individual model returns 404/410, malformed detail or a mismatched identity. It proceeds to other requested identities, records each failure and preserves their native data. Shared authorization, rate-limit, service, network, resource and deadline failures still stop the bounded batch without retries. Six additional regression tests pass, bringing the focused catalogue suite to 24; these include real tool status, caller-price recovery, shared failures and deadline behavior.

Companion site PR #523 also addresses its generated catalogue banner and explicit release-state promotion. Its independent source CI remains blocked until read-only access to this private package repository is configured. Neither the automated Codex comments nor the local fixes satisfy the required different-family review; no release gate is inferred from them.

Council advisory routing returned HTTP 401; no council verdict or independent approval was obtained. No merge, npm publication, database mutation, credential access, account discount application or paid inference occurred. Install-time tool/provider selection remains the explicitly deferred 1.0 feature.

## Reproduction

```sh
npm ci --ignore-scripts
npm run docs:check
npm test
npm run build
npm run verify:catalogue -- /path/to/stdio-evidence.json
npx tsx scripts/verify-media-prices.ts
npm pack --dry-run
```

The site PR records its immutable source pin, registry mutation red/green evidence, rendered row-set equality and build checks separately. Publishing is a later gated action after the required review and site merge, not a result of this verification.

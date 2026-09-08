# fal and Crazyrouter addendum — 2026-09-08

This is part of the 0.9.0 release candidate. The generated README and companion site obtain provider/tool counts from registry and MCP discovery. WaveSpeed remains part of the original media scope, so adding Crazyrouter increases the candidate registry beyond the addendum's original nine-plus-two calculation.

## Credentials and acquisition

Both authorized keys were probed **before implementation**, using `secret()` from the user-named `hermes_agents/tools/secret_read.py`. At 16:03 UTC, fal authenticated pricing returned 200 with the three requested rows, and Crazyrouter authenticated models returned 200 with 146 key-visible identities. Only GET metadata requests were made. Values were supplied to child processes through memory/environment, never CLI arguments, logs, evidence, or committed files. The package itself only reads optional `FAL_API_KEY` and `CRAZYROUTER_API_KEY` environment values.

fal and Crazyrouter have separate collectors and declared roles: media generation platform and multi-provider aggregator. Full key-visible catalogue coverage is distinct from the provider's entire global inventory, public marketing counts, and comparable price coverage.

## fal: full identities, bounded account pricing

The authenticated collector observed **1,494 / 1,494 identities, zero excluded**, in two cursor pages at 16:11 UTC. It requested prices in 50-ID batches and stopped on HTTP 429 at batch eleven without retrying. Ten successful batches observed 500 native prices: 127 normalized and 373 retained with unsupported or ambiguous billing units. The remaining 994 identities retained unavailable prices: 50 failed lookup IDs and 944 not attempted after the failure. Nothing in that outcome establishes nonpublication.

| Exact fal endpoint | Authenticated native quote | Canonical quote | Independent provider-page evidence |
| --- | --- | --- | --- |
| `fal-ai/bytedance/seedream/v4/text-to-image` | 0.03 USD/images | **0.03 USD/image** | [Seedream V4](https://fal.ai/models/fal-ai/bytedance/seedream/v4/text-to-image): $0.03 per image |
| `fal-ai/flux-pro/kontext` | 0.04 USD/images | **0.04 USD/image** | [FLUX Kontext](https://fal.ai/models/fal-ai/flux-pro/kontext): $0.04 per image |
| `fal-ai/kling-video/v2.5-turbo/pro/image-to-video` | 0.07 USD/seconds | **0.07 USD/video-second** | [Kling 2.5 Turbo Pro](https://fal.ai/models/fal-ai/kling-video/v2.5-turbo/pro/image-to-video): $0.35 for five seconds and $0.07 for each additional second |

All three comparisons passed. Conversion is exact multiplication by 1 and division by 1 for these native units. Kling's own page establishes that its generic `seconds` unit denotes generated video duration. Other generic seconds are withheld without an explicit output contract; GPU/compute time is never relabelled as output duration. Megapixel rates state the one-megapixel reference image. Native values and conditions remain in every quote. Account discounts may apply to authenticated fal prices.

The [fal pricing API reference](https://fal.ai/docs/platform-apis/v1/models/pricing) documents up to 50 endpoint IDs per request and account pricing. No undocumented pricing-cursor traversal or retry is invented. A failed batch, an unattempted batch, a successfully checked missing price, and an unsupported native unit have distinct reasons.

## Crazyrouter: shared-model comparison

Authenticated collection at 16:17 UTC retained **146 / 146 key-visible identities, zero excluded**. Its public pricing source provided 85 supported plain-token price pairs; 61 identities retained unavailable comparison prices and their native billing data. The OpenRouter public all-modalities response supplied 580 rows. Exact author/alias matching produced 24 input/output comparable pairs, while all 146 Crazyrouter rows remained in the comparison output. This does not verify its marketed global model count.

Prices below are USD per **million uncached text tokens**, shown as **input / output**. The tool stores exact per-token values and rational savings, plus native coefficients and conversion operands.

| Shared API alias | Crazyrouter default group | OpenRouter public quote | OpenAI published reference | Difference on both legs |
| --- | ---: | ---: | ---: | ---: |
| `gpt-4o` | **1.625 / 6.5** | **2.5 / 10** | **2.5 / 10** | **35% lower** |
| `gpt-4o-mini` | **0.0975 / 0.39** | **0.15 / 0.6** | **0.15 / 0.6** | **35% lower** |
| `gpt-4.1` | **1.3 / 5.2** | **2 / 8** | **2 / 8** | **35% lower** |

Sources: [Crazyrouter public pricing](https://crazyrouter.com/api/pricing), [OpenRouter all-modalities catalogue](https://openrouter.ai/api/v1/models?output_modalities=all), OpenAI's own [GPT-4o](https://developers.openai.com/api/docs/models/gpt-4o), [GPT-4o mini](https://developers.openai.com/api/docs/models/gpt-4o-mini), and [GPT-4.1](https://developers.openai.com/api/docs/models/gpt-4.1) pages. Direct-provider references are dated September 8 observations; the runtime labels them `dated_published_reference_not_live`, and leaves other direct-provider baselines unknown.

The formula comes from the [provider-owned pricing frontend](https://crazyrouter.com/assets/mtrgex7b/pricingHelpers-Dhu58xYK.js), linked by its pricing page: input USD/M is `model_ratio × 2 × group_ratio × discount`; output also multiplies `completion_ratio`. The selected public group has ratio 1 and discount 0.65. This does not establish the account's billing group or actual settled charges. Unsupported custom/tiered, time, image and video formulas are retained without assuming the plain-token formula applies.

Crazyrouter Team states: “Pay-as-you-go pricing: 20–50% cheaper than official provider rates on most models” in its [March 1 comparison article](https://crazyrouter.com/en/blog/openrouter-vs-crazyrouter-ai-api-router-comparison-2026), observed September 8. The three selected aliases fall within that range on both input and output against the available direct-provider references. They do not prove a claim about most models. OpenRouter differences are reported separately; the vendor claim concerns official provider prices.

An actual discrepancy remains visible: the [GPT-5 mini landing page](https://crazyrouter.com/models/gpt-5-mini), reviewed March 12 and checked September 8, advertises 45% off and 0.14 / 1.10 USD/M. Current public pricing for the exact `gpt-5-mini` alias was **0.1625 / 1.30**, reflecting 35% off. The collected quote wins; the comparison tool reports the dated landing-page discrepancy. A different GPT-4o landing route uses `chatgpt-4o-latest` in its code example and is not joined to `gpt-4o` merely because the page title resembles it.

Alias matching uses explicit native vendor/owner evidence and identical alias spelling. Unknown authors, conflicting or missing vendor IDs, duplicate IDs, suffix variants, and unpriced rows remain explicit. Matching API aliases does not establish identical immutable snapshots or deployments. No inference, latency, accuracy, account spending, or global discount benchmark was performed.

## Behavioral verification

Observed RED-to-GREEN tests cover authenticated batching, exact decimal rates, missing/failed/unattempted prices, credential reflection, duplicate identity accounting, prototype-safe unit contracts, malformed/incomplete Crazyrouter prices, undefined vendor joins, tiered billing, mismatched aliases, zero-baseline comparisons, more-expensive/range contradictions and pagination retention. MCP tests validate identical JSON text and structured output, read-only annotations, and network-free discovery.

The original three-provider media evidence remains in [media-price-evidence.md](media-price-evidence.md). Release-wide tests, final stdio and artifact evidence are recorded in [release-0.9.0-verification.md](release-0.9.0-verification.md) and the PR. Install-time tool/provider selection remains deferred to 1.0; publication requires different-family review and the companion site merge.

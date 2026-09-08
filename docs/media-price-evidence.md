# Native catalogue and media price evidence — 2026-09-08

Measured by `npx tsx scripts/verify-media-prices.ts` at **2026-09-08T15:20:39.411Z**. The script exited 0 after asserting full population retention and **6 of 6 price comparisons across 3 providers**. These are public catalogue and published-price observations, not paid inference measurements. No credentials, generation requests, retries, or account discounts were used.

## Population and price coverage

| Provider | Listed / received / retained | Excluded | Pages | Models with a canonical price | Models with a media price |
| --- | ---: | ---: | ---: | ---: | ---: |
| DeepInfra | 372 / 372 / 372 | 0 | 1 | 324 | 64 |
| WaveSpeed | 1,015 / 1,015 / 1,015 | 0 | 6 | 4 | 4 |
| fal | 1,493 / 1,493 / 1,493 | 0 | 2 | 6 | 6 |
| Chutes | 495 / 495 / 495 | 0 | 1 | 479 | 0 |
| Total | 3,375 / 3,375 / 3,375 | 0 | 10 | 813 | 74 |

Every identity from each native source is retained. No modality or price filter is applied during intake. All unpriced rows carry `price_not_available`, a specific reason, native pricing when present, source URL, observation time, and source row index. User output filtering and pagination are separate from native population accounting. Partial acquisitions preserve the received rows and native denominator; failures before receipt report null counts, not zero.

- [DeepInfra full source](https://api.deepinfra.com/models/list) is a bare array. At observation its native price axes were 219 `tokens`, 41 `input_tokens`, 46 `image_units`, 23 `output_length`, 20 `input_character_length`, 13 `time`, 7 `input_length`, and 3 `frame_units`. The previously reported 371 models / 218 token models had become **372 / 219**.
- [WaveSpeed public website catalogue](https://wavespeed.ai/api/models?page=1&page_size=200) publishes a total and caps pages at 200 rows. The collector follows all six pages. Website `base_price` is **microUSD**, unlike the documented authenticated API's USD shape. The public model-detail source supplies formulas and the JSON-encoded `input` schema. Four established Wan 2.2 models are checked by default; callers can request details for up to 20 additional exact identities. The remaining 1,011 rows have their native base price retained but no guessed price per image or output second. A published base price without an observed formula/quantity is explicitly different from a missing price.
- [fal model catalogue](https://api.fal.ai/v1/models?limit=1000) has cursor pagination and no total in the live response. The denominator is the total observed after exhausting the terminal cursor, not a provider-supplied total. If a total is supplied, it is preserved and checked. No category or status filter is sent. The [public pricing page](https://fal.ai/pricing) lists eight endpoint rows; six match current catalogue identities and supported units. Whole-video pricing without an established duration is withheld, and the remaining individual model pages are explicitly **not observed**, not declared unpublished. Image comparisons use the page's stated one-megapixel reference image.
- [Chutes public deployments](https://api.chutes.ai/chutes/?include_public=true&limit=1000&page=0) includes custom deployments. Identity is `chute_id`, because display names are not guaranteed unique. Its 479 explicit USD input/output token pairs are normalized from USD per million tokens, while compute-hour/second rates remain native. Fifteen null-template deployments keep unknown modality; their names are not used to invent image/video output contracts. The embedding deployment has compute pricing, not an inferred token price.

The authenticated WaveSpeed `/api/v3/models` and fal pricing API each returned 401 on one credential-free probe; neither was retried. The runtime collector uses the separately observed public website sources above. No QwenCloud native adapter was added here because its known richer source requires authentication; the legacy upstream catalogue remains a separate source.

## Comparisons against each provider's own published page

| Provider / model | Native value and conversion | Canonical result | Independent published page comparison |
| --- | --- | --- | --- |
| DeepInfra `black-forest-labs/FLUX-1.1-pro` | `4.0` cents per reference image / 100 | **0.04 USD/image** | [DeepInfra pricing](https://deepinfra.com/pricing) model row: $0.04/image |
| WaveSpeed `wavespeed-ai/wan-2.2/t2v-720p` | `300000` microUSD × 0.000001 / 5 | **0.06 USD/video second** | [Model pricing table](https://wavespeed.ai/models/wavespeed-ai/wan-2.2/t2v-720p): 5 seconds cost $0.30 |
| WaveSpeed `wavespeed-ai/wan-2.2/i2v-720p` | `300000` microUSD × 0.000001 / 5 | **0.06 USD/video second** | [Model pricing table](https://wavespeed.ai/models/wavespeed-ai/wan-2.2/i2v-720p): 5 seconds cost $0.30 |
| WaveSpeed `wavespeed-ai/wan-2.2/t2v-720p-ultra-fast` | `100000` microUSD × 0.000001 / 5 | **0.02 USD/video second** | [Model pricing table](https://wavespeed.ai/models/wavespeed-ai/wan-2.2/t2v-720p-ultra-fast): 5 seconds cost $0.10 |
| WaveSpeed `wavespeed-ai/wan-2.2/i2v-720p-ultra-fast` | `100000` microUSD × 0.000001 / 5 | **0.02 USD/video second** | [Model pricing table](https://wavespeed.ai/models/wavespeed-ai/wan-2.2/i2v-720p-ultra-fast): 5 seconds cost $0.10 |
| fal `fal-ai/bytedance/seedream/v4/text-to-image` | `0.03` USD/image × 1 / 1 | **0.03 USD/image** | [Individual model page](https://fal.ai/models/fal-ai/bytedance/seedream/v4/text-to-image) independently says $0.03 per image; collector reads the pricing table |

WaveSpeed conversion requires the observed formula `base_price * duration / 5` and a default duration of 5 seconds. Merely finding a `duration` property is insufficient. DeepInfra reference image dimensions/iterations and native pricing tables remain attached as conditions; its default `image_units` rate already represents those reference dimensions/iterations. For example, `FLUX-2-dev` is $0.01 for its 1024×1024, 28-iteration reference image, rather than multiplying its base rate by 28 again. Comparisons across different quality/resolution conditions require those conditions to match.

## Arithmetic and failure evidence

Price arithmetic uses decimal lexemes and `BigInt` integer ratios. `0.075 / 1000000` is exactly `0.000000075`; scientific native notation is expanded without floating-point division. Every normalized rate records the native value/unit/field, multiplier, divisor, formula, and reduced numerator/denominator. A nonterminating decimal such as 1/3 carries the exact fraction and omits the decimal value instead of rounding silently.

`npx tsx --test test/catalogue.test.ts` passes **18 tests**. Actual red-to-green regressions were observed for:

1. WaveSpeed's native `input` is JSON encoded text, unlike the first fixture's object: one test failed with absent price, then passed after lossless nested parsing.
2. A fal terminal cursor with declared total 10 and one row: the test failed when the denominator became 1, then passed with total 10 and partial/mismatch state.
3. A WaveSpeed flat image run with unrecognized `batch_size`: the test failed when a run became one image, then passed with an unavailable price until output quantity is established.
4. Chutes token rates alongside compute prices: the test failed when all prices were discarded, then passed with `0.12/M → 0.00000012/token` and `0.37/M → 0.00000037/token` while preserving compute rates natively.

Other checks cover unpriced identity retention, compute seconds versus output seconds, video frame units without FPS, negative/invalid decimals, exact recurring fractions, 401 without retries/body reflection, page-budget partial state, full pagination, and price-status consistency. `tsc -p tsconfig.json` passed after the initial implementation; final repository-wide build and stdio checks are recorded with the release integration evidence.

The collector deliberately does not infer runtime seconds as USD/image, frame prices as USD/video second without a frame contract, account discounts, an output count from a missing count parameter, or media prices for all models merely because the entire identity population was collected. Full catalogue coverage and partial price coverage are reported separately on every response.

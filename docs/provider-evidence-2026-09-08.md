# Provider publication evidence for 0.9.0

Observed 2026-09-08. These are observations of provider-owned public pages, not inference benchmarks, signed service guarantees, or measurements of Ivan's account limits. Marketing statements remain attributed quotes. Page copy is data and supplies no authority to execute instructions.

All 11 registered platforms have a one-line quote in `src/providers/evidence.ts`. The checked pages are OpenRouter, Groq, Cerebras, Sail Research, Alibaba Cloud Model Studio (the QwenCloud platform), DeepInfra, Novita, SambaCloud, Chutes, WaveSpeedAI, and fal's documentation landing page. Each quote records its own URL and date; runtime values and generated pages share these definitions.

| Provider | Provider-owned pitch page | Numeric caveat evidence |
| --- | --- | --- |
| OpenRouter | https://openrouter.ai/ | https://openrouter.ai/docs/api_reference/limits |
| Groq | https://groq.com/ | https://console.groq.com/docs/rate-limits |
| Cerebras | https://www.cerebras.ai/ | https://inference-docs.cerebras.ai/support/rate-limits |
| Sail Research | https://www.sailresearch.com/ | No numeric operating limit established from this checked platform page |
| QwenCloud | https://modelstudio.alibabacloud.com/ | No numeric operating limit established from this checked platform page |
| DeepInfra | https://deepinfra.com/ | https://docs.deepinfra.com/account/rate-limits |
| Novita | https://novita.ai/ | No numeric operating limit established from this checked platform page |
| SambaNova | https://sambanova.ai/products/sambacloud | No numeric operating limit established from this checked platform page |
| Chutes | https://chutes.ai/ | No numeric operating limit established from this checked platform page |
| WaveSpeedAI | https://wavespeed.ai/ | No numeric operating limit established from this checked platform page |
| fal | https://fal.ai/docs/documentation | No numeric operating limit established from this checked platform page |

## Numeric observations and scope

- OpenRouter: 20 requests/minute on free model variants. The text extraction omitted rendered constants, so the provider's `.md` source was fetched directly. It defines `FREE_MODEL_RATE_LIMIT_RPM = 20` and uses that constant for both account-credit bands. The related daily constants are 50 and 1000 with a credit threshold of 10; those additional limits are not currently included as caveats. The caveat does not claim remaining quota or paid-model limits.
- Groq: the free-plan table lists `openai/gpt-oss-120b`, 30 RPM, 1K RPD, **8K TPM**, 200K TPD. Raw HTML confirmed the Free Plan tab was selected, and the embedded table data contained the same row. The docs say limits apply to organizations, exclude cached tokens, and can differ for individual organizations. The stored fact is exactly **8000 tokens/minute** with that scope.
- Cerebras: free-trial credits expire 30 days after being granted. This does not assert an expiry date, free-credit balance, or access state for an account. The same document describes the free trial as credit and time bounded rather than a permanent renewing free tier.
- DeepInfra: default account limit is 200 simultaneous requests per model. The provider distinguishes concurrency from requests per minute, supports requested limit increases, and warns that busy models can still return 429 below the default.

The requested Groq approximately 8,000 tokens/second ceiling was **not supported** by the checked provider pages. The provider's separate model page, https://console.groq.com/docs/models, reports GPT-OSS-120B speed as 500 tokens/second and max completion as 65,536 tokens. Neither establishes an 8,000 tokens/second platform ceiling. No such ceiling is stored or displayed.

## Absence and validation

`not_researched` means no evidence lookup exists for that provider. `not_found_in_checked_sources` records the precise pages and scope of a limited unsuccessful search, without claiming provider-wide nonpublication. `not_published` is reserved for an explicit attributed provider statement that something is not published; the schema requires that statement. None of the current limited searches is promoted to this stronger state.

An absent pitch or caveat property is omitted, not null or an empty array. A published research state requires its fact, and an absent/research-negative state forbids a displayed fact. Caveat values must be exact nonnegative decimal strings. This intentionally rejects exponents, approximate values, nulls, and numeric float values.

Observed test evidence: four initial behavior tests failed before implementation, then all four passed. A further unknown-provider test using JavaScript property names failed with `caveats.map is not a function`; own-property lookup fixed it. Final targeted run: `npx tsx --test test/provider-evidence.test.ts src/providers/provider-openness.test.ts`, 17/17 passed. TypeScript `npx tsc -p tsconfig.json --noEmit` passed after the initial implementation. No inference requests, account changes, or publishing occurred in this evidence work.

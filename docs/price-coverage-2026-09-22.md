# Provider price coverage (2026-09-22)

This is the live coverage check used for the provider-coverage change. It records
whether each provider registered by `open-dashboard-mcp` exposed machine-readable
price data at the time of the check. A credential was used only where the provider
requires one; holding a credential was not treated as evidence that prices exist.

`PUBLISHES_PRICES` means a JSON or raw Markdown source returned a price field and a
unit that can be retained. `PRICES_UNPUBLISHED` means the checked model endpoint
returned model identities but no price fields, and no machine-readable source was
available without scraping a rendered page. `UNREACHABLE` means no checked source
could be read. No registered provider remained in the last state after trying its
documented alternate or keyed source.

| Provider | State | Machine-readable source checked | Unit observed | Collection path |
|---|---|---|---|---|
| OpenRouter | PUBLISHES_PRICES | `https://openrouter.ai/api/v1/models` | USD per token, plus request/image/cache fields | Native JSON collector |
| Groq | PUBLISHES_PRICES | `https://api.groq.com/openai/v1/models` (keyed) | USD per token, plus cache/image/request fields | Native JSON collector |
| Cerebras | PRICES_UNPUBLISHED | `https://api.cerebras.ai/v1/models` returned model rows with no pricing fields | None returned | Declared gap; rendered pricing page was not scraped |
| Sail | PUBLISHES_PRICES | `https://docs.sailresearch.com/pricing.md` | USD per million tokens, with ASAP/Balanced/Flex windows | Existing Markdown parser |
| Nous Research | PUBLISHES_PRICES | `https://inference-api.nousresearch.com/v1/models` | USD per token | Native JSON collector |
| QwenCloud | PUBLISHES_PRICES | `https://dashscope-intl.aliyuncs.com/api/v1/models` (keyed) | USD per million tokens in the returned `price_unit`, plus native non-token units | Native JSON collector |
| DeepInfra | PUBLISHES_PRICES | `https://api.deepinfra.com/models/list` | Token, image, second, frame and character axes | Existing native collector |
| Novita | PUBLISHES_PRICES | `https://api.novita.ai/v3/openai/models` | USD per million tokens (`per_m`) with tier flags | Native JSON collector |
| SambaNova | PUBLISHES_PRICES | `https://api.sambanova.ai/v1/models` | USD per token | Native JSON collector |
| Chutes | PUBLISHES_PRICES | `https://llm.chutes.ai/v1/models` and `https://api.chutes.ai/chutes/?include_public=true&limit=100&page=0` | Token and native media rates | Existing native collector |
| WaveSpeedAI | PUBLISHES_PRICES | `https://wavespeed.ai/api/models` | Native media rates (`base_price`, discount metadata) | Existing native collector |
| fal | PUBLISHES_PRICES | `/v1/models` plus keyed `/v1/models/pricing?endpoint_id=...` | Provider-declared currency and native units per endpoint | Existing native collector |
| Crazyrouter | PUBLISHES_PRICES | `https://crazyrouter.com/api/pricing` | Provider-declared token/group/media ratios | Existing native collector |

The initial Sail model request returned `401` without authentication; the raw
Markdown pricing document is a separate public, machine-readable source and was the
source accepted by the existing Sail economics parser. Chutes' first host timed out
within the probe budget; its alternate `llm.chutes.ai` model endpoint and the public
API catalogue were reachable. Those endpoint-specific failures do not turn a provider
whose alternate source returned prices into `UNREACHABLE`.

Every collected price point now carries `measurement_origin: "catalogue"` and
`observed: null`. A published catalogue amount is therefore never presented as a
settled charge. The later values `live_provider_read` and `unknown` remain reserved
for an observed provider charge and an explicitly unestablished observation. Credit
units remain credit units; the schema rejects currency metadata on a credit-priced
model instead of converting credits into money.

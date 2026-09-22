# Provider price coverage — live evidence rerun

Observed at `2026-09-22T22:04:47.406Z` by the read-only
`scripts/collect-price-coverage.ts` runner. It invokes the ordinary provider
collectors; rendered sources are a normal source class, not a documentation
fallback. Credentials were supplied only to the process for providers that
require them and are not recorded here.

## Evidence rule

`PUBLISHES_PRICES` requires at least one retained price row from an acquired
source. `UNKNOWN` means the checked source did not establish a retained price
row; API silence is never promoted to a conclusion about a provider's public
pricing. `PRICES_UNPUBLISHED` is structurally valid only with
`renderedPageEvidence` recording a URL, fetch timestamp, executed JavaScript,
a settled DOM, a recognized rendered price table, zero price rows, and visible
text explicitly stating that prices are absent. An unread, failed, loading,
unconfigured, unrecognized, header-only, or unparseable page cannot create
that state.

## Full rerun

| Provider | Previous label | Observed label | Executed source | Retained price rows | Collector status |
|---|---|---|---|---:|---|
| OpenRouter | `PUBLISHES_PRICES` | `PUBLISHES_PRICES` | `https://openrouter.ai/api/v1/models` (native JSON) | 1273 | available |
| Groq | `PUBLISHES_PRICES` | `PUBLISHES_PRICES` | `https://api.groq.com/openai/v1/models` (native JSON) | 30 | available |
| Cerebras | `PRICES_UNPUBLISHED` | `PUBLISHES_PRICES` | `https://www.cerebras.ai/pricing` (rendered DOM) | 2 | available |
| Sail | `PUBLISHES_PRICES` | `PUBLISHES_PRICES` | `https://docs.sailresearch.com/pricing.md` (Markdown) | 7 | available |
| Nous Research | `PUBLISHES_PRICES` | `PUBLISHES_PRICES` | `https://inference-api.nousresearch.com/v1/models` (native JSON) | 1181 | available |
| QwenCloud | `PUBLISHES_PRICES` | `UNKNOWN` | `https://dashscope-intl.aliyuncs.com/api/v1/models` (native JSON) | 0 | available |
| DeepInfra | `PUBLISHES_PRICES` | `PUBLISHES_PRICES` | `https://api.deepinfra.com/models/list` (native catalogue) | 554 | available |
| Novita | `PUBLISHES_PRICES` | `PUBLISHES_PRICES` | `https://api.novita.ai/v3/openai/models` (native JSON) | 283 | available |
| SambaNova | `PUBLISHES_PRICES` | `PUBLISHES_PRICES` | `https://api.sambanova.ai/v1/models` (native JSON) | 18 | available |
| Chutes | `PUBLISHES_PRICES` | `PUBLISHES_PRICES` | `https://api.chutes.ai/chutes/` (native catalogue) | 952 | available |
| WaveSpeedAI | `PUBLISHES_PRICES` | `PUBLISHES_PRICES` | `https://wavespeed.ai/api/models` (native catalogue) | 4 | available |
| fal | `PUBLISHES_PRICES` | `PUBLISHES_PRICES` | `https://api.fal.ai/v1/models` (native catalogue) | 158 | partial |
| Crazyrouter | `PUBLISHES_PRICES` | `PUBLISHES_PRICES` | `https://api.crazyrouter.com/v1/models` (native JSON) | 192 | available |

Changed labels only:

| Provider | Before | After | Reason |
|---|---|---|---|
| Cerebras | `PRICES_UNPUBLISHED` | `PUBLISHES_PRICES` | JavaScript was executed on the public pricing page and two visible price rows were retained. |
| QwenCloud | `PUBLISHES_PRICES` | `UNKNOWN` | The reachable model API established zero retained price rows in this rerun. No rendered-page evidence was acquired, so nonpublication is not assertable. |

`fal` is deliberately still marked `partial` at the collector level: it proves
published prices exist, not complete per-model price coverage. Its provider label
does not hide that acquisition limitation.

## Cerebras rendered-page receipt

The browser collector used Chrome through Playwright, waited for two consecutive
identical visible-table snapshots after JavaScript execution, and read
`HTMLTableElement.rows`, `HTMLTableRowElement.cells` and visible `innerText`
only. It did not fetch raw HTML and does not read
`aria-label` attributes.

```json
{
  "url": "https://www.cerebras.ai/pricing",
  "fetchedAt": "2026-09-22T22:04:40.031Z",
  "javascriptExecuted": true,
  "domSettled": true,
  "tableCount": 2,
  "priceTableCount": 1,
  "priceTableObserved": true,
  "priceRowCount": 2,
  "explicitNoPrices": false,
  "outcome": "rendered_prices_found"
}
```

The separate page tables intentionally remain separate observations:

| Model | Developer tier table | Rendered speed / price table | Per-model price state |
|---|---|---|---|
| `gpt-oss-120b` / GPT OSS 120B | listed | `~3000 tokens/s`; input `$0.35/M`, output `$0.75/M` | `priced` |
| `qwen-3.8-27b` / Qwen 3.8 27B | not listed | `~1,850 tokens/s`; input `$0.99/M`, output `$1.49/M` | `priced` |
| `gemma-4-31b` | listed | no matching price row | `offered_unpriced` |

This preserves the mismatch: the Developer column lists `gpt-oss 120b` and
`gemma-4-31b`, while the price table lists GPT OSS 120B and Qwen 3.8 27B.
Gemma is retained as offered-but-unpriced, rather than being smoothed into
either a priced model or a model that is not offered.

All published amounts retain `measurement_origin: "catalogue"` and
`observed: null`; they are not observed charges. Native billing units remain
native, and the existing schema still rejects currency metadata on credit-priced
rows.

## Verification

The final local suite passed `385/385` tests with `0` failures. Both
`npx tsc -p tsconfig.json --noEmit` and
`npx tsc -p tsconfig.harness.json --noEmit` passed, and `git diff --check`
was clean.

`npm run docs:check` currently exits `1` with
`README generated facts disagree with the package registry or tools/list. Run npm run docs:generate.`
The generated README is outside this change by instruction, so it was neither
generated nor staged. This report and the collector tests are therefore local
verification evidence; the queued remote `verify` jobs are not claimed as CI
success.

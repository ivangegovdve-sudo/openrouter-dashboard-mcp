# AkashML and io.net: provider research, 2026-09-25/26

Evidence behind the 1.2.0 provider additions. Figures are what was read or measured on
these dates; call `dashboard_catalogue` for current values.

## AkashML

- Akash Network's managed inference service. Base URL `https://api.akashml.com/v1`,
  OpenAI-compatible. `/models` requires a key (401 without one).
- `/models` publishes a per-model `pricing` object in USD per token (`input`, `output`,
  `input_cache_read`, `request`). Six models, all priced. Output ranges from $0.10/M
  (`openai/gpt-oss-20b`) to $4.40/M (`zai-org/GLM-5.3`), about 44x.
- The homepage metadata says "competitive pricing starting from $0.15/M tokens" and
  names DeepSeek. No listed model costs $0.15/M, and no DeepSeek model is listed.
- Three small calls billed in the AkashML console (read by Ivan) agree with the per-model
  rates at the console's 5-decimal precision: Llama-3.3-70B 44 tokens → $0.00001 (rates
  give ~$0.0000074); Qwen3.8-27B 33 tokens → $0.00004 (~$0.000043); gpt-oss-20b 106
  tokens → $0.00000. Larger calls on 2026-09-25 could not be matched to billing because
  the console needs a signed-in session this work does not use.
- The chat `usage` object carries token counts (and `cached_tokens`, sometimes
  `reasoning_tokens`) but no cost field. No billing or usage API is documented; spend is
  visible only in the web console. Generation cost is therefore `UNKNOWN`.
- Documented request controls: `reasoning_effort` (gpt-oss accepts low/medium/high; `none`
  is rejected because those models always reason) and an open `reasoning` object.

### Response shape (measured 2026-09-25)

Prompts: "Reply with exactly READY." at `max_tokens` 16 and 2048, and a ~2500-word essay
at 6000.

| Model | 16 tokens | 2048 tokens | 6000-token essay |
|---|---|---|---|
| gpt-oss-120b | empty content, reasoning | answer (36 tok) | answer (5249 tok) |
| GLM-5.3 | answer (3 tok, no reasoning) | answer (3 tok) | **empty content, 6000 tok of reasoning** |
| Qwen3.8-27B | empty content, reasoning | answer (24 tok) | answer (3506 tok) |
| Qwen3.6-35B-A3B | empty content, reasoning | answer (222 tok) | truncated answer (6000 tok) |
| gpt-oss-20b | empty content, reasoning | answer (19 tok) | answer (4328 tok) |
| Llama-3.3-70B | answer (2 tok) | answer (2 tok) | answer (1283 tok) |

An earlier 16-token GLM-5.3 call reasoned and returned empty content, so its behaviour on
the same prompt varies between calls.

## io.net

- **Sells both.** IO Cloud rents GPUs; IO Intelligence sells per-token inference at
  `https://api.intelligence.io.solutions/api/v1`.
- Inference: `/models` is public (HTTP 200 without a key) and lists 37 models, all with
  `input_token_price`, `output_token_price` and `cache_read_token_price` as JSON numbers
  in USD per token. 31 of 37 carry `min_access_tier` 2 or 3 with `higher_tier_required`,
  so a free key cannot call most of the catalogue. Included in the dashboard.
- Plans (io.net payments docs): a free Standard tier with unstated daily limits;
  Professional $15/month and Developer $150/month in usage credits. A "1M tokens/day
  free" figure appears only in third-party posts and is unverified.
- GPU rental: two io.net blog pages disagree. One dated April 2026 gives H100 SXM
  $2.20/hr, H100 PCIe $1.49/hr, A100 80GB $1.49/hr, RTX 4090 $0.18/hr. Another gives
  H100 SXM $3.50–4/hr and A100 80GB $2.50–3/hr. The live cloud.io.net table sits behind a
  session gate. H200 price: unknown. GPU rental is not collected by this package.

### io.net response shape (measured 2026-09-26, with a key)

Prompt "Reply with exactly READY.", 18 calls. Every message carried `content`,
`reasoning_content` and `refusal`. A key-bearing request can get Cloudflare
`403 error code: 1010` depending on client and User-Agent (reported by Ivan; not reproduced
from this desktop, where node, curl and an empty User-Agent all got 200).

| Model | max_tokens 16 (3 calls) | tokens used for the answer at 256 (3 calls) |
|---|---|---|
| GLM-5.3-Flash | empty, empty, empty | 95, 218, 217 |
| DeepSeek-V4.1-Flash | empty, empty, answered | 35, 16, 32 |
| Qwen3.8-27B | truncated, truncated, answered (13 tok) | 25, 26, 27 |

Ivan's probe the same day saw Qwen3.8-27B return empty at 16 tokens and measured GLM-5.3-Flash
at 91 tokens and DeepSeek at 18, inside or near the ranges above.

## Akash (GPU marketplace, for comparison)

H100 PCIe ~$2.09/hr, H100 SXM5 ~$2.69/hr, A100 ~$1.00–2.50/hr via a bidding marketplace
whose capacity contracted ~57% quarter-on-quarter. Supply is thin. Figures supplied by
Ivan, not re-measured here.

## Sail (measured 2026-09-26)

- Keyed `/models` (401 without a key) lists 12 ids and nothing else. Prices come only from the
  digest-verified pricing document, re-pinned today (`2a939cfd…`): all 12 ids priced, per
  completion window (ASAP / Balanced / Flex; gpt-oss-120b ASAP only, Qwen3.6-35B-A3B Flex only).
- Prompt "Reply with exactly one word: ready", temperature 0, budgets 16/64/256. The operator
  measured gemma-4-12B-it, DeepSeek-V4.1-Flash, gpt-oss-120b and GLM-5.3-Flash; this build
  measured the other eight.

| Model | reasoning_content | 16 | 64 | 256 | latency (this build) |
|---|---|---|---|---|---|
| Gemma-4-31B-IT-NVFP4 | absent | ready (2) | ready (2) | ready (2) | 0.38–0.45 s |
| gemma-4-31B-it | absent | ready (2) | ready (2) | ready (2) | 0.57–0.90 s |
| DeepSeek-V4-Pro-0813 | absent | ready (2) | ready (2) | ready (2) | 1.8–2.4 s |
| gemma-4-12B-it (operator) | absent | ready (2) | – | – | – |
| DeepSeek-V4.1-Flash (operator) | present | ready (15) | – | – | – |
| GLM-5.3 | present | empty | ready (38) | ready (38) | 0.53–0.73 s |
| DeepSeek-V4-Flash-0731 | present | empty | ready (42) | ready (44) | 0.72–1.18 s |
| Kimi-K2.6 | present | empty | ready (37) | ready (34) | 1.1–1.3 s |
| Kimi-K3 | present | empty | ready (48) | ready (48) | 0.9–1.9 s |
| gpt-oss-120b (operator) | present | empty | – | ready (46) | – |
| GLM-5.3-Flash (operator) | present | empty | – | ready (36) | – |
| Qwen3.6-35B-A3B (flex only) | present | empty | empty | ready (144) | 8.3–8.8 s |

- Qwen3.6-35B-A3B returns HTTP 400 synchronously unless `metadata.completion_window` is
  `flex`; with flex it returned `content: null`, not `""`, when the budget ran out.
- Correction to the brief: gemma-4-12B-it is not the only zero-reasoning-tax model. Three more
  Sail models and AkashML's Llama-3.3-70B-Instruct answer in 2 tokens with no reasoning, and
  Gemma-4-31B-IT-NVFP4 is the cheapest and fastest of them.

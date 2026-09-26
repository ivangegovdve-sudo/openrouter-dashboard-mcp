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

## Akash (GPU marketplace, for comparison)

H100 PCIe ~$2.09/hr, H100 SXM5 ~$2.69/hr, A100 ~$1.00–2.50/hr via a bidding marketplace
whose capacity contracted ~57% quarter-on-quarter. Supply is thin. Figures supplied by
Ivan, not re-measured here.

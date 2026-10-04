# open-dashboard-mcp 1.6.0: three-host live observation report

Observed on 2026-10-04. This report is packaged with 1.6.0 as
[`release-1.6.0-host-observations.json`](release-1.6.0-host-observations.json).

## Result

`open-dashboard-mcp@1.5.0` was the npm `latest` package at test time. It had
16 direct catalogue providers and no Higgsfield adapter. The final locally
packed `1.6.0` candidate exposes 17 providers, including Higgsfield, and passed
the public catalogue, media catalogue, Higgsfield-only catalogue,
`dashboard_capability_state`, and live-page HTTP smoke on all three hosts.

The release also bounds `dashboard_capability_state` to 500 rows by default and
at most 500 rows. The three-host baseline recorded generic transport failures
for its 2,000-row request, while the new default produced successful, explicitly
capped snapshots on every host.

## Scope and controls

- Hosts: Bulgaria desktop, KVM2, and Oracle.
- Every run installed the package into a fresh, exact temporary directory and
  used ephemeral test storage rather than the repository. Cleanup receipts are
  not included in the packaged report.
- The public dashboard page smoke fetched
  `https://www.sdforest.site/web/open-dashboard/` and recorded the HTTP status,
  content type/size, and dashboard marker. It is an HTTP observation, not a
  browser-render assertion.
- Credentials were retrieved through Google Cloud Secret Manager resource names.
  No secret value or resource name appears in this report or the package.
- The release checkout was refreshed with `git fetch origin && git rebase
  origin/main` onto `584812c43f44c0cb0cef74da38dd6e648fd8d45c`. Validation is
  self-hosted only; no hosted CI run was dispatched.

## npm latest baseline: 1.5.0

| Host | Public refresh | Mixed media refresh | `capability_state` at 2,000 rows | Higgsfield web comparison | Live page |
|---|---:|---:|---:|---:|---:|
| Bulgaria desktop | 22,264.7 ms; 5,492 models / 2,601 priced | 7,108.2 ms; partial, 500 rows | transport failure, 2,393.3 ms | 200, 167.6 ms | 200, 293.7 ms |
| KVM2 | 20,072.7 ms; 5,492 / 2,601 | 9,805.8 ms; partial, 500 rows | transport failure, 3,426.8 ms | 200, 139.2 ms | 200, 33.5 ms |
| Oracle | 22,661.3 ms; 5,001 / 2,125 | 4,523.9 ms; partial, 500 rows | transport failure, 3,037.5 ms | 200, 339.8 ms | 200, 389.0 ms |

The published package advertised the capability tool, but the three-host
harness recorded a generic transport failure for its 2,000-row response. This
report retains that failure as `TRANSPORT_ERROR` without making a per-host
root-cause claim. All 1.5.0 runs lacked Higgsfield in the provider registry.
`fal` was partial and Sail reported `PRICING_STALE` on all hosts. Oracle's
initial public Chutes read timed out (`SOURCE_TIMEOUT`), but its media refresh
subsequently returned Chutes normally, so that failure was transient.

## Final 1.6.0 candidate: per-host operations

| Host | Package/runtime | Public catalogue | MCP connect / list | Mixed media / Higgsfield-only | Capability state, default | Higgsfield plan read | Live page | Errors |
|---|---|---:|---:|---:|---:|---:|---:|---|
| Bulgaria desktop | 1.6.0 / Node 26.3.0 | 17,805.3 ms; 5,603 / 2,712 | 567.2 / 36.3 ms | 7,676.1 ms partial / 140.6 ms ok | 608.3 ms; ok, 500 rows | 117.3 ms; 200 | 123.7 ms; 200 | none |
| KVM2 | 1.6.0 / Node 22.23.2 | 18,321.8 ms; 5,600 / 2,709 | 822.0 / 122.2 ms | 10,781.2 ms partial / 599.9 ms ok | 1,481.4 ms; ok, 500 rows | 152.8 ms; 200 | 41.8 ms; 200 | none |
| Oracle | 1.6.0 / Node 24.19.0 | 13,779.8 ms; 5,600 / 2,709 | 868.7 / 128.6 ms | 4,873.2 ms partial / 298.5 ms ok | 1,513.0 ms; ok, 500 rows | 294.0 ms; 200 | 274.5 ms; 200 | none |

All final live-page responses were `text/html; charset=utf-8`, 35,914 bytes,
and contained the dashboard marker. Mixed-media reads were partial only because
`fal` pricing acquisition was unavailable; DeepInfra, WaveSpeed, Chutes, KIE,
and Higgsfield were available. The mixed request returns at most 500 rows, so a
separate Higgsfield-only call was made to avoid alphabetical pagination hiding
its prices.

## Final 1.6.0 public-source matrix

`live` means the provider's public-catalogue source was available in this run.
`stale` and `partial` are preserved rather than normalized away.

| Source | Bulgaria desktop | KVM2 | Oracle |
|---|---|---|---|
| DeepInfra | live · 386 | live · 386 | live · 386 |
| Chutes | live · 491 | live · 491 | live · 491 |
| WaveSpeed | live · 1,054 | live · 1,054 | live · 1,054 |
| fal | partial · 1,503 | partial · 1,503 | partial · 1,503 |
| KIE | live · 524 | live · 524 | live · 524 |
| Higgsfield | live · 108 | live · 108 | live · 108 |
| OpenRouter | live · 466 | live · 466 | live · 466 |
| Groq | live · 11 | live · 11 | live · 11 |
| Sail | stale/partial · 12 (`PRICING_STALE`) | stale/partial · 12 (`PRICING_STALE`) | stale/partial · 12 (`PRICING_STALE`) |
| Nous | live · 428 | live · 425 | live · 425 |
| QwenCloud | live · 270 | live · 270 | live · 270 |
| Novita | live · 121 | live · 121 | live · 121 |
| SambaNova | live · 6 | live · 6 | live · 6 |
| AkashML | live · 7 | live · 7 | live · 7 |
| io.net | live · 39 | live · 39 | live · 39 |
| Cerebras | live · 2 | live · 2 | live · 2 |
| CrazyRouter | live · 175; completeness unknown | live · 175; completeness unknown | live · 175; completeness unknown |

No public catalogue source failed in the final candidate runs. Higgsfield read
124 source rows, retained 108 generation-price rows, and excluded 16 access,
concurrency, or credit-balance metadata rows.

## Higgsfield price coverage and web plans

The final candidate collected 108/108 Higgsfield generation-price rows. Samples
that resolved live on every host:

| Model | Published native rate |
|---|---|
| Higgsfield Soul 2.0 | `0.12 credit_image` per image |
| Seedance 2.0 720p | approximately `22 credit_video` per 5 seconds |
| Wan 3.0 720p | `8.75 credit_video` per 5 seconds |
| Higgsfield Speak 2.0 720p | approximately `14 credit_audio` per 5 seconds |

The public comparison response also returned 16 subscription-plan records. Its
currency field was `eur` on the Bulgaria desktop and KVM2, and `usd` on Oracle.
The amount fields below are copied verbatim from the endpoint; the payload does
not declare an amount scale, so they are deliberately not converted to display
currency and are never represented as per-generation cost.

| Plan / period | Credits | Seats | Final raw / monthly raw | Original raw / monthly raw | Renewal raw / monthly raw |
|---|---:|---:|---|---|---|
| Free / annual or monthly | 0 | 1 | 0 / 0 | 0 / 0 | 0 / 0 |
| Starter / monthly | 270 | 1 | 1900 / 1900 | 1900 / 1900 | 1900 / 1900 |
| Starter / annual | 270 | 1 | 22800 / 1900 | 22800 / 1900 | 22800 / 1900 |
| Plus / monthly | 1,200 | 1 | 5900 / 5900 | 5900 / 5900 | 5900 / 5900 |
| Plus / annual | 1,200 | 1 | 56400 / 4700 | 70800 / 5900 | 56400 / 4700 |
| Ultra / monthly, 3,000 credits | 3,000 | 1 | 12900 / 12900 | 12900 / 12900 | 12900 / 12900 |
| Ultra / monthly, 6,000 credits | 6,000 | 1 | 22000 / 22000 | 25000 / 25000 | 25000 / 25000 |
| Ultra / monthly, 9,000 credits | 9,000 | 1 | 31000 / 31000 | 37500 / 37500 | 37500 / 37500 |
| Ultra / annual, 3,000 credits | 3,000 | 1 | 118800 / 9900 | 154800 / 12900 | 118800 / 9900 |
| Ultra / annual, 6,000 credits | 6,000 | 1 | 232200 / 19350 | 309600 / 25800 | 232200 / 19350 |
| Ultra / annual, 9,000 credits | 9,000 | 1 | 324000 / 27000 | 464400 / 38700 | 324000 / 27000 |
| Team / monthly | 1,000 | 2 | 6900 / 6900 | 7900 / 7900 | 7900 / 7900 |
| Team / annual | 1,000 | 2 | 78001 / 6500 | 94800 / 7900 | 78001 / 6500 |
| Scale / monthly | 2,500 | 5 | 16901 / 16901 | 21500 / 21500 | 16901 / 16901 |
| Scale / annual | 2,500 | 5 | 180007 / 15001 | 258000 / 21500 | 180007 / 15001 |

## Capability-state observation

The final default state call succeeded on all hosts. Each response was a
snapshot of 500 returned live rows after scanning two 500-row pages;
`pagination.capped` was true and a `next_cursor` was present. Its sources were
`/api/public/v2/live-models` and `/api/public/v2/measured-costs`, with
`source_stale: true`. The three functionality/lineage/capability ledger routes
were absent, so those facts remain explicitly `UNKNOWN`; the capped warning
also makes clear that omitted rows are not a complete-provider claim.

At the time of capture, capability-state's text live feed observed: Cerebras
2, Chutes 14, DeepInfra 226, Groq 11, Novita 121, and OpenRouter 126. It had no
Higgsfield media row in that dated text feed; that does not contradict the
separate Higgsfield media catalogue, which was live and fully priced.

## 1.6.0 contents

- Version updated to `1.6.0` in package metadata, lockfile, and server
  handshake.
- Higgsfield is carried as the seventeenth live provider with 108 native-credit
  generation rates observed across the three hosts.
- README coverage and tool totals reflect 17 providers and 19 read-only tools.
- Capability-state uses a transport-safe default/maximum of 500 rows and
  retains explicit pagination/cap evidence.
- This sanitized, per-host observation report and JSON companion are included
  in the npm package.

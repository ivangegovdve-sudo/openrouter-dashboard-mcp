- **Published discount** — a straight percentage off list at a named provider.

Null means the provider published no discount, which is not the same as publishing
zero. Endpoints are collected under a daily request budget, so coverage is partial
by construction and the page states how many models have been observed; a dash
means "not looked at yet", never "no discount".

## Live model availability

`GET /api/public/v2/live-models` aggregates the model catalogues that OpenRouter,
Groq and Cerebras publish, into one shape, refreshed daily by the 06:00 cron.

Query parameters: `provider`, `availability`, `free`, `limit` (default 200, max
500), `cursor`.

Two timestamps per model carry the load, and the difference between them is the
point:

- `lastSeenAt` — the last time the provider's list **contained** this model.
- `lastConfirmedAt` — the last time we successfully read that provider's **whole**
  list, whether or not this model was in it.

`lastConfirmedAt > lastSeenAt` is therefore a positive observation of absence — we
looked, the catalogue answered, and the model was not in it — and the row's
`availability` flips to `disappeared`. A failed or partial fetch never advances
`lastConfirmedAt`, so a provider outage cannot masquerade as its entire catalogue
being retired. `absenceStreak` counts consecutive complete listings that omitted
the model, which separates a one-run blip from a real retirement.

Rows are updated, never deleted. When a config still names a model that vanished,
"what was it, and when did it go" is answerable:

```
GET /api/public/v2/live-models?availability=disappeared
```

`isFree` is derived from published price and nothing else. It is `null` when the
provider does not publish a price — Cerebras publishes none at all — and null is
neither free nor paid. `?free=true` requires both prices present and zero, so it
never returns a model whose cost is merely unknown.

### Selecting on intent

The row carries what selection needs, so a chain can ask a question instead of
naming a slug:

```
GET /api/public/v2/live-models?free=true&outputModality=text&reasoning=true&minContext=200000&sort=throughput-desc
```

- `outputModalities` — what the model emits. Without it the cheapest free model is
  a music generator: zero-priced audio and video models are genuinely free and
  genuinely unusable as chat models.
- `reasoningEfforts` — `["xhigh","high"]`, `[]` (reasons, no levels published), or
  null (nothing published). Only OpenRouter publishes this: 287 of 550 models.
- `performance` — best throughput and lowest median latency across the provider
  endpoints observed for that model, with the fastest provider named. **Null means
  unmeasured, never slow.** Endpoint observation runs under a daily request budget.

`sort` returns a ranked top-N and no cursor — keyset paging is ordered by
(provider, id) and cannot also be ordered by a metric. Passing both is a 400.
Models missing the sort metric come last rather than being dropped, because
"unmeasured" is a different answer from "slow".

`isFree` reads from the price classification, not from prompt+completion alone: 29
of the 83 zero-token-priced OpenRouter models charge per image or per audio second
instead, and returning those as free would be exactly the wrong answer.

`docs/model-intent-contract.md` proposes the intent-resolution shape that would sit
on top of this ("cheapest capable free model" rather than a slug). It is a contract
only; nothing implements or calls it yet.

## Agent subscribe API

`GET /api/feed/stream` is a public Server-Sent Events stream for agents that
want an invalidation signal after ingestion. It requires no authentication and

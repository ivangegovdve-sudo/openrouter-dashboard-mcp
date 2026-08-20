# Model intent contract (proposed)

**Status: proposed. Nothing in the fleet calls this yet, and nothing should until it is built.**
This document is the contract only — publishing it is deliberately separate from
rewiring any consumer.

## The problem it exists to solve

A fleet chain that names `llama-3.3-70b-versatile` is asserting two things at once:
*this model is right for the job*, and *this model exists*. The second assertion is
the one that rots. It rotted on 2026-02-16, when Groq retired that model; the
config files naming it kept asserting it anyway, and each fix edited a file without
removing the need to edit it again.

Intent is durable in a way a slug is not. "The cheapest free model that can do this
job" was true before the retirement and stayed true after it — only the answer
changed. A chain that stores the question and resolves it at run time survives the
catalogue changing underneath it. A chain that stores the answer does not.

## What backs it today

`GET /api/public/v2/live-models` — implemented, three providers, refreshed daily:

| Field | OpenRouter | Groq | Cerebras |
|---|---|---|---|
| model id | ✅ | ✅ | ✅ |
| price in / out | ✅ | ✅ (8 of 13 models) | ❌ never published |
| context length | ✅ | ✅ | ❌ never published |
| `availability` + `lastSeenAt` / `lastConfirmedAt` | ✅ | ✅ | ✅ |
| provider-declared `active` | ❌ | ✅ | ❌ |
| latency / throughput | ❌ | ❌ | ❌ |

Two consequences follow, and the contract below is shaped around them rather than
around what would be convenient:

- **`isFree` is `null` for anything whose price the provider does not publish.**
  Null is not free and not paid. Every Cerebras model is null today. A resolver must
  exclude null from a free-only request, never guess at it.
- **"Fastest" is not answerable from catalogue data.** None of the three `/models`
  endpoints publishes latency or throughput. See *Not yet answerable* below.

## Proposed shape

```
POST /api/public/v2/resolve
```

```json
{
  "intent": "cheapest_capable",
  "constraints": {
    "pricing": "free",
    "minContextLength": 32768,
    "providers": ["groq", "openrouter"],
    "requireProviderActive": true
  },
  "fallbackDepth": 3
}
```

The response returns a ranked list, not a single slug, so the caller can fail over
without a second round trip:

```json
{
  "schemaVersion": "2.0",
  "intent": "cheapest_capable",
  "resolved": [
    {
      "provider": "groq",
      "id": "openai/gpt-oss-20b",
      "rank": 1,
      "basis": "usd_per_1m_blended",
      "value": "0.30",
      "contextLength": "131072",
      "isFree": false,
      "availability": "available",
      "lastConfirmedAt": "2026-08-19T06:00:00.000Z"
    }
  ],
  "excluded": [
    { "provider": "cerebras", "id": "gemma-4-31b", "reason": "pricing_not_published" }
  ],
  "unsatisfiable": false,
  "stale": false,
  "provenance": [ /* same shape as every other v2 endpoint */ ]
}
```

### Rules the resolver must keep

1. **Never invent an answer.** If no model satisfies the constraints, return
   `unsatisfiable: true` with an empty `resolved`. A caller that receives a wrong
   model behaves worse than one that receives nothing — the first fails silently
   at inference time, the second fails at selection time where it can be handled.
2. **`excluded` is part of the answer.** A caller asking for a free model and
   getting three results should be able to see that nine more were dropped for
   `pricing_not_published`, not silently omitted.
3. **Unknown is never favourable.** Missing price cannot satisfy `pricing: free`;
   missing context length cannot satisfy `minContextLength`.
4. **Disappeared models are never resolved**, but they remain queryable by id on
   `/live-models` — "what happened to the model my config names" is the question a
   caller has at exactly that moment.
5. **Resolution is a read of stored catalogue state, not a live probe.** It reports
   what providers published as of `lastConfirmedAt`. It does not prove the model
   answers a request — see below.

### Intents

| Intent | Basis | Answerable today |
|---|---|---|
| `cheapest_capable` | blended USD/1M tokens, ascending | Yes, where price is published |
| `largest_context` | context length, descending | Yes, OpenRouter + Groq |
| `any_available` | provider order, then id | Yes, all three |
| `fastest_available` | latency/throughput | **No — see below** |

## Not yet answerable, and why

**`fastest_available`.** No provider publishes latency in its model list. OpenRouter's
benchmark dataset carries `avgGenerationTimeMs` for OpenRouter-served models, which
would cover one provider partially; Groq and Cerebras would need measured probes.
Speccing the field now and filling it with nulls would invite exactly the kind of
silent wrong answer rule 1 exists to prevent, so the intent is listed as unsupported
until there is real data behind it.

**"Capable" is currently price and context only.** Capability signals exist but are
not uniform: Groq publishes `supported_features` and modality lists, OpenRouter
publishes `supported_parameters` and architecture, Cerebras publishes neither.
Normalising these into one vocabulary is real work and is not done here.

**Whether a model actually answers.** This API reports what providers *list*. Whether
a slug returns 200 to a real request is a different question, already owned by the
fleet's own model registry (`hermes_agents`, surfaced read-only on the dashboard).
That registry probes; this API catalogues. They are complementary and should not be
merged: a model can be listed and rate-limited, or listed and broken.

## Boundary with the announcements pipeline

A separate effort ingests provider announcements from email — deprecation notices and
upcoming models. The division is clean and worth preserving:

- **This API answers what exists now**, observed from provider endpoints.
- **That pipeline answers what is about to change**, reported by providers in advance.

A deprecation notice arriving by email is a *warning*; `availability: "disappeared"`
is a *confirmation*. Both are useful, and neither substitutes for the other — the
2026-02-16 retirement would have been caught by the second even if the first was
never read.

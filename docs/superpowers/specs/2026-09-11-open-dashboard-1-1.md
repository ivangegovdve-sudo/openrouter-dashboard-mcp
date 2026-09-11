# Open Dashboard 1.1 Source-Backed Cost and Performance Spec

## Goal

Extend the Open Dashboard MCP, dashboard API, and owning explorer UI so that a
real OpenRouter generation is recorded with its routed upstream provider,
model slug, token counts, authoritative per-generation cost, timestamp,
workload, and vantage point, then surfaced with explicit provenance.

## Cost contract

- Catalogue rates remain published rate-card facts. They are never presented
  as the cost of a generation routed through an aggregator.
- A generation observation carries `costUsd`, `costState`, `provenance`, a
  provenance date, the authoritative response field, a source URL, and the
  provider/model identity.
- `costState` distinguishes `MEASURED`, `PUBLISHED_ESTIMATE`, `DERIVED`,
  `BLOCKED`, `UNKNOWN`, and `LAG`. `provenance` is one of `MEASURED`,
  `PUBLISHED`, `DERIVED`, `BLOCKED`, or `UNKNOWN`.
- A zero balance delta is `LAG`, never a zero generation cost.
- OpenRouter observations use the authoritative per-generation response field
  and are `MEASURED`. Nous is provider 13 and `BLOCKED`. Sail is `BLOCKED`;
  any balance divided by runs is `DERIVED`, not per-call cost.

## Performance contract

TTFT, total round trip, and sustained throughput are separate fields. Every
numeric latency/throughput value carries workload name, vantage point, token
budgets, sample size, percentile method, and date. Catalogue endpoint rows
remain endpoint evidence and are not named direct integrations.

## Provider/UI correction

The named provider registry has 13 IDs after adding Nous. `wavespeedai` is
removed from explorer provider data because it duplicates `wavespeed`; the 186
OpenRouter endpoint rows across 61 upstream names remain a separate endpoint
evidence surface.

## Delivery boundary

No deployment, npm publication, or release is allowed. Verification is local:
run a real OpenRouter generation, record only its non-secret response evidence,
run the API and explorer locally, call the MCP against the local API, and
confirm the row and provenance label are visible in the rendered UI.

# Wiring this server to a consumer

Written 2026-08-27. Nothing in this document has been applied to any fleet config.

## 1. Register with Claude Code

Build first, then register the compiled absolute path. This is the whole of what
"wired" means for a Claude Code session:

```bash
claude mcp add openrouter-dashboard --scope user -- node D:/projects/openrouter-dashboard-mcp/build/index.js
```

To enable the key inventory as well, pass the credential mapping through the
environment. Only Secret Manager names appear in tool output:

```bash
claude mcp add openrouter-dashboard --scope user \
  --env OPENROUTER_KEY_SOURCES=openrouter-council=OR_COUNCIL,openrouter-spare=OR_SPARE \
  -- node D:/projects/openrouter-dashboard-mcp/build/index.js
```

Without `OPENROUTER_KEY_SOURCES` the inventory returns `unconfigured` and every
other tool works with zero credentials.

## 2. What wiring the fleet would take

**Not done, and not to be done without approval.** This section reports scope only.

The fleet does not choose models. As of the 2026-08-27 run of
`tools/model_deprecation_guard.py`, **38 hardcoded pins across 20+ files** need a
human decision — `chloe`, `soul-server`, `council-web`, `memory-pipeline`, the
`kvm2-*` hosts, and the fleet tools themselves. A hardcoded slug does not
degrade; it 404s, which is what happened when `openai/gpt-oss-120b:free` was
retired and every consumer had to be re-pointed by hand.

Three things would have to be true for this server to close that loop.

### 2a. A resolution point that is not a config file

Pins live in `agents/*/hermes-home/config.yaml`, `agents/shared/model_registry.yaml`
and `agents/shared/free_model_routing.yaml`. Today each is read literally. Routing
through this server means one of:

- **Read-time resolution** — an agent asks `dashboard_model_economics` for a
  capability ("cheapest genuinely free model that emits text and accepts tools")
  and gets a slug. Most correct, adds a network hop to every start-up.
- **Refresh-time resolution** — a scheduled job resolves capabilities to slugs,
  writes the configs, and opens a PR for a human. Keeps start-up offline and keeps
  the human diff the deprecation guard already asks for. **Recommended**, because
  it changes when pins are chosen without changing how agents read them.

The existing `tools/model_deprecation_guard.py` already produces the work order
and already knows every pin site. Pointing it at `dashboard_model_economics`
with `ids: [...every pin...]` gives it `missingIds` and `retirementRisk` in one
call, which is exactly the evidence its `class-b`/`inconclusive` verdicts lack
today. That is the smallest useful integration and it needs no agent changes.

### 2b. A capability vocabulary

`resolve_model` already takes an intent. The fleet's four pinned slugs would need
to become four named capabilities (something like `bulk_free_text`,
`long_context_free`, `cheap_paid_tools`, `fast_paid_multimodal`) so a resolver has
something to resolve *to*. This is a decision about the fleet, not about this
server, and it is the part that genuinely needs Ivan.

### 2c. AnyCloudLLM

AnyCloudLLM would embed the compiled `build/index.js` and speak MCP over the
child's stdio, exactly as the README's Electron section describes. The
zero-credential default is what makes that possible — OpenRouter's own MCP server
mints a real API key over OAuth and therefore cannot ship inside a distributed
desktop app. The key inventory must stay **off** in that build: leave
`OPENROUTER_KEY_SOURCES` unset and it reports `unconfigured`.

## 3. Upstream gaps that limit this server

These are dashboard-side, not MCP-side, and none of them are fixed here.

1. **Endpoint observation coverage is thin.** Sampling 60 catalogue models on
   2026-08-27, only 12 had provider-endpoint observations; the other 48 returned
   `SOURCE_UNAVAILABLE`. Discount coverage is therefore partial by construction.
   The tool reports this as `unavailable` rather than as "no discount", but wider
   coverage upstream would make discount answers far more useful.
2. **No route lists discounted models.** `/models/{id}/providers` is per model, so
   finding discounts means N requests. The dashboard computes a cross-catalogue
   discount index server-side for its own `/models/discounted` page but does not
   publish it. A `/api/public/v2/discounts` route would turn N requests into one.
3. **No discount expiry is published anywhere.** OpenRouter gives a ratio and no
   end date, so "when does this discount expire" is currently unanswerable from
   any source. Reported as `expiryPublished: false` rather than guessed.
4. **`benchmarks_current` has been failing.** `source-status` shows
   `OPENROUTER_COLLECTOR_FAILED` on its latest attempt, so benchmark-quality
   evidence is stale.

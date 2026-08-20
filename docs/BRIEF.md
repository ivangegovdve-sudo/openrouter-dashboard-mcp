# Codex brief — MCP server for the OpenRouter/GitHub dashboard

**Status:** brief only. Nothing is built. Written 2026-08-20.
**Build target:** `D:\projects\openrouter-dashboard-mcp` (new repo, not a subdirectory of the dashboard).
**Priority:** low. There is no deadline.

---

## 0. Read this first: what already exists, and why this is still worth building

OpenRouter shipped its **own official MCP server on 2026-06-25** with 13 tools:
`models-list`, `model-get`, `model-endpoints`, `rankings-daily`, `app-rankings`,
`providers-list`, `credits-get`, `generation-get`, `docs-search`, `chat-send`
and others. Twelve are free and read-only.

**Do not rebuild any of those.** If a question is answerable by OpenRouter's own
MCP server, this server must not answer it too. Two servers giving slightly
different answers to "list the models" is worse than one.

This server exists for the questions OpenRouter's server **structurally cannot**
answer, because OpenRouter's API is present-tense and single-vendor:

| Capability | OpenRouter's MCP | This dashboard |
|---|---|---|
| A time axis — what changed since yesterday | ❌ no history at all | ✅ daily archived snapshots |
| Model deprecation state | ❌ | ✅ `/deprecations` |
| Positive observation of *absence* (a model vanished) | ❌ | ✅ two-timestamp design |
| Groq and Cerebras catalogues | ❌ OpenRouter only | ✅ three providers in one shape |
| GitHub AI-repo intelligence | ❌ | ✅ rankings + history + enrichment |
| Whether the data is stale, and which collector failed | ❌ | ✅ `/source-status` + watermarks |
| Free-model classification that isn't fooled by zero-priced audio models | ❌ | ✅ price-derived, modality-aware |

That table is the entire justification for the server. Every tool you build must
trace back to a row in it. If you find yourself writing a tool that just proxies
`/models` — stop, that is `models-list` on OpenRouter's server.

---

## 1. What the dashboard is

A Next.js app at `D:\projects\openrouter-github-dashboard`, deployed to
`https://openrouter-github-dashboard.vercel.app`. It ingests OpenRouter, Groq,
Cerebras and GitHub daily via cron, archives every run, and republishes the
result as a versioned public read API.

**The public API needs no authentication.** Verified 2026-08-20:
`GET /api/public/v2/manifest` returns `200` with no credentials. This matters
enormously — see §5.

### Response envelope (every v2 endpoint shares it)

```json
{
  "schemaVersion": "2.0",
  "data": [ /* ... */ ],
  "cursor": "<opaque base64 keyset cursor, or absent>",
  "window": { "start": "2026-08-18", "end": "2026-08-18", "timezone": "UTC",
              "inclusive": true, "basis": "derived" },
  "completeness": { "acquisitionComplete": true, "populationCompleteness": "full" }
}
```

`completeness` and `window` are not decoration. `populationCompleteness` can be
`requested_slice` rather than `full`, meaning the answer covers only part of the
catalogue. Any tool that drops this on the floor is lying by omission.

### Live route inventory (from the deployed manifest, 2026-08-20)

```
/api/public/v2/manifest
/api/public/v2/source-status
/api/public/v2/models              /api/public/v2/models/{id}
/api/public/v2/models/{id}/history /api/public/v2/models/{id}/providers
/api/public/v2/free-models         /api/public/v2/free-frontiers
/api/public/v2/deprecations
/api/public/v2/apps                /api/public/v2/apps/{id}
/api/public/v2/apps/{id}/history   /api/public/v2/apps/{id}/models
/api/public/v2/app-model-matrix
/api/public/v2/tasks               /api/public/v2/benchmarks
/api/public/v2/providers           /api/public/v2/history
/api/public/v2/github/rankings     /api/public/v2/github/repositories
/api/public/v2/github/repositories/{id}/history
/api/public/v2/github/repositories/{id}/enrichment
```

### ⚠ `/api/public/v2/live-models` is NOT in that list yet

It exists only on branch `feat/live-model-availability-api`
([PR #24](https://github.com/ivangegovdve-sudo/openrouter-github-dashboard/pull/24),
open since 2026-08-18). It is the single richest endpoint for this server and
three of the seven tools below depend on it.

**Handle this with capability detection, not a hardcoded assumption.** On
startup, fetch `/manifest` and read `routes`. If `live-models` is absent,
the dependent tools must still *register* but return a clear, actionable message:

> "This tool needs `/api/public/v2/live-models`, which is not yet deployed.
> It ships with PR #24. Until then, ask about deprecations or history instead."

Never fabricate a fallback answer from a different endpoint. Do not silently
degrade — say what is missing and what would fix it.

---

## 2. The design rule: tools answer questions, not endpoints

A thin wrapper per endpoint produces a server that is technically complete and
useless in conversation. Twenty-two routes must not become twenty-two tools.

Build **seven tools**, each of which answers a real question in **one call**,
doing the fan-out and joining internally.

---

### Tool 1 — `dashboard_resolve_model` ⭐ the important one

**Question:** *"Give me a model that can do X"* — asked as an intent, not a slug.

Read `docs/model-intent-contract.md` in the dashboard repo **in full** before
writing this. It is a 148-line design contract that already specifies this tool's
semantics. You are implementing that contract client-side, over `/live-models`,
rather than waiting for the dashboard to grow a `POST /resolve` route.

Why it matters: the fleet's config files name model slugs. Slugs rot — Groq
retired `llama-3.3-70b-versatile` on 2026-02-16 and every config naming it kept
asserting it existed. Intent is durable in a way a slug is not.

**Input:**
- `intent`: `cheapest_capable` | `largest_context` | `fastest_available` | `any_available`
- `constraints`: `{ free?, minContext?, outputModality?, reasoning?, providers? }`
- `fallbackDepth`: default 3 — return a ranked list so the caller can fail over
  without a second round trip.

**Four rules from the contract that you must not soften:**

1. **Never invent an answer.** Nothing satisfies the constraints → `unsatisfiable: true`
   with an empty `resolved`. A caller that gets a wrong model fails silently at
   inference time; one that gets nothing fails at selection time, where it can be handled.
2. **`excluded` is part of the answer.** If nine candidates were dropped for
   `pricing_not_published`, the caller sees that. Silent omission is not allowed.
3. **Unknown is never favourable.** Missing price cannot satisfy `free`. Missing
   context length cannot satisfy `minContext`. Cerebras publishes *no* prices at
   all, so `isFree` is `null` for every Cerebras model — and null is neither free nor paid.
4. **`availability: "disappeared"` is never resolved.** Disappeared models stay
   queryable by id (that's Tool 2), but never come back as an answer.

**Implementation note:** the branch already does most of the ranking server-side.
`/live-models` accepts `free`, `outputModality`, `reasoning`, `minContext`,
`provider`, `availability`, and `sort` ∈ `{throughput-desc, latency-asc,
context-desc, price-asc}`. Map intents onto `sort`:
`cheapest_capable`→`price-asc`, `largest_context`→`context-desc`,
`fastest_available`→`throughput-desc`.

`sort` and `cursor` cannot be combined — the API returns 400. A ranked query is a
top-N question and returns no cursor. Do not paginate a ranked query.

**Note:** the contract doc says `fastest_available` is unanswerable. That is now
**stale** — commit `7c32f89` added a `performance` block (best throughput, lowest
median latency, fastest provider named). Trust the README over the contract doc
here. But `performance: null` means **unmeasured, never slow** — rank nulls last,
never drop them, and label them as unmeasured in the output.

---

### Tool 2 — `dashboard_model_status`

**Question:** *"My config names `groq/llama-3.3-70b-versatile` and it broke. What happened to it?"*

This is the question a caller has at exactly the worst moment, and the dashboard
is the only thing in the estate that can answer it.

One call takes a slug (any provider) and fans out across `/live-models?...`,
`/deprecations`, `/models/{id}` and `/models/{id}/history`, returning:
availability, `firstSeenAt` / `lastSeenAt` / `lastConfirmedAt`, `disappearedAt`,
`absenceStreak`, deprecation state and expiry, current price, context length —
plus a **plain-language verdict**.

**Explain the two-timestamp design in the tool description**, because the
distinction is the whole product and an agent that doesn't grasp it will
misreport:

- `lastSeenAt` — the last time the provider's list **contained** this model.
- `lastConfirmedAt` — the last time we read that provider's **whole** list
  successfully, whether or not this model was in it.

`lastConfirmedAt > lastSeenAt` is therefore a *positive observation of absence*:
we looked, the catalogue answered, the model was not in it. A failed or partial
fetch never advances `lastConfirmedAt`, so a provider outage cannot masquerade as
its entire catalogue being retired. `absenceStreak` counts consecutive complete
listings that omitted the model — which separates a one-run blip from a real retirement.

A good verdict reads like: *"Disappeared from Groq's catalogue. Last present
2026-08-03; the catalogue has been read completely 4 times since without it."*

---

### Tool 3 — `dashboard_whats_changed`

**Question:** *"What changed since yesterday?"* (or since any date)

Squarely the dashboard's unique value — OpenRouter's API has no time axis at all.

One call, one `since` parameter, returns a diff: models that appeared, models
that disappeared, new deprecation notices, price changes, and rank movement in
token-usage leaders. Built from `/history`, `/deprecations`,
`/live-models`, `/models/{id}/history`.

Default `since` to the previous complete ingestion day, not to `now - 24h` — the
cron runs at 06:00 UTC and a naive 24-hour window will straddle runs and produce
phantom churn.

Return an explicit "nothing changed" rather than an empty object.

---

### Tool 4 — `dashboard_free_models`

**Question:** *"What's free right now that I can actually use?"*

Wraps `/free-models` and `/free-frontiers`, plus the `/live-models` free filter.

**Two traps that must be handled, both documented in the dashboard README:**

1. **The modality trap.** Without an `outputModality` filter, the cheapest free
   model is a music generator: zero-priced audio and video models are genuinely
   free and genuinely unusable as chat models. Default to `outputModality=text`
   and say so in the response.
2. **The per-image/per-second trap.** 29 of the 83 zero-token-priced OpenRouter
   models charge per image or per audio second instead. `isFree` reads from the
   price *classification*, not from prompt+completion alone. Use the API's
   `isFree`; never recompute freeness from the pricing block yourself.

`?free=true` requires both prices present and zero, so it never returns a model
whose cost is merely unknown. Preserve that guarantee.

---

### Tool 5 — `dashboard_usage_leaders`

**Question:** *"Which models and apps are burning the most tokens?"*

Built from `/history` (`modelUsage` series), `/apps`, `/apps/{id}/models` and
`/app-model-matrix`. Takes a window, returns ranked token volume with movement
versus the previous window.

**🚩 Honesty requirement — this is public ecosystem-wide OpenRouter usage, NOT
Ivan's personal spend.** State that plainly in the tool description and in the
response payload. An agent that reads "top model by tokens" and reports it as
"your biggest cost" is producing a confidently wrong answer about money. Name the
field something like `ecosystemTokenVolume`, never `spend` or `cost`.

See §5 for why personal spend is not in this server at all.

---

### Tool 6 — `dashboard_source_health`

**Question:** *"Can I trust what you just told me?"*

Wraps `/source-status` and `/manifest`. Per source: tier, cadence, when it last
published, whether it is `stale`, and the last attempt's status and error code.

This is not a nice-to-have. As of 2026-08-20 the live manifest shows
`benchmarks_current` with `"stale": true` and
`"lastAttemptErrorCode": "OPENROUTER_COLLECTOR_FAILED"` — a real, currently
failing collector. Any tool sourcing benchmark data must surface that rather than
present stale numbers as current.

This tool doubles as the capability-detection surface from §1.

---

### Tool 7 — `dashboard_github_movers`

**Question:** *"Which AI repos are moving?"*

Wraps `/github/rankings`, `/github/repositories`,
`/github/repositories/{id}/history` and `/enrichment`. Star and fork velocity
over a window, new entrants, and rank movement. Entirely absent from OpenRouter's
MCP server.

---

## 2.1 Four non-negotiables

If implementation pressure forces a trade-off, these four do not bend. They are
the point of the server, and each one exists because the alternative is a
confidently wrong answer:

1. **`ecosystemTokenVolume` must never read as the user's own spend.** Not in the
   field name, not in the description, not in the summary text. This is public
   OpenRouter-wide volume. An agent that is confidently wrong about money is
   worse than one that says it does not know.
2. **`/live-models`-dependent tools register but decline.** They never fabricate a
   fallback from a different endpoint while PR #24 is unmerged.
3. **`unsatisfiable` beats a near-miss.** No model matching the constraints means
   an empty `resolved`, never the closest thing you could find.
4. **Unknown is never favourable.** A null price is not free. A null context
   length does not satisfy `minContext`. A null `performance` is unmeasured, not slow.

---

## 3. Cross-cutting requirements

**Every tool response carries provenance.** Surface `window`, `completeness`,
and the relevant source watermark. When a source is stale, say so **in the
response**, not only in Tool 6. A stale answer presented as fresh is the main
failure mode of a server like this.

**Pagination.** Cursors are opaque base64 keyset cursors — pass them through
verbatim, never parse or reconstruct them. (PR #9 fixed a millisecond-precision
bug in the deprecations cursor; do not reintroduce that class of problem by
round-tripping cursors through your own types.) Never auto-paginate an unbounded
result set into the model's context — cap it, and report that you capped it.

**Context discipline.** `/live-models` defaults to `limit=200`, max 500. Model
descriptions are long. Trim to the fields the question needs; offer a `verbose`
flag for the full row rather than defaulting to it.

**Errors must be actionable.** "404" is useless. "That model id isn't in the
catalogue — 12 models match `llama-3.3`; did you mean one of these?" is a tool
doing its job.

**Annotations.** Every tool here is read-only: set `readOnlyHint: true`,
`destructiveHint: false`, `openWorldHint: true`.

**Output schemas.** Define `outputSchema` and return `structuredContent`
alongside text. The dashboard already publishes Zod schemas in
`src/lib/public-api-v2/` — mirror those shapes rather than inventing new ones.

---

## 4. Stack and transport

- **TypeScript**, official `@modelcontextprotocol/typescript-sdk`.
- **stdio transport** — this is a local server for Ivan's Claude Code / Codex /
  Hermes fleet. Not a hosted multi-tenant service.
- **Zod** for input schemas, mirroring the dashboard's own schemas.
- Single configuration knob: `DASHBOARD_BASE_URL`, defaulting to
  `https://openrouter-github-dashboard.vercel.app`, overridable to
  `http://localhost:3000` for local development.

---

## 4.1 The consumer may be an embedded client, not a CLI

Assume this server will be **bundled inside an Electron desktop app**
(AnyCloudLLM) and spawned as a child process — not only run by hand from a
terminal by someone who can watch it. The goal is that the app always knows
whether its configured OpenRouter models are still alive and still sensible.

This is a real, funded intention rather than a hypothetical, so build for it now.
It costs almost nothing up front and is expensive to retrofit.

Concrete consequences, all of them testable:

**No interactive prompts. Ever.** Nothing may read from a TTY, ask a question,
wait for a keypress, or open a browser for auth. There is no human at the other
end of stdin — stdin *is* the MCP transport. A prompt does not merely annoy the
user; it corrupts the protocol stream and hangs the host app.

**No assumptions about the working directory.** The app spawns the process with a
cwd you do not control and cannot predict. Resolve every path relative to the
module's own location. Do not read or write `./config.json`, do not `process.cwd()`,
do not expect a `.env` file to exist. Configuration arrives via environment
variables only, and every one of them has a working default.

**No writes outside a caller-supplied cache directory.** If you cache, take the
directory from an env var and degrade to in-memory when it is absent or
unwritable. An app bundle directory is frequently read-only, and on macOS it is
signed — writing next to the binary breaks the signature.

**Sane timeouts on every HTTP call.** Default to roughly 10 seconds with an
explicit `AbortController`. A hung fetch inside an embedded server presents to
the user as the whole application freezing, with no clue why.

**Graceful degradation when the network is unavailable.** This is the one that
matters most, because a laptop on a train is the normal case, not the edge case.
A DNS failure, a refused connection, a timeout, a captive portal returning HTML
where JSON was expected — every one of these must produce a clear, structured
"can't reach the model catalogue right now" result. Never a hang, never an
unhandled rejection, never a crash that takes the host app's MCP connection down
with it.

Distinguish the three cases in the message, because they need different actions
from the user:

- *offline / unreachable* — "no connection to the catalogue" (wait, or reconnect)
- *reachable but erroring* — "the catalogue returned a 500" (a dashboard problem, not theirs)
- *reachable but stale* — "answered, but this source last published 6 days ago" (usable with caution)

**Startup must never block on the network.** Capability detection (the `/manifest`
fetch from §1) has to be lazy or best-effort with a short timeout. If the server
cannot start and list its tools while fully offline, it is not embeddable — the
host app would fail to initialise on every flight.

**Log to stderr, never stdout.** stdout is the protocol channel. A stray
`console.log` corrupts the JSON-RPC stream and produces a baffling
client-side parse error far from its cause. Keep logs quiet by default and
gate anything verbose behind an env var.

### Why `resolve_model` and `model_status` are the marquee in-app features

A user whose configured model silently died currently sees an opaque API error.
With these two tools the app can tell them *what happened* ("Groq retired this on
2026-08-03") and *what to use instead* (a ranked replacement satisfying the same
constraints they originally chose). That pairing — diagnosis plus remedy in one
exchange — is the entire "always knows its models are fresh" feature. Build them
so that pairing is natural: `model_status` on a dead model should make it obvious
that `resolve_model` is the next call.

---

## 5. Secrets — read carefully

**Zero credentials is a HARD DESIGN CONSTRAINT, not a happy accident.**

The public v2 API requires no authentication (verified 2026-08-20: `/manifest`
returns 200 with no credentials). Preserve that property deliberately.

The reason is §4.1: this server is intended to ship *inside* a distributed
desktop application. The moment any tool needs a key, the whole server stops
being shippable — there is nowhere to put a credential inside an app you hand to
other people that is not a leak. Obfuscation is not storage. A key in an Electron
bundle is a key in a zip file on someone else's disk.

So this is not "we happen not to need a key." It is: **a tool that needs a key
cannot exist in the shippable surface.** If a credentialed capability is ever
built, it lives in a separate, clearly-marked module that is excluded from the
embeddable build — never behind a flag in a shared module, because flags get
flipped and bundles get built by CI that does not read this document.

### Why there is no "which key is burning budget" tool

The dashboard holds **no key, credit, spend or budget data**. Verified: the
archive schema has no such tables, and `/api/dashboard/openrouter` contains no
key/credit/spend/usage concepts. Those questions are answered by:

- **OpenRouter's own MCP server** — `credits-get` covers remaining balance, and
  `generation-get` covers per-generation cost. Already available. Use it.
- **A provisioning key** would be needed to enumerate per-key budgets. That key
  is `openrouter-management-key` in GCP Secret Manager, project
  `forest-family-cloud`. **Do not use it in this server.** Adding it would turn a
  zero-secret read-only server into a credential-holding one for a capability
  that already exists elsewhere. If Ivan later decides he wants it, it is a
  separate, additive decision — not part of this build.

### If any credential ever does enter this codebase

Reuse the estate's existing pattern rather than inventing one:
`services/session_kb/secretstr.py` in the `hermes_agents` repo. It exists because
on 2026-08-20 a live OpenRouter key reached a session transcript — `build_chain()`
returned rungs as plain tuples, and a tuple renders its members with `repr()`, so
a single `str(rung)` in a debug line emitted the key in full. The key was rotated.

The TypeScript equivalent must hold the value privately and refuse to render it:
`toString()`, `toJSON()` and the Node `util.inspect.custom` symbol all return
`<secret:NAME>` — no prefix, no suffix, no length. `JSON.stringify` must throw
rather than serialise. Failing loudly beats leaking. The defence lives in the
value, not at the call sites, because the call site that leaks is by definition
the one nobody remembered to guard.

**Absolute rules for this build:** never print, log, echo, or hardcode any key or
any fragment of one — no ids, no prefixes, no last-four — in code, comments,
logs, tests, fixtures, commit messages, or your final report. Refer to secrets by
name only.

---

## 6. Verification — this is not optional

**A server that imports cleanly and exits 0 has proven nothing.** Ivan's standing
rule: build, run, and check real output before claiming success.

Required before you report done:

1. `npm run build` compiles with no errors.
2. **Drive the server as an MCP client would**, over stdio, with real tool calls
   returning real data from the deployed dashboard. Use
   `npx @modelcontextprotocol/inspector`, or a scripted stdio client.
3. Exercise **every tool** at least once and paste the actual returned payloads
   into your report — not a description of them.
4. Exercise the failure paths deliberately:
   - a model id that does not exist → actionable error, not a raw 404
   - a `resolve` query that nothing satisfies → `unsatisfiable: true`, empty
     `resolved`, populated `excluded`
   - the `live-models`-dependent tools while PR #24 is unmerged → the clear
     "not yet deployed" message from §1, **not** a fabricated fallback
   - a stale source → staleness surfaced in the response body

5. **Embedded-client checks from §4.1**, each proven by actual output:
   - **Offline.** Point `DASHBOARD_BASE_URL` at an unroutable host or a dead port
     and call every tool. Each must return a clear "cannot reach the catalogue"
     within the timeout. No hang, no unhandled rejection, no crash.
   - **Offline startup.** With the network unavailable, the server must still
     start and answer `tools/list` in full. If it cannot, it is not embeddable.
   - **Non-JSON response.** Point it at a host returning HTML (a captive-portal
     simulation) and confirm a clean error rather than a parse exception.
   - **stdout purity.** Assert that a full session writes *nothing* to stdout
     except JSON-RPC frames. Grep the raw stdout capture for stray log output —
     this is the single easiest way to ship a broken embedded server.
   - **Alien cwd.** Spawn the server from an unrelated directory (e.g. `C:\`) and
     confirm every tool still works.

6. Write the 10-question evaluation set the mcp-builder skill asks for
   (independent, read-only, complex, realistic, verifiable, stable) as XML.
   Prefer questions whose answers do not drift with tomorrow's cron run — ask
   about archived history rather than today's rankings.

---

## 7. Git and review rules

- Work on a branch. **Never commit to `main`/`master`.**
- `git fetch && git rebase` — never plain `pull` or `merge`.
- Ask before anything irreversible.
- **Never touch any `butcher-*` repo or key** — those belong to Ivan's wife's agent.
- **Cross-model review before merge.** The reviewer must not share base weights
  with the author. Codex writes this, so Codex cannot be the only reviewer — a
  Claude or Gemini pass is required before merge. A free-tier model is not
  strong enough to be the sole cross-model reviewer.

---

## 8. Suggested order of work

1. Read `docs/model-intent-contract.md` and the `/live-models` section of
   `README.md` in the dashboard repo. Both are on branch
   `feat/live-model-availability-api`.
2. Scaffold the project, the HTTP client, the shared envelope/provenance types,
   and manifest-driven capability detection.
3. Build Tool 6 (`source_health`) first — it is the smallest, and it proves the
   client, the envelope handling and capability detection all work end to end.
4. Then Tool 2 (`model_status`) and Tool 3 (`whats_changed`) — highest value,
   and Tool 3 does not depend on PR #24.
5. Then Tool 1 (`resolve_model`) — the most design-sensitive; re-read the
   contract's four rules before writing it.
6. Then Tools 4, 5, 7.
7. Verification pass per §6, then the evaluation set.

---

## 9. Report back with

- The tool list as built, with one line each on the question it answers.
- Real captured payloads from a live stdio session (§6.3).
- Anything in this brief that turned out to be wrong. The `fastest_available`
  staleness in the contract doc is one known example; assume there are others.
- Whether the server ended up needing any credential, and if so, exactly why.
  The expected answer is "none" — see §5. If that is not the answer, stop and
  flag it rather than shipping it.
- The captured evidence for each §6.5 embedded check, especially the offline runs
  and the stdout-purity assertion.
- A one-paragraph statement of how this server would be embedded in an Electron
  app: what gets spawned, what environment variables it needs, and what the host
  app must handle. Ivan intends to ship it inside AnyCloudLLM.

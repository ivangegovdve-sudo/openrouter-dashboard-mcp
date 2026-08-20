# Dashboard Intelligence MCP verification report

Verified on 2026-08-20 against the compiled absolute `build/index.js` child.

## Outcome

The server registered exactly seven read-only tools in every session. Official semantic sessions used `Client`, `StdioClientTransport`, and `Client.connect()`; the independent purity session used a direct child and the installed SDK's serializer/deserializer.

The live and alien-cwd runs used the public default `https://openrouter-github-dashboard.vercel.app` with zero credentials. No key, auth header, cookie, environment dump, or secret-loading file was supplied or fetched. The first sandboxed live attempt returned structured `unreachable`; the identical command succeeded when read-only public network access was permitted.

| Mode | Result | Total elapsed | Reviewed stderr |
|---|---|---:|---:|
| live | 7 tools listed twice; 7 calls validated | 3353.92 ms | 0 bytes |
| fixture | complete diagnostic matrix validated | 1014.00 ms | 0 bytes |
| offline | all 7 calls contained structured `unreachable`; connection survived | 891.97 ms | 0 bytes |
| html | all 7 calls contained structured `non_json`; no body/stack leaked | 1059.22 ms | 0 bytes |
| stdout purity | 10/10 strict response-only NDJSON frames; ids 1–10 exactly | 498.32 ms | 0 bytes |
| alien-cwd | live matrix from `C:\\`; live status/top-level shapes matched | 2173.58 ms | 0 bytes |

Evidence artifacts are ignored and stored at `verification/raw/{live,fixture,offline,html,stdout,alien-cwd}.json`, with reviewed stderr in the corresponding `*.stderr.txt` files. Before writing, the harness validates forbidden diagnostic and credential-bearing fields and fails closed; it does not rewrite definitions, arguments, timings, URLs, or `structuredContent`. Only separately captured stderr receives URL sanitization.

## Live tool-call timings and deployment state

| Tool | Elapsed | Status | Deployment observation |
|---|---:|---|---|
| `dashboard_resolve_model` | 715.36 ms | unavailable | exact PR #24 `/live-models` capability decline |
| `dashboard_model_status` | 58.94 ms | unavailable | exact PR #24 `/live-models` capability decline |
| `dashboard_whats_changed` | 307.15 ms | partial | real history/deprecation evidence; price history remains unsupported |
| `dashboard_free_models` | 73.34 ms | unavailable | exact PR #24 `/live-models` capability decline |
| `dashboard_usage_leaders` | 281.77 ms | partial | real public model/app data; endpoint-specific partial sections preserved |
| `dashboard_source_health` | 66.82 ms | ok | six sources; stale benchmark source and failed latest attempt retained |
| `dashboard_github_movers` | 1479.09 ms | partial | real category-scoped momentum; endpoint-specific auxiliary failures retained |

Live connect/list/final-list/close timings were 278.36/19.21/11.32/20.61 ms. The public manifest still lacked `/api/public/v2/live-models`; this is current deployment state, not a forced fixture. All seven results passed their exported output schemas; the three unavailable live-model-dependent paths used the exact capability contract, while their normal branches were exercised against the local fixture with request-specific invariants. The standard resolver probe now requests `verbose: true`, allowing returned details to prove requested modality, reasoning, and provider-active constraints without inventing fields; this adds payload only after the live-models route is deployed. Normal resolver validation also requires exactly `min(eligibleCount, fallbackDepth)` rows, and live free-model candidates require semantic zero prompt/completion prices plus the authoritative `concrete_free` classification.

## Actual live `structuredContent`

The following seven payloads are the actual bounded machine-readable values captured from the successful zero-credential live stdio session. Text-content duplicates are intentionally omitted.

### `dashboard_resolve_model`

```json
{
  "status": "unavailable",
  "summary": "This tool needs /api/public/v2/live-models, which is not yet deployed. It ships with PR #24. Until then, ask about deprecations or history instead.",
  "message": "This tool needs /api/public/v2/live-models, which is not yet deployed. It ships with PR #24. Until then, ask about deprecations or history instead.",
  "missingCapability": "/api/public/v2/live-models",
  "evidence": [
    {
      "endpoint": "/api/public/v2/manifest",
      "window": {
        "start": null,
        "end": null,
        "timezone": "unknown",
        "inclusive": null,
        "basis": "unknown"
      },
      "completeness": null,
      "stale": null,
      "watermark": "2026-08-20T07:00:15.491Z",
      "provenance": [
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "213412cf-acaa-4c70-a95a-55be4f5b03cf",
          "fetchedAt": "2026-08-20T07:00:03.398Z",
          "sourceAsOf": "2026-08-20T07:00:03.312Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "models_current",
          "sourceTier": "stable",
          "runId": "f0bfee8f-cd28-4c11-9f45-3d3938b46a1a",
          "fetchedAt": "2026-08-20T06:57:54.467Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-current-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "c7ddfdbc-40b7-4e3b-a9e0-7aa39b040de5",
          "fetchedAt": "2026-08-20T06:58:35.246Z",
          "sourceAsOf": "2026-08-20T06:58:35.208Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_top_weekly",
          "sourceTier": "stable",
          "runId": "66ccca5e-77ee-422c-beba-e61f2d3b7e29",
          "fetchedAt": "2026-08-20T06:58:15.310Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-weekly-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
        },
        {
          "sourceId": "task_classifications",
          "sourceTier": "stable",
          "runId": "0579cfba-45c7-4597-a58c-4f2cbdeef104",
          "fetchedAt": "2026-08-20T07:00:15.245Z",
          "sourceAsOf": "2026-08-19T00:00:00.000Z",
          "transformVersion": "or-task-classifications-v1",
          "citation": "https://openrouter.ai/openapi.json"
        }
      ]
    }
  ],
  "provenance": [
    {
      "sourceId": "apps_ranked",
      "sourceTier": "stable",
      "runId": "213412cf-acaa-4c70-a95a-55be4f5b03cf",
      "fetchedAt": "2026-08-20T07:00:03.398Z",
      "sourceAsOf": "2026-08-20T07:00:03.312Z",
      "transformVersion": "or-app-rankings-v1",
      "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
    },
    {
      "sourceId": "models_current",
      "sourceTier": "stable",
      "runId": "f0bfee8f-cd28-4c11-9f45-3d3938b46a1a",
      "fetchedAt": "2026-08-20T06:57:54.467Z",
      "sourceAsOf": null,
      "transformVersion": "or-models-current-v1",
      "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
    },
    {
      "sourceId": "models_ranked_history",
      "sourceTier": "stable",
      "runId": "c7ddfdbc-40b7-4e3b-a9e0-7aa39b040de5",
      "fetchedAt": "2026-08-20T06:58:35.246Z",
      "sourceAsOf": "2026-08-20T06:58:35.208Z",
      "transformVersion": "or-rankings-daily-v1",
      "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
    },
    {
      "sourceId": "models_top_weekly",
      "sourceTier": "stable",
      "runId": "66ccca5e-77ee-422c-beba-e61f2d3b7e29",
      "fetchedAt": "2026-08-20T06:58:15.310Z",
      "sourceAsOf": null,
      "transformVersion": "or-models-weekly-v1",
      "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
    },
    {
      "sourceId": "task_classifications",
      "sourceTier": "stable",
      "runId": "0579cfba-45c7-4597-a58c-4f2cbdeef104",
      "fetchedAt": "2026-08-20T07:00:15.245Z",
      "sourceAsOf": "2026-08-19T00:00:00.000Z",
      "transformVersion": "or-task-classifications-v1",
      "citation": "https://openrouter.ai/openapi.json"
    }
  ],
  "warnings": []
}
```

### `dashboard_model_status`

```json
{
  "status": "unavailable",
  "summary": "This tool needs /api/public/v2/live-models, which is not yet deployed. It ships with PR #24. Until then, ask about deprecations or history instead.",
  "message": "This tool needs /api/public/v2/live-models, which is not yet deployed. It ships with PR #24. Until then, ask about deprecations or history instead.",
  "missingCapability": "/api/public/v2/live-models",
  "evidence": [
    {
      "endpoint": "/api/public/v2/manifest",
      "window": {
        "start": null,
        "end": null,
        "timezone": "unknown",
        "inclusive": null,
        "basis": "unknown"
      },
      "completeness": null,
      "stale": null,
      "watermark": "2026-08-20T07:00:15.491Z",
      "provenance": [
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "213412cf-acaa-4c70-a95a-55be4f5b03cf",
          "fetchedAt": "2026-08-20T07:00:03.398Z",
          "sourceAsOf": "2026-08-20T07:00:03.312Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "models_current",
          "sourceTier": "stable",
          "runId": "f0bfee8f-cd28-4c11-9f45-3d3938b46a1a",
          "fetchedAt": "2026-08-20T06:57:54.467Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-current-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "c7ddfdbc-40b7-4e3b-a9e0-7aa39b040de5",
          "fetchedAt": "2026-08-20T06:58:35.246Z",
          "sourceAsOf": "2026-08-20T06:58:35.208Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_top_weekly",
          "sourceTier": "stable",
          "runId": "66ccca5e-77ee-422c-beba-e61f2d3b7e29",
          "fetchedAt": "2026-08-20T06:58:15.310Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-weekly-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
        },
        {
          "sourceId": "task_classifications",
          "sourceTier": "stable",
          "runId": "0579cfba-45c7-4597-a58c-4f2cbdeef104",
          "fetchedAt": "2026-08-20T07:00:15.245Z",
          "sourceAsOf": "2026-08-19T00:00:00.000Z",
          "transformVersion": "or-task-classifications-v1",
          "citation": "https://openrouter.ai/openapi.json"
        }
      ]
    }
  ],
  "warnings": []
}
```

### `dashboard_whats_changed`

```json
{
  "status": "partial",
  "summary": "No changes were found in the scanned evidence since 2026-08-18, but the comparison is incomplete.",
  "since": "2026-08-18",
  "through": "2026-08-19",
  "sinceSource": "input",
  "modelAppearances": {
    "status": "unavailable",
    "reason": "/api/public/v2/live-models is not yet deployed; model appearance and disappearance are unavailable."
  },
  "modelDisappearances": {
    "status": "unavailable",
    "reason": "/api/public/v2/live-models is not yet deployed; model appearance and disappearance are unavailable."
  },
  "newDeprecations": {
    "status": "partial",
    "items": [],
    "omitted": null,
    "reason": "The deprecation scan reached its declared bound with more evidence unscanned."
  },
  "priceChanges": {
    "status": "unsupported_by_public_api",
    "reason": "The public API does not publish historical prices, so price changes cannot be determined and are not inferred."
  },
  "rankMovements": {
    "status": "unavailable",
    "reason": "No complete model-usage bucket exists on or before 2026-08-18."
  },
  "evidence": [
    {
      "endpoint": "/api/public/v2/manifest",
      "window": {
        "start": null,
        "end": null,
        "timezone": "unknown",
        "inclusive": null,
        "basis": "unknown"
      },
      "completeness": null,
      "stale": null,
      "watermark": "2026-08-20T07:00:15.491Z",
      "provenance": [
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "213412cf-acaa-4c70-a95a-55be4f5b03cf",
          "fetchedAt": "2026-08-20T07:00:03.398Z",
          "sourceAsOf": "2026-08-20T07:00:03.312Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "models_current",
          "sourceTier": "stable",
          "runId": "f0bfee8f-cd28-4c11-9f45-3d3938b46a1a",
          "fetchedAt": "2026-08-20T06:57:54.467Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-current-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "c7ddfdbc-40b7-4e3b-a9e0-7aa39b040de5",
          "fetchedAt": "2026-08-20T06:58:35.246Z",
          "sourceAsOf": "2026-08-20T06:58:35.208Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_top_weekly",
          "sourceTier": "stable",
          "runId": "66ccca5e-77ee-422c-beba-e61f2d3b7e29",
          "fetchedAt": "2026-08-20T06:58:15.310Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-weekly-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
        },
        {
          "sourceId": "task_classifications",
          "sourceTier": "stable",
          "runId": "0579cfba-45c7-4597-a58c-4f2cbdeef104",
          "fetchedAt": "2026-08-20T07:00:15.245Z",
          "sourceAsOf": "2026-08-19T00:00:00.000Z",
          "transformVersion": "or-task-classifications-v1",
          "citation": "https://openrouter.ai/openapi.json"
        }
      ]
    },
    {
      "endpoint": "/api/public/v2/history",
      "window": {
        "start": "2025-08-20",
        "end": "2026-08-19",
        "timezone": "UTC",
        "inclusive": true,
        "basis": "derived"
      },
      "completeness": {
        "acquisitionComplete": true,
        "populationCompleteness": "requested_slice",
        "missingFields": []
      },
      "stale": false,
      "watermark": null,
      "provenance": [
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "12997265-4d35-49b9-b652-e0a514ee04b1",
          "fetchedAt": "2026-08-13T06:41:13.655Z",
          "sourceAsOf": "2026-08-13T06:41:13.592Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "213412cf-acaa-4c70-a95a-55be4f5b03cf",
          "fetchedAt": "2026-08-20T07:00:03.398Z",
          "sourceAsOf": "2026-08-20T07:00:03.312Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "37d81b51-cd41-429a-ba5a-93c251637c05",
          "fetchedAt": "2026-08-08T07:00:55.950Z",
          "sourceAsOf": "2026-08-08T07:00:55.887Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "83e7006c-740b-4805-9d91-8c27f3953652",
          "fetchedAt": "2026-08-18T06:59:57.422Z",
          "sourceAsOf": "2026-08-18T06:59:57.362Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "c0348f5b-7868-46ee-8480-3669433786ae",
          "fetchedAt": "2026-08-10T07:01:01.959Z",
          "sourceAsOf": "2026-08-10T07:01:01.903Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "c2d0acc2-5a48-4124-bcca-f801ea37e69d",
          "fetchedAt": "2026-08-16T06:48:33.054Z",
          "sourceAsOf": "2026-08-16T06:48:32.981Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "d1d33417-e53e-4038-91c9-780a92b20aa5",
          "fetchedAt": "2026-08-14T06:48:36.631Z",
          "sourceAsOf": "2026-08-14T06:48:36.574Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "e241ee62-e74d-45a7-a318-9e62f81041a8",
          "fetchedAt": "2026-08-12T06:32:08.381Z",
          "sourceAsOf": "2026-08-12T06:32:08.328Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "6b3338ea-c9b0-4fca-a7e8-e5556e1dc12e",
          "fetchedAt": "2026-08-13T06:04:08.262Z",
          "sourceAsOf": "2026-08-13T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "ad2f3bff-6c0a-42e9-ab50-c8ceaf717944",
          "fetchedAt": "2026-08-14T06:40:08.308Z",
          "sourceAsOf": "2026-08-14T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "c298726a-d0b3-47d2-b903-ce85e9ac7ff0",
          "fetchedAt": "2026-08-19T06:41:59.342Z",
          "sourceAsOf": "2026-08-19T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "e05950fd-9eb5-46a4-be18-7577f48d515e",
          "fetchedAt": "2026-08-16T06:40:08.400Z",
          "sourceAsOf": "2026-08-16T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "e0875e90-e1c5-4006-82a3-2afd4048d801",
          "fetchedAt": "2026-08-17T06:40:08.369Z",
          "sourceAsOf": "2026-08-17T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "e448e621-4fc1-4e0c-9080-8521f6bce24d",
          "fetchedAt": "2026-08-12T07:50:02.130Z",
          "sourceAsOf": "2026-08-12T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "f8649257-75d1-4585-adf9-50a6d30fd59e",
          "fetchedAt": "2026-08-15T06:40:08.368Z",
          "sourceAsOf": "2026-08-15T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "16457c46-8750-4702-a478-6b318fcc80ac",
          "fetchedAt": "2026-08-10T06:59:33.893Z",
          "sourceAsOf": "2026-08-10T06:59:33.850Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "1e0ef9d1-cc2f-459b-b5ef-df73f07fad3d",
          "fetchedAt": "2026-07-23T08:11:28.781Z",
          "sourceAsOf": "2026-07-23T08:11:28.733Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "26af0d5e-afaa-4b99-b3be-23198e3818bd",
          "fetchedAt": "2026-08-08T06:59:28.453Z",
          "sourceAsOf": "2026-08-08T06:59:28.422Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "424fc5a4-693d-4b1a-9737-fae9b3de657b",
          "fetchedAt": "2026-08-13T06:39:45.502Z",
          "sourceAsOf": "2026-08-13T06:39:45.472Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "5585d2bf-5dcc-4097-8755-a0bfd78ed846",
          "fetchedAt": "2026-08-12T06:30:40.916Z",
          "sourceAsOf": "2026-08-12T06:30:40.873Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "953e736b-924b-4f45-8635-568ea24d10d7",
          "fetchedAt": "2026-08-14T06:47:09.086Z",
          "sourceAsOf": "2026-08-14T06:47:09.048Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "be3aa77e-2512-4592-820f-189599797788",
          "fetchedAt": "2026-08-18T06:58:29.876Z",
          "sourceAsOf": "2026-08-18T06:58:29.834Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "c7ddfdbc-40b7-4e3b-a9e0-7aa39b040de5",
          "fetchedAt": "2026-08-20T06:58:35.246Z",
          "sourceAsOf": "2026-08-20T06:58:35.208Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "cf7a3dbe-2381-454c-a565-2d770a415430",
          "fetchedAt": "2026-08-16T06:47:05.869Z",
          "sourceAsOf": "2026-08-16T06:47:05.824Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        }
      ]
    },
    {
      "endpoint": "/api/public/v2/deprecations",
      "window": {
        "start": "2026-08-20",
        "end": "2026-08-20",
        "timezone": "UTC",
        "inclusive": true,
        "basis": "derived"
      },
      "completeness": {
        "acquisitionComplete": true,
        "populationCompleteness": "full",
        "missingFields": []
      },
      "stale": false,
      "watermark": null,
      "provenance": [
        {
          "sourceId": "models_current",
          "sourceTier": "stable",
          "runId": "f0bfee8f-cd28-4c11-9f45-3d3938b46a1a",
          "fetchedAt": "2026-08-20T06:57:54.467Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-current-v1",
          "citation": "Source: OpenRouter (openrouter.ai/models), as of 2026-08-20T06:58:12.545Z."
        }
      ]
    },
    {
      "endpoint": "/api/public/v2/deprecations",
      "window": {
        "start": "2026-08-20",
        "end": "2026-08-20",
        "timezone": "UTC",
        "inclusive": true,
        "basis": "derived"
      },
      "completeness": {
        "acquisitionComplete": true,
        "populationCompleteness": "full",
        "missingFields": []
      },
      "stale": false,
      "watermark": null,
      "provenance": [
        {
          "sourceId": "models_current",
          "sourceTier": "stable",
          "runId": "f0bfee8f-cd28-4c11-9f45-3d3938b46a1a",
          "fetchedAt": "2026-08-20T06:57:54.467Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-current-v1",
          "citation": "Source: OpenRouter (openrouter.ai/models), as of 2026-08-20T06:58:12.545Z."
        }
      ]
    }
  ],
  "warnings": [
    "The deprecation scan reached its declared bound before the collection ended."
  ],
  "caps": {
    "liveModels": null,
    "deprecations": {
      "pageLimit": 2,
      "itemLimit": 400,
      "pagesScanned": 2,
      "itemsScanned": 400,
      "reached": true,
      "nextCursor": "eyJpZCI6ImY1Y2M5NzU5LTk5NmEtNDZhZi1hYzQ4LTNiNjdmZTRkMmY1OSIsIm9ic2VydmVkQXQiOiIyMDI2LTA3LTIzVDEwOjE3OjMzLjI5MVoiLCJyZXNvdXJjZSI6ImRlcHJlY2F0aW9ucyIsInJ1bklkIjoiZjBiZmVlOGYtY2QyOC00YzExLTlmNDUtM2QzOTM4YjQ2YTFhIn0"
    }
  }
}
```

### `dashboard_free_models`

```json
{
  "status": "unavailable",
  "summary": "This tool needs /api/public/v2/live-models, which is not yet deployed. It ships with PR #24. Until then, ask about deprecations or history instead.",
  "message": "This tool needs /api/public/v2/live-models, which is not yet deployed. It ships with PR #24. Until then, ask about deprecations or history instead.",
  "missingCapability": "/api/public/v2/live-models",
  "evidence": [
    {
      "endpoint": "/api/public/v2/manifest",
      "window": {
        "start": null,
        "end": null,
        "timezone": "unknown",
        "inclusive": null,
        "basis": "unknown"
      },
      "completeness": null,
      "stale": null,
      "watermark": "2026-08-20T07:00:15.491Z",
      "provenance": [
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "213412cf-acaa-4c70-a95a-55be4f5b03cf",
          "fetchedAt": "2026-08-20T07:00:03.398Z",
          "sourceAsOf": "2026-08-20T07:00:03.312Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "models_current",
          "sourceTier": "stable",
          "runId": "f0bfee8f-cd28-4c11-9f45-3d3938b46a1a",
          "fetchedAt": "2026-08-20T06:57:54.467Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-current-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "c7ddfdbc-40b7-4e3b-a9e0-7aa39b040de5",
          "fetchedAt": "2026-08-20T06:58:35.246Z",
          "sourceAsOf": "2026-08-20T06:58:35.208Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_top_weekly",
          "sourceTier": "stable",
          "runId": "66ccca5e-77ee-422c-beba-e61f2d3b7e29",
          "fetchedAt": "2026-08-20T06:58:15.310Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-weekly-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
        },
        {
          "sourceId": "task_classifications",
          "sourceTier": "stable",
          "runId": "0579cfba-45c7-4597-a58c-4f2cbdeef104",
          "fetchedAt": "2026-08-20T07:00:15.245Z",
          "sourceAsOf": "2026-08-19T00:00:00.000Z",
          "transformVersion": "or-task-classifications-v1",
          "citation": "https://openrouter.ai/openapi.json"
        }
      ]
    }
  ],
  "provenance": [
    {
      "sourceId": "apps_ranked",
      "sourceTier": "stable",
      "runId": "213412cf-acaa-4c70-a95a-55be4f5b03cf",
      "fetchedAt": "2026-08-20T07:00:03.398Z",
      "sourceAsOf": "2026-08-20T07:00:03.312Z",
      "transformVersion": "or-app-rankings-v1",
      "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
    },
    {
      "sourceId": "models_current",
      "sourceTier": "stable",
      "runId": "f0bfee8f-cd28-4c11-9f45-3d3938b46a1a",
      "fetchedAt": "2026-08-20T06:57:54.467Z",
      "sourceAsOf": null,
      "transformVersion": "or-models-current-v1",
      "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
    },
    {
      "sourceId": "models_ranked_history",
      "sourceTier": "stable",
      "runId": "c7ddfdbc-40b7-4e3b-a9e0-7aa39b040de5",
      "fetchedAt": "2026-08-20T06:58:35.246Z",
      "sourceAsOf": "2026-08-20T06:58:35.208Z",
      "transformVersion": "or-rankings-daily-v1",
      "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
    },
    {
      "sourceId": "models_top_weekly",
      "sourceTier": "stable",
      "runId": "66ccca5e-77ee-422c-beba-e61f2d3b7e29",
      "fetchedAt": "2026-08-20T06:58:15.310Z",
      "sourceAsOf": null,
      "transformVersion": "or-models-weekly-v1",
      "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
    },
    {
      "sourceId": "task_classifications",
      "sourceTier": "stable",
      "runId": "0579cfba-45c7-4597-a58c-4f2cbdeef104",
      "fetchedAt": "2026-08-20T07:00:15.245Z",
      "sourceAsOf": "2026-08-19T00:00:00.000Z",
      "transformVersion": "or-task-classifications-v1",
      "citation": "https://openrouter.ai/openapi.json"
    }
  ],
  "warnings": []
}
```

### `dashboard_usage_leaders`

```json
{
  "status": "partial",
  "schemaVersion": "2.0",
  "summary": "Public OpenRouter-wide token volume: 5 observed named model leaders for the requested calendar window and 5 rolling-30-day app leaders.",
  "query": {
    "windowDays": 7,
    "limit": 5
  },
  "modelRequestedWindow": {
    "status": "partial",
    "endpoint": "/api/public/v2/history",
    "periodSemantics": "requested_calendar_window",
    "populationScope": "named_models_observed_in_published_daily_top_25_slice",
    "observedSliceValueSemantics": "sum_of_published_daily_values_only_absence_not_zero",
    "upstreamHistoryWindow": "30d",
    "requestedWindowDays": 7,
    "currentInterval": {
      "start": "2026-08-13",
      "end": "2026-08-19",
      "expectedDays": 7,
      "observedCompleteDays": 4,
      "missingDates": [
        "2026-08-14",
        "2026-08-16",
        "2026-08-18"
      ],
      "incompleteDates": [],
      "evidenceGaps": [],
      "evidenceComplete": false
    },
    "previousInterval": {
      "start": "2026-08-06",
      "end": "2026-08-12",
      "expectedDays": 7,
      "observedCompleteDays": 4,
      "missingDates": [
        "2026-08-06",
        "2026-08-08",
        "2026-08-10"
      ],
      "incompleteDates": [],
      "evidenceGaps": [],
      "evidenceComplete": false
    },
    "leaders": [
      {
        "modelId": "deepseek/deepseek-v4-flash-20260731",
        "label": "deepseek/deepseek-v4-flash-20260731",
        "currentRank": 1,
        "previousRank": null,
        "rankMovement": null,
        "ecosystemTokenVolume": "6418300215515",
        "previousEcosystemTokenVolume": null
      },
      {
        "modelId": "tencent/hy3-20260706",
        "label": "tencent/hy3-20260706",
        "currentRank": 2,
        "previousRank": null,
        "rankMovement": null,
        "ecosystemTokenVolume": "5348516795240",
        "previousEcosystemTokenVolume": null
      },
      {
        "modelId": "xiaomi/mimo-v2.5-20260422",
        "label": "xiaomi/mimo-v2.5-20260422",
        "currentRank": 3,
        "previousRank": null,
        "rankMovement": null,
        "ecosystemTokenVolume": "3951040727959",
        "previousEcosystemTokenVolume": null
      },
      {
        "modelId": "openai/gpt-5.6-luna-20260709",
        "label": "openai/gpt-5.6-luna-20260709",
        "currentRank": 4,
        "previousRank": null,
        "rankMovement": null,
        "ecosystemTokenVolume": "3293947912548",
        "previousEcosystemTokenVolume": null
      },
      {
        "modelId": "deepseek/deepseek-v4-flash-20260423",
        "label": "deepseek/deepseek-v4-flash-20260423",
        "currentRank": 5,
        "previousRank": null,
        "rankMovement": null,
        "ecosystemTokenVolume": "2786751024965",
        "previousEcosystemTokenVolume": null
      }
    ],
    "unidentifiedLongTail": {
      "modelId": "other",
      "label": "other",
      "ecosystemTokenVolume": "2964523618956",
      "previousEcosystemTokenVolume": "2549430866634"
    },
    "evidence": {
      "endpoint": "/api/public/v2/history",
      "window": {
        "start": "2026-07-21",
        "end": "2026-08-19",
        "timezone": "UTC",
        "inclusive": true,
        "basis": "derived"
      },
      "completeness": {
        "acquisitionComplete": true,
        "populationCompleteness": "requested_slice",
        "missingFields": []
      },
      "stale": false,
      "watermark": null,
      "provenance": [
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "12997265-4d35-49b9-b652-e0a514ee04b1",
          "fetchedAt": "2026-08-13T06:41:13.655Z",
          "sourceAsOf": "2026-08-13T06:41:13.592Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "213412cf-acaa-4c70-a95a-55be4f5b03cf",
          "fetchedAt": "2026-08-20T07:00:03.398Z",
          "sourceAsOf": "2026-08-20T07:00:03.312Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "37d81b51-cd41-429a-ba5a-93c251637c05",
          "fetchedAt": "2026-08-08T07:00:55.950Z",
          "sourceAsOf": "2026-08-08T07:00:55.887Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "83e7006c-740b-4805-9d91-8c27f3953652",
          "fetchedAt": "2026-08-18T06:59:57.422Z",
          "sourceAsOf": "2026-08-18T06:59:57.362Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "c0348f5b-7868-46ee-8480-3669433786ae",
          "fetchedAt": "2026-08-10T07:01:01.959Z",
          "sourceAsOf": "2026-08-10T07:01:01.903Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "c2d0acc2-5a48-4124-bcca-f801ea37e69d",
          "fetchedAt": "2026-08-16T06:48:33.054Z",
          "sourceAsOf": "2026-08-16T06:48:32.981Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "d1d33417-e53e-4038-91c9-780a92b20aa5",
          "fetchedAt": "2026-08-14T06:48:36.631Z",
          "sourceAsOf": "2026-08-14T06:48:36.574Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "e241ee62-e74d-45a7-a318-9e62f81041a8",
          "fetchedAt": "2026-08-12T06:32:08.381Z",
          "sourceAsOf": "2026-08-12T06:32:08.328Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "6b3338ea-c9b0-4fca-a7e8-e5556e1dc12e",
          "fetchedAt": "2026-08-13T06:04:08.262Z",
          "sourceAsOf": "2026-08-13T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "ad2f3bff-6c0a-42e9-ab50-c8ceaf717944",
          "fetchedAt": "2026-08-14T06:40:08.308Z",
          "sourceAsOf": "2026-08-14T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "c298726a-d0b3-47d2-b903-ce85e9ac7ff0",
          "fetchedAt": "2026-08-19T06:41:59.342Z",
          "sourceAsOf": "2026-08-19T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "e05950fd-9eb5-46a4-be18-7577f48d515e",
          "fetchedAt": "2026-08-16T06:40:08.400Z",
          "sourceAsOf": "2026-08-16T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "e0875e90-e1c5-4006-82a3-2afd4048d801",
          "fetchedAt": "2026-08-17T06:40:08.369Z",
          "sourceAsOf": "2026-08-17T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "e448e621-4fc1-4e0c-9080-8521f6bce24d",
          "fetchedAt": "2026-08-12T07:50:02.130Z",
          "sourceAsOf": "2026-08-12T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "github.rankings.adoption",
          "sourceTier": "stable",
          "runId": "f8649257-75d1-4585-adf9-50a6d30fd59e",
          "fetchedAt": "2026-08-15T06:40:08.368Z",
          "sourceAsOf": "2026-08-15T00:00:00.000Z",
          "transformVersion": "github-adoption-v1",
          "citation": "https://docs.github.com/en/rest/repos/repos#get-a-repository"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "16457c46-8750-4702-a478-6b318fcc80ac",
          "fetchedAt": "2026-08-10T06:59:33.893Z",
          "sourceAsOf": "2026-08-10T06:59:33.850Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "1e0ef9d1-cc2f-459b-b5ef-df73f07fad3d",
          "fetchedAt": "2026-07-23T08:11:28.781Z",
          "sourceAsOf": "2026-07-23T08:11:28.733Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "26af0d5e-afaa-4b99-b3be-23198e3818bd",
          "fetchedAt": "2026-08-08T06:59:28.453Z",
          "sourceAsOf": "2026-08-08T06:59:28.422Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "424fc5a4-693d-4b1a-9737-fae9b3de657b",
          "fetchedAt": "2026-08-13T06:39:45.502Z",
          "sourceAsOf": "2026-08-13T06:39:45.472Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "5585d2bf-5dcc-4097-8755-a0bfd78ed846",
          "fetchedAt": "2026-08-12T06:30:40.916Z",
          "sourceAsOf": "2026-08-12T06:30:40.873Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "953e736b-924b-4f45-8635-568ea24d10d7",
          "fetchedAt": "2026-08-14T06:47:09.086Z",
          "sourceAsOf": "2026-08-14T06:47:09.048Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "be3aa77e-2512-4592-820f-189599797788",
          "fetchedAt": "2026-08-18T06:58:29.876Z",
          "sourceAsOf": "2026-08-18T06:58:29.834Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "c7ddfdbc-40b7-4e3b-a9e0-7aa39b040de5",
          "fetchedAt": "2026-08-20T06:58:35.246Z",
          "sourceAsOf": "2026-08-20T06:58:35.208Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "cf7a3dbe-2381-454c-a565-2d770a415430",
          "fetchedAt": "2026-08-16T06:47:05.869Z",
          "sourceAsOf": "2026-08-16T06:47:05.824Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        }
      ]
    },
    "warnings": [
      "The current requested calendar window has missing, incomplete, or non-integer evidence; totals are partial.",
      "Previous rank movement is unknown because both exact calendar windows do not have complete evidence."
    ],
    "cap": {
      "historyCandidateLimit": 25,
      "outputLimit": 5,
      "namedCandidatesObserved": 32
    }
  },
  "appsRolling30Day": {
    "status": "available",
    "endpoint": "/api/public/v2/apps",
    "periodSemantics": "rolling_30_day",
    "leaders": [
      {
        "appId": "3067167",
        "appName": "Hermes Agent",
        "publishedRank": 1,
        "rolling30DayEcosystemTokenVolume": "37534984214835",
        "rolling30DayRequestCount": "394703197",
        "ecosystemTokenVolumeMovement": null
      },
      {
        "appId": "2627404",
        "appName": "Claude Code",
        "publishedRank": 2,
        "rolling30DayEcosystemTokenVolume": "9260923737113",
        "rolling30DayRequestCount": "96599689",
        "ecosystemTokenVolumeMovement": null
      },
      {
        "appId": "2262242",
        "appName": "Kilo Code",
        "publishedRank": 3,
        "rolling30DayEcosystemTokenVolume": "7743072734794",
        "rolling30DayRequestCount": "96639613",
        "ecosystemTokenVolumeMovement": null
      },
      {
        "appId": "190604",
        "appName": "Cline",
        "publishedRank": 4,
        "rolling30DayEcosystemTokenVolume": "4556716245688",
        "rolling30DayRequestCount": "41733777",
        "ecosystemTokenVolumeMovement": null
      },
      {
        "appId": "2725608",
        "appName": "OpenClaw",
        "publishedRank": 5,
        "rolling30DayEcosystemTokenVolume": "4490754472331",
        "rolling30DayRequestCount": "81633360",
        "ecosystemTokenVolumeMovement": null
      }
    ],
    "evidence": {
      "endpoint": "/api/public/v2/apps",
      "window": {
        "start": "2026-07-21",
        "end": "2026-08-19",
        "timezone": "UTC",
        "inclusive": true,
        "basis": "source_meta"
      },
      "completeness": {
        "acquisitionComplete": true,
        "populationCompleteness": "requested_slice",
        "missingFields": [
          "app_slug",
          "app_url",
          "model_mix"
        ]
      },
      "stale": false,
      "watermark": null,
      "provenance": [
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "213412cf-acaa-4c70-a95a-55be4f5b03cf",
          "fetchedAt": "2026-08-20T07:00:03.398Z",
          "sourceAsOf": "2026-08-20T07:00:03.312Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "Source: OpenRouter (openrouter.ai/apps), as of 2026-08-20T07:00:03.312Z."
        }
      ]
    },
    "warnings": [
      "The rolling-30-day app view has more rows; only the bounded requested slice is returned."
    ],
    "cap": {
      "requestedLimit": 5,
      "returnedCount": 5,
      "nextCursor": "eyJjYXRlZ29yeSI6IiIsImlkIjoiMjcyNTYwOCIsInJhbmsiOjUsInJlc291cmNlIjoiYXBwcyIsInJ1bklkIjoiMjEzNDEyY2YtYWNhYS00YzcwLWE5NWEtNTViZTRmNWIwM2NmIiwic29ydCI6InBvcHVsYXIiLCJzdWJjYXRlZ29yeSI6IiJ9",
      "capped": true
    }
  },
  "appLatestDayModels": {
    "periodSemantics": "latest_observed_day",
    "populationCompleteness": "partial_or_unknown",
    "items": [
      {
        "appId": "3067167",
        "appName": "Hermes Agent",
        "endpoint": "/api/public/v2/apps/3067167/models",
        "status": "unavailable",
        "response": {
          "schemaVersion": "2.0",
          "status": "unavailable",
          "reason": "collection_disabled",
          "lastSuccessAt": null,
          "stale": false,
          "staleAfterSeconds": 172800,
          "completeness": {
            "acquisitionComplete": false,
            "populationCompleteness": "partial_or_unknown",
            "missingFields": [
              "collection_disabled"
            ]
          },
          "provenance": [],
          "appId": "3067167",
          "data": [],
          "cursor": null
        },
        "error": null,
        "warnings": [
          "/api/public/v2/apps/3067167/models is unavailable: collection_disabled."
        ]
      },
      {
        "appId": "2627404",
        "appName": "Claude Code",
        "endpoint": "/api/public/v2/apps/2627404/models",
        "status": "unavailable",
        "response": {
          "schemaVersion": "2.0",
          "status": "unavailable",
          "reason": "collection_disabled",
          "lastSuccessAt": null,
          "stale": false,
          "staleAfterSeconds": 172800,
          "completeness": {
            "acquisitionComplete": false,
            "populationCompleteness": "partial_or_unknown",
            "missingFields": [
              "collection_disabled"
            ]
          },
          "provenance": [],
          "appId": "2627404",
          "data": [],
          "cursor": null
        },
        "error": null,
        "warnings": [
          "/api/public/v2/apps/2627404/models is unavailable: collection_disabled."
        ]
      },
      {
        "appId": "2262242",
        "appName": "Kilo Code",
        "endpoint": "/api/public/v2/apps/2262242/models",
        "status": "unavailable",
        "response": {
          "schemaVersion": "2.0",
          "status": "unavailable",
          "reason": "collection_disabled",
          "lastSuccessAt": null,
          "stale": false,
          "staleAfterSeconds": 172800,
          "completeness": {
            "acquisitionComplete": false,
            "populationCompleteness": "partial_or_unknown",
            "missingFields": [
              "collection_disabled"
            ]
          },
          "provenance": [],
          "appId": "2262242",
          "data": [],
          "cursor": null
        },
        "error": null,
        "warnings": [
          "/api/public/v2/apps/2262242/models is unavailable: collection_disabled."
        ]
      },
      {
        "appId": "190604",
        "appName": "Cline",
        "endpoint": "/api/public/v2/apps/190604/models",
        "status": "unavailable",
        "response": {
          "schemaVersion": "2.0",
          "status": "unavailable",
          "reason": "collection_disabled",
          "lastSuccessAt": null,
          "stale": false,
          "staleAfterSeconds": 172800,
          "completeness": {
            "acquisitionComplete": false,
            "populationCompleteness": "partial_or_unknown",
            "missingFields": [
              "collection_disabled"
            ]
          },
          "provenance": [],
          "appId": "190604",
          "data": [],
          "cursor": null
        },
        "error": null,
        "warnings": [
          "/api/public/v2/apps/190604/models is unavailable: collection_disabled."
        ]
      },
      {
        "appId": "2725608",
        "appName": "OpenClaw",
        "endpoint": "/api/public/v2/apps/2725608/models",
        "status": "unavailable",
        "response": {
          "schemaVersion": "2.0",
          "status": "unavailable",
          "reason": "collection_disabled",
          "lastSuccessAt": null,
          "stale": false,
          "staleAfterSeconds": 172800,
          "completeness": {
            "acquisitionComplete": false,
            "populationCompleteness": "partial_or_unknown",
            "missingFields": [
              "collection_disabled"
            ]
          },
          "provenance": [],
          "appId": "2725608",
          "data": [],
          "cursor": null
        },
        "error": null,
        "warnings": [
          "/api/public/v2/apps/2725608/models is unavailable: collection_disabled."
        ]
      }
    ],
    "warnings": [
      "/api/public/v2/apps/3067167/models is unavailable: collection_disabled.",
      "/api/public/v2/apps/2627404/models is unavailable: collection_disabled.",
      "/api/public/v2/apps/2262242/models is unavailable: collection_disabled.",
      "/api/public/v2/apps/190604/models is unavailable: collection_disabled.",
      "/api/public/v2/apps/2725608/models is unavailable: collection_disabled."
    ],
    "cap": {
      "perAppModelLimit": 100,
      "appLimit": 5
    }
  },
  "producerSelectedTopAxisMatrix": {
    "status": "unavailable",
    "endpoint": "/api/public/v2/app-model-matrix",
    "periodSemantics": "latest_common_complete_day",
    "selectionSemantics": "producer_selected_top_10_axes_not_caller_selected_ids",
    "response": {
      "schemaVersion": "2.0",
      "status": "unavailable",
      "reason": "collection_disabled",
      "lastSuccessAt": null,
      "stale": false,
      "staleAfterSeconds": 172800,
      "completeness": {
        "acquisitionComplete": false,
        "populationCompleteness": "partial_or_unknown",
        "missingFields": [
          "collection_disabled"
        ]
      },
      "provenance": [],
      "appIds": [],
      "modelIds": [],
      "cells": []
    },
    "error": null,
    "warnings": [
      "/api/public/v2/app-model-matrix is unavailable: collection_disabled."
    ],
    "cap": {
      "appLimit": 10,
      "modelLimit": 10,
      "cellLimit": 100
    }
  },
  "warnings": [
    "The current requested calendar window has missing, incomplete, or non-integer evidence; totals are partial.",
    "Previous rank movement is unknown because both exact calendar windows do not have complete evidence.",
    "The rolling-30-day app view has more rows; only the bounded requested slice is returned.",
    "/api/public/v2/apps/3067167/models is unavailable: collection_disabled.",
    "/api/public/v2/apps/2627404/models is unavailable: collection_disabled.",
    "/api/public/v2/apps/2262242/models is unavailable: collection_disabled.",
    "/api/public/v2/apps/190604/models is unavailable: collection_disabled.",
    "/api/public/v2/apps/2725608/models is unavailable: collection_disabled.",
    "/api/public/v2/app-model-matrix is unavailable: collection_disabled."
  ]
}
```

### `dashboard_source_health`

```json
{
  "status": "ok",
  "summary": "6 sources checked; 1 stale; 1 failed latest attempts.",
  "routes": [
    "/api/public/v2/manifest",
    "/api/public/v2/source-status",
    "/api/public/v2/models",
    "/api/public/v2/models/{id}",
    "/api/public/v2/models/{id}/history",
    "/api/public/v2/models/{id}/providers",
    "/api/public/v2/free-models",
    "/api/public/v2/deprecations",
    "/api/public/v2/apps",
    "/api/public/v2/apps/{id}",
    "/api/public/v2/apps/{id}/history",
    "/api/public/v2/app-model-matrix",
    "/api/public/v2/apps/{id}/models",
    "/api/public/v2/tasks",
    "/api/public/v2/benchmarks",
    "/api/public/v2/providers",
    "/api/public/v2/free-frontiers",
    "/api/public/v2/history",
    "/api/public/v2/github/rankings",
    "/api/public/v2/github/repositories",
    "/api/public/v2/github/repositories/{id}/history",
    "/api/public/v2/github/repositories/{id}/enrichment"
  ],
  "sources": [
    {
      "sourceId": "apps_ranked",
      "sourceTier": "stable",
      "cadenceSeconds": 86400,
      "staleAfterSeconds": 172800,
      "publishedRunId": "213412cf-acaa-4c70-a95a-55be4f5b03cf",
      "publishedAt": "2026-08-20T07:00:12.573Z",
      "nextScheduledAt": "2026-08-21T07:00:12.573Z",
      "stale": false,
      "transformVersion": "or-app-rankings-v1",
      "citationUrl": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings",
      "lastAttemptRunId": "213412cf-acaa-4c70-a95a-55be4f5b03cf",
      "lastAttemptStatus": "published",
      "lastAttemptStartedAt": "2026-08-20T06:58:40.538Z",
      "lastAttemptFinishedAt": "2026-08-20T07:00:12.573Z",
      "lastAttemptErrorCode": null,
      "lastAttemptAcquisitionComplete": true,
      "lastAttemptPopulationCompleteness": "requested_slice"
    },
    {
      "sourceId": "benchmarks_current",
      "sourceTier": "stable",
      "cadenceSeconds": 86400,
      "staleAfterSeconds": 172800,
      "publishedRunId": null,
      "publishedAt": null,
      "nextScheduledAt": null,
      "stale": true,
      "transformVersion": "or-benchmarks-v1",
      "citationUrl": "https://openrouter.ai/docs/api/api-reference/benchmarks/list-benchmarks",
      "lastAttemptRunId": "10af6911-d34c-4eb7-86e1-5e7b55a1acdd",
      "lastAttemptStatus": "failed",
      "lastAttemptStartedAt": "2026-08-20T07:00:17.713Z",
      "lastAttemptFinishedAt": "2026-08-20T07:00:19.095Z",
      "lastAttemptErrorCode": "OPENROUTER_COLLECTOR_FAILED",
      "lastAttemptAcquisitionComplete": null,
      "lastAttemptPopulationCompleteness": null
    },
    {
      "sourceId": "models_current",
      "sourceTier": "stable",
      "cadenceSeconds": 86400,
      "staleAfterSeconds": 172800,
      "publishedRunId": "f0bfee8f-cd28-4c11-9f45-3d3938b46a1a",
      "publishedAt": "2026-08-20T06:58:12.545Z",
      "nextScheduledAt": "2026-08-21T06:58:12.545Z",
      "stale": false,
      "transformVersion": "or-models-current-v1",
      "citationUrl": "https://openrouter.ai/docs/api/api-reference/models/get-models",
      "lastAttemptRunId": "f0bfee8f-cd28-4c11-9f45-3d3938b46a1a",
      "lastAttemptStatus": "published",
      "lastAttemptStartedAt": "2026-08-20T06:57:54.054Z",
      "lastAttemptFinishedAt": "2026-08-20T06:58:12.545Z",
      "lastAttemptErrorCode": null,
      "lastAttemptAcquisitionComplete": true,
      "lastAttemptPopulationCompleteness": "full"
    },
    {
      "sourceId": "models_ranked_history",
      "sourceTier": "stable",
      "cadenceSeconds": 86400,
      "staleAfterSeconds": 172800,
      "publishedRunId": "c7ddfdbc-40b7-4e3b-a9e0-7aa39b040de5",
      "publishedAt": "2026-08-20T06:58:38.316Z",
      "nextScheduledAt": "2026-08-21T06:58:38.316Z",
      "stale": false,
      "transformVersion": "or-rankings-daily-v1",
      "citationUrl": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily",
      "lastAttemptRunId": "c7ddfdbc-40b7-4e3b-a9e0-7aa39b040de5",
      "lastAttemptStatus": "published",
      "lastAttemptStartedAt": "2026-08-20T06:58:34.669Z",
      "lastAttemptFinishedAt": "2026-08-20T06:58:38.316Z",
      "lastAttemptErrorCode": null,
      "lastAttemptAcquisitionComplete": true,
      "lastAttemptPopulationCompleteness": "top_n_plus_other"
    },
    {
      "sourceId": "models_top_weekly",
      "sourceTier": "stable",
      "cadenceSeconds": 86400,
      "staleAfterSeconds": 172800,
      "publishedRunId": "66ccca5e-77ee-422c-beba-e61f2d3b7e29",
      "publishedAt": "2026-08-20T06:58:32.444Z",
      "nextScheduledAt": "2026-08-21T06:58:32.444Z",
      "stale": false,
      "transformVersion": "or-models-weekly-v1",
      "citationUrl": "https://openrouter.ai/docs/api/api-reference/models/get-models",
      "lastAttemptRunId": "66ccca5e-77ee-422c-beba-e61f2d3b7e29",
      "lastAttemptStatus": "published",
      "lastAttemptStartedAt": "2026-08-20T06:58:14.788Z",
      "lastAttemptFinishedAt": "2026-08-20T06:58:32.444Z",
      "lastAttemptErrorCode": null,
      "lastAttemptAcquisitionComplete": true,
      "lastAttemptPopulationCompleteness": "full"
    },
    {
      "sourceId": "task_classifications",
      "sourceTier": "stable",
      "cadenceSeconds": 86400,
      "staleAfterSeconds": 172800,
      "publishedRunId": "0579cfba-45c7-4597-a58c-4f2cbdeef104",
      "publishedAt": "2026-08-20T07:00:15.491Z",
      "nextScheduledAt": "2026-08-21T07:00:15.491Z",
      "stale": false,
      "transformVersion": "or-task-classifications-v1",
      "citationUrl": "https://openrouter.ai/openapi.json",
      "lastAttemptRunId": "0579cfba-45c7-4597-a58c-4f2cbdeef104",
      "lastAttemptStatus": "published",
      "lastAttemptStartedAt": "2026-08-20T07:00:14.793Z",
      "lastAttemptFinishedAt": "2026-08-20T07:00:15.491Z",
      "lastAttemptErrorCode": null,
      "lastAttemptAcquisitionComplete": true,
      "lastAttemptPopulationCompleteness": "requested_slice"
    }
  ],
  "evidence": [
    {
      "endpoint": "/api/public/v2/manifest",
      "window": {
        "start": null,
        "end": null,
        "timezone": "unknown",
        "inclusive": null,
        "basis": "unknown"
      },
      "completeness": null,
      "stale": null,
      "watermark": "2026-08-20T07:00:15.491Z",
      "provenance": [
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "213412cf-acaa-4c70-a95a-55be4f5b03cf",
          "fetchedAt": "2026-08-20T07:00:03.398Z",
          "sourceAsOf": "2026-08-20T07:00:03.312Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "models_current",
          "sourceTier": "stable",
          "runId": "f0bfee8f-cd28-4c11-9f45-3d3938b46a1a",
          "fetchedAt": "2026-08-20T06:57:54.467Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-current-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "c7ddfdbc-40b7-4e3b-a9e0-7aa39b040de5",
          "fetchedAt": "2026-08-20T06:58:35.246Z",
          "sourceAsOf": "2026-08-20T06:58:35.208Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_top_weekly",
          "sourceTier": "stable",
          "runId": "66ccca5e-77ee-422c-beba-e61f2d3b7e29",
          "fetchedAt": "2026-08-20T06:58:15.310Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-weekly-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
        },
        {
          "sourceId": "task_classifications",
          "sourceTier": "stable",
          "runId": "0579cfba-45c7-4597-a58c-4f2cbdeef104",
          "fetchedAt": "2026-08-20T07:00:15.245Z",
          "sourceAsOf": "2026-08-19T00:00:00.000Z",
          "transformVersion": "or-task-classifications-v1",
          "citation": "https://openrouter.ai/openapi.json"
        }
      ]
    },
    {
      "endpoint": "/api/public/v2/source-status",
      "window": {
        "start": null,
        "end": null,
        "timezone": "unknown",
        "inclusive": null,
        "basis": "unknown"
      },
      "completeness": {
        "acquisitionComplete": true,
        "populationCompleteness": "full",
        "missingFields": []
      },
      "stale": true,
      "watermark": null,
      "provenance": [
        {
          "sourceId": "apps_ranked",
          "sourceTier": "stable",
          "runId": "213412cf-acaa-4c70-a95a-55be4f5b03cf",
          "fetchedAt": "2026-08-20T07:00:03.398Z",
          "sourceAsOf": "2026-08-20T07:00:03.312Z",
          "transformVersion": "or-app-rankings-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-app-rankings"
        },
        {
          "sourceId": "models_current",
          "sourceTier": "stable",
          "runId": "f0bfee8f-cd28-4c11-9f45-3d3938b46a1a",
          "fetchedAt": "2026-08-20T06:57:54.467Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-current-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
        },
        {
          "sourceId": "models_ranked_history",
          "sourceTier": "stable",
          "runId": "c7ddfdbc-40b7-4e3b-a9e0-7aa39b040de5",
          "fetchedAt": "2026-08-20T06:58:35.246Z",
          "sourceAsOf": "2026-08-20T06:58:35.208Z",
          "transformVersion": "or-rankings-daily-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/datasets/get-rankings-daily"
        },
        {
          "sourceId": "models_top_weekly",
          "sourceTier": "stable",
          "runId": "66ccca5e-77ee-422c-beba-e61f2d3b7e29",
          "fetchedAt": "2026-08-20T06:58:15.310Z",
          "sourceAsOf": null,
          "transformVersion": "or-models-weekly-v1",
          "citation": "https://openrouter.ai/docs/api/api-reference/models/get-models"
        },
        {
          "sourceId": "task_classifications",
          "sourceTier": "stable",
          "runId": "0579cfba-45c7-4597-a58c-4f2cbdeef104",
          "fetchedAt": "2026-08-20T07:00:15.245Z",
          "sourceAsOf": "2026-08-19T00:00:00.000Z",
          "transformVersion": "or-task-classifications-v1",
          "citation": "https://openrouter.ai/openapi.json"
        }
      ]
    }
  ],
  "warnings": [
    "1 source is stale.",
    "1 source has a failed latest attempt."
  ],
  "cap": {
    "sourceLimit": 6,
    "reached": true
  }
}
```

### `dashboard_github_movers`

```json
{
  "status": "partial",
  "schemaVersion": "2.0",
  "summary": "5 public GitHub project-family momentum leaders across 1 category slice; ranks remain category-scoped.",
  "query": {
    "category": "mcp",
    "windowDays": 7,
    "limit": 5,
    "metric": "momentum",
    "entityLevel": "project-family"
  },
  "fanout": {
    "categoryLimit": 8,
    "categoriesRequested": [
      "mcp"
    ],
    "omittedCategories": []
  },
  "categories": [
    {
      "status": "partial",
      "category": "mcp",
      "endpoint": "/api/public/v2/github/rankings",
      "rankingEvidence": {
        "watermark": "ae88ecf9-fd5c-4366-9183-d7d7a019a651",
        "coverage": {
          "resolvedAsOf": "2026-08-19",
          "acquisitionComplete": true,
          "populationCompleteness": "full",
          "missingFields": [],
          "stale": false,
          "lastSuccessAt": "2026-08-19T06:41:59.342Z",
          "staleAfterSeconds": 172800
        },
        "ranking": {
          "metric": "momentum",
          "rankMethod": "locally_calculated",
          "definition": "absolute star delta, then relative growth, fork delta, current stars and stable identity over a fully covered window",
          "unit": "stars",
          "direction": "higher_is_better",
          "ruleVersion": "github-momentum-v1",
          "taxonomyVersion": "github-ai-v1",
          "category": "mcp",
          "entityLevel": "project-family",
          "eligiblePopulation": 5,
          "coverageExcluded": 3,
          "windowDays": 7,
          "baselineDate": "2026-08-12"
        },
        "page": {
          "limit": 5,
          "nextCursor": null
        },
        "provenance": [
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:146",
            "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway",
            "fetchedAt": "2026-08-12T07:46:03.615Z",
            "payloadSha256": "f709d1211bdd0d15344cd1b9bf332c033c9accf14ebc1bdfa3153c5baad4b429"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:147",
            "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/commits?sha=main&per_page=1",
            "fetchedAt": "2026-08-12T07:46:06.066Z",
            "payloadSha256": "90d8513904588f4a86bd3179c9324bc479294562fa735c94252dc6aa6426bb87"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:148",
            "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/releases?per_page=100&page=1",
            "fetchedAt": "2026-08-12T07:46:08.999Z",
            "payloadSha256": "3621d7c9a41aecd250bfac85c8e04f614bb031549589e3704d4bb4daa29de75e"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:164",
            "sourceUrl": "https://api.github.com/repos/github/github-mcp-server",
            "fetchedAt": "2026-08-12T07:46:11.177Z",
            "payloadSha256": "48858e40f349ab3c6e7e5518d3dfc35ae4d1e8c60610cd2018a216aaef40c41a"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:165",
            "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/commits?sha=main&per_page=1",
            "fetchedAt": "2026-08-12T07:46:13.821Z",
            "payloadSha256": "5b7e2a0482416704cdcf4a2fecbecb99e07d79b1c961a9697b87f756117f1859"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:166",
            "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/releases?per_page=100&page=1",
            "fetchedAt": "2026-08-12T07:46:16.849Z",
            "payloadSha256": "930a5dc7f243fd33f9d1f5c34408f103253aec9b2967ead96695cacfcf5c4317"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:184",
            "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge",
            "fetchedAt": "2026-08-12T07:44:21.966Z",
            "payloadSha256": "c4afc35e64992463350332766d80adbe6408662a069aab645bce2382468cfb3d"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:185",
            "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/commits?sha=main&per_page=1",
            "fetchedAt": "2026-08-12T07:44:24.427Z",
            "payloadSha256": "99a0af5f0284fadd296d4891aefe09b1bf319c57985aa5f576dfc48ed955f131"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:186",
            "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/releases?per_page=100&page=1",
            "fetchedAt": "2026-08-12T07:44:27.330Z",
            "payloadSha256": "78c6a64e3165b6e7be03f966435066ead780a5dfb290cad343146dae0e515f26"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:231",
            "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go",
            "fetchedAt": "2026-08-12T07:46:51.779Z",
            "payloadSha256": "ff5b3ed1ed2a63c07212422867bc003aa08170535342dfba2445a3b6201025c9"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:232",
            "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/commits?sha=main&per_page=1",
            "fetchedAt": "2026-08-12T07:46:54.285Z",
            "payloadSha256": "60707061dd2462c8c2ce954015457ccae5987d24ea80d42d84ea47c0e1a6034e"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:233",
            "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/releases?per_page=100&page=1",
            "fetchedAt": "2026-08-12T07:46:56.991Z",
            "payloadSha256": "b0cb7b81416109202ab325653e3d8cd183fe9c2b591f01aa8be5f5dd2733b9ba"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:328",
            "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp",
            "fetchedAt": "2026-08-12T07:44:46.832Z",
            "payloadSha256": "2047e1c78c2947ab6fa4427247448a8fb97eb1106123390fe1851d5c3873c0a0"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:329",
            "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/commits?sha=main&per_page=1",
            "fetchedAt": "2026-08-12T07:44:49.301Z",
            "payloadSha256": "8cc3fe01c18a6cd2dec484400cec032cb1a6c4ee584cf1abc3dc17f89f2e3275"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:330",
            "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=1",
            "fetchedAt": "2026-08-12T07:44:52.009Z",
            "payloadSha256": "f93e1edab24fdd7499f48b46ebb823c830c4b4ebe8c508212c42713643df4a52"
          },
          {
            "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:331",
            "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=2",
            "fetchedAt": "2026-08-12T07:44:54.435Z",
            "payloadSha256": "92ebdea80aa39d5c0a089718dfc42777f0270e6c2aac348d0f107c3cea15488c"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:147",
            "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway",
            "fetchedAt": "2026-08-19T06:43:03.451Z",
            "payloadSha256": "69c51094941006be61ba7f7e620426a2d86aca9d57368b1541be59156a80ae22"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:148",
            "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/commits?sha=main&per_page=1",
            "fetchedAt": "2026-08-19T06:43:03.678Z",
            "payloadSha256": "90d8513904588f4a86bd3179c9324bc479294562fa735c94252dc6aa6426bb87"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:149",
            "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/releases?per_page=100&page=1",
            "fetchedAt": "2026-08-19T06:43:04.221Z",
            "payloadSha256": "73553391b15709b1236027a70ec5b4956f37b07a5adf1b5bbfc27df7db73d6bb"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:165",
            "sourceUrl": "https://api.github.com/repos/github/github-mcp-server",
            "fetchedAt": "2026-08-19T06:43:03.997Z",
            "payloadSha256": "4ec256a46022126b5f652476e41cbbd6df0917d0df65ed150ce120c4006f0895"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:166",
            "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/commits?sha=main&per_page=1",
            "fetchedAt": "2026-08-19T06:43:04.231Z",
            "payloadSha256": "e637d0ca4ac8714165510a2d6b8c369a5db7ca5176ef87a53449cfa5aaf6a0dd"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:167",
            "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/releases?per_page=100&page=1",
            "fetchedAt": "2026-08-19T06:43:04.951Z",
            "payloadSha256": "4649facfcefcfc12b95e74cebfceb6f6c75a32cbea564c1630bf09e608e17bf6"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:185",
            "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge",
            "fetchedAt": "2026-08-19T06:42:43.676Z",
            "payloadSha256": "b41ba16a5ce7fba4a43f870851791eda006b6edfc16a3bad12e5c537e85668fa"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:186",
            "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/commits?sha=main&per_page=1",
            "fetchedAt": "2026-08-19T06:42:43.918Z",
            "payloadSha256": "707073a5e2d9942a614ca49362f0a47dc907bcd4d12809676e4858e18354052f"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:187",
            "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/releases?per_page=100&page=1",
            "fetchedAt": "2026-08-19T06:42:44.416Z",
            "payloadSha256": "da450d6dde8c4b691331f78285173e932d956e34aa379a951ade6cd6558d7323"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:232",
            "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go",
            "fetchedAt": "2026-08-19T06:43:11.594Z",
            "payloadSha256": "0716536e8414ac7102cc1e0847c88cf42fe33518a082f0b178c89c049a6a59be"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:233",
            "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/commits?sha=main&per_page=1",
            "fetchedAt": "2026-08-19T06:43:11.811Z",
            "payloadSha256": "94fe053df429786616f8c007dd8242832512eb6d09d852629384aef88de12e4c"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:234",
            "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/releases?per_page=100&page=1",
            "fetchedAt": "2026-08-19T06:43:12.209Z",
            "payloadSha256": "34782b59ffb29a938496de93b08156d932860a0fdcb47b34002a2427b19f6ee9"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:329",
            "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp",
            "fetchedAt": "2026-08-19T06:42:47.934Z",
            "payloadSha256": "015bd08f447cea718cc61af0e4f27f860974d466984a57b472f1064d35cf93bc"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:330",
            "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/commits?sha=main&per_page=1",
            "fetchedAt": "2026-08-19T06:42:48.161Z",
            "payloadSha256": "7a8824200557850484eac89664626934dad4b48845d112f9f6a199bcc59f474c"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:331",
            "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=1",
            "fetchedAt": "2026-08-19T06:42:48.571Z",
            "payloadSha256": "5230bbb231161437ee5bd779bfad877177872d29f8bc7e1998ff9dacdba4fea6"
          },
          {
            "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:332",
            "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=2",
            "fetchedAt": "2026-08-19T06:42:48.842Z",
            "payloadSha256": "cbfda7b4b9c8734f5aab9b96ae996e51141f637ee8334abd50f621b076033967"
          }
        ],
        "endpoint": "/api/public/v2/github/rankings"
      },
      "baselineComparison": {
        "status": "unavailable",
        "requestedAsOf": "2026-08-12",
        "pagesScanned": 0,
        "cap": {
          "pageLimit": 2,
          "pageSize": 100,
          "nextCursor": null,
          "capped": false
        },
        "evidence": [],
        "warnings": [
          "The exact baseline momentum publication is unavailable: The dashboard catalogue returned HTTP 503."
        ],
        "error": {
          "kind": "http_error",
          "message": "The dashboard catalogue returned HTTP 503.",
          "retryable": true,
          "status": 503
        }
      },
      "leaders": [
        {
          "entityId": "github/github-mcp-server",
          "familyId": "github/github-mcp-server",
          "canonicalRepositoryId": "942771284",
          "memberRepositoryIds": [
            "942771284"
          ],
          "fullName": "github/github-mcp-server",
          "currentRank": 1,
          "previousRank": null,
          "rankMovement": null,
          "newEntrant": null,
          "momentumScore": null,
          "stars": "32347",
          "forks": "4819",
          "baselineStars": "32168",
          "starDelta": "179",
          "forkDelta": "39",
          "metricEvidence": {
            "repositoryId": "942771284",
            "baselineStars": "32168",
            "starDelta": "179",
            "forkDelta": "39",
            "relativeGrowth": "0.005564",
            "defaultBranchCommittedAt": null,
            "latestStableReleaseAt": null,
            "stableReleaseCount90d": null
          },
          "canonicalRepositoryEvidence": {
            "scope": "canonical_repository_only_not_project_family",
            "metadata": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories",
              "response": {
                "schemaVersion": "2.0",
                "watermark": "e9c34e4e-cacf-4961-9792-d03ddf6afe48",
                "coverage": {
                  "resolvedAsOf": "2026-08-19",
                  "acquisitionComplete": true,
                  "populationCompleteness": "partial_or_unknown",
                  "missingFields": [
                    "repository:671269505:releases",
                    "repository:612354784:releases",
                    "repository:552661142:releases"
                  ],
                  "stale": false,
                  "lastSuccessAt": "2026-08-19T06:44:00.711Z",
                  "staleAfterSeconds": 172800
                },
                "data": [
                  {
                    "repositoryId": "942771284",
                    "familyId": "github/github-mcp-server",
                    "isCanonical": true,
                    "fullName": "github/github-mcp-server",
                    "url": "https://github.com/github/github-mcp-server",
                    "primaryCategory": "mcp",
                    "roles": [
                      "server"
                    ],
                    "lifecycle": "active",
                    "license": "verified_osi",
                    "language": "Go",
                    "stars": "32347",
                    "forks": "4819"
                  }
                ],
                "page": {
                  "limit": 100,
                  "nextCursor": null
                },
                "provenance": [
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:165",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server",
                    "fetchedAt": "2026-08-19T06:43:03.997Z",
                    "payloadSha256": "4ec256a46022126b5f652476e41cbbd6df0917d0df65ed150ce120c4006f0895"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:166",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-19T06:43:04.231Z",
                    "payloadSha256": "e637d0ca4ac8714165510a2d6b8c369a5db7ca5176ef87a53449cfa5aaf6a0dd"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:167",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-19T06:43:04.951Z",
                    "payloadSha256": "4649facfcefcfc12b95e74cebfceb6f6c75a32cbea564c1630bf09e608e17bf6"
                  }
                ]
              },
              "canonicalRepository": {
                "repositoryId": "942771284",
                "familyId": "github/github-mcp-server",
                "isCanonical": true,
                "fullName": "github/github-mcp-server",
                "url": "https://github.com/github/github-mcp-server",
                "primaryCategory": "mcp",
                "roles": [
                  "server"
                ],
                "lifecycle": "active",
                "license": "verified_osi",
                "language": "Go",
                "stars": "32347",
                "forks": "4819"
              },
              "error": null,
              "warnings": []
            },
            "history": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories/942771284/history",
              "response": {
                "schemaVersion": "2.0",
                "repositoryId": "942771284",
                "requestFactKind": "snapshot",
                "coverage": {
                  "resolvedAsOf": "2026-08-19",
                  "acquisitionComplete": true,
                  "populationCompleteness": "partial_or_unknown",
                  "missingFields": [
                    "repository:671269505:releases",
                    "repository:612354784:releases",
                    "repository:552661142:releases"
                  ],
                  "stale": false,
                  "lastSuccessAt": "2026-08-19T06:44:00.711Z",
                  "staleAfterSeconds": 172800
                },
                "data": [
                  {
                    "observedDate": "2026-08-12",
                    "stars": "32168",
                    "forks": "4780",
                    "openIssues": "373",
                    "defaultBranchCommittedAt": "2026-08-10T14:13:30.000Z",
                    "latestStableReleaseAt": "2026-08-10T13:10:20.000Z",
                    "stableReleaseCount90d": 12,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-13",
                    "stars": "32204",
                    "forks": "4785",
                    "openIssues": "371",
                    "defaultBranchCommittedAt": "2026-08-12T13:40:51.000Z",
                    "latestStableReleaseAt": "2026-08-10T13:10:20.000Z",
                    "stableReleaseCount90d": 12,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-14",
                    "stars": "32230",
                    "forks": "4793",
                    "openIssues": "367",
                    "defaultBranchCommittedAt": "2026-08-12T13:40:51.000Z",
                    "latestStableReleaseAt": "2026-08-10T13:10:20.000Z",
                    "stableReleaseCount90d": 12,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-15",
                    "stars": "32261",
                    "forks": "4800",
                    "openIssues": "377",
                    "defaultBranchCommittedAt": "2026-08-14T11:53:02.000Z",
                    "latestStableReleaseAt": "2026-08-10T13:10:20.000Z",
                    "stableReleaseCount90d": 12,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-16",
                    "stars": "32283",
                    "forks": "4804",
                    "openIssues": "375",
                    "defaultBranchCommittedAt": "2026-08-14T11:53:02.000Z",
                    "latestStableReleaseAt": "2026-08-10T13:10:20.000Z",
                    "stableReleaseCount90d": 12,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-17",
                    "stars": "32295",
                    "forks": "4809",
                    "openIssues": "377",
                    "defaultBranchCommittedAt": "2026-08-14T11:53:02.000Z",
                    "latestStableReleaseAt": "2026-08-10T13:10:20.000Z",
                    "stableReleaseCount90d": 11,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-19",
                    "stars": "32347",
                    "forks": "4819",
                    "openIssues": "369",
                    "defaultBranchCommittedAt": "2026-08-18T22:04:54.000Z",
                    "latestStableReleaseAt": "2026-08-10T13:10:20.000Z",
                    "stableReleaseCount90d": 11,
                    "lifecycle": "active"
                  }
                ],
                "page": {
                  "limit": 8,
                  "nextCursor": null
                },
                "provenance": [
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:165",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server",
                    "fetchedAt": "2026-08-16T06:41:15.718Z",
                    "payloadSha256": "79d9950ec92deafa367f802f230bddea831f364bc2e3889088fe305e24d83ecc"
                  },
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:166",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-16T06:41:15.937Z",
                    "payloadSha256": "2b97a2c2eb22b51157776c1004e2a8f61eef01af90231cd10ce1321f6ff1ea01"
                  },
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:167",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-16T06:41:16.652Z",
                    "payloadSha256": "f426621f1c5b527b4d2cd0fac1aa421f2a98d773b0d5149e61e691c5ce47d795"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:165",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server",
                    "fetchedAt": "2026-08-13T06:05:23.752Z",
                    "payloadSha256": "fd4f505ee237c87ac6e16481883d6cbc65a184c6883f9081075bb781d1b27be6"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:166",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-13T06:05:24.040Z",
                    "payloadSha256": "8a93e2e9e40fcaa4d2658ec0118c16082bffbeebd558566d9bd1e29c23d8755e"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:167",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-13T06:05:24.787Z",
                    "payloadSha256": "b859856d1f7a0c5edab72b4d75f0e3865260213b350a68be488afd993b87dda6"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:165",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server",
                    "fetchedAt": "2026-08-14T06:41:18.887Z",
                    "payloadSha256": "f359f6c7e9b7afd8dea578c98ce0d3ad0e4a82b8462401bb9b4bc19d13fc7e1b"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:166",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-14T06:41:19.096Z",
                    "payloadSha256": "8a93e2e9e40fcaa4d2658ec0118c16082bffbeebd558566d9bd1e29c23d8755e"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:167",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-14T06:41:19.708Z",
                    "payloadSha256": "3defe81521bd04e8b4017b9e18c36f4908233a444244cd98a7f5e1e296b10e94"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:164",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server",
                    "fetchedAt": "2026-08-12T07:46:11.177Z",
                    "payloadSha256": "48858e40f349ab3c6e7e5518d3dfc35ae4d1e8c60610cd2018a216aaef40c41a"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:165",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-12T07:46:13.821Z",
                    "payloadSha256": "5b7e2a0482416704cdcf4a2fecbecb99e07d79b1c961a9697b87f756117f1859"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:166",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-12T07:46:16.849Z",
                    "payloadSha256": "930a5dc7f243fd33f9d1f5c34408f103253aec9b2967ead96695cacfcf5c4317"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:165",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server",
                    "fetchedAt": "2026-08-17T06:41:17.095Z",
                    "payloadSha256": "58ac06f7c2492deec81e55087192cede3736c21f95dde4500f954b6a77c4b067"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:166",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-17T06:41:17.303Z",
                    "payloadSha256": "2b97a2c2eb22b51157776c1004e2a8f61eef01af90231cd10ce1321f6ff1ea01"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:167",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-17T06:41:18.038Z",
                    "payloadSha256": "9297c9e34feeb68973c16f8f24474cd4112d1dab87463424022ddcf900c12b88"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:165",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server",
                    "fetchedAt": "2026-08-15T06:41:16.620Z",
                    "payloadSha256": "8e4c62449932303b75ed742803a1e561cfdd474cfef174afb993d68047e89919"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:166",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-15T06:41:16.908Z",
                    "payloadSha256": "2b97a2c2eb22b51157776c1004e2a8f61eef01af90231cd10ce1321f6ff1ea01"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:167",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-15T06:41:17.859Z",
                    "payloadSha256": "876648e5a4d4111685b0f9560b1152a2f41ba922667a4da65ad3eb092e152c87"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:165",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server",
                    "fetchedAt": "2026-08-19T06:43:03.997Z",
                    "payloadSha256": "4ec256a46022126b5f652476e41cbbd6df0917d0df65ed150ce120c4006f0895"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:166",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-19T06:43:04.231Z",
                    "payloadSha256": "e637d0ca4ac8714165510a2d6b8c369a5db7ca5176ef87a53449cfa5aaf6a0dd"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:167",
                    "sourceUrl": "https://api.github.com/repos/github/github-mcp-server/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-19T06:43:04.951Z",
                    "payloadSha256": "4649facfcefcfc12b95e74cebfceb6f6c75a32cbea564c1630bf09e608e17bf6"
                  }
                ]
              },
              "error": null,
              "warnings": [
                "Canonical repository snapshot history has partial coverage."
              ]
            },
            "enrichment": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories/942771284/enrichment",
              "response": {
                "schemaVersion": "2.0",
                "repositoryId": "942771284",
                "requestRange": {
                  "from": "2026-08-12",
                  "to": "2026-08-19"
                },
                "releaseCadence": {
                  "latestStableReleaseAt": "2026-08-19T17:36:14.000Z",
                  "stableReleaseCount90d": "12",
                  "medianStableReleaseIntervalDays365d": "6.977546",
                  "coverageStart": "2025-08-20",
                  "coverageEnd": "2026-08-19",
                  "coverageComplete": true
                },
                "starBuckets": [],
                "provenance": [
                  {
                    "id": "ac9e4e47-b72b-4dbe-9765-1757b3859197:releases",
                    "sourceUrl": "https://github.com/github/github-mcp-server/releases",
                    "fetchedAt": "2026-08-20T06:46:00.886Z"
                  }
                ]
              },
              "error": null,
              "warnings": []
            },
            "warnings": [
              "Canonical repository snapshot history has partial coverage."
            ]
          }
        },
        {
          "entityId": "prefecthq/fastmcp",
          "familyId": "prefecthq/fastmcp",
          "canonicalRepositoryId": "896296825",
          "memberRepositoryIds": [
            "896296825"
          ],
          "fullName": "PrefectHQ/fastmcp",
          "currentRank": 2,
          "previousRank": null,
          "rankMovement": null,
          "newEntrant": null,
          "momentumScore": null,
          "stars": "27271",
          "forks": "2251",
          "baselineStars": "27181",
          "starDelta": "90",
          "forkDelta": "9",
          "metricEvidence": {
            "repositoryId": "896296825",
            "baselineStars": "27181",
            "starDelta": "90",
            "forkDelta": "9",
            "relativeGrowth": "0.003311",
            "defaultBranchCommittedAt": null,
            "latestStableReleaseAt": null,
            "stableReleaseCount90d": null
          },
          "canonicalRepositoryEvidence": {
            "scope": "canonical_repository_only_not_project_family",
            "metadata": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories",
              "response": {
                "schemaVersion": "2.0",
                "watermark": "e9c34e4e-cacf-4961-9792-d03ddf6afe48",
                "coverage": {
                  "resolvedAsOf": "2026-08-19",
                  "acquisitionComplete": true,
                  "populationCompleteness": "partial_or_unknown",
                  "missingFields": [
                    "repository:671269505:releases",
                    "repository:612354784:releases",
                    "repository:552661142:releases"
                  ],
                  "stale": false,
                  "lastSuccessAt": "2026-08-19T06:44:00.711Z",
                  "staleAfterSeconds": 172800
                },
                "data": [
                  {
                    "repositoryId": "896296825",
                    "familyId": "prefecthq/fastmcp",
                    "isCanonical": true,
                    "fullName": "PrefectHQ/fastmcp",
                    "url": "https://github.com/PrefectHQ/fastmcp",
                    "primaryCategory": "mcp",
                    "roles": [
                      "server"
                    ],
                    "lifecycle": "active",
                    "license": "verified_osi",
                    "language": "Python",
                    "stars": "27271",
                    "forks": "2251"
                  }
                ],
                "page": {
                  "limit": 100,
                  "nextCursor": null
                },
                "provenance": [
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:329",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp",
                    "fetchedAt": "2026-08-19T06:42:47.934Z",
                    "payloadSha256": "015bd08f447cea718cc61af0e4f27f860974d466984a57b472f1064d35cf93bc"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:330",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-19T06:42:48.161Z",
                    "payloadSha256": "7a8824200557850484eac89664626934dad4b48845d112f9f6a199bcc59f474c"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:331",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-19T06:42:48.571Z",
                    "payloadSha256": "5230bbb231161437ee5bd779bfad877177872d29f8bc7e1998ff9dacdba4fea6"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:332",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=2",
                    "fetchedAt": "2026-08-19T06:42:48.842Z",
                    "payloadSha256": "cbfda7b4b9c8734f5aab9b96ae996e51141f637ee8334abd50f621b076033967"
                  }
                ]
              },
              "canonicalRepository": {
                "repositoryId": "896296825",
                "familyId": "prefecthq/fastmcp",
                "isCanonical": true,
                "fullName": "PrefectHQ/fastmcp",
                "url": "https://github.com/PrefectHQ/fastmcp",
                "primaryCategory": "mcp",
                "roles": [
                  "server"
                ],
                "lifecycle": "active",
                "license": "verified_osi",
                "language": "Python",
                "stars": "27271",
                "forks": "2251"
              },
              "error": null,
              "warnings": []
            },
            "history": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories/896296825/history",
              "response": {
                "schemaVersion": "2.0",
                "repositoryId": "896296825",
                "requestFactKind": "snapshot",
                "coverage": {
                  "resolvedAsOf": "2026-08-19",
                  "acquisitionComplete": true,
                  "populationCompleteness": "partial_or_unknown",
                  "missingFields": [
                    "repository:671269505:releases",
                    "repository:612354784:releases",
                    "repository:552661142:releases"
                  ],
                  "stale": false,
                  "lastSuccessAt": "2026-08-19T06:44:00.711Z",
                  "staleAfterSeconds": 172800
                },
                "data": [
                  {
                    "observedDate": "2026-08-12",
                    "stars": "27181",
                    "forks": "2242",
                    "openIssues": "263",
                    "defaultBranchCommittedAt": "2026-08-11T17:55:48.000Z",
                    "latestStableReleaseAt": "2026-08-10T21:17:13.000Z",
                    "stableReleaseCount90d": 10,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-13",
                    "stars": "27197",
                    "forks": "2244",
                    "openIssues": "264",
                    "defaultBranchCommittedAt": "2026-08-11T17:55:48.000Z",
                    "latestStableReleaseAt": "2026-08-10T21:17:13.000Z",
                    "stableReleaseCount90d": 10,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-14",
                    "stars": "27207",
                    "forks": "2244",
                    "openIssues": "264",
                    "defaultBranchCommittedAt": "2026-08-14T03:19:17.000Z",
                    "latestStableReleaseAt": "2026-08-10T21:17:13.000Z",
                    "stableReleaseCount90d": 8,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-15",
                    "stars": "27219",
                    "forks": "2245",
                    "openIssues": "260",
                    "defaultBranchCommittedAt": "2026-08-14T18:56:10.000Z",
                    "latestStableReleaseAt": "2026-08-10T21:17:13.000Z",
                    "stableReleaseCount90d": 8,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-16",
                    "stars": "27235",
                    "forks": "2245",
                    "openIssues": "263",
                    "defaultBranchCommittedAt": "2026-08-14T18:56:10.000Z",
                    "latestStableReleaseAt": "2026-08-10T21:17:13.000Z",
                    "stableReleaseCount90d": 8,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-17",
                    "stars": "27244",
                    "forks": "2247",
                    "openIssues": "265",
                    "defaultBranchCommittedAt": "2026-08-14T18:56:10.000Z",
                    "latestStableReleaseAt": "2026-08-10T21:17:13.000Z",
                    "stableReleaseCount90d": 8,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-19",
                    "stars": "27271",
                    "forks": "2251",
                    "openIssues": "268",
                    "defaultBranchCommittedAt": "2026-08-18T16:42:45.000Z",
                    "latestStableReleaseAt": "2026-08-10T21:17:13.000Z",
                    "stableReleaseCount90d": 8,
                    "lifecycle": "active"
                  }
                ],
                "page": {
                  "limit": 8,
                  "nextCursor": null
                },
                "provenance": [
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:329",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp",
                    "fetchedAt": "2026-08-16T06:40:59.006Z",
                    "payloadSha256": "14479b47430506116a37f563a9d9144fcb3a4ee0f0cc6ceaa8a6a8018929f835"
                  },
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:330",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-16T06:40:59.226Z",
                    "payloadSha256": "9ea655e182a08a2e9bcfe66165c7de450802a44e2a389082264b93d5325e1ea4"
                  },
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:331",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-16T06:40:59.776Z",
                    "payloadSha256": "5dd962d191ac3442881372403c857e46aa2c93c07313656394366cf5574e664f"
                  },
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:332",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=2",
                    "fetchedAt": "2026-08-16T06:41:00.078Z",
                    "payloadSha256": "cbfda7b4b9c8734f5aab9b96ae996e51141f637ee8334abd50f621b076033967"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:329",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp",
                    "fetchedAt": "2026-08-13T06:05:07.124Z",
                    "payloadSha256": "aae1671c3b51ac5a19918b8e7702a20aebc8de32ac6d97bad7917329936093d3"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:330",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-13T06:05:07.355Z",
                    "payloadSha256": "8cc3fe01c18a6cd2dec484400cec032cb1a6c4ee584cf1abc3dc17f89f2e3275"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:331",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-13T06:05:07.863Z",
                    "payloadSha256": "bbc63e2a47937bc9b976cbadb105dfeb167f820889e7b1d3cec4643ab9a58d92"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:332",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=2",
                    "fetchedAt": "2026-08-13T06:05:08.176Z",
                    "payloadSha256": "92ebdea80aa39d5c0a089718dfc42777f0270e6c2aac348d0f107c3cea15488c"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:329",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp",
                    "fetchedAt": "2026-08-14T06:41:01.882Z",
                    "payloadSha256": "d81bc03840a7f779987792664be621b317b875dd9c5931cccc892796e625768d"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:330",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-14T06:41:02.169Z",
                    "payloadSha256": "e563719280084e9dc7df504000942729ed9c29cfefb2051ee443a514f0953f37"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:331",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-14T06:41:02.649Z",
                    "payloadSha256": "07fdc71d49414c00b77fda7c574b927e733262b61c5d5b011a25ab42fd7ace83"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:332",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=2",
                    "fetchedAt": "2026-08-14T06:41:03.012Z",
                    "payloadSha256": "92ebdea80aa39d5c0a089718dfc42777f0270e6c2aac348d0f107c3cea15488c"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:328",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp",
                    "fetchedAt": "2026-08-12T07:44:46.832Z",
                    "payloadSha256": "2047e1c78c2947ab6fa4427247448a8fb97eb1106123390fe1851d5c3873c0a0"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:329",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-12T07:44:49.301Z",
                    "payloadSha256": "8cc3fe01c18a6cd2dec484400cec032cb1a6c4ee584cf1abc3dc17f89f2e3275"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:330",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-12T07:44:52.009Z",
                    "payloadSha256": "f93e1edab24fdd7499f48b46ebb823c830c4b4ebe8c508212c42713643df4a52"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:331",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=2",
                    "fetchedAt": "2026-08-12T07:44:54.435Z",
                    "payloadSha256": "92ebdea80aa39d5c0a089718dfc42777f0270e6c2aac348d0f107c3cea15488c"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:329",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp",
                    "fetchedAt": "2026-08-17T06:41:00.854Z",
                    "payloadSha256": "19edad739f23ced28df5a681105ea7c85f732640d54a46264b90e2680a1ac8d8"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:330",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-17T06:41:01.160Z",
                    "payloadSha256": "9ea655e182a08a2e9bcfe66165c7de450802a44e2a389082264b93d5325e1ea4"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:331",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-17T06:41:01.581Z",
                    "payloadSha256": "fb9ff6a0facb4451b8b8c275381d121682490c5dd96cdc78d5c0318318658b64"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:332",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=2",
                    "fetchedAt": "2026-08-17T06:41:01.877Z",
                    "payloadSha256": "cbfda7b4b9c8734f5aab9b96ae996e51141f637ee8334abd50f621b076033967"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:329",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp",
                    "fetchedAt": "2026-08-15T06:41:00.300Z",
                    "payloadSha256": "b20de7dca9f79c8d79825af008e6f72102e56ba90739ffc01ad568b004301212"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:330",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-15T06:41:00.665Z",
                    "payloadSha256": "9ea655e182a08a2e9bcfe66165c7de450802a44e2a389082264b93d5325e1ea4"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:331",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-15T06:41:01.080Z",
                    "payloadSha256": "5dd962d191ac3442881372403c857e46aa2c93c07313656394366cf5574e664f"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:332",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=2",
                    "fetchedAt": "2026-08-15T06:41:01.475Z",
                    "payloadSha256": "cbfda7b4b9c8734f5aab9b96ae996e51141f637ee8334abd50f621b076033967"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:329",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp",
                    "fetchedAt": "2026-08-19T06:42:47.934Z",
                    "payloadSha256": "015bd08f447cea718cc61af0e4f27f860974d466984a57b472f1064d35cf93bc"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:330",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-19T06:42:48.161Z",
                    "payloadSha256": "7a8824200557850484eac89664626934dad4b48845d112f9f6a199bcc59f474c"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:331",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-19T06:42:48.571Z",
                    "payloadSha256": "5230bbb231161437ee5bd779bfad877177872d29f8bc7e1998ff9dacdba4fea6"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:332",
                    "sourceUrl": "https://api.github.com/repos/PrefectHQ/fastmcp/releases?per_page=100&page=2",
                    "fetchedAt": "2026-08-19T06:42:48.842Z",
                    "payloadSha256": "cbfda7b4b9c8734f5aab9b96ae996e51141f637ee8334abd50f621b076033967"
                  }
                ]
              },
              "error": null,
              "warnings": [
                "Canonical repository snapshot history has partial coverage."
              ]
            },
            "enrichment": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories/896296825/enrichment",
              "response": {
                "schemaVersion": "2.0",
                "repositoryId": "896296825",
                "requestRange": {
                  "from": "2026-08-12",
                  "to": "2026-08-19"
                },
                "releaseCadence": {
                  "latestStableReleaseAt": "2026-08-10T21:17:13.000Z",
                  "stableReleaseCount90d": "8",
                  "medianStableReleaseIntervalDays365d": "7.978553",
                  "coverageStart": "2025-08-20",
                  "coverageEnd": "2026-08-19",
                  "coverageComplete": true
                },
                "starBuckets": [],
                "provenance": [
                  {
                    "id": "051faac4-63d3-42b6-8b3a-58d5410724ad:releases",
                    "sourceUrl": "https://github.com/PrefectHQ/fastmcp/releases",
                    "fetchedAt": "2026-08-20T06:45:49.391Z"
                  }
                ]
              },
              "error": null,
              "warnings": []
            },
            "warnings": [
              "Canonical repository snapshot history has partial coverage."
            ]
          }
        },
        {
          "entityId": "ibm/mcp-context-forge",
          "familyId": "ibm/mcp-context-forge",
          "canonicalRepositoryId": "979886407",
          "memberRepositoryIds": [
            "979886407"
          ],
          "fullName": "IBM/mcp-context-forge",
          "currentRank": 3,
          "previousRank": null,
          "rankMovement": null,
          "newEntrant": null,
          "momentumScore": null,
          "stars": "4338",
          "forks": "821",
          "baselineStars": "4302",
          "starDelta": "36",
          "forkDelta": "8",
          "metricEvidence": {
            "repositoryId": "979886407",
            "baselineStars": "4302",
            "starDelta": "36",
            "forkDelta": "8",
            "relativeGrowth": "0.008368",
            "defaultBranchCommittedAt": null,
            "latestStableReleaseAt": null,
            "stableReleaseCount90d": null
          },
          "canonicalRepositoryEvidence": {
            "scope": "canonical_repository_only_not_project_family",
            "metadata": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories",
              "response": {
                "schemaVersion": "2.0",
                "watermark": "e9c34e4e-cacf-4961-9792-d03ddf6afe48",
                "coverage": {
                  "resolvedAsOf": "2026-08-19",
                  "acquisitionComplete": true,
                  "populationCompleteness": "partial_or_unknown",
                  "missingFields": [
                    "repository:671269505:releases",
                    "repository:612354784:releases",
                    "repository:552661142:releases"
                  ],
                  "stale": false,
                  "lastSuccessAt": "2026-08-19T06:44:00.711Z",
                  "staleAfterSeconds": 172800
                },
                "data": [
                  {
                    "repositoryId": "979886407",
                    "familyId": "ibm/mcp-context-forge",
                    "isCanonical": true,
                    "fullName": "IBM/mcp-context-forge",
                    "url": "https://github.com/IBM/mcp-context-forge",
                    "primaryCategory": "mcp",
                    "roles": [
                      "gateway"
                    ],
                    "lifecycle": "active",
                    "license": "verified_osi",
                    "language": "Python",
                    "stars": "4338",
                    "forks": "821"
                  }
                ],
                "page": {
                  "limit": 100,
                  "nextCursor": null
                },
                "provenance": [
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:185",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge",
                    "fetchedAt": "2026-08-19T06:42:43.676Z",
                    "payloadSha256": "b41ba16a5ce7fba4a43f870851791eda006b6edfc16a3bad12e5c537e85668fa"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:186",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-19T06:42:43.918Z",
                    "payloadSha256": "707073a5e2d9942a614ca49362f0a47dc907bcd4d12809676e4858e18354052f"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:187",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-19T06:42:44.416Z",
                    "payloadSha256": "da450d6dde8c4b691331f78285173e932d956e34aa379a951ade6cd6558d7323"
                  }
                ]
              },
              "canonicalRepository": {
                "repositoryId": "979886407",
                "familyId": "ibm/mcp-context-forge",
                "isCanonical": true,
                "fullName": "IBM/mcp-context-forge",
                "url": "https://github.com/IBM/mcp-context-forge",
                "primaryCategory": "mcp",
                "roles": [
                  "gateway"
                ],
                "lifecycle": "active",
                "license": "verified_osi",
                "language": "Python",
                "stars": "4338",
                "forks": "821"
              },
              "error": null,
              "warnings": []
            },
            "history": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories/979886407/history",
              "response": {
                "schemaVersion": "2.0",
                "repositoryId": "979886407",
                "requestFactKind": "snapshot",
                "coverage": {
                  "resolvedAsOf": "2026-08-19",
                  "acquisitionComplete": true,
                  "populationCompleteness": "partial_or_unknown",
                  "missingFields": [
                    "repository:671269505:releases",
                    "repository:612354784:releases",
                    "repository:552661142:releases"
                  ],
                  "stale": false,
                  "lastSuccessAt": "2026-08-19T06:44:00.711Z",
                  "staleAfterSeconds": 172800
                },
                "data": [
                  {
                    "observedDate": "2026-08-12",
                    "stars": "4302",
                    "forks": "813",
                    "openIssues": "1258",
                    "defaultBranchCommittedAt": "2026-08-11T15:55:17.000Z",
                    "latestStableReleaseAt": "2026-08-05T18:07:27.000Z",
                    "stableReleaseCount90d": 6,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-13",
                    "stars": "4308",
                    "forks": "814",
                    "openIssues": "1258",
                    "defaultBranchCommittedAt": "2026-08-12T15:50:11.000Z",
                    "latestStableReleaseAt": "2026-08-05T18:07:27.000Z",
                    "stableReleaseCount90d": 6,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-14",
                    "stars": "4315",
                    "forks": "813",
                    "openIssues": "1265",
                    "defaultBranchCommittedAt": "2026-08-13T15:41:29.000Z",
                    "latestStableReleaseAt": "2026-08-05T18:07:27.000Z",
                    "stableReleaseCount90d": 6,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-15",
                    "stars": "4323",
                    "forks": "813",
                    "openIssues": "1274",
                    "defaultBranchCommittedAt": "2026-08-14T16:41:11.000Z",
                    "latestStableReleaseAt": "2026-08-05T18:07:27.000Z",
                    "stableReleaseCount90d": 6,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-16",
                    "stars": "4327",
                    "forks": "815",
                    "openIssues": "1275",
                    "defaultBranchCommittedAt": "2026-08-14T16:41:11.000Z",
                    "latestStableReleaseAt": "2026-08-05T18:07:27.000Z",
                    "stableReleaseCount90d": 6,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-17",
                    "stars": "4332",
                    "forks": "819",
                    "openIssues": "1277",
                    "defaultBranchCommittedAt": "2026-08-14T16:41:11.000Z",
                    "latestStableReleaseAt": "2026-08-05T18:07:27.000Z",
                    "stableReleaseCount90d": 6,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-19",
                    "stars": "4338",
                    "forks": "821",
                    "openIssues": "1296",
                    "defaultBranchCommittedAt": "2026-08-18T12:41:21.000Z",
                    "latestStableReleaseAt": "2026-08-18T13:14:39.000Z",
                    "stableReleaseCount90d": 7,
                    "lifecycle": "active"
                  }
                ],
                "page": {
                  "limit": 8,
                  "nextCursor": null
                },
                "provenance": [
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:185",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge",
                    "fetchedAt": "2026-08-16T06:40:54.660Z",
                    "payloadSha256": "daa710cbacd5c936132284efad7732222530f17811fe8e00e9cfdd7c42f4dace"
                  },
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:186",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-16T06:40:54.972Z",
                    "payloadSha256": "54241c7facd12254bf464ed4fa00f249b4b312a563c8b2451a3111c5f5dce0af"
                  },
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:187",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-16T06:40:55.409Z",
                    "payloadSha256": "94293a5f9c305c5d18716ae496540f3b27cac5d685a84fad6451e1cc14afbd3f"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:185",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge",
                    "fetchedAt": "2026-08-13T06:05:01.784Z",
                    "payloadSha256": "1b150ff14145aae656404c033bc5b6f4c34043acb01201ef9b58c75791f7d66d"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:186",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-13T06:05:02.015Z",
                    "payloadSha256": "deeaa012de46047b2b6a590c0454474deaf8c98ed968ab2b5fc7e8bb50ae7004"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:187",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-13T06:05:02.618Z",
                    "payloadSha256": "74795edeafffec4b563c610c22e8b90010c4b4907e3dcaf6f234cee7e4a595e5"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:185",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge",
                    "fetchedAt": "2026-08-14T06:40:57.375Z",
                    "payloadSha256": "ea3ce4d155cbe857dc832bab6d719a79b0e2e48fea88029bcfbd7f4658cb72f6"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:186",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-14T06:40:57.666Z",
                    "payloadSha256": "9f022fba5d070204989dfb7198e0688fbbbe4839b9a1dc566885f67be3413a48"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:187",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-14T06:40:58.171Z",
                    "payloadSha256": "d8bd925ba37ef88ef099db181c2c6e2612525c1c11322d7b7466813c0c2b3d15"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:184",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge",
                    "fetchedAt": "2026-08-12T07:44:21.966Z",
                    "payloadSha256": "c4afc35e64992463350332766d80adbe6408662a069aab645bce2382468cfb3d"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:185",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-12T07:44:24.427Z",
                    "payloadSha256": "99a0af5f0284fadd296d4891aefe09b1bf319c57985aa5f576dfc48ed955f131"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:186",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-12T07:44:27.330Z",
                    "payloadSha256": "78c6a64e3165b6e7be03f966435066ead780a5dfb290cad343146dae0e515f26"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:185",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge",
                    "fetchedAt": "2026-08-17T06:40:56.330Z",
                    "payloadSha256": "a667b6f853243c7d8020fd4c92030d88bfba9853b61df39baab1b5b0d0345ff1"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:186",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-17T06:40:56.541Z",
                    "payloadSha256": "54241c7facd12254bf464ed4fa00f249b4b312a563c8b2451a3111c5f5dce0af"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:187",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-17T06:40:57.082Z",
                    "payloadSha256": "89bfa750dfed940143a7a8fc5da76aa634d6f2c817177c94dd8e69345f6cef9d"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:185",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge",
                    "fetchedAt": "2026-08-15T06:40:56.061Z",
                    "payloadSha256": "9f453f77c1b4ca883cacca846e6c2b70cd4c62f655118b11ce815213cc633fb6"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:186",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-15T06:40:56.317Z",
                    "payloadSha256": "54241c7facd12254bf464ed4fa00f249b4b312a563c8b2451a3111c5f5dce0af"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:187",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-15T06:40:56.761Z",
                    "payloadSha256": "94293a5f9c305c5d18716ae496540f3b27cac5d685a84fad6451e1cc14afbd3f"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:185",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge",
                    "fetchedAt": "2026-08-19T06:42:43.676Z",
                    "payloadSha256": "b41ba16a5ce7fba4a43f870851791eda006b6edfc16a3bad12e5c537e85668fa"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:186",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-19T06:42:43.918Z",
                    "payloadSha256": "707073a5e2d9942a614ca49362f0a47dc907bcd4d12809676e4858e18354052f"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:187",
                    "sourceUrl": "https://api.github.com/repos/IBM/mcp-context-forge/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-19T06:42:44.416Z",
                    "payloadSha256": "da450d6dde8c4b691331f78285173e932d956e34aa379a951ade6cd6558d7323"
                  }
                ]
              },
              "error": null,
              "warnings": [
                "Canonical repository snapshot history has partial coverage."
              ]
            },
            "enrichment": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories/979886407/enrichment",
              "response": {
                "schemaVersion": "2.0",
                "repositoryId": "979886407",
                "requestRange": {
                  "from": "2026-08-12",
                  "to": "2026-08-19"
                },
                "releaseCadence": {
                  "latestStableReleaseAt": "2026-08-18T13:14:39.000Z",
                  "stableReleaseCount90d": "7",
                  "medianStableReleaseIntervalDays365d": "16.428322",
                  "coverageStart": "2025-08-20",
                  "coverageEnd": "2026-08-19",
                  "coverageComplete": true
                },
                "starBuckets": [],
                "provenance": [
                  {
                    "id": "6b254c2f-d873-4e84-87d7-2359b5f6a42b:releases",
                    "sourceUrl": "https://github.com/IBM/mcp-context-forge/releases",
                    "fetchedAt": "2026-08-20T06:46:28.210Z"
                  }
                ]
              },
              "error": null,
              "warnings": []
            },
            "warnings": [
              "Canonical repository snapshot history has partial coverage."
            ]
          }
        },
        {
          "entityId": "mark3labs/mcp-go",
          "familyId": "mark3labs/mcp-go",
          "canonicalRepositoryId": "895029087",
          "memberRepositoryIds": [
            "895029087"
          ],
          "fullName": "mark3labs/mcp-go",
          "currentRank": 4,
          "previousRank": null,
          "rankMovement": null,
          "newEntrant": null,
          "momentumScore": null,
          "stars": "9014",
          "forks": "869",
          "baselineStars": "8997",
          "starDelta": "17",
          "forkDelta": "5",
          "metricEvidence": {
            "repositoryId": "895029087",
            "baselineStars": "8997",
            "starDelta": "17",
            "forkDelta": "5",
            "relativeGrowth": "0.001889",
            "defaultBranchCommittedAt": null,
            "latestStableReleaseAt": null,
            "stableReleaseCount90d": null
          },
          "canonicalRepositoryEvidence": {
            "scope": "canonical_repository_only_not_project_family",
            "metadata": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories",
              "response": {
                "schemaVersion": "2.0",
                "watermark": "e9c34e4e-cacf-4961-9792-d03ddf6afe48",
                "coverage": {
                  "resolvedAsOf": "2026-08-19",
                  "acquisitionComplete": true,
                  "populationCompleteness": "partial_or_unknown",
                  "missingFields": [
                    "repository:671269505:releases",
                    "repository:612354784:releases",
                    "repository:552661142:releases"
                  ],
                  "stale": false,
                  "lastSuccessAt": "2026-08-19T06:44:00.711Z",
                  "staleAfterSeconds": 172800
                },
                "data": [
                  {
                    "repositoryId": "895029087",
                    "familyId": "mark3labs/mcp-go",
                    "isCanonical": true,
                    "fullName": "mark3labs/mcp-go",
                    "url": "https://github.com/mark3labs/mcp-go",
                    "primaryCategory": "mcp",
                    "roles": [
                      "server"
                    ],
                    "lifecycle": "active",
                    "license": "verified_osi",
                    "language": "Go",
                    "stars": "9014",
                    "forks": "869"
                  }
                ],
                "page": {
                  "limit": 100,
                  "nextCursor": null
                },
                "provenance": [
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:232",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go",
                    "fetchedAt": "2026-08-19T06:43:11.594Z",
                    "payloadSha256": "0716536e8414ac7102cc1e0847c88cf42fe33518a082f0b178c89c049a6a59be"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:233",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-19T06:43:11.811Z",
                    "payloadSha256": "94fe053df429786616f8c007dd8242832512eb6d09d852629384aef88de12e4c"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:234",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-19T06:43:12.209Z",
                    "payloadSha256": "34782b59ffb29a938496de93b08156d932860a0fdcb47b34002a2427b19f6ee9"
                  }
                ]
              },
              "canonicalRepository": {
                "repositoryId": "895029087",
                "familyId": "mark3labs/mcp-go",
                "isCanonical": true,
                "fullName": "mark3labs/mcp-go",
                "url": "https://github.com/mark3labs/mcp-go",
                "primaryCategory": "mcp",
                "roles": [
                  "server"
                ],
                "lifecycle": "active",
                "license": "verified_osi",
                "language": "Go",
                "stars": "9014",
                "forks": "869"
              },
              "error": null,
              "warnings": []
            },
            "history": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories/895029087/history",
              "response": {
                "schemaVersion": "2.0",
                "repositoryId": "895029087",
                "requestFactKind": "snapshot",
                "coverage": {
                  "resolvedAsOf": "2026-08-19",
                  "acquisitionComplete": true,
                  "populationCompleteness": "partial_or_unknown",
                  "missingFields": [
                    "repository:671269505:releases",
                    "repository:612354784:releases",
                    "repository:552661142:releases"
                  ],
                  "stale": false,
                  "lastSuccessAt": "2026-08-19T06:44:00.711Z",
                  "staleAfterSeconds": 172800
                },
                "data": [
                  {
                    "observedDate": "2026-08-12",
                    "stars": "8997",
                    "forks": "864",
                    "openIssues": "25",
                    "defaultBranchCommittedAt": "2026-08-11T11:54:14.000Z",
                    "latestStableReleaseAt": "2026-08-11T12:00:00.000Z",
                    "stableReleaseCount90d": 6,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-13",
                    "stars": "9000",
                    "forks": "864",
                    "openIssues": "23",
                    "defaultBranchCommittedAt": "2026-08-12T12:06:14.000Z",
                    "latestStableReleaseAt": "2026-08-12T12:29:33.000Z",
                    "stableReleaseCount90d": 7,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-14",
                    "stars": "9006",
                    "forks": "866",
                    "openIssues": "26",
                    "defaultBranchCommittedAt": "2026-08-12T12:06:14.000Z",
                    "latestStableReleaseAt": "2026-08-12T12:29:33.000Z",
                    "stableReleaseCount90d": 7,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-15",
                    "stars": "9008",
                    "forks": "866",
                    "openIssues": "26",
                    "defaultBranchCommittedAt": "2026-08-12T12:06:14.000Z",
                    "latestStableReleaseAt": "2026-08-12T12:29:33.000Z",
                    "stableReleaseCount90d": 7,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-16",
                    "stars": "9009",
                    "forks": "867",
                    "openIssues": "26",
                    "defaultBranchCommittedAt": "2026-08-12T12:06:14.000Z",
                    "latestStableReleaseAt": "2026-08-12T12:29:33.000Z",
                    "stableReleaseCount90d": 7,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-17",
                    "stars": "9008",
                    "forks": "867",
                    "openIssues": "26",
                    "defaultBranchCommittedAt": "2026-08-12T12:06:14.000Z",
                    "latestStableReleaseAt": "2026-08-12T12:29:33.000Z",
                    "stableReleaseCount90d": 7,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-19",
                    "stars": "9014",
                    "forks": "869",
                    "openIssues": "30",
                    "defaultBranchCommittedAt": "2026-08-12T12:06:14.000Z",
                    "latestStableReleaseAt": "2026-08-12T12:29:33.000Z",
                    "stableReleaseCount90d": 7,
                    "lifecycle": "active"
                  }
                ],
                "page": {
                  "limit": 8,
                  "nextCursor": null
                },
                "provenance": [
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:232",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go",
                    "fetchedAt": "2026-08-16T06:41:23.580Z",
                    "payloadSha256": "6995170e1e53f11950a62e4a9f7216f6525728a5a8e2dbd6b45dc7edd3f87037"
                  },
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:233",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-16T06:41:23.802Z",
                    "payloadSha256": "94fe053df429786616f8c007dd8242832512eb6d09d852629384aef88de12e4c"
                  },
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:234",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-16T06:41:24.252Z",
                    "payloadSha256": "2768b084752a538426c48f629a16bef9590814e7dfb8aa63079206c3c103510f"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:232",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go",
                    "fetchedAt": "2026-08-13T06:05:32.514Z",
                    "payloadSha256": "a2bcb763b62aca6b76e172e66d79203c1a43df3e651470dd6c787c955a72b519"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:233",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-13T06:05:32.879Z",
                    "payloadSha256": "94fe053df429786616f8c007dd8242832512eb6d09d852629384aef88de12e4c"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:234",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-13T06:05:33.326Z",
                    "payloadSha256": "eb6fb111e3e89665f4036fb4df8010e8cb289ff4d356b0a1eed471401ac9a2ae"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:232",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go",
                    "fetchedAt": "2026-08-14T06:41:27.017Z",
                    "payloadSha256": "c06db3d956f6c908f0b3e9efd808861d1d9e42b80ae8ae2c1ff30359ff95a5bf"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:233",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-14T06:41:27.227Z",
                    "payloadSha256": "94fe053df429786616f8c007dd8242832512eb6d09d852629384aef88de12e4c"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:234",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-14T06:41:27.663Z",
                    "payloadSha256": "2768b084752a538426c48f629a16bef9590814e7dfb8aa63079206c3c103510f"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:231",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go",
                    "fetchedAt": "2026-08-12T07:46:51.779Z",
                    "payloadSha256": "ff5b3ed1ed2a63c07212422867bc003aa08170535342dfba2445a3b6201025c9"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:232",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-12T07:46:54.285Z",
                    "payloadSha256": "60707061dd2462c8c2ce954015457ccae5987d24ea80d42d84ea47c0e1a6034e"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:233",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-12T07:46:56.991Z",
                    "payloadSha256": "b0cb7b81416109202ab325653e3d8cd183fe9c2b591f01aa8be5f5dd2733b9ba"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:232",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go",
                    "fetchedAt": "2026-08-17T06:41:25.357Z",
                    "payloadSha256": "b1f892a3f4b16a25c46c8da4af9926d2d763ed0cc47d3132195f707cdc8aeaa4"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:233",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-17T06:41:25.587Z",
                    "payloadSha256": "94fe053df429786616f8c007dd8242832512eb6d09d852629384aef88de12e4c"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:234",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-17T06:41:26.096Z",
                    "payloadSha256": "2768b084752a538426c48f629a16bef9590814e7dfb8aa63079206c3c103510f"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:232",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go",
                    "fetchedAt": "2026-08-15T06:41:24.415Z",
                    "payloadSha256": "2b24676c6a5001f96138a98afdb6f3a0420089535e44060c159143834a9621ed"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:233",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-15T06:41:24.697Z",
                    "payloadSha256": "94fe053df429786616f8c007dd8242832512eb6d09d852629384aef88de12e4c"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:234",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-15T06:41:25.066Z",
                    "payloadSha256": "2768b084752a538426c48f629a16bef9590814e7dfb8aa63079206c3c103510f"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:232",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go",
                    "fetchedAt": "2026-08-19T06:43:11.594Z",
                    "payloadSha256": "0716536e8414ac7102cc1e0847c88cf42fe33518a082f0b178c89c049a6a59be"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:233",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-19T06:43:11.811Z",
                    "payloadSha256": "94fe053df429786616f8c007dd8242832512eb6d09d852629384aef88de12e4c"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:234",
                    "sourceUrl": "https://api.github.com/repos/mark3labs/mcp-go/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-19T06:43:12.209Z",
                    "payloadSha256": "34782b59ffb29a938496de93b08156d932860a0fdcb47b34002a2427b19f6ee9"
                  }
                ]
              },
              "error": null,
              "warnings": [
                "Canonical repository snapshot history has partial coverage."
              ]
            },
            "enrichment": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories/895029087/enrichment",
              "response": {
                "schemaVersion": "2.0",
                "repositoryId": "895029087",
                "requestRange": {
                  "from": "2026-08-12",
                  "to": "2026-08-19"
                },
                "releaseCadence": {
                  "latestStableReleaseAt": "2026-08-12T12:29:33.000Z",
                  "stableReleaseCount90d": "7",
                  "medianStableReleaseIntervalDays365d": "8.594994",
                  "coverageStart": "2025-08-20",
                  "coverageEnd": "2026-08-19",
                  "coverageComplete": true
                },
                "starBuckets": [],
                "provenance": [
                  {
                    "id": "ba9783ee-14b4-44a2-a283-c0cb3831c868:releases",
                    "sourceUrl": "https://github.com/mark3labs/mcp-go/releases",
                    "fetchedAt": "2026-08-20T06:45:47.977Z"
                  }
                ]
              },
              "error": null,
              "warnings": []
            },
            "warnings": [
              "Canonical repository snapshot history has partial coverage."
            ]
          }
        },
        {
          "entityId": "docker/mcp-gateway",
          "familyId": "docker/mcp-gateway",
          "canonicalRepositoryId": "970603579",
          "memberRepositoryIds": [
            "970603579"
          ],
          "fullName": "docker/mcp-gateway",
          "currentRank": 5,
          "previousRank": null,
          "rankMovement": null,
          "newEntrant": null,
          "momentumScore": null,
          "stars": "1535",
          "forks": "264",
          "baselineStars": "1525",
          "starDelta": "10",
          "forkDelta": "4",
          "metricEvidence": {
            "repositoryId": "970603579",
            "baselineStars": "1525",
            "starDelta": "10",
            "forkDelta": "4",
            "relativeGrowth": "0.006557",
            "defaultBranchCommittedAt": null,
            "latestStableReleaseAt": null,
            "stableReleaseCount90d": null
          },
          "canonicalRepositoryEvidence": {
            "scope": "canonical_repository_only_not_project_family",
            "metadata": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories",
              "response": {
                "schemaVersion": "2.0",
                "watermark": "e9c34e4e-cacf-4961-9792-d03ddf6afe48",
                "coverage": {
                  "resolvedAsOf": "2026-08-19",
                  "acquisitionComplete": true,
                  "populationCompleteness": "partial_or_unknown",
                  "missingFields": [
                    "repository:671269505:releases",
                    "repository:612354784:releases",
                    "repository:552661142:releases"
                  ],
                  "stale": false,
                  "lastSuccessAt": "2026-08-19T06:44:00.711Z",
                  "staleAfterSeconds": 172800
                },
                "data": [
                  {
                    "repositoryId": "970603579",
                    "familyId": "docker/mcp-gateway",
                    "isCanonical": true,
                    "fullName": "docker/mcp-gateway",
                    "url": "https://github.com/docker/mcp-gateway",
                    "primaryCategory": "mcp",
                    "roles": [
                      "gateway"
                    ],
                    "lifecycle": "active",
                    "license": "verified_osi",
                    "language": "Go",
                    "stars": "1535",
                    "forks": "264"
                  }
                ],
                "page": {
                  "limit": 100,
                  "nextCursor": null
                },
                "provenance": [
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:147",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway",
                    "fetchedAt": "2026-08-19T06:43:03.451Z",
                    "payloadSha256": "69c51094941006be61ba7f7e620426a2d86aca9d57368b1541be59156a80ae22"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:148",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-19T06:43:03.678Z",
                    "payloadSha256": "90d8513904588f4a86bd3179c9324bc479294562fa735c94252dc6aa6426bb87"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:149",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-19T06:43:04.221Z",
                    "payloadSha256": "73553391b15709b1236027a70ec5b4956f37b07a5adf1b5bbfc27df7db73d6bb"
                  }
                ]
              },
              "canonicalRepository": {
                "repositoryId": "970603579",
                "familyId": "docker/mcp-gateway",
                "isCanonical": true,
                "fullName": "docker/mcp-gateway",
                "url": "https://github.com/docker/mcp-gateway",
                "primaryCategory": "mcp",
                "roles": [
                  "gateway"
                ],
                "lifecycle": "active",
                "license": "verified_osi",
                "language": "Go",
                "stars": "1535",
                "forks": "264"
              },
              "error": null,
              "warnings": []
            },
            "history": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories/970603579/history",
              "response": {
                "schemaVersion": "2.0",
                "repositoryId": "970603579",
                "requestFactKind": "snapshot",
                "coverage": {
                  "resolvedAsOf": "2026-08-19",
                  "acquisitionComplete": true,
                  "populationCompleteness": "partial_or_unknown",
                  "missingFields": [
                    "repository:671269505:releases",
                    "repository:612354784:releases",
                    "repository:552661142:releases"
                  ],
                  "stale": false,
                  "lastSuccessAt": "2026-08-19T06:44:00.711Z",
                  "staleAfterSeconds": 172800
                },
                "data": [
                  {
                    "observedDate": "2026-08-12",
                    "stars": "1525",
                    "forks": "260",
                    "openIssues": "116",
                    "defaultBranchCommittedAt": "2026-08-11T18:01:55.000Z",
                    "latestStableReleaseAt": null,
                    "stableReleaseCount90d": 0,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-13",
                    "stars": "1525",
                    "forks": "260",
                    "openIssues": "117",
                    "defaultBranchCommittedAt": "2026-08-11T18:01:55.000Z",
                    "latestStableReleaseAt": null,
                    "stableReleaseCount90d": 0,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-14",
                    "stars": "1528",
                    "forks": "261",
                    "openIssues": "119",
                    "defaultBranchCommittedAt": "2026-08-11T18:01:55.000Z",
                    "latestStableReleaseAt": null,
                    "stableReleaseCount90d": 0,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-15",
                    "stars": "1529",
                    "forks": "261",
                    "openIssues": "119",
                    "defaultBranchCommittedAt": "2026-08-11T18:01:55.000Z",
                    "latestStableReleaseAt": null,
                    "stableReleaseCount90d": 0,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-16",
                    "stars": "1530",
                    "forks": "261",
                    "openIssues": "119",
                    "defaultBranchCommittedAt": "2026-08-11T18:01:55.000Z",
                    "latestStableReleaseAt": null,
                    "stableReleaseCount90d": 0,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-17",
                    "stars": "1531",
                    "forks": "263",
                    "openIssues": "120",
                    "defaultBranchCommittedAt": "2026-08-11T18:01:55.000Z",
                    "latestStableReleaseAt": null,
                    "stableReleaseCount90d": 0,
                    "lifecycle": "active"
                  },
                  {
                    "observedDate": "2026-08-19",
                    "stars": "1535",
                    "forks": "264",
                    "openIssues": "122",
                    "defaultBranchCommittedAt": "2026-08-11T18:01:55.000Z",
                    "latestStableReleaseAt": null,
                    "stableReleaseCount90d": 0,
                    "lifecycle": "active"
                  }
                ],
                "page": {
                  "limit": 8,
                  "nextCursor": null
                },
                "provenance": [
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:147",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway",
                    "fetchedAt": "2026-08-16T06:41:14.603Z",
                    "payloadSha256": "6aeb48f009f488148c838570f3b634d4c9584c8a94afc37178f18e2fee693230"
                  },
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:148",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-16T06:41:14.832Z",
                    "payloadSha256": "90d8513904588f4a86bd3179c9324bc479294562fa735c94252dc6aa6426bb87"
                  },
                  {
                    "id": "03b5bad3-85db-4a21-8a67-f2c1a38be196:149",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-16T06:41:15.423Z",
                    "payloadSha256": "618b049f56cd99126e2cfc0f1758d0eeb25da1b487dc0119d8ef52a828ac52a8"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:147",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway",
                    "fetchedAt": "2026-08-13T06:05:22.665Z",
                    "payloadSha256": "5d0e3ea565c40d1eb201dd847a78bff8abd610d68f13fbf004177f5c21c9d581"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:148",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-13T06:05:23.139Z",
                    "payloadSha256": "90d8513904588f4a86bd3179c9324bc479294562fa735c94252dc6aa6426bb87"
                  },
                  {
                    "id": "1ac50f67-5640-4637-bbec-cbead11f32fb:149",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-13T06:05:23.799Z",
                    "payloadSha256": "916e17bc97c592bd444d0c687d0765ab964604525b2f7b990c9997b602b3ccb3"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:147",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway",
                    "fetchedAt": "2026-08-14T06:41:18.026Z",
                    "payloadSha256": "2012c3f32c05cfba931772a9eaa1dc8ded6591d2bd8649244f6be4f25a5febeb"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:148",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-14T06:41:18.430Z",
                    "payloadSha256": "90d8513904588f4a86bd3179c9324bc479294562fa735c94252dc6aa6426bb87"
                  },
                  {
                    "id": "1df5c3c3-967f-4dc5-9c29-c1cf66917b2b:149",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-14T06:41:19.134Z",
                    "payloadSha256": "9910678581e77628772d277bbc238138a57e313d90fad2f190449bd8df8507f4"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:146",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway",
                    "fetchedAt": "2026-08-12T07:46:03.615Z",
                    "payloadSha256": "f709d1211bdd0d15344cd1b9bf332c033c9accf14ebc1bdfa3153c5baad4b429"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:147",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-12T07:46:06.066Z",
                    "payloadSha256": "90d8513904588f4a86bd3179c9324bc479294562fa735c94252dc6aa6426bb87"
                  },
                  {
                    "id": "7490969d-ee3d-47db-b3cf-e29eadd12d36:148",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-12T07:46:08.999Z",
                    "payloadSha256": "3621d7c9a41aecd250bfac85c8e04f614bb031549589e3704d4bb4daa29de75e"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:147",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway",
                    "fetchedAt": "2026-08-17T06:41:16.523Z",
                    "payloadSha256": "242f9f3d673931bbd060489d1433fc3d2955d7d449c73e1b8318a4d374acd458"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:148",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-17T06:41:16.771Z",
                    "payloadSha256": "90d8513904588f4a86bd3179c9324bc479294562fa735c94252dc6aa6426bb87"
                  },
                  {
                    "id": "992fba70-3cef-4512-ab1f-e45b383378c5:149",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-17T06:41:17.360Z",
                    "payloadSha256": "17c43da8454d003726d5e336105313393c56d7ddccec6cf39007c022df0e9959"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:147",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway",
                    "fetchedAt": "2026-08-15T06:41:16.041Z",
                    "payloadSha256": "578203caf436ecc90a0e549a3a34987b5f3e261f4bb52851fc4bb3a1173f684f"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:148",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-15T06:41:16.275Z",
                    "payloadSha256": "90d8513904588f4a86bd3179c9324bc479294562fa735c94252dc6aa6426bb87"
                  },
                  {
                    "id": "a5bffd37-8865-4fa3-b969-5878be65904f:149",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-15T06:41:16.882Z",
                    "payloadSha256": "5c22c4466cd5d7ae99aa16b91ff010f3196d5a19d5d282641ca1d52367fadfea"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:147",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway",
                    "fetchedAt": "2026-08-19T06:43:03.451Z",
                    "payloadSha256": "69c51094941006be61ba7f7e620426a2d86aca9d57368b1541be59156a80ae22"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:148",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/commits?sha=main&per_page=1",
                    "fetchedAt": "2026-08-19T06:43:03.678Z",
                    "payloadSha256": "90d8513904588f4a86bd3179c9324bc479294562fa735c94252dc6aa6426bb87"
                  },
                  {
                    "id": "e9c34e4e-cacf-4961-9792-d03ddf6afe48:149",
                    "sourceUrl": "https://api.github.com/repos/docker/mcp-gateway/releases?per_page=100&page=1",
                    "fetchedAt": "2026-08-19T06:43:04.221Z",
                    "payloadSha256": "73553391b15709b1236027a70ec5b4956f37b07a5adf1b5bbfc27df7db73d6bb"
                  }
                ]
              },
              "error": null,
              "warnings": [
                "Canonical repository snapshot history has partial coverage."
              ]
            },
            "enrichment": {
              "status": "available",
              "endpoint": "/api/public/v2/github/repositories/970603579/enrichment",
              "response": {
                "schemaVersion": "2.0",
                "repositoryId": "970603579",
                "requestRange": {
                  "from": "2026-08-12",
                  "to": "2026-08-19"
                },
                "releaseCadence": {
                  "latestStableReleaseAt": null,
                  "stableReleaseCount90d": "0",
                  "medianStableReleaseIntervalDays365d": null,
                  "coverageStart": "2025-08-20",
                  "coverageEnd": "2026-08-19",
                  "coverageComplete": true
                },
                "starBuckets": [],
                "provenance": [
                  {
                    "id": "d01f9301-ed40-41cf-98f9-524bb1e87eed:releases",
                    "sourceUrl": "https://github.com/docker/mcp-gateway/releases",
                    "fetchedAt": "2026-08-20T06:46:20.792Z"
                  }
                ]
              },
              "error": null,
              "warnings": []
            },
            "warnings": [
              "Canonical repository snapshot history has partial coverage."
            ]
          }
        }
      ],
      "warnings": [
        "The exact baseline momentum publication is unavailable: The dashboard catalogue returned HTTP 503.",
        "Canonical repository snapshot history has partial coverage."
      ],
      "cap": {
        "outputLimit": 5,
        "returnedLeaders": 5,
        "currentNextCursor": null,
        "currentPageCapped": false
      }
    }
  ],
  "warnings": [
    "The exact baseline momentum publication is unavailable: The dashboard catalogue returned HTTP 503.",
    "Canonical repository snapshot history has partial coverage."
  ]
}
```

## Deliberate fixture evidence

The fixture session used the complete seven-call diagnostic matrix and strict route/query fixtures.

- Resolver: `status=ok`, `unsatisfiable=true`, empty `resolved`, and populated exclusions including disappeared and unpublished-pricing rows.
- Model status: exact nonexistent id returned `not_found` with non-empty suggestions.
- Free models: only the available, known-free, zero-price text row survived; unknown and disappeared rows were excluded.
- Usage and GitHub: both successful deterministic paths exercised all documented auxiliary requests.
- Source health: the stale `benchmarks_current` source and failed latest attempt remained visible.
- Per-call timings, in matrix order: 464.65, 15.21, 28.96, 41.21, 35.06, 5.90, and 28.39 ms.
- Initial/final list timings were 20.80/11.32 ms; the connection remained usable.

## Dead-port offline evidence

Offline mode allocated an ephemeral `127.0.0.1` port, closed it, proved a connection refusal, then supplied only that dead URL as `DASHBOARD_BASE_URL`. It did not use a reset-listener simulation.

| Tool | Elapsed | Top-level status | Required kind present |
|---|---:|---|---|
| resolver | 449.06 ms | error | `unreachable` |
| model status | 11.94 ms | error | `unreachable` |
| changes | 16.32 ms | error | `unreachable` |
| free models | 31.21 ms | error | `unreachable` |
| usage leaders | 20.36 ms | partial | `unreachable` |
| source health | 5.49 ms | error | `unreachable` |
| GitHub movers | 17.48 ms | partial | `unreachable` |

Every call was below the 11,500 ms offline ceiling. A second `tools/list` returned all seven tools after the calls.

## HTML evidence

A loopback server returned status 200 and `text/html; charset=utf-8` for every route. All seven calls contained structured `non_json` evidence. Per-call timings were 528.70, 13.16, 23.74, 31.76, 20.82, 5.48, and 17.88 ms. No HTML body, parse stack, raw cause, headers, or environment appeared in evidence, and the final list succeeded.

## Raw stdout purity

The direct child driver used `process.execPath`, the absolute `build/index.js`, `shell:false`, the SDK safe default environment plus only `DASHBOARD_BASE_URL`, and SDK `serializeMessage`/`deserializeMessage`.

It sent legacy initialize, initialized notification, an initial list, seven diagnostic calls, and a final list. The captured stdout:

- was non-empty and ended in LF;
- decoded once as fatal UTF-8 after child exit;
- contained exactly 10 non-blank response-only NDJSON frames;
- contained exactly response ids 1 through 10, with no duplicates, unknown ids, notifications, requests, or ambiguous result/error frames accepted as responses;
- contained no malformed or unterminated frame;
- had empty separately captured stderr.

The harness unit suite also proved rejection of malformed JSON-RPC, invalid UTF-8, blank/interstitial lines, missing final LF, unknown ids, missing ids, unsolicited notifications, id-bearing requests, and frames containing both result and error.

## Alien-cwd evidence

The MCP child ran from the unrelated drive root `C:\\`, derived from `path.parse(process.execPath).root`. It listed all seven tools twice and exercised all seven live calls. Tool order, top-level keys, and statuses matched the prior live evidence: unavailable/unavailable/partial/unavailable/partial/ok/partial. This confirms runtime paths do not depend on the repository working directory.

## Brief and SDK corrections

1. `Client.connect()` starts `StdioClientTransport` and performs initialize; manually starting or initializing would be incorrect.
2. The official transport does not expose child stdout, and its installed line reader can skip syntax-invalid lines; an official-client success is not byte-purity proof.
3. Installed stdio framing is LF-terminated NDJSON, not `Content-Length` framing. Blank lines are impurity and fail.
4. MCP has no JSON-RPC close method here; the client/transport closes or stdin reaches EOF.
5. Production `tsconfig.json` retains `rootDir: src` and `outDir: build`; `tsconfig.harness.json` provides no-emit script/test checking without moving the binary.
6. `verify:stdout` was added separately from `verify:stdio`.
7. The static guard's token alternative can match legitimate public total-volume or per-unit pricing metrics and therefore requires reviewed disposition, not a naive substring ban.
8. The earlier reset-listener offline suggestion was superseded by the binding allocate-close-confirm-refusal requirement.
9. Live-model-dependent behavior follows deployment drift: normal validated data is accepted if deployed; otherwise only the exact PR #24 decline is accepted.

## Evaluation and embedding

`evals/dashboard-intelligence.xml` contains ten independent cases, covers all seven tools, uses the archived date 2026-08-19, and states tool, argument, bound, conditional-capability, and JSON-path criteria in machine-checkable form.

An Electron host should spawn the compiled absolute `build/index.js` path with the Node executable, optionally set only `DASHBOARD_BASE_URL`, speak MCP over the child's stdin/stdout, and consume stderr separately. It should treat structured unavailable, partial, stale, and endpoint-specific error results as normal outcomes and keep the child alive.

## Final command evidence

Fresh final verification:

- `npm test`: exit 0; 101 tests passed, 0 failed.
- `npm run build`: exit 0; production TypeScript build plus no-emit harness typecheck passed; executable remained `build/index.js`.
- `git diff --check`: exit 0 with no output.
- XML parse/coverage check: 10 cases, 10 independent, archived date `2026-08-19`, 7 unique tool names.
- Live-report equality check: all seven JSON blocks deep-strict-equal their corresponding `verification/raw/live.json` `structuredContent` values.

Reviewed matches:

- `test/verification-harness.test.ts`: the neutral credential-header field-name input proves the fail-closed evidence guard; it contains no credential value.
- `src/tools/usage-leaders.ts`: the integer public token-volume validator covers exact metric strings; it is a domain metric, not a credential.

There were no matches for production stdout logging, working-directory lookup, interactive input APIs, browser opening, bearer values, key/secret environment names, or environment-file loading.

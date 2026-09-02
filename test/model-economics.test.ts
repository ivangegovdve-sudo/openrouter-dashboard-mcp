import fs from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardClient } from "../src/dashboard/client.js";

const _originalFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  if (url === "https://docs.sailresearch.com/pricing.md") {
    // Return empty document by default so no models are injected for other tests
    return {
      ok: true,
      arrayBuffer: async () => Buffer.from("")
    };
  }
  return _originalFetch(url);
};

import { DashboardRequestError } from "../src/dashboard/errors.js";
import {
  DISCOUNT_ENRICHMENT_LIMIT,
  modelEconomicsOutputSchema,
  retirementRisk,
  runModelEconomics,
  shiftDecimalString,
} from "../src/tools/model-economics.js";
import {
  publicCompleteness,
  publicProvenance,
  publicWindow,
} from "./fixtures.js";

const NOW = () => new Date("2026-08-27T00:00:00.000Z");
const STAMP = "2026-08-26T06:00:00.000Z";

type LiveOverrides = {
  provider: "openrouter" | "groq" | "cerebras";
  id: string;
  prompt?: string | null;
  completion?: string | null;
  contextLength?: string | null;
  outputModalities?: string[] | null;
  freeKind?: "concrete_free" | "free_router" | "paid_or_unknown";
  availability?: "available" | "disappeared";
  missingFields?: string[];
};

function liveModel(overrides: LiveOverrides) {
  const prompt = overrides.prompt === undefined ? "0.0000001250" : overrides.prompt;
  const completion =
    overrides.completion === undefined ? "0.0000005000" : overrides.completion;
  const freeKind = overrides.freeKind ?? "paid_or_unknown";
  const isFree =
    freeKind === "concrete_free"
      ? true
      : prompt !== null && completion !== null
        ? false
        : null;
  return {
    provider: overrides.provider,
    id: overrides.id,
    displayName: overrides.id,
    ownedBy: "vendor",
    contextLength:
      overrides.contextLength === undefined ? "128000" : overrides.contextLength,
    pricing: { promptUsdPerToken: prompt, completionUsdPerToken: completion },
    isFree,
    freeKind,
    providerActive: null,
    reasoningEfforts: null,
    outputModalities:
      overrides.outputModalities === undefined
        ? ["text"]
        : overrides.outputModalities,
    performance: null,
    availability: overrides.availability ?? "available",
    firstSeenAt: STAMP,
    lastSeenAt: STAMP,
    lastConfirmedAt: STAMP,
    disappearedAt: null,
    absenceStreak: "0",
    missingFields: overrides.missingFields ?? [],
  };
}

function catalogueModel(overrides: {
  id: string;
  lifecycleState?: string;
  expirationDate?: string | null;
  supportedParameters?: string[];
}) {
  return {
    id: overrides.id,
    canonicalSlug: overrides.id,
    name: overrides.id,
    description: "Untrusted catalogue description.",
    contentTrust: "untrusted-source",
    createdUnix: "1700000000",
    contextLength: "128000",
    architecture: { modality: "text->text", output_modalities: ["text"] },
    pricing: { prompt: "0.0000001250", completion: "0.0000005000" },
    supportedParameters: overrides.supportedParameters ?? ["temperature", "tools"],
    expirationDate: overrides.expirationDate ?? null,
    lifecycleState: overrides.lifecycleState ?? "no_announced_expiration",
    freeKind: "paid_or_unknown",
    weeklyRank: 1,
    rankMethod: "response_order",
  };
}

function collection(data: unknown[], cursor: string | null = null) {
  return {
    schemaVersion: "2.0",
    data,
    cursor,
    window: publicWindow,
    completeness: publicCompleteness,
    stale: false,
    rank: null,
    provenance: publicProvenance,
  };
}

function providerRow(overrides: {
  modelId: string;
  provider: string;
  discount: string | null;
}) {
  return {
    modelId: overrides.modelId,
    provider: overrides.provider,
    endpoint: `${overrides.provider} | ${overrides.modelId}`,
    quantization: "unknown",
    contextLength: "128000",
    promptPrice: "0.0000001250",
    completionPrice: "0.0000005000",
    discount: overrides.discount,
    uptime: "99.000000000",
    latency: "400.000000",
    throughput: "100.000000",
    status: "0",
    sourceUrl: `https://openrouter.ai/${overrides.modelId}/providers`,
    fetchedAt: "2026-08-27T06:00:00.000Z",
  };
}

type Routes = {
  live: unknown[];
  catalogue?: unknown[];
  providers?: Record<string, unknown[] | "throw">;
};

function stubClient(routes: Routes): DashboardClient {
  return {
    async get(path, _query, schema) {
      if (path === "/api/public/v2/live-models") {
        return schema.parse(collection(routes.live));
      }
      if (path === "/api/public/v2/models") {
        return schema.parse(collection(routes.catalogue ?? []));
      }
      const match = /^\/api\/public\/v2\/models\/(.+)\/providers$/.exec(path);
      if (match !== null) {
        const id = decodeURIComponent(match[1] ?? "");
        const entry = routes.providers?.[id];
        if (entry === undefined || entry === "throw") {
          throw new DashboardRequestError("http_error", "unavailable", {
            retryable: true,
            status: 503,
          });
        }
        return schema.parse(collection(entry));
      }
      throw new Error(`unexpected path ${path}`);
    },
  };
}

test("shifts exact decimal strings to per-million prices without float loss", () => {
  assert.equal(shiftDecimalString("0.000000088606", 6), "0.088606");
  assert.equal(shiftDecimalString("0.0000001250", 6), "0.125");
  assert.equal(shiftDecimalString("0.00000000000000000000", 6), "0");
  assert.equal(shiftDecimalString("0.432000000", 2), "43.2");
  assert.equal(shiftDecimalString("not-a-number", 6), null);
});

test("maps every upstream lifecycle value, and only one of them to none", () => {
  const asOf = "2026-08-27T00:00:00.000Z";
  const or = (state: string, expiry: string | null = null) =>
    retirementRisk("openrouter", state, expiry, "available", asOf);

  // The ONLY route to "none". Anything else reporting none is a false all-clear.
  assert.equal(or("no_announced_expiration"), "none");

  // These are the values the upstream schema actually emits. The previous
  // implementation tested for "deprecated"/"retired" -- which the schema never
  // emits -- so every one of these fell through to "none".
  assert.equal(or("past_expiration_still_listed"), "imminent");
  assert.equal(or("absent_from_catalog"), "imminent");
  assert.equal(or("removed_or_unavailable"), "imminent");
  assert.equal(or("scheduled_deprecation"), "imminent");
  assert.equal(or("scheduled_deprecation", "2026-09-15"), "imminent");
  assert.equal(or("scheduled_deprecation", "2098-12-31"), "dated");

  // Unreadable lifecycle is unknown, never safe.
  assert.equal(or("expiration_unknown"), "unknown");
  assert.equal(or("a_value_this_build_has_never_seen"), "unknown");
  assert.equal(or(null as unknown as string), "unknown");

  // Providers that publish no lifecycle at all say so.
  assert.equal(retirementRisk("groq", null, null, "available", asOf), "not_published_by_provider");
  assert.equal(retirementRisk("cerebras", null, null, "available", asOf), "not_published_by_provider");
  // Disappearance is the only signal those two give, and it outranks everything.
  assert.equal(retirementRisk("groq", null, null, "disappeared", asOf), "imminent");
  assert.equal(retirementRisk("openrouter", "no_announced_expiration", null, "disappeared", asOf), "imminent");
});

test("never returns none for any value the upstream schema can emit except the all-clear", () => {
  const asOf = "2026-08-27T00:00:00.000Z";
  const emitted = [
    "expiration_unknown",
    "no_announced_expiration",
    "scheduled_deprecation",
    "past_expiration_still_listed",
    "absent_from_catalog",
    "removed_or_unavailable",
  ];
  for (const state of emitted) {
    const risk = retirementRisk("openrouter", state, null, "available", asOf);
    if (state === "no_announced_expiration") {
      assert.equal(risk, "none", `${state} is the all-clear`);
    } else {
      assert.notEqual(risk, "none", `${state} must never read as safe to pin`);
    }
  }
});

test("requires both halves of a price before a model can be ranked", async () => {
  const client = stubClient({
    live: [
      liveModel({ provider: "openrouter", id: "or/half", prompt: "0", completion: null }),
      liveModel({ provider: "openrouter", id: "or/whole", prompt: "0.0000001000" }),
    ],
    catalogue: [],
  });

  const output = await runModelEconomics(
    { discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  const half = output.models.find((entry) => entry.id === "or/half");
  // A zero prompt price with an unknown completion price must not win on half a
  // price -- total cost is unknown.
  assert.equal(half?.priceComparable, false);
  assert.equal(output.models[0]?.id, "or/whole");
});

test("says so when an id list disables filters the caller asked for", async () => {
  const client = stubClient({
    live: [liveModel({ provider: "openrouter", id: "or/a" })],
    catalogue: [],
  });

  const output = await runModelEconomics(
    { ids: ["or/a"], excludeRetirementRisk: true, requireTools: true, discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  assert.match(output.warnings.join(" "), /excludeRetirementRisk/);
  assert.match(output.warnings.join(" "), /requireTools/);
  assert.match(output.warnings.join(" "), /not applied/);
});

test("drops unreadable-lifecycle models when retirement risk is excluded", async () => {
  const client = stubClient({
    live: [
      liveModel({ provider: "openrouter", id: "or/unknown" }),
      liveModel({ provider: "openrouter", id: "or/clear", prompt: "0.0000002000" }),
    ],
    catalogue: [
      catalogueModel({ id: "or/unknown", lifecycleState: "expiration_unknown" }),
      catalogueModel({ id: "or/clear", lifecycleState: "no_announced_expiration" }),
    ],
  });

  const output = await runModelEconomics(
    { excludeRetirementRisk: true, discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  assert.deepEqual(output.models.map((entry) => entry.id), ["or/clear"]);
});

test("ranks across all three providers cheapest first", async () => {
  const client = stubClient({
    live: [
      liveModel({ provider: "openrouter", id: "or/pricey", prompt: "0.0000090000" }),
      liveModel({ provider: "groq", id: "groq/cheap", prompt: "0.0000000300" }),
      liveModel({ provider: "openrouter", id: "or/mid", prompt: "0.0000001000" }),
    ],
    catalogue: [],
  });

  const output = await runModelEconomics(
    { discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  assert.deepEqual(
    output.models.map((entry) => `${entry.provider}:${entry.id}`),
    ["groq:groq/cheap", "openrouter:or/mid", "openrouter:or/pricey"],
  );
  assert.equal(output.models[0]?.pricing.promptUsdPerMillionTokens, "0.03");
  modelEconomicsOutputSchema.parse(output);
});

test("keeps unpriced Cerebras models in the answer instead of dropping them", async () => {
  const client = stubClient({
    live: [
      liveModel({ provider: "openrouter", id: "or/priced", prompt: "0.0000001000" }),
      liveModel({
        provider: "cerebras",
        id: "gpt-oss-120b",
        prompt: null,
        completion: null,
        contextLength: null,
        outputModalities: null,
        missingFields: ["pricing", "context_length", "output_modalities"],
      }),
    ],
    catalogue: [],
  });

  const output = await runModelEconomics(
    { discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  const cerebras = output.models.find((entry) => entry.provider === "cerebras");
  assert.ok(cerebras, "cerebras model must survive into the answer");
  // Ranked rows come first; the unrankable row follows rather than vanishing.
  assert.equal(output.models.at(-1)?.provider, "cerebras");
  assert.equal(cerebras?.priceComparable, false);
  assert.match(String(cerebras?.unrankableReason), /publishes no prices/);
  // Unknown capability must never read as a capability claim.
  assert.equal(cerebras?.emitsText, null);
  assert.equal(cerebras?.genuinelyFree, false);

  assert.equal(output.comparability.priceComparable, 1);
  assert.equal(output.comparability.priceUnknown, 1);
  assert.match(output.comparability.note, /cost-unknown, not free/);
  assert.match(output.warnings.join(" "), /not dropped/);
});

test("excludes unknown-capability rows when a hard guarantee is demanded", async () => {
  const client = stubClient({
    live: [
      liveModel({ provider: "openrouter", id: "or/text" }),
      liveModel({
        provider: "cerebras",
        id: "cerebras/unknown",
        prompt: null,
        completion: null,
        outputModalities: null,
      }),
    ],
    catalogue: [],
  });

  const output = await runModelEconomics(
    { includeUnknownCapability: false, discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  assert.deepEqual(
    output.models.map((entry) => entry.id),
    ["or/text"],
  );
});

test("reports per-provider publication facts so a null is explained", async () => {
  const client = stubClient({
    live: [
      liveModel({ provider: "openrouter", id: "or/a" }),
      liveModel({ provider: "groq", id: "groq/a", prompt: null, completion: null }),
    ],
    catalogue: [],
  });

  const output = await runModelEconomics(
    { discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  const groq = output.providers.find((entry) => entry.provider === "groq");
  const cerebras = output.providers.find((entry) => entry.provider === "cerebras");

  assert.equal(groq?.spendVisibility, "no_billing_api");
  assert.equal(groq?.publishes.lifecycle, "never");
  assert.match(String(groq?.comparabilityNote), /no billing API/);
  // A provider that contributed nothing is still reported, and said so.
  assert.equal(cerebras?.modelsInCatalogue, 0);
  assert.match(output.warnings.join(" "), /Cerebras contributed no models/);
});

test("does not spend a discount lookup on a provider that publishes none", async () => {
  const requested: string[] = [];
  const base = stubClient({
    live: [
      liveModel({ provider: "groq", id: "groq/a", prompt: "0.0000000100" }),
      liveModel({ provider: "openrouter", id: "or/a", prompt: "0.0000001000" }),
    ],
    catalogue: [],
    providers: {
      "or/a": [providerRow({ modelId: "or/a", provider: "Cheapest", discount: "0.432000000" })],
    },
  });
  const client: DashboardClient = {
    async get(path, query, schema) {
      if (path.includes("/providers")) requested.push(path);
      return base.get(path, query, schema);
    },
  };

  const output = await runModelEconomics(
    { discountEnrichment: 5 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  // Groq is cheaper and sorts first, but publishes no discounts, so it is not
  // looked up at all -- and is reported as such rather than as no_discount.
  assert.equal(requested.length, 1);
  assert.match(requested[0] ?? "", /or%2Fa/);
  const groq = output.models.find((entry) => entry.provider === "groq");
  assert.equal(groq?.discountCoverage, "not_published_by_provider");

  const or = output.models.find((entry) => entry.provider === "openrouter");
  assert.equal(or?.discountCoverage, "discounted");
  assert.equal(or?.bestDiscount?.percentOff, "43.2");
  assert.equal(or?.bestDiscount?.providerName, "Cheapest");
  assert.equal(or?.bestDiscount?.expiresAt, null);
  assert.equal(or?.bestDiscount?.expiryPublished, false);
  assert.match(output.discounts.note, /No provider publishes a discount expiry/);
});

test("separates a published zero discount from an unobserved model", async () => {
  const client = stubClient({
    live: [
      liveModel({ provider: "openrouter", id: "or/observed", prompt: "0.0000001000" }),
      liveModel({ provider: "openrouter", id: "or/unobserved", prompt: "0.0000002000" }),
    ],
    catalogue: [],
    providers: {
      "or/observed": [
        providerRow({ modelId: "or/observed", provider: "Only", discount: "0.000000000" }),
      ],
      "or/unobserved": "throw",
    },
  });

  const output = await runModelEconomics({}, { client, now: NOW });
  if (output.status === "error") assert.fail("expected a catalogue result");

  assert.equal(output.models[0]?.discountCoverage, "no_discount");
  assert.equal(output.models[1]?.discountCoverage, "unavailable");
  assert.equal(output.discounts.modelsUnobserved, 1);
  // One failed lookup must not read as a total outage.
  assert.equal(output.discounts.sourceAvailable, true);
});

test("keeps a rate-limited free router out of genuinely free results", async () => {
  const client = stubClient({
    live: [
      liveModel({
        provider: "openrouter",
        id: "openrouter/free",
        freeKind: "free_router",
        prompt: "0",
        completion: "0",
      }),
      liveModel({
        provider: "openrouter",
        id: "vendor/real-free",
        freeKind: "concrete_free",
        prompt: "0",
        completion: "0",
      }),
    ],
    catalogue: [],
  });

  const output = await runModelEconomics(
    { genuinelyFreeOnly: true, discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  assert.deepEqual(
    output.models.map((entry) => entry.id),
    ["vendor/real-free"],
  );
  assert.equal(output.models[0]?.genuinelyFree, true);
});

test("names a pinned id that is in no provider catalogue", async () => {
  const client = stubClient({
    live: [liveModel({ provider: "groq", id: "groq/alive" })],
    catalogue: [],
  });

  const output = await runModelEconomics(
    { ids: ["groq/alive", "openai/gpt-oss-120b:free"], discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  assert.deepEqual(output.missingIds, ["openai/gpt-oss-120b:free"]);
  assert.deepEqual(
    output.models.map((entry) => entry.id),
    ["groq/alive"],
  );
  assert.match(output.warnings.join(" "), /will fail if called/);
});

test("treats a disappeared model as imminent and excludes it by default", async () => {
  const client = stubClient({
    live: [
      liveModel({ provider: "groq", id: "groq/gone", availability: "disappeared" }),
      liveModel({ provider: "groq", id: "groq/here" }),
    ],
    catalogue: [],
  });

  const shown = await runModelEconomics(
    { discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (shown.status === "error") assert.fail("expected a catalogue result");
  assert.deepEqual(shown.models.map((entry) => entry.id), ["groq/here"]);

  const all = await runModelEconomics(
    { availableOnly: false, discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (all.status === "error") assert.fail("expected a catalogue result");
  const gone = all.models.find((entry) => entry.id === "groq/gone");
  assert.equal(gone?.retirementRisk, "imminent");
});

test("carries OpenRouter lifecycle onto the cross-provider row", async () => {
  const client = stubClient({
    live: [liveModel({ provider: "openrouter", id: "or/sunsetting" })],
    catalogue: [
      catalogueModel({
        id: "or/sunsetting",
        lifecycleState: "scheduled_deprecation",
        expirationDate: "2026-09-10",
      }),
    ],
  });

  const output = await runModelEconomics(
    { discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  assert.equal(output.models[0]?.retirementRisk, "imminent");
  assert.equal(output.models[0]?.expirationDate, "2026-09-10");
  assert.equal(output.models[0]?.supportsTools, true);
});

test("leaves tool support unknown where the provider publishes no parameters", async () => {
  const client = stubClient({
    live: [
      liveModel({ provider: "groq", id: "groq/a" }),
      liveModel({ provider: "openrouter", id: "or/a" }),
    ],
    catalogue: [catalogueModel({ id: "or/a", supportedParameters: ["temperature"] })],
  });

  const output = await runModelEconomics(
    { discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  const groq = output.models.find((entry) => entry.provider === "groq");
  const or = output.models.find((entry) => entry.provider === "openrouter");
  assert.equal(groq?.supportsTools, null);
  assert.equal(or?.supportsTools, false);

  // requireTools must exclude unknowns, not assume them capable.
  const strict = await runModelEconomics(
    { requireTools: true, discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (strict.status === "error") assert.fail("expected a catalogue result");
  assert.equal(strict.models.length, 0);
});

test("survives an OpenRouter catalogue failure without losing cross-provider pricing", async () => {
  const client: DashboardClient = {
    async get(path, _query, schema) {
      if (path === "/api/public/v2/live-models") {
        return schema.parse(
          collection([liveModel({ provider: "groq", id: "groq/a" })]),
        );
      }
      throw new DashboardRequestError("http_error", "down", {
        retryable: true,
        status: 500,
      });
    },
  };

  const output = await runModelEconomics(
    { discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a degraded result");

  assert.equal(output.models.length, 1);
  assert.match(
    output.warnings.join(" "),
    /Cross-provider pricing is unaffected/,
  );
});

test("returns a structured error when the cross-provider catalogue fails", async () => {
  const client: DashboardClient = {
    async get() {
      throw new DashboardRequestError("timeout", "timed out", { retryable: true });
    },
  };

  const output = await runModelEconomics({}, { client, now: NOW });

  assert.equal(output.status, "error");
  if (output.status !== "error") assert.fail("expected an error result");
  assert.equal(output.error.kind, "timeout");
  modelEconomicsOutputSchema.parse(output);
});

test("bounds discount enrichment", () => {
  assert.equal(DISCOUNT_ENRICHMENT_LIMIT, 12);
});

test("announces a provider whose data is days older than the rest", async () => {
  const stale = (id: string, provider: "groq" | "openrouter", confirmed: string) => ({
    ...liveModel({ provider, id }),
    lastConfirmedAt: confirmed,
    lastSeenAt: confirmed,
  });
  const client = stubClient({
    live: [
      stale("or/fresh", "openrouter", "2026-08-26T06:00:00.000Z"),
      stale("groq/old", "groq", "2026-08-24T00:00:00.000Z"),
    ],
    catalogue: [],
  });

  const output = await runModelEconomics(
    { discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  const joined = output.warnings.join(" ");
  // Absolute staleness must be stated, not left in a field for the caller to
  // notice: an answer that mixes 1-day-old and 3-day-old data looks uniformly
  // current unless it says otherwise.
  assert.match(joined, /Groq data was last confirmed 3 days ago/);
  assert.match(joined, /Treat as last known, not current/);
  // The fresh provider is not warned about.
  assert.doesNotMatch(joined, /OpenRouter data was last confirmed/);
});

test("flags a provider that is merely a day behind the freshest one", async () => {
  const at = (id: string, provider: "groq" | "openrouter", confirmed: string) => ({
    ...liveModel({ provider, id }),
    lastConfirmedAt: confirmed,
    lastSeenAt: confirmed,
  });
  const client = stubClient({
    live: [
      at("or/fresh", "openrouter", "2026-08-27T00:00:00.000Z"),
      at("groq/behind", "groq", "2026-08-25T20:00:00.000Z"),
    ],
    catalogue: [],
  });

  const output = await runModelEconomics(
    { discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  // Under two days absolute, but a day behind the freshest -- the comparison is
  // still not like-for-like in time, and says so.
  assert.match(output.warnings.join(" "), /hours older than the freshest provider/);
});



test("Sail integration: parses three windows, matches fingerprint", async () => {
  const fixture = fs.readFileSync('sail-pricing.md');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url === "https://docs.sailresearch.com/pricing.md") {
      return {
        ok: true,
        arrayBuffer: async () => fixture
      };
    }
    return originalFetch(url);
  };

  const client = stubClient({
    live: [
      liveModel({
        provider: "openrouter",
        id: "openrouter/model",
      }),
    ],
  });

  try {
    const output = await runModelEconomics({ providers: ["sail"] }, { client, now: NOW });
    assert.equal(output.status, "ok");
    
    // The fixture has ASAP input $1.40 and output $4.40
    // promptUsdPerToken = 0.0000014000
    // completionUsdPerToken = 0.0000044000
    
    const sailModel = (output as any).models.find((m: any) => m.provider === "sail" && m.id === "zai-org/GLM-5.3");
    assert.ok(sailModel, "Sail model should be injected");
    assert.equal(sailModel.pricing.promptUsdPerToken, "0.0000014000");
    assert.equal(sailModel.pricing.completionUsdPerToken, "0.0000044000");
    assert.deepEqual(sailModel.missingFields, ["availabilitySource_absent_assumed_available"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Sail integration: fingerprint MISMATCH refuses and reports staleness", async () => {
  const fixture = Buffer.from("wrong content");
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (url === "https://docs.sailresearch.com/pricing.md") {
      return {
        ok: true,
        arrayBuffer: async () => fixture
      };
    }
    return originalFetch(url);
  };

  const client = stubClient({ live: [] });

  try {
    const output = await runModelEconomics({ providers: ["sail"] }, { client, now: NOW });

    // A refusal is NOT "ok". The tool declines to price from a document it
    // cannot vouch for, and says so -- so the honest status is "partial".
    // Asserting "ok" here would have passed only if the fingerprint were
    // ignored, i.e. the assertion would have been satisfied by the bug.
    assert.equal(output.status, "partial");

    const sailModel = (output as any).models.find((m: any) => m.provider === "sail");
    assert.equal(sailModel, undefined, "Sail models must be omitted on mismatch");

    // It must REFUSE, never fall back to the unverified prices.
    const said = [(output as any).summary, ...((output as any).warnings ?? [])].join(" ");
    assert.match(said, /PRICES ARE STALE/, "Must report staleness");
    assert.match(said, /does not match expected/, "Must name the digest mismatch");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

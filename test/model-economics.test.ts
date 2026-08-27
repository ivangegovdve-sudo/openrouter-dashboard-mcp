import assert from "node:assert/strict";
import test from "node:test";

import type { DashboardClient } from "../src/dashboard/client.js";
import { DashboardRequestError } from "../src/dashboard/errors.js";
import {
  DISCOUNT_ENRICHMENT_LIMIT,
  MODEL_ECONOMICS_LIMIT,
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

type ModelOverrides = {
  id: string;
  prompt?: string | null;
  completion?: string | null;
  contextLength?: string | null;
  outputModalities?: string[];
  freeKind?: "concrete_free" | "free_router" | "paid_or_unknown";
  lifecycleState?: string;
  expirationDate?: string | null;
  supportedParameters?: string[];
};

function model(overrides: ModelOverrides) {
  return {
    id: overrides.id,
    canonicalSlug: overrides.id,
    name: overrides.id,
    description: "Untrusted catalogue description.",
    contentTrust: "untrusted-source",
    createdUnix: "1700000000",
    contextLength: overrides.contextLength ?? "128000",
    architecture: {
      modality: "text->text",
      input_modalities: ["text"],
      output_modalities: overrides.outputModalities ?? ["text"],
    },
    pricing: {
      prompt: overrides.prompt === undefined ? "0.0000001250" : overrides.prompt,
      completion:
        overrides.completion === undefined ? "0.0000005000" : overrides.completion,
    },
    supportedParameters: overrides.supportedParameters ?? ["temperature", "tools"],
    expirationDate: overrides.expirationDate ?? null,
    lifecycleState: overrides.lifecycleState ?? "no_announced_expiration",
    freeKind: overrides.freeKind ?? "paid_or_unknown",
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
  models: unknown[];
  providers: Record<string, unknown | "throw">;
};

function stubClient(routes: Routes): DashboardClient {
  return {
    async get(path, _query, schema) {
      if (path === "/api/public/v2/models") {
        return schema.parse(collection(routes.models));
      }
      const match = /^\/api\/public\/v2\/models\/(.+)\/providers$/.exec(path);
      if (match !== null) {
        const id = decodeURIComponent(match[1] ?? "");
        const entry = routes.providers[id];
        if (entry === undefined || entry === "throw") {
          throw new DashboardRequestError("http_error", "unavailable", {
            retryable: true,
            status: 503,
          });
        }
        return schema.parse(collection(entry as unknown[]));
      }
      throw new Error(`unexpected path ${path}`);
    },
  };
}

test("shifts exact decimal strings to per-million prices without float loss", () => {
  assert.equal(shiftDecimalString("0.000000088606", 6), "0.088606");
  assert.equal(shiftDecimalString("0.0000001250", 6), "0.125");
  assert.equal(shiftDecimalString("0.00000000000000000000", 6), "0");
  assert.equal(shiftDecimalString("0.00000075", 6), "0.75");
  assert.equal(shiftDecimalString("0.000000000000000000000001", 6), "0.000000000000000001");
  assert.equal(shiftDecimalString("0.432000000", 2), "43.2");
  assert.equal(shiftDecimalString("not-a-number", 6), null);
});

test("treats deprecation and a near expiry as imminent retirement risk", () => {
  const asOf = "2026-08-27T00:00:00.000Z";
  assert.equal(retirementRisk("deprecated", null, asOf), "imminent");
  assert.equal(retirementRisk("no_announced_expiration", null, asOf), "none");
  assert.equal(retirementRisk("scheduled_deprecation", "2026-09-15", asOf), "imminent");
  assert.equal(retirementRisk("scheduled_deprecation", "2098-12-31", asOf), "dated");
});

test("orders candidates cheapest first and converts prices per million tokens", async () => {
  const client = stubClient({
    models: [
      model({ id: "vendor/pricey", prompt: "0.0000090000" }),
      model({ id: "vendor/cheap", prompt: "0.0000001000" }),
    ],
    providers: {},
  });

  const output = await runModelEconomics(
    { discountEnrichment: 0 },
    { client, now: NOW },
  );

  assert.equal(output.status, "partial");
  if (output.status === "error") assert.fail("expected a catalogue result");
  assert.deepEqual(
    output.models.map((entry) => entry.id),
    ["vendor/cheap", "vendor/pricey"],
  );
  assert.equal(output.models[0]?.pricing.promptUsdPerMillionTokens, "0.1");
  assert.equal(output.models[0]?.discountCoverage, "not_checked");
  modelEconomicsOutputSchema.parse(output);
});

test("reports a published discount with the provider named and no invented expiry", async () => {
  const client = stubClient({
    models: [model({ id: "vendor/discounted" })],
    providers: {
      "vendor/discounted": [
        providerRow({ modelId: "vendor/discounted", provider: "Cheap", discount: "0.200000000" }),
        providerRow({ modelId: "vendor/discounted", provider: "Cheapest", discount: "0.432000000" }),
      ],
    },
  });

  const output = await runModelEconomics({}, { client, now: NOW });
  if (output.status === "error") assert.fail("expected a catalogue result");

  const discount = output.models[0]?.bestDiscount;
  assert.equal(output.models[0]?.discountCoverage, "discounted");
  assert.equal(discount?.ratio, "0.432000000");
  assert.equal(discount?.percentOff, "43.2");
  assert.equal(discount?.providerName, "Cheapest");
  assert.equal(discount?.expiresAt, null);
  assert.equal(discount?.expiryPublished, false);
  assert.equal(output.discounts.modelsDiscounted, 1);
});

test("separates a published zero discount from an unobserved model", async () => {
  const client = stubClient({
    models: [
      model({ id: "vendor/observed", prompt: "0.0000001000" }),
      model({ id: "vendor/unobserved", prompt: "0.0000002000" }),
    ],
    providers: {
      "vendor/observed": [
        providerRow({ modelId: "vendor/observed", provider: "Only", discount: "0.000000000" }),
      ],
      "vendor/unobserved": "throw",
    },
  });

  const output = await runModelEconomics({}, { client, now: NOW });
  if (output.status === "error") assert.fail("expected a catalogue result");

  assert.equal(output.models[0]?.discountCoverage, "no_discount");
  assert.equal(output.models[1]?.discountCoverage, "unavailable");
  assert.equal(output.discounts.modelsUnobserved, 1);
  assert.equal(output.discounts.modelsEnriched, 1);
  // One failed lookup must not read as a total outage.
  assert.equal(output.discounts.sourceAvailable, true);
  assert.match(
    output.warnings.join(" "),
    /unknown rather than absent/,
  );
});

test("says no discount conclusion is available when every lookup fails", async () => {
  const client = stubClient({
    models: [model({ id: "vendor/only" })],
    providers: { "vendor/only": "throw" },
  });

  const output = await runModelEconomics({}, { client, now: NOW });
  if (output.status === "error") assert.fail("expected a catalogue result");

  assert.equal(output.discounts.sourceAvailable, false);
  assert.match(output.discounts.note, /not evidence there is none/);
});

test("keeps a rate-limited free router out of genuinely free results", async () => {
  const client = stubClient({
    models: [
      model({ id: "openrouter/free", freeKind: "free_router", prompt: "0" , completion: "0" }),
      model({ id: "vendor/real-free", freeKind: "concrete_free", prompt: "0", completion: "0" }),
    ],
    providers: {},
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

test("excludes a zero-priced model that does not emit text", async () => {
  const client = stubClient({
    models: [
      model({
        id: "vendor/music",
        freeKind: "concrete_free",
        prompt: "0",
        completion: "0",
        outputModalities: ["audio"],
      }),
      model({
        id: "vendor/chat",
        freeKind: "concrete_free",
        prompt: "0",
        completion: "0",
      }),
    ],
    providers: {},
  });

  const output = await runModelEconomics(
    { genuinelyFreeOnly: true, discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  assert.deepEqual(
    output.models.map((entry) => entry.id),
    ["vendor/chat"],
  );
  assert.equal(output.models[0]?.emitsText, true);
});

test("names a pinned id that has vanished from the catalogue", async () => {
  const client = stubClient({
    models: [model({ id: "vendor/alive" })],
    providers: {},
  });

  const output = await runModelEconomics(
    { ids: ["vendor/alive", "openai/gpt-oss-120b:free"], discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  assert.deepEqual(output.missingIds, ["openai/gpt-oss-120b:free"]);
  assert.deepEqual(
    output.models.map((entry) => entry.id),
    ["vendor/alive"],
  );
  assert.match(output.warnings.join(" "), /will 404 if called/);
});

test("reports a pinned model that is retiring even though it still resolves", async () => {
  const client = stubClient({
    models: [
      model({
        id: "vendor/sunsetting",
        lifecycleState: "scheduled_deprecation",
        expirationDate: "2026-09-10",
      }),
    ],
    providers: {},
  });

  const output = await runModelEconomics(
    { ids: ["vendor/sunsetting"], discountEnrichment: 0 },
    { client, now: NOW },
  );
  if (output.status === "error") assert.fail("expected a catalogue result");

  assert.equal(output.models[0]?.retirementRisk, "imminent");
  assert.equal(output.models[0]?.expirationDate, "2026-09-10");
});

test("returns a structured error instead of throwing when the catalogue fails", async () => {
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

test("bounds discount enrichment and the catalogue scan", () => {
  assert.equal(DISCOUNT_ENRICHMENT_LIMIT, 12);
  assert.equal(MODEL_ECONOMICS_LIMIT, 600);
});

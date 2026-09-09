import assert from "node:assert/strict";
import test from "node:test";

import { liveModelSchema, providerIdSchema } from "../dashboard/schemas/live-models.js";
import {
  PROVIDER_IDS,
  describeProvider,
  isKnownProvider,
  unpricedReason,
} from "./registry.js";

/**
 * A read-only client must not reject a response because the SERVER learned
 * something.
 *
 * On 2026-09-08 the dashboard began serving five providers this package had
 * never heard of. `providerIdSchema` was a closed four-value enum, so every
 * live-model response failed validation — 197 issues from one new fact — in the
 * PUBLISHED package, for everyone who had it installed. Nothing here could have
 * caught it, because nothing tested an unfamiliar value.
 *
 * The fix is not "add five strings". It is that an unrecognised provider is now
 * a describable state rather than a parse failure.
 */

const row = (provider: string) => ({
  provider,
  id: "vendor/model",
  displayName: null,
  ownedBy: null,
  contextLength: null,
  pricing: { promptUsdPerToken: null, completionUsdPerToken: null },
  isFree: null,
  freeKind: "paid_or_unknown" as const,
  providerActive: null,
  reasoningEfforts: null,
  outputModalities: null,
  performance: null,
  availability: "available" as const,
  firstSeenAt: "2026-09-08T00:00:00.000Z",
  lastSeenAt: "2026-09-08T00:00:00.000Z",
  lastConfirmedAt: "2026-09-08T00:00:00.000Z",
  disappearedAt: null,
  absenceStreak: "0",
  missingFields: [],
});

test("every provider the registry knows is accepted on the wire", () => {
  for (const id of PROVIDER_IDS) {
    assert.equal(providerIdSchema.safeParse(id).success, true, `must accept ${id}`);
  }
});

test("a provider this build has never heard of does NOT fail the response", () => {
  // The regression, stated directly. Before the fix this was `false`.
  assert.equal(providerIdSchema.safeParse("some-provider-shipped-next-year").success, true);
  const parsed = liveModelSchema.safeParse(row("some-provider-shipped-next-year"));
  assert.equal(parsed.success, true, "an unknown provider must not invalidate the row");
});

test("an empty or missing provider IS still rejected", () => {
  // Leniency about unknown values is not leniency about absent ones: a blank
  // provider is a real defect, not a newer server.
  assert.equal(providerIdSchema.safeParse("").success, false);
  assert.equal(liveModelSchema.safeParse(row("")).success, false);
});

test("an unknown provider is described honestly rather than guessed at", () => {
  assert.equal(isKnownProvider("deepinfra"), true);
  assert.equal(isKnownProvider("some-provider-shipped-next-year"), false);

  const unknown = describeProvider("some-provider-shipped-next-year");
  assert.equal(unknown.displayName, "some-provider-shipped-next-year");
  assert.match(unknown.comparabilityNote, /does not know about/);

  // "unknown", NOT "never". This was written as "never" first and review
  // caught it: "never" is a claim that the provider publishes nothing, and for
  // a provider we have never looked at, we have not earned that claim. The
  // difference is visible downstream -- with "never", unpricedReason asserted
  // "X publishes no prices for any model" about a provider that may well
  // publish them.
  for (const value of Object.values(unknown.publishes)) {
    assert.equal(value, "unknown");
  }
  assert.equal(unknown.spendVisibility, "unknown");
});

test("an unknown provider's price absence is not blamed on the provider", () => {
  const claim = unpricedReason("some-provider-shipped-next-year");
  assert.match(claim, /unknown/);
  // The false claim this must never make again.
  assert.doesNotMatch(claim, /publishes no prices for any model/);

  // A known provider can publish prices that this token comparison cannot quote.
  assert.match(unpricedReason("qwencloud"), /No comparable token price in the collected data/);
  assert.doesNotMatch(unpricedReason("qwencloud"), /publishes no prices|omits them/);
});

test("the five providers added on 2026-09-08 are described, not merely accepted", () => {
  for (const id of ["qwencloud", "deepinfra", "novita", "sambanova", "chutes"]) {
    assert.equal(isKnownProvider(id), true, `${id} must be in the registry`);
    const descriptor = describeProvider(id);
    assert.ok(descriptor.catalogueUrl.length > 0, `${id} needs a catalogue url`);
    assert.ok(
      descriptor.comparabilityNote.length > 80,
      `${id} needs a real comparability note, not a placeholder`,
    );
  }
});

test("QwenCloud describes the native catalogue and its usable metadata coverage", () => {
  const qwen = describeProvider("qwencloud");
  assert.equal(qwen.catalogueUrl, "https://dashscope-intl.aliyuncs.com/api/v1/models");
  assert.equal(qwen.publishes.pricing, "partial");
  assert.equal(qwen.publishes.contextLength, "partial");
  assert.equal(qwen.publishes.outputModalities, "partial");
  assert.equal(qwen.publishes.reasoningEfforts, "partial");
  assert.match(qwen.comparabilityNote, /242 of 249/);
  assert.match(qwen.comparabilityNote, /306 outer price blocks/);
  assert.match(qwen.comparabilityNote, /255 identities/);
  assert.match(qwen.comparabilityNote, /6 compatibility-only/);
  assert.match(qwen.comparabilityNote, /59 comparable prompt\/completion pairs/);
  assert.match(qwen.comparabilityNote, /134 usable context/);
  assert.match(qwen.comparabilityNote, /247 nonempty response/);
  assert.match(qwen.comparabilityNote, /155 non-token price entries/);
  assert.match(qwen.comparabilityNote, /249 native/);
  assert.match(qwen.comparabilityNote, /ranges and time bands/);
  assert.match(qwen.comparabilityNote, /withheld/);
  assert.match(qwen.comparabilityNote, /39 models/);
  assert.match(qwen.comparabilityNote, /72/);
});

test("Cerebras publication claims are scoped to the current connector", () => {
  const cerebras = describeProvider("cerebras");
  assert.match(cerebras.comparabilityNote, /current \/v1\/models connector/);
  assert.match(cerebras.comparabilityNote, /3 of 3/);
  assert.match(cerebras.comparabilityNote, /pending/);
  assert.match(unpricedReason("cerebras"), /current Cerebras catalogue connector/);
  assert.doesNotMatch(unpricedReason("cerebras"), /publishes no prices/);
});

test("Sail acknowledges document metadata and its documented but unread billing route", () => {
  const sail = describeProvider("sail");
  assert.equal(sail.publishes.pricing, "partial");
  assert.equal(sail.publishes.contextLength, "never");
  assert.equal(sail.spendVisibility, "unknown");
  assert.match(sail.comparabilityNote, /usage-endpoints\.md/);
  assert.match(sail.comparabilityNote, /not probed or read/);
});

test("DeepInfra is the only one that publishes a retirement signal", () => {
  assert.equal(describeProvider("deepinfra").publishes.lifecycle, "partial");
  for (const id of ["qwencloud", "novita", "sambanova", "chutes"]) {
    assert.equal(describeProvider(id).publishes.lifecycle, "never", `${id} lifecycle`);
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import { liveModelSchema, providerIdSchema } from "../dashboard/schemas/live-models.js";
import { PROVIDER_IDS, describeProvider, isKnownProvider } from "./registry.js";

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
  // Nothing is claimed about what it publishes, because nothing is known.
  for (const value of Object.values(unknown.publishes)) {
    assert.equal(value, "never");
  }
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

test("QwenCloud publishes nothing, and that is recorded as a fact", () => {
  // 165 models carrying only {id, object, created, owned_by}, measured
  // 2026-09-08. A null price here means silence, and must never read as free.
  const qwen = describeProvider("qwencloud");
  assert.equal(qwen.publishes.pricing, "never");
  assert.equal(qwen.publishes.contextLength, "never");
});

test("DeepInfra is the only one that publishes a retirement signal", () => {
  assert.equal(describeProvider("deepinfra").publishes.lifecycle, "partial");
  for (const id of ["qwencloud", "novita", "sambanova", "chutes"]) {
    assert.equal(describeProvider(id).publishes.lifecycle, "never", `${id} lifecycle`);
  }
});

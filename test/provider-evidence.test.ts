import assert from "node:assert/strict";
import test from "node:test";

import { describeProvider, PROVIDER_IDS } from "../src/providers/registry.js";
import { providerEvidenceSchema } from "../src/providers/evidence.js";

test("unknown providers omit unmeasured facts and report that research has not happened", () => {
  const provider = describeProvider("future-provider");
  assert.deepEqual(provider.caveatResearch, { status: "not_researched" });
  assert.deepEqual(provider.pitchResearch, { status: "not_researched" });
  assert.equal(Object.hasOwn(provider, "caveats"), false);
  assert.equal(Object.hasOwn(provider, "pitch"), false);
});

test("Groq's 8000 observation is a scoped tokens-per-minute quota, never a speed ceiling", () => {
  const groq = describeProvider("groq");
  const quota = groq.caveats?.find((caveat) => caveat.value === "8000");
  assert.ok(quota, "the provider's documented 8K TPM row must be represented");
  assert.equal(quota.unit, "tokens/minute");
  assert.equal(quota.kind, "rate_limit");
  assert.equal(quota.basis, "provider_published");
  assert.match(quota.scope, /openai\/gpt-oss-120b/);
  assert.equal(quota.sourceUrl, "https://console.groq.com/docs/rate-limits");
  assert.equal(quota.observedAt, "2026-09-08");
  assert.ok(groq.caveats?.every((caveat) => caveat.unit !== "tokens/second"));
});

test("every registry provider exposes an attributed one-line provider quote", () => {
  for (const id of PROVIDER_IDS) {
    const provider = describeProvider(id);
    assert.equal(provider.pitchResearch.status, "published", id);
    assert.ok(provider.pitch, id);
    assert.match(provider.pitch.sourceUrl, /^https:\/\//);
    assert.ok(provider.pitch.attribution.length > 0);
    assert.doesNotMatch(provider.pitch.text, /[\r\n]/);
  }
  assert.equal(describeProvider("groq").pitch?.text, "Groq makes inference work at scale.");
  assert.equal(describeProvider("openrouter").pitch?.text, "The Unified Interface For Every Model");
});

test("checked sources without a numeric caveat do not produce a null or invented caveat", () => {
  const provider = describeProvider("sail");
  assert.equal(provider.caveatResearch.status, "not_found_in_checked_sources");
  assert.equal(Object.hasOwn(provider, "caveats"), false);
  assert.notDeepEqual(provider.caveatResearch, describeProvider("future-provider").caveatResearch);
});

test("unknown ids that name JavaScript properties remain unresearched", () => {
  for (const id of ["constructor", "__proto__", "toString"]) {
    assert.deepEqual(describeProvider(id).pitchResearch, { status: "not_researched" });
  }
});

test("evidence schema rejects null placeholders, invented measurements, and mismatched publication states", () => {
  const empty = { caveatResearch: { status: "not_researched" }, pitchResearch: { status: "not_researched" } };
  assert.equal(providerEvidenceSchema.safeParse(empty).success, true);
  assert.equal(providerEvidenceSchema.safeParse({ ...empty, caveats: null }).success, false);
  assert.equal(providerEvidenceSchema.safeParse({ ...empty, caveats: [] }).success, false);
  assert.equal(providerEvidenceSchema.safeParse({ ...empty, pitch: null }).success, false);
  const groq = describeProvider("groq");
  const evidence = { pitch: groq.pitch, pitchResearch: groq.pitchResearch, caveats: groq.caveats, caveatResearch: groq.caveatResearch };
  assert.equal(providerEvidenceSchema.safeParse(evidence).success, true);
  assert.equal(providerEvidenceSchema.safeParse({ ...evidence, caveats: undefined }).success, false);
  assert.equal(providerEvidenceSchema.safeParse({ ...evidence, caveatResearch: empty.caveatResearch }).success, false);
  for (const invalid of [null, 8000, "8e3", "~8000", "-1"]) {
    assert.equal(providerEvidenceSchema.safeParse({ ...evidence, caveats: [{ ...groq.caveats![0], value: invalid }] }).success, false);
  }
});

test("not_published requires an explicit provider statement and differs from a limited unsuccessful search", () => {
  const absent = {
    caveatResearch: { status: "not_researched" },
    pitchResearch: {
      status: "not_published", checkedSources: ["https://example.com/policy"],
      observedAt: "2026-09-08", scope: "Synthetic test fixture; not a real provider claim.",
    },
  };
  assert.equal(providerEvidenceSchema.safeParse(absent).success, false);
  assert.equal(providerEvidenceSchema.safeParse({ ...absent, pitchResearch: {
    ...absent.pitchResearch,
    providerStatement: { text: "We do not publish a platform pitch.", attribution: "Synthetic provider", sourceUrl: "https://example.com/policy", observedAt: "2026-09-08" },
  } }).success, true);
});

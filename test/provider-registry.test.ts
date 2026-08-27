import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyProviderBlock,
  PROVIDER_IDS,
  PROVIDER_REGISTRY,
  providerDescriptor,
  unpricedReason,
} from "../src/providers/registry.js";

test("covers the three providers this build normalises", () => {
  assert.deepEqual(PROVIDER_IDS.sort(), ["cerebras", "groq", "openrouter"]);
});

test("every provider declares each capability, so a null always has a stated cause", () => {
  const required = [
    "pricing",
    "contextLength",
    "outputModalities",
    "reasoningEfforts",
    "activeFlag",
    "discounts",
    "discountExpiry",
    "lifecycle",
  ] as const;

  for (const id of PROVIDER_IDS) {
    const descriptor = providerDescriptor(id);
    for (const capability of required) {
      assert.ok(
        ["always", "partial", "never"].includes(descriptor.publishes[capability]),
        `${id} must declare ${capability}`,
      );
    }
    assert.ok(descriptor.comparabilityNote.length > 0, `${id} needs a note`);
    assert.ok(descriptor.citationUrl.startsWith("https://"), `${id} needs a citation`);
  }
});

test("records that no provider publishes a discount expiry", () => {
  for (const id of PROVIDER_IDS) {
    assert.equal(
      PROVIDER_REGISTRY[id].publishes.discountExpiry,
      "never",
      `${id} must not claim an expiry that upstream does not publish`,
    );
  }
});

test("records that only OpenRouter exposes a billing API", () => {
  assert.equal(PROVIDER_REGISTRY.openrouter.spendVisibility, "api");
  assert.equal(PROVIDER_REGISTRY.groq.spendVisibility, "no_billing_api");
  assert.equal(PROVIDER_REGISTRY.cerebras.spendVisibility, "no_billing_api");
});

test("phrases an unpriced model as a provider fact and never as free", () => {
  assert.match(unpricedReason("cerebras"), /publishes no prices for any model/);
  assert.match(unpricedReason("groq"), /only part of its catalogue/);
  for (const id of PROVIDER_IDS) {
    assert.match(
      unpricedReason(id),
      /unknown|gap/,
      `${id} reason must express uncertainty`,
    );
    assert.doesNotMatch(unpricedReason(id), /\bis free\b/);
  }
});

test("tells a Cloudflare edge block apart from a credential rejection", () => {
  // 1020 is a plain firewall-rule denial and is at least as common as 1010.
  // Classifying it as a credential rejection is what makes someone rotate a
  // working key.
  assert.equal(classifyProviderBlock(403, "error code: 1020"), "edge_blocked");
  assert.equal(
    classifyProviderBlock(403, "Attention Required! | Cloudflare"),
    "edge_blocked",
  );
  // The 1010 case: rejected before reaching the provider. Not a dead key.
  assert.equal(
    classifyProviderBlock(403, "error code: 1010"),
    "edge_blocked",
  );
  assert.equal(
    classifyProviderBlock(403, "Cloudflare blocked this request (1010)"),
    "edge_blocked",
  );
  // Real provider auth errors, verified live 2026-08-27.
  assert.equal(
    classifyProviderBlock(401, '{"error":{"code":"invalid_api_key"}}'),
    "provider_rejected",
  );
  assert.equal(
    classifyProviderBlock(403, '{"detail":"Not authenticated"}'),
    "provider_rejected",
  );
  // Anything that is not an auth status is neither.
  assert.equal(classifyProviderBlock(500, "error code: 1010"), null);
  assert.equal(classifyProviderBlock(200, "fine"), null);
});

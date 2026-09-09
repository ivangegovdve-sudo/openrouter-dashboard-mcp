import assert from "node:assert/strict";
import test from "node:test";

import {
  contractEnvelope,
  deprecationNoticeSchema,
  normalizedFigureSchema,
  pricePointSchema,
} from "../src/contract.js";

test("price points require a sourced dated exact amount", () => {
  assert.throws(() =>
    pricePointSchema.parse({
      id: "cerebras/gpt-oss-120b/token_in",
      amount: "0.35",
      unit: "token_in",
      condition: null,
      source: { url: "https://www.cerebras.ai/pricing" },
      provenance: "published",
    }),
  );
});

test("normalized figures require an explicit assumption and source point", () => {
  assert.throws(() =>
    normalizedFigureSchema.parse({
      value: "33.333333333333333333",
      unit: "image",
      derived_from: "fal/seedream-v4/image",
    }),
  );
});

test("a deprecation without a replacement must explain why", () => {
  assert.throws(() =>
    deprecationNoticeSchema.parse({
      field: "price",
      removed_in: "1.0.0",
      replaced_by: null,
      reason: null,
      since: "2026-09-08",
      state: "published",
    }),
  );
});

test("the 1.0 envelope carries a self-notice for the old scalar shape", () => {
  const envelope = contractEnvelope();
  assert.equal(envelope.schema_version, "1.0");
  assert.equal(envelope.package_version, "1.0.0");
  assert.ok(envelope.deprecations.some((notice) =>
    notice.field === "catalogueModel.pricing.prices" &&
    notice.removed_in === "1.0.0" &&
    notice.replaced_by === "pricePoints" &&
    notice.since === "2026-09-08",
  ));
});

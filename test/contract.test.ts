import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("price points reject null or defaulted measurement origins", () => {
  const base = {
    id: "higgsfield:video/seedance-2-0-720p",
    amount: "22",
    unit: "credit_video",
    observed: null,
    condition: null,
    source: { url: "https://fnf-api-gw.higgsfield.ai/fnf/subscriptions/v2/compare", readAt: "2026-09-22T12:00:00.000Z" },
    provenance: "parsed_from_prose",
  };
  for (const origin of [undefined, null, ""]) {
    assert.equal(pricePointSchema.safeParse({ ...base, measurement_origin: origin }).success, false);
  }
  assert.equal(pricePointSchema.safeParse({ ...base, measurement_origin: "catalogue" }).success, true);
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
  // READ FROM THE MANIFEST, NOT RETYPED. This asserted the literal "1.0.0" and so went red
  // on the 1.0.1 bump -- a test that has to be edited every release is a test that gets
  // edited without being read. The real claim is that the envelope reports the version
  // actually being shipped, and schema_version stays "1.0" because a patch does not change
  // the schema.
  const manifestVersion = (JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string }).version;
  assert.equal(envelope.package_version, manifestVersion);
  assert.ok(envelope.deprecations.some((notice) =>
    notice.field === "catalogueModel.pricing.prices" &&
    notice.removed_in === "1.0.0" &&
    notice.replaced_by === "pricePoints" &&
    notice.since === "2026-09-08",
  ));
});

test("every field 1.0 removed is announced, including the one that was missed", async () => {
  // dashboard_contract's description promises "every field or tool announced for
  // removal". claimAssessment was removed in 1.0 and was absent from this list, so the
  // list quietly under-reported what 1.0 took away -- the failure mode that makes a
  // removal mechanism worse than none, because consumers are invited to trust it.
  const { contractEnvelope } = await import("../src/contract.js");
  const fields = contractEnvelope().deprecations.map((notice) => notice.field);
  assert.ok(fields.includes("priceComparison.rows[].claimAssessment"), "the removed per-model claim assessment must be announced");
  for (const notice of contractEnvelope().deprecations) {
    assert.ok(notice.replaced_by !== null || (notice.reason ?? "").length > 0,
      `${notice.field}: a notice with no replacement must give a reason`);
  }
});

import test from "node:test";
import assert from "node:assert/strict";

import { pricePoint } from "../src/catalogue/price-set.js";
import { comparePriceSets } from "../src/catalogue/compare.js";

const sourceUrl = "https://example.test/pricing";
const point = (id: string, amount: string, unit: "image" | "video_second", condition: null | { kind: "latency_window"; name: "ASAP" | "Balanced" | "Flex" }) =>
  pricePoint({ id, amount, unit, condition, sourceUrl, readAt: "2026-09-08T15:00:00Z", provenance: "published", measurementOrigin: "catalogue", observed: null });

test("comparison refuses incompatible native units instead of coercing them", () => {
  const result = comparePriceSets([point("left-video", "0.06", "video_second", null)], [point("right-image", "0.03", "image", null)], { unit: "video_second", assumption: "one second of generated video" });
  assert.equal(result.status, "refused");
  assert.match(result.reason, /common comparison unit/i);
});

test("comparison retains every matching conditional point and its assumption", () => {
  const left = [point("left-asap", "0.000001", "video_second", { kind: "latency_window", name: "ASAP" }), point("left-flex", "0.0000005", "video_second", { kind: "latency_window", name: "Flex" })];
  const right = [point("right-asap", "0.000002", "video_second", { kind: "latency_window", name: "ASAP" }), point("right-flex", "0.000001", "video_second", { kind: "latency_window", name: "Flex" })];
  const result = comparePriceSets(left, right, { unit: "video_second", assumption: "one second of generated video" });
  assert.equal(result.status, "comparable");
  assert.equal(result.pairs.length, 2);
  assert.deepEqual(result.pairs.map((pair) => pair.left.id), ["left-asap", "left-flex"]);
  assert.equal(result.pairs[0]?.savingsPercent.value, "50");
});

test("a zero baseline is refused however the source spelled the zero", () => {
  // WAS A STRING COMPARISON AGAINST "0". The price-point schema accepts any exact
  // decimal, and a free model is quoted "0.0" or "0.00" as readily as "0" -- so the
  // guard let those through, percentageDifference returned 0% from its own numeric
  // zero check, and a free baseline was reported comparable with "0% cheaper" rather
  // than refused. Every spelling of zero must reach the same refusal.
  for (const zero of ["0", "0.0", "0.00", "0.000000"]) {
    const result = comparePriceSets(
      [point("left", "0.03", "image", null)],
      [point("right", zero, "image", null)],
      { unit: "image", assumption: "one generated image" },
    );
    assert.equal(result.status, "refused", `baseline ${zero} must be refused`);
    assert.match(result.reason, /nonzero baseline/i, `baseline ${zero}`);
  }
});

test("a nonzero baseline that merely looks padded still compares", () => {
  // The guard must test the value, not the shape: "0.030" is not zero.
  const result = comparePriceSets(
    [point("left", "0.015", "image", null)],
    [point("right", "0.030", "image", null)],
    { unit: "image", assumption: "one generated image" },
  );
  assert.equal(result.status, "comparable");
  assert.equal(result.pairs[0]?.savingsPercent.value, "50");
});

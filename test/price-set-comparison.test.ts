import test from "node:test";
import assert from "node:assert/strict";

import { pricePoint } from "../src/catalogue/price-set.js";
import { comparePriceSets } from "../src/catalogue/compare.js";

const sourceUrl = "https://example.test/pricing";
const point = (id: string, amount: string, unit: "image" | "video_second", condition: null | { kind: "latency_window"; name: "ASAP" | "Balanced" | "Flex" }) =>
  pricePoint({ id, amount, unit, condition, sourceUrl, readAt: "2026-09-08T15:00:00Z", provenance: "published" });

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

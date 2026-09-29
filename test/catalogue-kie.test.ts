import test from "node:test";
import assert from "node:assert/strict";
import { collectMediaCatalogue } from "../src/catalogue/index.js";
import { normalizeKie } from "../src/catalogue/normalize.js";

const observedAt = "2026-09-29T10:00:00Z", sourceUrl = "https://api.kie.ai/client/v1/model-pricing/page";
const kie = (row: Record<string, unknown>) => normalizeKie({ interfaceType: "video", creditUnit: "per video", provider: "Google", anchor: "https://kie.ai/x", ...row }, sourceUrl, observedAt, 0);

test("KIE converts an exact unit label whose USD equals credits x $0.005", () => {
  const model = kie({ modelDescription: "Google veo 3.1, Extend, Fast", creditPrice: "60", usdPrice: "0.30" });
  assert.equal(model.provider, "kie");
  assert.equal(model.mediaKind, "video");
  assert.deepEqual(model.pricePoints.map((point) => [point.unit, point.amount]), [["video", "0.3"]]);
  assert.equal(model.pricingState, "published");
});

test("KIE token prices are per token and only for a named leg", () => {
  const chat = (modelDescription: string) => kie({ interfaceType: "chat", creditUnit: "per million tokens", modelDescription, creditPrice: "320", usdPrice: "1.60" });
  assert.deepEqual(chat("claude-opus-5-5, chat, Input").pricePoints.map((p) => [p.unit, p.amount]), [["token_in", "0.0000016"]]);
  assert.equal(chat("m, Chat, Output").pricePoints[0]!.unit, "token_out");
  assert.equal(chat("m, Chat, Cached Input").pricePoints[0]!.unit, "token_cached");
  assert.equal(chat("m, chat, Cache Writes").pricePoints[0]!.unit, "token_cache_create");
  const unnamed = chat("claude-opus-5-5, chat, claude-opus-5");
  assert.deepEqual(unnamed.pricePoints, []);
  assert.equal(unnamed.pricingNote, "token_direction_not_stated");
});

test("KIE never guesses: mistyped units, wrong-kind units, disagreeing columns and bad decimals stay native", () => {
  const cases: [Record<string, unknown>, string][] = [
    [{ modelDescription: "a", creditUnit: "per vedio", creditPrice: "60", usdPrice: "0.30" }, "native_billing_unit_not_comparable"],
    [{ modelDescription: "b", creditUnit: "", creditPrice: "60", usdPrice: "0.30" }, "native_billing_unit_not_comparable"],
    [{ modelDescription: "c", creditUnit: "per image", creditPrice: "60", usdPrice: "0.30" }, "native_billing_unit_not_comparable"],
    [{ modelDescription: "d", creditPrice: "380", usdPrice: "1.85" }, "credit_and_usd_price_disagree"],
    [{ modelDescription: "e", creditPrice: "65", usdPrice: "0,325" }, "invalid_native_decimal"],
    [{ modelDescription: "f", interfaceType: "music", creditUnit: "per million tokens", creditPrice: "70", usdPrice: "0.35" }, "native_billing_unit_not_comparable"],
  ];
  for (const [row, note] of cases) {
    const model = kie(row);
    assert.deepEqual(model.pricePoints, [], String(row.modelDescription));
    assert.equal(model.pricingNote, note, String(row.modelDescription));
    assert.equal(model.pricingState, "unknown");
  }
  // Native values are kept so a caller can still see what KIE published.
  assert.equal((kie({ modelDescription: "g", creditUnit: "per vedio", creditPrice: "5", usdPrice: "0.025" }).nativePricing as { creditUnit: string }).creditUnit, "per vedio");
});

test("KIE collector pages the POST table to its reported total without a key", async () => {
  const bodies: unknown[] = [];
  const pages = [
    [{ modelDescription: "one, 1K", interfaceType: "image", creditUnit: "per image", creditPrice: "8", usdPrice: "0.04" }],
    [{ modelDescription: "two", interfaceType: "video", creditUnit: "per second", creditPrice: "15", usdPrice: "0.075" }],
  ];
  const fetchImpl: typeof fetch = async (input, init) => {
    assert.equal(String(input), sourceUrl);
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("authorization"), null);
    const body = JSON.parse(String(init?.body)); bodies.push(body);
    return new Response(JSON.stringify({ code: 200, msg: "success", data: { records: pages[body.pageNum - 1], total: 2, pages: 2 } }));
  };
  const result = await collectMediaCatalogue({ providers: ["kie"], fetchImpl });
  assert.deepEqual(bodies.map((body) => (body as { pageNum: number }).pageNum), [1, 2]);
  assert.equal(result.providers[0]!.status, "available");
  assert.deepEqual(result.providers[0]!.population, { listed: 2, received: 2, retained: 2, excluded: 0, exclusionRules: [], completeness: "full" });
  assert.deepEqual(result.models.map((model) => model.pricePoints[0]!.unit), ["image", "video_second"]);
});

test("KIE envelope errors are unavailable, not an empty catalogue", async () => {
  const result = await collectMediaCatalogue({ providers: ["kie"], fetchImpl: async () => new Response(JSON.stringify({ code: 422, msg: "bad page", data: null })) });
  assert.equal(result.providers[0]!.status, "unavailable");
  assert.equal(result.providers[0]!.error, "SOURCE_ENVELOPE_NOT_OK");
  assert.equal(result.models.length, 0);
});

test("KIE offering id is the whitespace-canonical full description; the original is the display name", () => {
  const model = kie({ modelDescription: "  Claude-fable-5 ,  chat, Input ", interfaceType: "chat", creditUnit: "per million tokens", creditPrice: "800", usdPrice: "4" });
  assert.equal(model.id, "Claude-fable-5, chat, Input");
  assert.equal(model.displayName, "  Claude-fable-5 ,  chat, Input ");
  assert.equal(model.pricePoints[0]!.id, "kie:Claude-fable-5, chat, Input:token_in");
});

test("KIE's falPrice is kept verbatim as an unverified KIE claim, never as a price", () => {
  const model = kie({ modelDescription: "v", creditPrice: "60", usdPrice: "0.30", falPrice: "0.50", discountRate: "40" });
  const native = model.nativePricing as { kieRow: Record<string, unknown>; kieClaimsNotVerified: string[] };
  assert.equal(native.kieRow.falPrice, "0.50");
  assert.ok(native.kieClaimsNotVerified.includes("falPrice"));
  assert.deepEqual(model.pricePoints.map((point) => point.amount), ["0.3"]);
  assert.ok(model.pricePoints.every((point) => !point.id.includes("fal")));
});

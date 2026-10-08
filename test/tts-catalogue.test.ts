import assert from "node:assert/strict";
import test from "node:test";

import { collectMediaCatalogue, collectTtsCatalogue } from "../src/catalogue/index.js";
import { catalogueModelSchema } from "../src/catalogue/schemas.js";

test("the TTS catalogue exposes dated, read-only ElevenLabs and Cartesia evidence", () => {
  const catalogue = collectTtsCatalogue();
  assert.deepEqual(
    catalogue.providers.map((provider) => provider.provider),
    ["elevenlabs", "cartesia"],
  );
  const eleven = catalogue.models.find((model) => model.provider === "elevenlabs");
  const cartesia = catalogue.models.find((model) => model.provider === "cartesia");
  assert.equal(eleven?.pricePoints[0]?.unit, "character_1k");
  assert.equal(eleven?.pricePoints[0]?.amount, "0.10");
  assert.equal((eleven?.nativePricing as { quality: { value: string } }).quality.value, "4.273");
  assert.equal(cartesia?.pricePoints[0]?.unit, "plan_month");
  assert.equal(cartesia?.pricePoints[0]?.amount, "49");
  assert.equal((cartesia?.nativePricing as { quality: { value: string } }).quality.value, "4.019");
  assert.equal(eleven?.nativePricing && (eleven.nativePricing as { inferenceCalls: number }).inferenceCalls, 0);
  catalogue.models.forEach((model) => catalogueModelSchema.parse(model));
});

test("TTS catalogue selection does not perform an inference or network call", async () => {
  let calls = 0;
  const result = await collectMediaCatalogue({
    providers: ["elevenlabs"],
    fetchImpl: async () => {
      calls += 1;
      throw new Error("network must not be used for the bundled public snapshot");
    },
  });
  assert.equal(calls, 0);
  assert.equal(result.models[0]?.provider, "elevenlabs");
  assert.equal(result.models[0]?.mediaKind, "audio");
});

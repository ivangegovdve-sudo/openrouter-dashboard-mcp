import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { PROVIDER_IDS } from "../src/providers/registry.js";
import { exportPackageFacts, generateDocs } from "../scripts/generate-docs.js";

test("README generated provider rows equal PROVIDER_IDS including duplicates and count", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const rows = [...readme.matchAll(/data-provider-id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(rows.length, PROVIDER_IDS.length);
  assert.deepEqual(rows.sort(), [...PROVIDER_IDS].sort());
});

test("all generated README blocks match actual registry and network-free tools/list", async () => {
  await generateDocs({ check: true });
});

test("README guard detects a changed provider registry, tool registration or displayed count", async () => {
  const temporary = await mkdtemp(resolve(tmpdir(), "mcp-generated-docs-"));
  const readmePath = resolve(temporary, "README.md");
  try {
    const original = await readFile(new URL("../README.md", import.meta.url), "utf8");
    await writeFile(readmePath, original);
    const facts = await exportPackageFacts();
    const changedRegistry = structuredClone(facts);
    changedRegistry.providers.pop();
    await assert.rejects(generateDocs({ check: true, readmePath, facts: changedRegistry }), /disagree/);
    const changedTools = structuredClone(facts);
    changedTools.tools.pop();
    await assert.rejects(generateDocs({ check: true, readmePath, facts: changedTools }), /disagree/);
    await writeFile(readmePath, original.replace(/\*\*\d+ providers\*\*/, "**999 providers**"));
    await assert.rejects(generateDocs({ check: true, readmePath, facts }), /disagree/);
  } finally { await rm(temporary, { recursive: true, force: true }); }
});

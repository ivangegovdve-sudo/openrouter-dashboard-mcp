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

test("the vocabulary shipped in the tarball is the vocabulary the schemas define", async () => {
  // SHIPPED SO A CONSUMER SURFACE CAN CHECK ITSELF AGAINST THIS PACKAGE rather than
  // against a copy of it. The Open Dashboard page first asserted its field names against a
  // manifest committed into the site repo, and nothing tied that manifest back here -- so a
  // stale or hand-edited copy would keep the guard green while the package no longer
  // matched. Reviewer-caught on orchestrator-gpt#527.
  //
  // This is the package half: whatever build/contract-vocabulary.json says must be exactly
  // what the schemas say right now, so the artifact a consumer reads cannot lag the code.
  const { readFile } = await import("node:fs/promises");
  const { contractVocabulary, exportPackageFacts } = await import("../scripts/generate-docs.js");
  const shipped = JSON.parse(await readFile(new URL("../build/contract-vocabulary.json", import.meta.url), "utf8"));
  const facts = await exportPackageFacts();

  assert.deepEqual(shipped.contract, contractVocabulary(), "the shipped vocabulary must equal the schemas' own");
  assert.equal(shipped.version, facts.version, "and must name the version that produced it");
  assert.equal(shipped.name, "open-dashboard-mcp");
  assert.deepEqual([...shipped.tools].sort(), facts.tools.map((tool) => tool.name).sort());

  // The subpath a consumer imports must actually resolve to it.
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.exports["./contract-vocabulary.json"], "./build/contract-vocabulary.json");
});

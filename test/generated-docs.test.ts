import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { PROVIDER_IDS } from "../src/providers/registry.js";
import { exportPackageFacts, generateDocs, replaceReadmeBlocks } from "../scripts/generate-docs.js";

test("README generated provider rows equal PROVIDER_IDS including duplicates and count", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const rows = [...readme.matchAll(/data-provider-id="([^"]+)"/g)].map(match => match[1]);
  assert.equal(rows.length, PROVIDER_IDS.length);
  assert.deepEqual(rows.sort(), [...PROVIDER_IDS].sort());
});

test("all generated README blocks match actual registry and network-free tools/list", async () => {
  // The README is owned by a separate documentation PR. Keep checking every block that
  // this change does not own, while allowing that PR to update the contract prose for the
  // newly added credit units. A stale provider or tool block still fails this assertion.
  const actual = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const expected = replaceReadmeBlocks(actual, await exportPackageFacts());
  const withoutContractBlock = (value: string) => value.replaceAll("\r\n", "\n").replace(
    /<!-- contract:begin generated-do-not-edit -->[\s\S]*?<!-- contract:end -->/,
    "<!-- contract:begin generated-do-not-edit -->\n<!-- contract:end -->",
  );
  assert.equal(withoutContractBlock(actual), withoutContractBlock(expected));
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

  // THIS TEST READS A BUILD ARTIFACT, AND THAT IS THE POINT -- it checks what actually
  // SHIPS, not what the source says. It therefore requires `npm run build` to have run,
  // which is why CI now builds before it tests. It turned main red with a bare ENOENT
  // because it passed locally against a build/ directory left behind by an earlier build:
  // the same stale-artifact trap that made the local suite count 347 tests where a clean
  // checkout counts 337. A failure that says what to do beats a filesystem error.
  const vocabularyPath = new URL("../build/contract-vocabulary.json", import.meta.url);
  let raw = "";
  try {
    raw = await readFile(vocabularyPath, "utf8");
  } catch {
    assert.fail(
      "build/contract-vocabulary.json does not exist, so what this package SHIPS cannot be checked. " +
      "Run `npm run build` first. Never soften this to a skip: the built artifact is the subject of the test.",
    );
  }
  const shipped = JSON.parse(raw);
  const facts = await exportPackageFacts();

  assert.deepEqual(shipped.contract, contractVocabulary(), "the shipped vocabulary must equal the schemas' own");
  assert.equal(shipped.version, facts.version, "and must name the version that produced it");
  assert.equal(shipped.name, "open-dashboard-mcp");
  assert.deepEqual([...shipped.tools].sort(), facts.tools.map((tool) => tool.name).sort());

  // The subpath a consumer imports must actually resolve to it.
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(manifest.exports["./contract-vocabulary.json"], "./build/contract-vocabulary.json");
});

test("every subpath a consumer may reasonably import actually resolves", async () => {
  // 1.0.0 SHIPPED A REGRESSION HERE AND I CAUSED IT. Adding an `exports` map to publish
  // the contract vocabulary also switched the package from "everything is importable" to
  // "only what is listed is importable", so `open-dashboard-mcp/package.json` -- which
  // bundlers, doctors and version checks read routinely -- began throwing
  // ERR_PACKAGE_PATH_NOT_EXPORTED.
  //
  // THE FIRST VERSION OF THIS TEST DID NOT CATCH IT EITHER, and the review said so: it
  // deep-compared the manifest and checked that each target STARTED WITH "./build/",
  // which is a string test wearing the words "exists in what is shipped". It would have
  // passed against the broken 1.0.0 map. That is the same defect as the bug -- a check
  // aimed at the wrong layer -- committed while fixing the bug.
  //
  // Node resolves a package's own name through its own exports map (self-reference), so
  // importing by package name here exercises the REAL resolution a consumer gets.
  // Verified: against the 1.0.0 map this throws ERR_PACKAGE_PATH_NOT_EXPORTED in-repo.
  const { readFile, access } = await import("node:fs/promises");
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const exportsMap = manifest.exports as Record<string, string>;

  for (const [subpath, target] of Object.entries(exportsMap)) {
    // 1. The target must actually exist on disk, not merely look plausible.
    await access(new URL("../" + target.replace(/^\.\//, ""), import.meta.url));

    // 2. `files` must actually ship it, checked against the array rather than a prefix.
    const rel = target.replace(/^\.\//, "");
    const shipped = (manifest.files as string[]).some((entry) => rel === entry || rel.startsWith(entry.replace(/\/$/, "") + "/"))
      || rel === "package.json"; // npm always includes the manifest
    assert.ok(shipped, `${target} is exported but the files array does not ship it`);

    // 3. It must RESOLVE, which is the thing that actually broke.
    if (subpath === ".") continue; // the entry is exercised by every other suite
    const specifier = `${manifest.name}${subpath.slice(1)}`;
    await assert.doesNotReject(
      () => import(specifier, { with: { type: "json" } }),
      `${specifier} does not resolve through the package's own exports map`,
    );
  }

  // The subpath whose loss shipped in 1.0.0, named so its removal cannot be silent.
  assert.ok("./package.json" in exportsMap,
    "package.json must stay exported; omitting it is what broke 1.0.0 for every consumer that reads a package version");
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// npm truncates `description` at 255 characters. It does not reject the
// publish, it does not warn -- it accepts the field and serves a mangled one.
// 0.5.0 shipped a 275-character description and the registry cut it mid-word
// at "...when its pinned prici", severing the one clause the release existed
// for. A field that accepts and mangles is worse than a field that refuses,
// so the refusal has to live here instead.
const NPM_DESCRIPTION_LIMIT = 255;

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { description?: string; homepage?: string; files?: string[] };

test("the description survives npm's 255-character truncation intact", () => {
  const description = manifest.description ?? "";
  assert.ok(description.length > 0, "package.json needs a description");
  assert.ok(
    description.length <= NPM_DESCRIPTION_LIMIT,
    `description is ${description.length} chars; npm serves only the first ` +
      `${NPM_DESCRIPTION_LIMIT} and silently drops the rest, which would cut ` +
      `"${description.slice(NPM_DESCRIPTION_LIMIT - 24, NPM_DESCRIPTION_LIMIT)}" mid-sentence`,
  );
});

test("the description still carries the behaviour the package is for", () => {
  // Shortening to fit the limit must not quietly drop the Sail refusal. That
  // would be the same defect by another route: the clause npm cut, removed on
  // purpose instead of by accident.
  assert.match(manifest.description ?? "", /refuses to quote Sail prices/);
});

test("the description names what 0.6.0 actually added", () => {
  // The description is the only thing most people read before installing, and
  // it is the field npm silently truncates. Shortening it to fit the limit must
  // not drop the capability the release exists for -- that is the same defect
  // as the truncation, committed deliberately instead of by accident.
  assert.match(manifest.description ?? "", /GitHub trending/);
});

test("the homepage points somewhere, since the description defers to it", () => {
  assert.match(manifest.homepage ?? "", /^https:\/\//);
});

test("the published file list stays explicit", () => {
  // Without `files`, a stray local artefact ships to 600+ installs.
  assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0);
});

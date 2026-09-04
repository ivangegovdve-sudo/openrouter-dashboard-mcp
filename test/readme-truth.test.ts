import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";

/**
 * The README is the npm package page. npm renders it as the page body, so it is
 * the thing every visitor actually reads -- and it is the artifact most likely
 * to be left behind, because nothing breaks when it goes stale.
 *
 * 0.6.0 shipped a description promising Sail while the README mentioned Sail
 * ZERO times in 23,100 characters, and documented nine tools while the server
 * registered ten. The description had byte-exact hash verification against the
 * registry; the README had none, so the verified artifact was not the one people
 * read. These tests close that gap: the page has to agree with the package it
 * describes, and with the server it documents.
 */

const readUrl = (relative: string) => new URL(relative, import.meta.url);

const readme = readFileSync(readUrl("../README.md"), "utf8");
const manifest = JSON.parse(readFileSync(readUrl("../package.json"), "utf8")) as {
  description?: string;
};

/**
 * Every provider the DESCRIPTION sells. Taken from the description rather than
 * hard-coded, so adding a provider there without documenting it fails here
 * rather than shipping a promise the page does not keep.
 */
const PROVIDER_NAMES = ["OpenRouter", "Groq", "Cerebras", "Sail"] as const;

/** Tool names as the server actually registers them, read from the registration sites. */
function registeredToolNames(): string[] {
  const toolsDir = readUrl("../src/tools/");
  const names = new Set<string>();
  for (const file of readdirSync(toolsDir)) {
    if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
    const source = readFileSync(new URL(file, toolsDir), "utf8");
    for (const match of source.matchAll(/registerTool\(\s*"([a-z0-9_]+)"/g)) {
      names.add(match[1]!);
    }
  }
  return [...names].sort();
}

test("every provider the description promises is documented in the README", () => {
  const description = manifest.description ?? "";
  for (const provider of PROVIDER_NAMES) {
    if (!description.includes(provider)) continue;
    assert.ok(
      readme.includes(provider),
      `the npm description promises ${provider} but the README never mentions it. ` +
        `The description is hash-verified against the registry and the README is not, ` +
        `so this is exactly how a package ends up selling something its own page omits.`,
    );
  }
});

test("the README documents every tool the server registers", () => {
  const registered = registeredToolNames();
  assert.ok(registered.length > 0, "no registerTool call was found; the scan is broken");
  for (const name of registered) {
    assert.ok(
      readme.includes(name),
      `the server registers ${name} but the README does not mention it. ` +
        `An undocumented tool is invisible to everyone reading the package page.`,
    );
  }
});

test("the README does not document tools the server no longer registers", () => {
  // The other direction matters too: a removed tool left in the README is a
  // promise the server cannot keep, and reads as a bug to whoever calls it.
  const registered = new Set(registeredToolNames());
  const documented = new Set(readme.match(/dashboard_[a-z0-9_]+/g) ?? []);
  for (const name of documented) {
    assert.ok(
      registered.has(name),
      `the README documents ${name} but the server does not register it.`,
    );
  }
});

test("the README's tool count claim matches the number of registered tools", () => {
  // "ten bounded tools" in the opening paragraph is a number that silently rots
  // every time a tool is added.
  const registered = registeredToolNames();
  const words = [
    "zero", "one", "two", "three", "four", "five", "six", "seven",
    "eight", "nine", "ten", "eleven", "twelve",
  ];
  const expected = words[registered.length] ?? String(registered.length);
  assert.match(
    readme,
    new RegExp(`${expected} bounded tools`),
    `the README should say "${expected} bounded tools" for ${registered.length} registered tools`,
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";

import { PROVIDER_REGISTRY } from "../src/providers/registry.js";
import { createServer } from "../src/server.js";

/**
 * The README is the npm package page. npm renders it as the page body, so it is
 * what every visitor actually reads -- and it is the artifact most likely to be
 * left behind, because nothing breaks when it goes stale.
 *
 * 0.6.0 shipped a description promising Sail while the README mentioned Sail
 * ZERO times in 23,100 characters, and documented nine tools while the server
 * registered ten. The description had byte-exact verification against the
 * registry; the README had none, so the verified artifact was not the one people
 * read.
 *
 * The first version of this guard read tool names with a source regex over
 * `src/tools/*.ts`. A reviewer pointed out that this is not authoritative: a
 * tool registered through a variable, a template literal, a nested directory or
 * a helper would be invisible to the scan, so the live server could expose
 * eleven tools while the guard saw ten and every assertion here stayed green.
 * A guard whose authority is a grep can rot exactly the way the README did.
 *
 * So the tool list now comes from the SERVER, over a real MCP `tools/list`, and
 * the provider list comes from `PROVIDER_REGISTRY` -- the same registry the
 * server itself enumerates providers from. Both sides of every comparison are
 * now the thing being described rather than a restatement of it.
 */

const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { description?: string };

/** Tool names as the running server actually advertises them. */
async function liveToolNames(): Promise<string[]> {
  const server = createServer({
    fetchImpl: (() => {
      throw new Error("tools/list must not fetch");
    }) as unknown as typeof fetch,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "readme-truth", version: "1.0.0" });
  await client.connect(clientTransport);
  try {
    const listed = await client.listTools();
    return listed.tools.map((tool) => tool.name).sort();
  } finally {
    await client.close();
  }
}

/**
 * Tool names the README documents, read only from the delimited Tools block.
 * Scanning the whole document matched prose, code samples and URL fragments,
 * which would have blocked legitimate edits for no reason.
 */
function documentedToolNames(): string[] {
  const begin = readme.indexOf("<!-- tools:begin");
  const end = readme.indexOf("<!-- tools:end -->");
  assert.ok(
    begin !== -1 && end !== -1 && end > begin,
    "the README must keep its tools:begin/tools:end markers; without them this guard has nothing authoritative to compare",
  );
  const block = readme.slice(begin, end);
  return [...new Set(block.match(/dashboard_[a-z0-9_]+/g) ?? [])].sort();
}

test("the README's tool table matches the server's live tools/list exactly", async () => {
  const live = await liveToolNames();
  assert.ok(live.length > 0, "the server advertised no tools; the harness is broken");
  assert.deepEqual(
    documentedToolNames(),
    live,
    "the documented tool table and the server's advertised tools have diverged. " +
      "An undocumented tool is invisible on the package page; a documented one the " +
      "server does not serve is a promise it cannot keep.",
  );
});

test("every provider the server knows about is named in both the description and the README", async () => {
  // Derived from PROVIDER_REGISTRY, not a hand-kept list: adding a fifth
  // provider there without documenting it fails here. Checking only providers
  // that already appear in the description would have let a supported-but-
  // unmentioned provider through, which is the same silence in a new place.
  const names = Object.values(PROVIDER_REGISTRY).map((provider) => provider.displayName);
  assert.ok(names.length > 0, "the provider registry is empty; the harness is broken");
  const description = manifest.description ?? "";
  for (const name of names) {
    assert.ok(
      description.includes(name),
      `the server supports ${name} but the npm description never names it`,
    );
    assert.ok(
      readme.includes(name),
      `the server supports ${name} but the README never mentions it`,
    );
  }
});

test("the opening line's tool count matches the number of tools actually served", async () => {
  const live = await liveToolNames();
  const words = [
    "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  ];
  const word = words[live.length];
  assert.ok(
    word,
    `the tool count reached ${live.length}, past this list of number words. ` +
      `Extend the list rather than deleting the claim.`,
  );
  // Bounded to the opening paragraph so an unrelated or historical sentence
  // elsewhere in the document cannot satisfy it.
  const opening = readme.slice(0, 600);
  assert.match(
    opening,
    new RegExp(`\\b${word} bounded tools\\b`),
    `the opening line should say "${word} bounded tools" for ${live.length} served tools`,
  );
});

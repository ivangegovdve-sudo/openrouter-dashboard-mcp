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
  // Backtick-delimited, so the match has EXPLICIT boundaries. A bare
  // /dashboard_[a-z0-9_]+/ scan extracts a prefix: a table documenting
  // `dashboard_foo-v2` while the server serves `dashboard_foo` yielded
  // "dashboard_foo" and compared equal, so a wrong documented identifier passed.
  // MCP tool names permit hyphens and dots, which that character class silently
  // truncates, and preceding text like `notdashboard_foo` matched too.
  const names = [...block.matchAll(/`([A-Za-z0-9_.-]+)`/g)]
    .map((match) => match[1]!)
    .filter((name) => name.startsWith("dashboard_"));
  const unique = [...new Set(names)];
  assert.equal(
    unique.length,
    names.length,
    "the tools table lists the same tool twice; a Set would have hidden that",
  );
  return unique.sort();
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
    "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
  ];
  const word = words[live.length];
  assert.ok(
    word,
    `the tool count reached ${live.length}, past this list of number words. ` +
      `Extend the list rather than deleting the claim.`,
  );
  // Bounded to the generated summary block so an unrelated or historical sentence
  // elsewhere in the document cannot satisfy it. The marketing opening is intentionally
  // followed immediately by installation and no longer carries generated facts.
  const summaryStart = readme.indexOf("<!-- summary:begin generated-do-not-edit -->");
  const summaryEnd = readme.indexOf("<!-- summary:end -->", summaryStart);
  assert.ok(summaryStart >= 0 && summaryEnd > summaryStart, "the generated summary block is missing");
  const summary = readme.slice(summaryStart, summaryEnd);
  assert.match(
    summary,
    new RegExp(`\\b${word} bounded tools\\b`),
    `the opening line should say "${word} bounded tools" for ${live.length} served tools`,
  );
});

test("the README states outright that 1.0 skips 0.9.0", () => {
  // A consumer watching version numbers sees 0.8.0 then 1.0.0 and reasonably concludes
  // they missed a release. They did not: 0.9.0 was built here and never published. The
  // npmjs page IS this README, so the statement has to live here, not only in docs/.
  // An earlier draft of the deprecation copy went further and claimed "0.9.0 shipped
  // before this mechanism existed", which is a false admission about a release that
  // never existed -- worse than saying nothing.
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /no 0\.9\.0 on npm/i, "the README must say plainly that 0.9.0 was never published");
  assert.match(readme, /0\.8\.0/, "and must name the version consumers are actually upgrading from");
  assert.doesNotMatch(readme, /0\.9\.0 shipped/i, "nothing may claim 0.9.0 shipped");

  const notes = readFileSync(new URL("../docs/release-1.0.0.md", import.meta.url), "utf8");
  assert.match(notes, /skips 0\.9\.0/i);
  assert.doesNotMatch(notes, /0\.9\.0 shipped/i);
});

test("the documented refusal statuses are the statuses the code returns", async () => {
  // THE README ASSERTED A STATUS THE PRIMITIVE DOES NOT RETURN. It said mismatched units,
  // conditions or a zero baseline produce `not_comparable`; comparePriceSets returns
  // `refused`, and only the tool layer renames it. Two layers, two names, and the doc
  // named one of them for both -- a README describing a contract the package does not
  // have, which is the exact defect this release exists to remove. Caught by the
  // cross-family review of the fix branch, not by me.
  const { comparePriceSets } = await import("../src/catalogue/price-set.js").then(() => import("../src/catalogue/compare.js"));
  const { pricePoint } = await import("../src/catalogue/price-set.js");
  const point = (id: string, amount: string, condition: unknown) => pricePoint({
    id, amount, unit: "image", condition: condition as never,
    sourceUrl: "https://example.test/pricing", readAt: "2026-09-08T15:00:00Z", provenance: "published", measurementOrigin: "catalogue", observed: null,
  });
  const basis = { unit: "image" as const, assumption: "one generated image" };

  // The primitive refuses under the name the README now gives it.
  for (const [left, right] of [
    [point("l", "0.03", null), point("r", "0", null)],
    [point("l", "0.03", { kind: "price_scope", name: "authenticated_account" }), point("r", "0.02", null)],
  ] as const) {
    assert.equal(comparePriceSets([left], [right], basis).status, "refused");
  }

  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /price-set primitive returns `status: "refused"`/,
    "the README must name the status the primitive actually returns");
  assert.match(readme, /`status: "not_comparable"`/,
    "and the status the tool layer renames it to");
});

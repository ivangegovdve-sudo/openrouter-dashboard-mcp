import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { PROVIDER_IDS, PROVIDER_REGISTRY, providerDescriptorSchema } from "../src/providers/registry.js";
import { priceConditionSchema, priceUnitSchema, pricePointSchema } from "../src/contract.js";
import { speedObservationSchema } from "../src/speed.js";
import { createServer } from "../src/server.js";

const root = resolve(import.meta.dirname, "..");
const markdown = (value: unknown) => String(value).replaceAll("|", "&#124;").replaceAll("\n", " ").replaceAll("<", "&lt;");
const publication = { always: "All collected models", partial: "Some collected models", never: "Not published in this connector", unknown: "Not established" };
const billing = { api: "Billing API", no_billing_api: "No billing API", unknown: "Not established" };
const providerKind = { aggregator: "Multi-provider aggregator", media: "Media generation platform", model_provider: "Model provider" };

/** Source-of-truth export shared by README generation and the companion site's release manifest. */
export async function exportPackageFacts() {
  const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8")) as { name: string; version: string; engines: { node: string } };
  if (manifest.name !== "open-dashboard-mcp") throw Error("Unexpected package identity.");
  if (!PROVIDER_IDS.length || new Set(PROVIDER_IDS).size !== PROVIDER_IDS.length || JSON.stringify([...PROVIDER_IDS].sort()) !== JSON.stringify(Object.keys(PROVIDER_REGISTRY).sort())) throw Error("Invalid provider registry.");
  for (const id of PROVIDER_IDS) {
    const provider = PROVIDER_REGISTRY[id];
    providerDescriptorSchema.parse(provider);
    if (provider.id !== id) throw Error("Provider identity differs from its registry key.");
  }
  const server = createServer({ fetchImpl: async () => { throw Error("Documentation generation must not fetch provider or dashboard data."); } });
  const client = new Client({ name: "package-documentation-generator", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const tools = (await client.listTools()).tools.map(({ name, title, description, annotations }) => ({ name, title, description, annotations })).sort((a, b) => a.name.localeCompare(b.name));
    if (!tools.length || new Set(tools.map(tool => tool.name)).size !== tools.length || tools.some(tool => tool.annotations?.readOnlyHint !== true)) throw Error("Documentation read-only tool contract changed.");
    return { name: manifest.name, version: manifest.version, node: manifest.engines.node, providers: PROVIDER_IDS.map(id => PROVIDER_REGISTRY[id]), tools, contract: contractVocabulary() };
  } finally { await client.close(); await server.close(); }
}


/**
 * THE VOCABULARY THIS PACKAGE ACTUALLY EMITS, read out of the schemas.
 *
 * Exported so the companion site can assert against it instead of describing the package
 * from memory. A previous pass put `measured_from` and `listed_but_unserviceable` on the
 * Open Dashboard page when the package emits `vantagePoint` and has no serviceability
 * state at all -- a page advertising fields that do not exist, which is the same
 * stale-surface defect the price-set work exists to remove, one layer out. Prose on one
 * side and a schema on the other cannot be kept in agreement by care alone.
 */
export function contractVocabulary() {
  const kinds = (priceConditionSchema.options as ReadonlyArray<{ shape: { kind: { value: string } } }>)
    .map(option => option.shape.kind.value);
  const point = pricePointSchema as unknown as { shape: Record<string, { options?: readonly string[] }> };
  const speed = speedObservationSchema as unknown as { shape: Record<string, { options?: readonly string[] }> };
  return {
    priceUnits: [...(priceUnitSchema.options as readonly string[])],
    conditionKinds: kinds,
    provenance: [...(point.shape.provenance!.options ?? [])],
    speedStates: [...(speed.shape.state!.options ?? [])],
    tokenBasis: [...(speed.shape.token_basis!.options ?? [])],
    // Field names a consumer-facing surface may legitimately print. Read from the schemas
    // where they are enumerable, listed here where they are object keys.
    pricePointFields: Object.keys(point.shape),
    speedFields: Object.keys(speed.shape),
    contractFields: ["schema_version", "package_version", "deprecations", "field", "removed_in", "replaced_by", "reason", "since", "state"],
    normalizedFigureFields: ["value", "unit", "assumption", "derived_from"],
    environmentVariables: ["OPEN_DASHBOARD_TOOLS", "OPEN_DASHBOARD_PROVIDERS", "OPEN_DASHBOARD_KEY_SOURCES", "DASHBOARD_BASE_URL"],
  };
}

export type PackageFacts = Awaited<ReturnType<typeof exportPackageFacts>>;
function researchLabel(research: PackageFacts["providers"][number]["pitchResearch"]) {
  if (research.status === "not_researched") return "Not researched.";
  const sources = research.checkedSources.map(url => `[Source](${url})`).join(" · ");
  if (research.status === "not_published") return `Not published: “${markdown(research.providerStatement.text)}” — [${markdown(research.providerStatement.attribution)}](${research.providerStatement.sourceUrl}).`;
  return `Not found in checked sources. ${markdown(research.scope)} ${sources}; checked ${research.observedAt}.`;
}

export function readmeBlocks(facts: PackageFacts): Record<string, string> {
  const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
  const providerRows = facts.providers.map(p => `| <span data-provider-id="${p.id}">${markdown(p.displayName)}</span>${p.providerKind ? `<br>${providerKind[p.providerKind]}` : ""} | [Catalogue](${p.catalogueUrl}) · [Documentation](${p.citationUrl}) | ${["pricing", "contextLength", "outputModalities", "lifecycle", "discounts"].map(field => publication[p.publishes[field as keyof typeof p.publishes]]).join(" | ")} | ${billing[p.spendVisibility]} |`).join("\n");
  const providerEvidence = facts.providers.map(p => `**${markdown(p.displayName)}**\n\n${p.pitch ? `> “${markdown(p.pitch.text)}” — [${markdown(p.pitch.attribution)}](${p.pitch.sourceUrl}), observed ${p.pitch.observedAt}.` : `Pitch: ${researchLabel(p.pitchResearch)}`}\n\n${p.caveats?.length ? p.caveats.map(c => `- **${markdown(c.kind)}: ${c.value} ${markdown(c.unit)}.** ${markdown(c.scope)} [Provider source](${c.sourceUrl}), observed ${c.observedAt}; basis: \`${c.basis}\`.`).join("\n") : `Caveats: ${researchLabel(p.caveatResearch)}`}`).join("\n\n");
  return {
    summary: `Read-only MCP access to public model and GitHub evidence, covering **${facts.providers.map(p => markdown(p.displayName)).join(", ")}**. Version **${facts.version}** registers **${facts.providers.length} providers** and exposes ${numberWords[facts.tools.length] ?? facts.tools.length} bounded tools over stdio. Results use the same machine-readable value in \`structuredContent\` and JSON text content.`,
    providers: `Generated from the package registry: **${facts.providers.length} providers** in **${facts.name} ${facts.version}**. Publication declarations describe the named connector; they are not fresh measurements or a full provider inventory.\n\n| Provider | Sources | Pricing | Context | Modality | Lifecycle | Discounts | Spend visibility |\n|---|---|---|---|---|---|---|---|\n${providerRows}\n\n### Provider pitches and structured caveats\n\nQuotations are the providers' words. Caveats record published limits, including scope and units; they do not claim measured inference speed or a caller's current quota. An absent caveat is accompanied by its research status, never a null placeholder.\n\n${providerEvidence}`,
    contract: contractBlock(),
    tools: `**${facts.tools.length} read-only tools**, read from the server's actual MCP \`tools/list\` registration graph without calling any tool.\n\n| Tool | Purpose |\n|---|---|\n${facts.tools.map(tool => `| \`${tool.name}\` | ${markdown(tool.title || tool.name)} |`).join("\n")}`,
  };
}


/**
 * READ OUT OF THE SCHEMAS, NOT RETYPED. The price-set section of this README was prose
 * and drifted the moment a condition kind was added: it still said the union was
 * "latency_window, time_band, tier, and rate_class" after price_scope existed in the
 * code. Anything a reader could check against the package is generated from the package.
 */
function contractBlock(): string {
  const units = (priceUnitSchema.options as readonly string[]).map(u => `\`${u}\``).join(", ");
  const kinds = (priceConditionSchema.options as ReadonlyArray<{ shape: { kind: { value: string } } }>)
    .map(option => `\`${option.shape.kind.value}\``);
  const provenance = (pricePointSchema as unknown as { shape: { provenance: { options: readonly string[] } } })
    .shape.provenance.options.map(value => `\`${value}\``).join(", ");
  const speedShape = (speedObservationSchema as unknown as { shape: Record<string, { options: readonly string[] }> }).shape;
  const speedStates = speedShape.state!.options.map(value => `\`${value}\``).join(", ");
  const tokenBasis = speedShape.token_basis!.options.map(value => `\`${value}\``).join(", ");
  const numberWords = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight"];
  return [
    `A model does not have *a* price. It has a **set** of price points, each valid only under a stated condition, and the set is the unit this package publishes.`,
    ``,
    `A point is \`{ amount, unit, condition, source: { url, readAt }, provenance }\`. Amounts are exact decimal strings, never floats, so a sub-cent per-token rate survives a round trip. \`source\` names the page it was read from and when; a price whose read time cannot be established is not emitted at all.`,
    ``,
    `**Units** (${(priceUnitSchema.options as readonly string[]).length}): ${units}.`,
    ``,
    `**Condition kinds** (${numberWords[kinds.length] ?? kinds.length}): ${kinds.join(", ")}. A rate is never detached from the choice that produced it: a latency window, a time of day, a volume tier, a rate class, or whose price it is. \`price_scope\` distinguishes a rate quoted to an authenticated account from a public list rate -- without it the two look identical and compare as though they were the same quantity.`,
    ``,
    `**Provenance**: ${provenance}. A \`derived\` point names \`derivedFrom\`; a \`parsed_from_prose\` point retains the \`sourceText\` it was read out of. \`unknown\` is a real answer and is never rounded to a number.`,
    ``,
    `**The refusal rule.** A comparison returns every compatible pair or it refuses. Two points compare only under the same unit AND the same condition; mismatched units, mismatched conditions, or a zero baseline refuse, always with a reason. The refusal surfaces under two names, one per layer: the price-set primitive returns \`status: \"refused\"\`, and a tool response carries that through as a comparison leg with \`status: \"not_comparable\"\` and the same reason. Nothing is coerced to make a comparison possible, because a comparison across conditions is not a weaker answer, it is a wrong one.`,
    ``,
    `**Speed carries its own conditions.** \`dashboard_speed\` observations are ${speedStates}. A rate names \`token_basis\` (${tokenBasis}) because a reasoning model emits tokens that never reach content, so a visible-output rate and a billed rate differ by multiples. Every observation carries a \`vantagePoint\`: latency is a property of a provider *and* where it was measured from, so a figure without one flatters whoever is nearest the benchmark host. A claim this package cannot source is published as \`unknown\`, not as a number.`,
    ``,
    `**Deprecations.** \`dashboard_contract\` returns \`schema_version\`, the installed \`package_version\`, and every field or tool announced for removal. A notice names \`replaced_by\`, or gives a plain \`reason\` when the capability is gone with no replacement. From 1.0.0 onward a removal is announced before the release that performs it; the 1.0.0 notices are retrospective because no earlier published release carried this mechanism.`,
  ].join(String.fromCharCode(10));
}

export function replaceReadmeBlocks(readme: string, facts: PackageFacts): string {
  for (const [id, content] of Object.entries(readmeBlocks(facts))) {
    const begin = `<!-- ${id}:begin generated-do-not-edit -->`;
    const end = `<!-- ${id}:end -->`;
    if (readme.split(begin).length !== 2 || readme.split(end).length !== 2 || readme.indexOf(end) < readme.indexOf(begin)) throw Error(`Missing or duplicate README ${id} markers.`);
    readme = readme.slice(0, readme.indexOf(begin) + begin.length) + "\n\n" + content + "\n\n" + readme.slice(readme.indexOf(end));
  }
  return readme;
}

export async function generateDocs({ check = false, readmePath = resolve(root, "README.md"), facts }: { check?: boolean; readmePath?: string; facts?: PackageFacts } = {}) {
  facts ??= await exportPackageFacts();
  const actual = (await readFile(readmePath, "utf8")).replaceAll("\r\n", "\n");
  const expected = replaceReadmeBlocks(actual, facts);
  if (actual !== expected) {
    if (check) throw Error("README generated facts disagree with the package registry or tools/list. Run npm run docs:generate.");
    await writeFile(readmePath, expected);
  }
  return { version: facts.version, providers: facts.providers.length, tools: facts.tools.length, changed: actual !== expected };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !["--check", "--facts"].includes(arg))) throw Error("Use --check or --facts.");
  const facts = await exportPackageFacts();
  if (args.includes("--facts")) process.stdout.write(JSON.stringify(facts, null, 2) + "\n");
  else console.log(JSON.stringify(await generateDocs({ check: args.includes("--check"), facts })));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });

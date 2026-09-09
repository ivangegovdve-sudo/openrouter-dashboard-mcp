import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { PROVIDER_IDS, PROVIDER_REGISTRY, providerDescriptorSchema } from "../src/providers/registry.js";
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
    return { name: manifest.name, version: manifest.version, node: manifest.engines.node, providers: PROVIDER_IDS.map(id => PROVIDER_REGISTRY[id]), tools };
  } finally { await client.close(); await server.close(); }
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
    tools: `**${facts.tools.length} read-only tools**, read from the server's actual MCP \`tools/list\` registration graph without calling any tool.\n\n| Tool | Purpose |\n|---|---|\n${facts.tools.map(tool => `| \`${tool.name}\` | ${markdown(tool.title || tool.name)} |`).join("\n")}`,
  };
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

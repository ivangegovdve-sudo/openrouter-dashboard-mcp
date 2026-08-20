import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";

import { createServer } from "../src/server.js";
import { startFixtureDashboard } from "../scripts/fixture-dashboard.js";

type JsonSchema = Record<string, unknown>;

function pathTokens(path: string): string[] {
  assert.ok(path.startsWith("$."), `unsupported evaluation path: ${path}`);
  return path
    .slice(2)
    .split(".")
    .flatMap((segment) => {
      const match = /^([^\[]+)(?:\[(\*|\d+)\])?$/.exec(segment);
      assert.ok(match, `unsupported evaluation path segment: ${segment}`);
      return match[2] === undefined ? [match[1]!] : [match[1]!, match[2]];
    });
}

function resolveValues(values: unknown[], tokens: readonly string[]): unknown[] {
  if (tokens.length === 0) return values;
  const [head, ...tail] = tokens;
  const next: unknown[] = [];
  for (const value of values) {
    if (head === "*") {
      if (Array.isArray(value)) next.push(...value);
    } else if (/^\d+$/.test(head ?? "")) {
      if (Array.isArray(value)) {
        const entry = value[Number(head)];
        if (entry !== undefined) next.push(entry);
      }
    } else if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.hasOwn(value, head!)
    ) {
      next.push((value as Record<string, unknown>)[head!]);
    }
  }
  return resolveValues(next, tail);
}

function schemaHasPath(schema: unknown, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return true;
  if (schema === null || typeof schema !== "object" || Array.isArray(schema)) {
    return false;
  }
  const record = schema as JsonSchema;
  for (const keyword of ["oneOf", "anyOf", "allOf"] as const) {
    const variants = record[keyword];
    if (
      Array.isArray(variants) &&
      variants.some((variant) => schemaHasPath(variant, tokens))
    ) {
      return true;
    }
  }

  const [head, ...tail] = tokens;
  if (head === "*" || /^\d+$/.test(head ?? "")) {
    return schemaHasPath(record.items, tail);
  }
  const properties = record.properties;
  if (
    properties === null ||
    typeof properties !== "object" ||
    Array.isArray(properties)
  ) {
    return false;
  }
  return schemaHasPath(
    (properties as Record<string, unknown>)[head!],
    tail,
  );
}

test("every evaluation assertion path resolves against fixture output or its registered schema", async () => {
  const xml = await readFile(
    new URL("../evals/dashboard-intelligence.xml", import.meta.url),
    "utf8",
  );
  const fixture = await startFixtureDashboard({ mode: "fixture" });
  const server = createServer({ baseUrl: fixture.baseUrl });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "evaluation-contract-test", version: "1.0.0" });
  await client.connect(clientTransport);

  try {
    const listed = await client.listTools();
    const outputSchemas = new Map(
      listed.tools.map((tool) => [tool.name, tool.outputSchema] as const),
    );
    const cases = [...xml.matchAll(/<case id="([^"]+)"[^>]*>([\s\S]*?)<\/case>/g)];
    assert.equal(cases.length, 10);

    for (const evaluationCase of cases) {
      const id = evaluationCase[1]!;
      const body = evaluationCase[2]!;
      const tool = /<expected-tool>([^<]+)<\/expected-tool>/.exec(body)?.[1];
      const argumentsJson = /<arguments><!\[CDATA\[([\s\S]*?)\]\]><\/arguments>/.exec(
        body,
      )?.[1];
      assert.ok(tool, `${id} has no expected tool`);
      assert.ok(argumentsJson, `${id} has no arguments`);
      const argumentsValue = JSON.parse(argumentsJson) as Record<string, unknown>;
      const call = await client.callTool({ name: tool, arguments: argumentsValue });
      assert.ok(call.structuredContent, `${id} returned no structured content`);
      const outputSchema = outputSchemas.get(tool);
      assert.ok(outputSchema, `${id} tool has no registered output schema`);
      const envelope = {
        tool,
        arguments: argumentsValue,
        result: call.structuredContent,
      };
      const assertionPaths = [
        ...body.matchAll(/<assert path="([^"]+)"/g),
      ].map((match) => match[1]!);
      assert.ok(assertionPaths.length > 0, `${id} has no assertion paths`);

      for (const assertionPath of assertionPaths) {
        const tokens = pathTokens(assertionPath);
        const actualValues = resolveValues([envelope], tokens);
        const resultSchemaPath =
          tokens[0] === "result" && schemaHasPath(outputSchema, tokens.slice(1));
        assert.ok(
          actualValues.length > 0 || resultSchemaPath,
          `${id} assertion path does not resolve: ${assertionPath}`,
        );
      }
    }
  } finally {
    await client.close();
    await fixture.close();
  }
});

import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getDefaultEnvironment } from "@modelcontextprotocol/client/stdio";
import {
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  deserializeMessage,
  serializeMessage,
  type JSONRPCMessage,
} from "@modelcontextprotocol/server";

import { startFixtureDashboard } from "./fixture-dashboard.js";
import {
  assertEvidenceCredentialSafe,
  assertFixtureResult,
  assertMatchingTextContent,
  assertToolDefinitions,
  DIAGNOSTIC_CALLS,
  sanitizeEvidenceValue,
} from "./verify-stdio.js";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ENTRY_PATH = fileURLToPath(new URL("../build/index.js", import.meta.url));
const EVIDENCE_DIRECTORY = fileURLToPath(
  new URL("../verification/raw/", import.meta.url),
);
const STDOUT_MAX_BYTES = 10 * 1024 * 1024;
const STDERR_MAX_BYTES = 64 * 1024;
const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;
const INITIALIZE_TIMEOUT_MS = 10_000;
const LIST_TIMEOUT_MS = 5_000;
const CALL_TIMEOUT_MS = 15_000;
const CLOSE_TIMEOUT_MS = 7_000;

type FrameRecord = Record<string, unknown>;

function asRecord(value: unknown, label: string): FrameRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is not an object`);
  }
  return value as FrameRecord;
}

export function parsePurityFrames(
  bytes: Buffer,
  expectedResponseIds: ReadonlySet<number>,
): JSONRPCMessage[] {
  if (bytes.length === 0) throw new Error("stdout is empty");
  if (bytes.length > STDOUT_MAX_BYTES) throw new Error("stdout exceeds 10 MiB");
  if (bytes.at(-1) !== 0x0a) throw new Error("stdout has an unterminated frame");

  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("stdout is not valid UTF-8");
  }
  const lines = decoded.split("\n");
  if (lines.pop() !== "") throw new Error("stdout has an unterminated tail");
  if (lines.length === 0) throw new Error("stdout has no JSON-RPC frames");

  const frames: JSONRPCMessage[] = [];
  const responseIds = new Set<number>();
  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line.length === 0) {
      throw new Error(`stdout contains a blank frame at line ${index + 1}`);
    }
    let frame: JSONRPCMessage;
    try {
      frame = deserializeMessage(line);
    } catch {
      throw new Error(`stdout line ${index + 1} is not a JSON-RPC frame`);
    }
    frames.push(frame);
    const record = frame as FrameRecord;
    if (!("id" in record)) continue;
    if (
      "method" in record ||
      (!("result" in record) && !("error" in record))
    ) {
      throw new Error(
        `stdout line ${index + 1} is an id-bearing request, not a response`,
      );
    }
    const id = record.id;
    if (typeof id !== "number" || !Number.isSafeInteger(id)) {
      throw new Error(`stdout line ${index + 1} has a non-numeric response id`);
    }
    if (!expectedResponseIds.has(id)) {
      throw new Error(`stdout contains unknown response id ${id}`);
    }
    if (responseIds.has(id)) throw new Error(`stdout repeats response id ${id}`);
    responseIds.add(id);
  }
  for (const id of expectedResponseIds) {
    if (!responseIds.has(id)) throw new Error(`stdout is missing response id ${id}`);
  }
  return frames;
}

function withDeadline<T>(
  label: string,
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} exceeded ${timeoutMs}ms`)),
      timeoutMs,
    );
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function elapsedSince(started: number): number {
  return Math.round((performance.now() - started) * 100) / 100;
}

function writeMessage(
  child: ChildProcessWithoutNullStreams,
  message: JSONRPCMessage,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    child.stdin.write(serializeMessage(message), (error) => {
      if (error !== null && error !== undefined) reject(error);
      else resolve();
    });
  });
}

function responseById(frames: JSONRPCMessage[], id: number): FrameRecord {
  const response = frames.find(
    (frame) =>
      "id" in (frame as FrameRecord) && (frame as FrameRecord).id === id,
  );
  if (response === undefined) throw new Error(`missing parsed response id ${id}`);
  return asRecord(response, `response ${id}`);
}

function resultFromResponse(response: FrameRecord, id: number): FrameRecord {
  if (response.error !== undefined) throw new Error(`response ${id} is an error`);
  return asRecord(response.result, `response ${id} result`);
}

function sanitizeReviewedStderr(bytes: Buffer): string {
  let decoded: string;
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error("raw child stderr is not valid UTF-8");
  }
  const withoutAnsi = decoded.replace(/\u001b\[[0-9;]*m/g, "");
  const scrubbed = withoutAnsi.replace(/https?:\/\/[^\s)\]}]+/g, (match) => {
    try {
      const url = new URL(match);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return "[invalid-url-redacted]";
    }
  });
  assertEvidenceCredentialSafe({ reviewedStderr: scrubbed });
  return scrubbed;
}

async function writeEvidence(evidence: unknown, stderr: string): Promise<string> {
  const safeEvidence = sanitizeEvidenceValue(evidence);
  const serialized = `${JSON.stringify(safeEvidence, null, 2)}\n`;
  if (Buffer.byteLength(serialized) > EVIDENCE_MAX_BYTES) {
    throw new Error("stdout verification evidence exceeds its cap");
  }
  await mkdir(EVIDENCE_DIRECTORY, { recursive: true });
  const evidencePath = path.join(EVIDENCE_DIRECTORY, "stdout.json");
  await writeFile(evidencePath, serialized, "utf8");
  await writeFile(
    path.join(EVIDENCE_DIRECTORY, "stdout.stderr.txt"),
    stderr,
    "utf8",
  );
  return evidencePath;
}

export async function runStdoutVerification(): Promise<string> {
  const startedAt = new Date();
  const overallStarted = performance.now();
  const fixture = await withDeadline(
    "stdout fixture startup",
    startFixtureDashboard({ mode: "fixture" }),
    INITIALIZE_TIMEOUT_MS,
  );
  let child: ChildProcessWithoutNullStreams | undefined;
  let childExited = false;
  try {
    child = spawn(process.execPath, [ENTRY_PATH], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...getDefaultEnvironment(),
        DASHBOARD_BASE_URL: fixture.baseUrl,
      },
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let lineCount = 0;
    let streamFailure: Error | undefined;
    const lineWaiters = new Set<{
      target: number;
      resolve(): void;
      reject(error: Error): void;
    }>();
    const rejectLineWaiters = (error: Error): void => {
      for (const waiter of lineWaiters) waiter.reject(error);
      lineWaiters.clear();
    };
    const resolveLineWaiters = (): void => {
      for (const waiter of lineWaiters) {
        if (lineCount >= waiter.target) {
          lineWaiters.delete(waiter);
          waiter.resolve();
        }
      }
    };
    child.stdout.on("data", (chunk: Buffer) => {
      const bytes = Buffer.from(chunk);
      stdoutBytes += bytes.length;
      if (stdoutBytes > STDOUT_MAX_BYTES) {
        streamFailure = new Error("raw stdout exceeded 10 MiB");
        rejectLineWaiters(streamFailure);
        child?.kill();
        return;
      }
      stdoutChunks.push(bytes);
      for (const byte of bytes) if (byte === 0x0a) lineCount += 1;
      resolveLineWaiters();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      const bytes = Buffer.from(chunk);
      stderrBytes += bytes.length;
      if (stderrBytes > STDERR_MAX_BYTES) {
        streamFailure = new Error("raw stderr exceeded its cap");
        rejectLineWaiters(streamFailure);
        child?.kill();
        return;
      }
      stderrChunks.push(bytes);
    });

    const exitPromise = new Promise<{ code: number | null; signal: string | null }>(
      (resolve, reject) => {
        child?.once("error", reject);
        child?.once("exit", (code, signal) => {
          childExited = true;
          if (lineCount === 0) {
            rejectLineWaiters(new Error("raw child exited before any response"));
          }
          resolve({ code, signal });
        });
      },
    );
    const waitForLineCount = (target: number): Promise<void> => {
      if (streamFailure !== undefined) return Promise.reject(streamFailure);
      if (lineCount >= target) return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        lineWaiters.add({ target, resolve, reject });
      });
    };

    const timings: Array<{ operation: string; elapsedMs: number }> = [];
    const sendAndAwait = async (
      operation: string,
      message: JSONRPCMessage,
      targetLines: number,
      timeoutMs: number,
    ): Promise<void> => {
      const started = performance.now();
      await withDeadline(
        `${operation} write`,
        writeMessage(child as ChildProcessWithoutNullStreams, message),
        timeoutMs,
      );
      await withDeadline(
        `${operation} response`,
        waitForLineCount(targetLines),
        timeoutMs,
      );
      timings.push({ operation, elapsedMs: elapsedSince(started) });
    };

    let responseLineTarget = 1;
    await sendAndAwait(
      "initialize",
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: "dashboard-stdout-verifier", version: "0.1.0" },
        },
      },
      responseLineTarget,
      INITIALIZE_TIMEOUT_MS,
    );
    await withDeadline(
      "initialized notification write",
      writeMessage(child, {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
      LIST_TIMEOUT_MS,
    );

    responseLineTarget += 1;
    await sendAndAwait(
      "initial tools/list",
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      responseLineTarget,
      LIST_TIMEOUT_MS,
    );
    for (const [index, call] of DIAGNOSTIC_CALLS.entries()) {
      const id = index + 3;
      responseLineTarget += 1;
      await sendAndAwait(
        `${call.name} tools/call`,
        {
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name: call.name, arguments: call.arguments },
        },
        responseLineTarget,
        CALL_TIMEOUT_MS,
      );
    }
    responseLineTarget += 1;
    await sendAndAwait(
      "final tools/list",
      { jsonrpc: "2.0", id: 10, method: "tools/list", params: {} },
      responseLineTarget,
      LIST_TIMEOUT_MS,
    );

    child.stdin.end();
    const exit = await withDeadline("raw child exit", exitPromise, CLOSE_TIMEOUT_MS);
    if (streamFailure !== undefined) throw streamFailure;
    if (exit.code !== 0 || exit.signal !== null) {
      throw new Error("raw child did not exit cleanly");
    }

    const stdout = Buffer.concat(stdoutChunks);
    const stderr = Buffer.concat(stderrChunks);
    const expectedIds = new Set(
      Array.from({ length: 10 }, (_, index) => index + 1),
    );
    const frames = parsePurityFrames(stdout, expectedIds);
    const initialList = resultFromResponse(responseById(frames, 2), 2);
    const initialTools = initialList.tools;
    if (!Array.isArray(initialTools)) throw new Error("raw tools/list has no tools");
    assertToolDefinitions(initialTools);

    const calls = DIAGNOSTIC_CALLS.map((call, index) => {
      const id = index + 3;
      const result = resultFromResponse(responseById(frames, id), id);
      if (result.structuredContent === undefined) {
        throw new Error(`${call.name} raw result has no structuredContent`);
      }
      assertMatchingTextContent(result, result.structuredContent);
      assertFixtureResult(call.name, result.structuredContent);
      return {
        name: call.name,
        arguments: call.arguments,
        elapsedMs:
          timings.find((timing) =>
            timing.operation.startsWith(`${call.name} `),
          )?.elapsedMs ?? null,
        structuredContent: result.structuredContent,
      };
    });
    const finalList = resultFromResponse(responseById(frames, 10), 10);
    if (!Array.isArray(finalList.tools)) throw new Error("raw final tools/list has no tools");
    assertToolDefinitions(finalList.tools);

    const reviewedStderr = sanitizeReviewedStderr(stderr);
    const finishedAt = new Date();
    return await writeEvidence(
      {
        mode: "stdout",
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        elapsedMs: elapsedSince(overallStarted),
        timings,
        frameCount: frames.length,
        responseIds: [...expectedIds],
        toolDefinitions: initialTools,
        calls,
      },
      reviewedStderr,
    );
  } finally {
    if (child !== undefined && !childExited) {
      child.stdin.destroy();
      child.kill();
    }
    await withDeadline("stdout fixture close", fixture.close(), CLOSE_TIMEOUT_MS);
  }
}

function isMainModule(): boolean {
  const invokedPath = process.argv[1];
  if (invokedPath === undefined) return false;
  const normalize = (value: string) =>
    path.normalize(value).toLocaleLowerCase();
  return normalize(invokedPath) === normalize(SCRIPT_PATH);
}

if (isMainModule()) {
  runStdoutVerification().then(
    (evidencePath) => {
      process.stderr.write(`stdout verification evidence: ${evidencePath}\n`);
    },
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`stdout verification failed: ${message}\n`);
      process.exitCode = 1;
    },
  );
}

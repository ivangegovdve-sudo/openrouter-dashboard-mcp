import assert from "node:assert/strict";
import test from "node:test";

import { z } from "zod";

import { createDashboardClient } from "../src/dashboard/client.js";
import { DashboardRequestError } from "../src/dashboard/errors.js";
import { manifestSchema } from "../src/dashboard/schemas/openrouter.js";
import { manifestFixture, opaqueCursor } from "./fixtures.js";

const hangingFetch: typeof fetch = (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    const signal = init?.signal;
    const onAbort = () => reject(new DOMException("aborted", "AbortError"));
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });

const htmlFetch: typeof fetch = async () =>
  new Response("<html><body>captive portal private body</body></html>", {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

test("times out a hung fetch and classifies it as timeout", async () => {
  const client = createDashboardClient({
    baseUrl: "https://catalogue.test",
    timeoutMs: 20,
    fetchImpl: hangingFetch,
  });

  await assert.rejects(
    () =>
      client.get(
        "/api/public/v2/manifest",
        new URLSearchParams(),
        manifestSchema,
      ),
    (error: unknown) =>
      error instanceof DashboardRequestError && error.kind === "timeout",
  );
});

test("rejects an oversized declared JSON body before reading and cancels it", async () => {
  let pulled = false;
  let cancelled = false;
  const client = createDashboardClient({
    baseUrl: "https://catalogue.test",
    maxResponseBytes: 16,
    timeoutMs: 200,
    fetchImpl: async (_input, init) => {
      const body = new ReadableStream<Uint8Array>(
        {
          start(controller) {
            init?.signal?.addEventListener(
              "abort",
              () => controller.error(new DOMException("aborted", "AbortError")),
              { once: true },
            );
          },
          pull() {
            pulled = true;
            return new Promise<void>(() => {});
          },
          cancel() {
            cancelled = true;
            return new Promise<void>(() => {});
          },
        },
        { highWaterMark: 0 },
      );
      return new Response(body, {
        headers: {
          "content-type": "application/json",
          "content-length": "17",
        },
      });
    },
  });
  await assert.rejects(
    client.get(
      "/api/public/v2/manifest",
      new URLSearchParams(),
      manifestSchema,
    ),
    (error: unknown) =>
      error instanceof DashboardRequestError &&
      error.kind === "invalid_payload" &&
      !error.message.includes("17"),
  );

  // A WALL-CLOCK BOUND USED TO SIT HERE: `performance.now() - startedAt < 100`. It failed
  // roughly one run in six on a loaded machine, always on that line and never on the
  // behaviour, which makes a red suite mean "the box was busy" instead of "the code is
  // wrong" -- and a suite that cries wolf gets its failures waved through.
  //
  // Nothing is lost by removing it, because the two assertions below plus the rejection
  // above already say everything it said, without consulting a clock:
  //   - `kind === "invalid_payload"` proves the request did NOT reach its 200ms timeout,
  //     since a timeout rejects with kind "timeout" instead. That is the fast-fail claim.
  //   - `pulled === false` proves the body was never read, which is the "before reading"
  //     claim, and is what the elapsed time was standing in for.
  assert.equal(pulled, false);
  assert.equal(cancelled, true);
});

test("rejects an oversized chunked JSON body while streaming and cancels it", async () => {
  let cancelled = false;
  let sent = false;
  const client = createDashboardClient({
    baseUrl: "https://catalogue.test",
    maxResponseBytes: 8,
    timeoutMs: 500,
    fetchImpl: async (_input, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          init?.signal?.addEventListener(
            "abort",
            () => controller.error(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        },
        pull(controller) {
          if (!sent) {
            sent = true;
            controller.enqueue(
              new TextEncoder().encode('{"private":"oversized"}'),
            );
          }
          return new Promise<void>(() => {});
        },
        cancel() {
          cancelled = true;
          return new Promise<void>(() => {});
        },
      });
      return new Response(body, {
        headers: {
          "content-type": "application/json",
          "content-length": "not-a-decimal-length",
        },
      });
    },
  });

  await assert.rejects(
    client.get(
      "/api/public/v2/manifest",
      new URLSearchParams(),
      manifestSchema,
    ),
    (error: unknown) =>
      error instanceof DashboardRequestError &&
      error.kind === "invalid_payload" &&
      !error.message.includes("private"),
  );

  assert.equal(cancelled, true);
});

test("accepts exact-cap JSON using UTF-8 byte length rather than string length", async () => {
  const body = JSON.stringify({ value: "é" });
  const byteLength = Buffer.byteLength(body, "utf8");
  assert.ok(byteLength > body.length);
  const client = createDashboardClient({
    baseUrl: "https://catalogue.test",
    maxResponseBytes: byteLength,
    fetchImpl: async () =>
      new Response(body, {
        headers: {
          "content-type": "application/json",
          "content-length": String(byteLength),
        },
      }),
  });

  const result = await client.get(
    "/utf8",
    new URLSearchParams(),
    z.object({ value: z.literal("é") }).strict(),
  );

  assert.deepEqual(result, { value: "é" });
});

test("rejects an invalid injected response cap before fetching", async () => {
  let fetchCalls = 0;
  const client = createDashboardClient({
    baseUrl: "https://catalogue.test",
    maxResponseBytes: 0,
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response();
    },
  });

  await assert.rejects(
    client.get(
      "/api/public/v2/manifest",
      new URLSearchParams(),
      manifestSchema,
    ),
    (error: unknown) =>
      error instanceof DashboardRequestError &&
      error.kind === "configuration_error",
  );
  assert.equal(fetchCalls, 0);
});

for (const responseCase of [
  { name: "HTTP 503", status: 503, contentType: "application/json" },
  { name: "HTML", status: 200, contentType: "text/html" },
] as const) {
  test(`cancels an endless ${responseCase.name} body without awaiting cancellation`, async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      pull() {
        return new Promise<void>(() => {});
      },
      cancel() {
        cancelled = true;
        return new Promise<void>(() => {});
      },
    });
    const client = createDashboardClient({
      baseUrl: "https://catalogue.test",
      timeoutMs: 500,
      fetchImpl: async () =>
        new Response(body, {
          status: responseCase.status,
          headers: { "content-type": responseCase.contentType },
        }),
    });
    const startedAt = performance.now();

    await assert.rejects(
      client.get(
        "/api/public/v2/manifest",
        new URLSearchParams(),
        manifestSchema,
      ),
      (error: unknown) =>
        error instanceof DashboardRequestError &&
        error.kind ===
          (responseCase.status === 503 ? "http_error" : "non_json"),
    );

    assert.ok(performance.now() - startedAt < 100);
    assert.equal(cancelled, true);
  });
}

test("uses manual redirect handling and rejects redirects without reading metadata", async () => {
  let redirectPolicy: RequestRedirect | undefined;
  let pulled = false;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>(
    {
      pull() {
        pulled = true;
        return new Promise<void>(() => {});
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
  const client = createDashboardClient({
    baseUrl: "https://catalogue.test",
    fetchImpl: async (_input, init) => {
      redirectPolicy = init?.redirect;
      return new Response(body, {
        status: 302,
        headers: {
          location: "https://private-redirect.test/path?secret=private",
          "content-type": "text/plain",
        },
      });
    },
  });

  await assert.rejects(
    client.get(
      "/api/public/v2/manifest",
      new URLSearchParams(),
      manifestSchema,
    ),
    (error: unknown) =>
      error instanceof DashboardRequestError &&
      error.kind === "http_error" &&
      error.status === 302 &&
      !error.message.includes("private-redirect") &&
      !error.message.includes("secret"),
  );

  assert.equal(redirectPolicy, "manual");
  assert.equal(pulled, false);
  assert.equal(cancelled, true);
});

test("keeps the timeout active while reading a stalled response body", async () => {
  const stalledBodyFetch: typeof fetch = async (_input, init) => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        init?.signal?.addEventListener(
          "abort",
          () => controller.error(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      },
    });
    return new Response(body, {
      headers: { "content-type": "application/json" },
    });
  };
  const client = createDashboardClient({
    baseUrl: "https://catalogue.test",
    timeoutMs: 20,
    fetchImpl: stalledBodyFetch,
  });

  await assert.rejects(
    Promise.race([
      client.get(
        "/api/public/v2/manifest",
        new URLSearchParams(),
        manifestSchema,
      ),
      new Promise<never>((_resolve, reject) =>
        setTimeout(
          () => reject(new Error("client did not time out the response body")),
          150,
        ),
      ),
    ]),
    (error: unknown) =>
      error instanceof DashboardRequestError && error.kind === "timeout",
  );
});

test("rejects an unreachable catalogue without exposing the fetch error", async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new TypeError("getaddrinfo ENOTFOUND internal-hostname");
  };
  const client = createDashboardClient({ fetchImpl });

  await assert.rejects(
    () =>
      client.get(
        "/api/public/v2/manifest",
        new URLSearchParams(),
        manifestSchema,
      ),
    (error: unknown) =>
      error instanceof DashboardRequestError &&
      error.kind === "unreachable" &&
      error.retryable &&
      !error.message.includes("internal-hostname"),
  );
});

test("rejects a reachable HTML response without exposing its body", async () => {
  const client = createDashboardClient({ fetchImpl: htmlFetch });

  await assert.rejects(
    () =>
      client.get(
        "/api/public/v2/manifest",
        new URLSearchParams(),
        manifestSchema,
      ),
    (error: unknown) =>
      error instanceof DashboardRequestError &&
      error.kind === "non_json" &&
      !error.message.includes("<html") &&
      !error.message.includes("private body"),
  );
});

test("checks HTTP status before reading or exposing the response body", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response("upstream diagnostic that must stay private", {
      status: 503,
      headers: { "content-type": "text/plain" },
    });
  const client = createDashboardClient({ fetchImpl });

  await assert.rejects(
    () =>
      client.get(
        "/api/public/v2/manifest",
        new URLSearchParams(),
        manifestSchema,
      ),
    (error: unknown) =>
      error instanceof DashboardRequestError &&
      error.kind === "http_error" &&
      error.status === 503 &&
      error.retryable &&
      !error.message.includes("diagnostic"),
  );
});

test("classifies malformed JSON separately from a schema-invalid payload", async (t) => {
  await t.test("malformed JSON is non_json", async () => {
    const client = createDashboardClient({
      fetchImpl: async () =>
        new Response("{not-json-private-body", {
          headers: { "content-type": "application/json" },
        }),
    });

    await assert.rejects(
      () =>
        client.get(
          "/api/public/v2/manifest",
          new URLSearchParams(),
          manifestSchema,
        ),
      (error: unknown) =>
        error instanceof DashboardRequestError &&
        error.kind === "non_json" &&
        !error.message.includes("private-body"),
    );
  });

  await t.test("valid JSON with schema drift is invalid_payload", async () => {
    const client = createDashboardClient({
      fetchImpl: async () =>
        new Response(JSON.stringify({ schemaVersion: "2.0", private: "value" }), {
          headers: { "content-type": "application/json" },
        }),
    });

    await assert.rejects(
      () =>
        client.get(
          "/api/public/v2/manifest",
          new URLSearchParams(),
          manifestSchema,
        ),
      (error: unknown) =>
        error instanceof DashboardRequestError &&
        error.kind === "invalid_payload" &&
        !error.message.includes("private"),
    );
  });
});

test("does not retain upstream parsing details as an error cause", async () => {
  const client = createDashboardClient({
    fetchImpl: async () =>
      new Response("{private-upstream-body", {
        headers: { "content-type": "application/json" },
      }),
  });

  const error = await client
    .get(
      "/api/public/v2/manifest",
      new URLSearchParams(),
      manifestSchema,
    )
    .then(
      () => assert.fail("expected the request to fail"),
      (cause: unknown) => cause,
    );

  assert.ok(error instanceof DashboardRequestError);
  assert.equal(Object.hasOwn(error, "cause"), false);
});

test("encodes query values, sends only JSON acceptance, and returns the validated envelope", async () => {
  let requestedUrl = "";
  let requestedHeaders = new Headers();
  let requestedSignal: AbortSignal | null | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = input.toString();
    requestedHeaders = new Headers(init?.headers);
    requestedSignal = init?.signal;
    return new Response(JSON.stringify(manifestFixture), {
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  };
  const client = createDashboardClient({
    baseUrl: "https://catalogue.test/root/",
    fetchImpl,
  });
  const query = new URLSearchParams();
  query.set("cursor", opaqueCursor);
  query.set("model", "provider/model name+variant");

  const result = await client.get(
    "/api/public/v2/manifest",
    query,
    manifestSchema,
  );

  const parsedUrl = new URL(requestedUrl);
  assert.equal(parsedUrl.origin, "https://catalogue.test");
  assert.equal(parsedUrl.pathname, "/api/public/v2/manifest");
  assert.equal(parsedUrl.searchParams.get("cursor"), opaqueCursor);
  assert.equal(parsedUrl.searchParams.get("model"), "provider/model name+variant");
  assert.equal(requestedHeaders.get("accept"), "application/json");
  assert.equal(requestedHeaders.has("authorization"), false);
  assert.equal(requestedSignal?.aborted, true);
  assert.deepEqual(result, manifestFixture);
});

test("reports an invalid base URL as configuration_error without fetching", async () => {
  let fetchCalls = 0;
  const client = createDashboardClient({
    baseUrl: "file:///catalogue",
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response();
    },
  });

  await assert.rejects(
    () =>
      client.get(
        "/api/public/v2/manifest",
        new URLSearchParams(),
        manifestSchema,
      ),
    (error: unknown) =>
      error instanceof DashboardRequestError &&
      error.kind === "configuration_error" &&
      !error.retryable,
  );
  assert.equal(fetchCalls, 0);
});

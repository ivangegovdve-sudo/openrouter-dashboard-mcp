import assert from "node:assert/strict";
import test from "node:test";

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

test("times out a hung fetch and classifies it as unreachable", async () => {
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
  const fetchImpl: typeof fetch = async (input, init) => {
    requestedUrl = input.toString();
    requestedHeaders = new Headers(init?.headers);
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

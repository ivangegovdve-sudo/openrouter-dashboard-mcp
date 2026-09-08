import { z } from "zod";

import {
  dashboardBaseUrl,
  dashboardRequestTimeoutMs,
} from "../config.js";
import { withCache, type CachingClientOptions } from "./cache.js";
import { DashboardRequestError } from "./errors.js";

export interface DashboardClient {
  /** Actual configured read origin for consumers that emit source citations. */
  sourceUrl?(path: string): string;
  get<T>(
    path: string,
    query: URLSearchParams,
    schema: z.ZodType<T>,
  ): Promise<T>;
}

export type DashboardClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
  fetchImpl?: typeof fetch;
  /** Response cache. Pass `{ ttlMs: 0 }` to read live on every call. */
  cache?: CachingClientOptions | false;
};

export const DASHBOARD_MAX_RESPONSE_BYTES = 8 * 1024 * 1024;

function isJsonContentType(contentType: string | null): boolean {
  if (contentType === null) return false;
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

function requestUrl(
  path: string,
  query: URLSearchParams,
  baseUrlOverride?: string,
): URL {
  const url = new URL(path, dashboardBaseUrl(baseUrlOverride));
  url.search = query.toString();
  return url;
}

function timeoutError(): DashboardRequestError {
  return new DashboardRequestError(
    "timeout",
    "The dashboard catalogue request timed out.",
    { retryable: true },
  );
}

function responseByteLimit(override?: number): number {
  const limit = override ?? DASHBOARD_MAX_RESPONSE_BYTES;
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new DashboardRequestError(
      "configuration_error",
      "The dashboard response byte limit must be a positive safe integer.",
      { retryable: false },
    );
  }
  return limit;
}

function oversizedPayloadError(): DashboardRequestError {
  return new DashboardRequestError(
    "invalid_payload",
    "The dashboard catalogue returned an oversized payload.",
    { retryable: false },
  );
}

function contentLengthBytes(response: Response): bigint | null {
  const value = response.headers.get("content-length")?.trim();
  if (value === undefined || !/^(0|[1-9]\d*)$/.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function initiateCancellation(
  stream: ReadableStream<Uint8Array> | null,
): void {
  if (stream === null || stream.locked) return;
  try {
    void stream.cancel().catch(() => {
      // Cancellation is best-effort and must never delay the caller.
    });
  } catch {
    // Hostile or already-disposed streams cannot affect the safe result.
  }
}

async function boundedResponseText(
  response: Response,
  maxResponseBytes: number,
): Promise<string> {
  const declaredBytes = contentLengthBytes(response);
  if (
    declaredBytes !== null &&
    declaredBytes > BigInt(maxResponseBytes)
  ) {
    throw oversizedPayloadError();
  }

  if (response.body === null) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let decoded = "";
  let bytesRead = 0;
  let completed = false;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) {
        completed = true;
        break;
      }
      bytesRead += next.value.byteLength;
      if (bytesRead > maxResponseBytes) throw oversizedPayloadError();
      decoded += decoder.decode(next.value, { stream: true });
    }
    decoded += decoder.decode();
    return decoded;
  } finally {
    if (!completed) {
      try {
        void reader.cancel().catch(() => {
          // Cancellation is best-effort and must never delay the caller.
        });
      } catch {
        // Hostile or already-disposed readers cannot affect the safe result.
      }
    }
    try {
      reader.releaseLock();
    } catch {
      // A reader with in-flight cleanup remains owned by the aborted request.
    }
  }
}

export function createDashboardClient(
  options: DashboardClientOptions = {},
): DashboardClient {
  const direct = createDirectDashboardClient(options);
  // Cached by default. The host relaunches this server per session and one
  // economics call can make two dozen upstream requests, so reading live every
  // time would put avoidable load on a host that owes nobody uptime. Every
  // answer still carries how old it is.
  return options.cache === false ? direct : withCache(direct, options.cache);
}

function createDirectDashboardClient(
  options: DashboardClientOptions = {},
): DashboardClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  return {
    sourceUrl: (path: string) => requestUrl(path, new URLSearchParams(), options.baseUrl).href,
    async get<T>(
      path: string,
      query: URLSearchParams,
      schema: z.ZodType<T>,
    ): Promise<T> {
      const url = requestUrl(path, query, options.baseUrl);
      const timeoutMs = dashboardRequestTimeoutMs(options.timeoutMs);
      const maxResponseBytes = responseByteLimit(options.maxResponseBytes);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      timer.unref?.();
      let response: Response | undefined;

      try {
        response = await fetchImpl(url, {
          method: "GET",
          headers: { Accept: "application/json" },
          redirect: "manual",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new DashboardRequestError(
            "http_error",
            `The dashboard catalogue returned HTTP ${response.status}.`,
            {
              retryable: response.status === 429 || response.status >= 500,
              status: response.status,
            },
          );
        }

        if (!isJsonContentType(response.headers.get("content-type"))) {
          throw new DashboardRequestError(
            "non_json",
            "The dashboard catalogue returned a non-JSON response.",
            { retryable: false },
          );
        }

        const body = await boundedResponseText(response, maxResponseBytes);
        let decoded: unknown;
        try {
          decoded = JSON.parse(body) as unknown;
        } catch {
          throw new DashboardRequestError(
            "non_json",
            "The dashboard catalogue returned malformed JSON.",
            { retryable: false },
          );
        }

        const parsed = schema.safeParse(decoded);
        if (!parsed.success) {
          throw new DashboardRequestError(
            "invalid_payload",
            "The dashboard catalogue returned an invalid payload.",
            { retryable: false },
          );
        }
        return parsed.data;
      } catch (cause) {
        if (cause instanceof DashboardRequestError) throw cause;
        if (controller.signal.aborted) throw timeoutError();
        throw new DashboardRequestError(
          "unreachable",
          "Cannot reach the dashboard catalogue right now.",
          { retryable: true },
        );
      } finally {
        clearTimeout(timer);
        initiateCancellation(response?.body ?? null);
        controller.abort();
      }
    },
  };
}

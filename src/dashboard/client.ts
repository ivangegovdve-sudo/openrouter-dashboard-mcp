import { z } from "zod";

import {
  dashboardBaseUrl,
  dashboardRequestTimeoutMs,
} from "../config.js";
import { DashboardRequestError } from "./errors.js";

export interface DashboardClient {
  get<T>(
    path: string,
    query: URLSearchParams,
    schema: z.ZodType<T>,
  ): Promise<T>;
}

export type DashboardClientOptions = {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

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

export function createDashboardClient(
  options: DashboardClientOptions = {},
): DashboardClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  return {
    async get<T>(
      path: string,
      query: URLSearchParams,
      schema: z.ZodType<T>,
    ): Promise<T> {
      const url = requestUrl(path, query, options.baseUrl);
      const timeoutMs = dashboardRequestTimeoutMs(options.timeoutMs);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      timer.unref?.();

      try {
        const response = await fetchImpl(url, {
          method: "GET",
          headers: { Accept: "application/json" },
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

        const body = await response.text();
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
      }
    },
  };
}

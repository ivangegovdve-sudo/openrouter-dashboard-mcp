import { DashboardRequestError } from "./dashboard/errors.js";

export const DEFAULT_DASHBOARD_BASE_URL =
  "https://openrouter-github-dashboard.vercel.app";
export const DASHBOARD_REQUEST_TIMEOUT_MS = 10_000;

export function dashboardBaseUrl(override?: string): URL {
  const configured =
    override ?? process.env.DASHBOARD_BASE_URL ?? DEFAULT_DASHBOARD_BASE_URL;

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new DashboardRequestError(
      "configuration_error",
      "DASHBOARD_BASE_URL must be an absolute HTTP(S) URL.",
      { retryable: false },
    );
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username !== "" ||
    url.password !== ""
  ) {
    throw new DashboardRequestError(
      "configuration_error",
      "DASHBOARD_BASE_URL must be an absolute HTTP(S) URL without credentials.",
      { retryable: false },
    );
  }

  return url;
}

export function dashboardRequestTimeoutMs(override?: number): number {
  const timeoutMs = override ?? DASHBOARD_REQUEST_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new DashboardRequestError(
      "configuration_error",
      "The dashboard request timeout must be a positive number.",
      { retryable: false },
    );
  }
  return timeoutMs;
}

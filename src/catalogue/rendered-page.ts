import { chromium } from "playwright";

/** A deliberately attribute-free capture of visible, rendered table cells. */
export type RenderedTable = {
  caption: string | null;
  rows: string[][];
};

export type RenderedPageSnapshot = {
  url: string;
  fetchedAt: string;
  /** Set only after the browser sees a stable, fully loaded DOM. */
  domSettled: true;
  tables: RenderedTable[];
};

export type RenderedPageFetcher = (input: {
  url: string;
  timeoutMs: number;
}) => Promise<RenderedPageSnapshot>;

type TableCellLike = { innerText: string };
type TableRowLike = { cells: ArrayLike<TableCellLike> };
type TableLike = { rows: ArrayLike<TableRowLike>; caption?: { innerText: string } | null };
type TableDocumentLike = { querySelectorAll(selector: "table"): ArrayLike<TableLike> };

function visibleText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Runs in the page's JavaScript realm in production and accepts a DOM-shaped
 * fixture in tests. It deliberately reads HTMLTableElement.rows/cells and
 * visible innerText only: aria labels are not a price source.
 */
export function extractVisibleTableRows(root?: TableDocumentLike): RenderedTable[] {
  const documentRoot = root ?? (document as unknown as TableDocumentLike);
  return Array.from(documentRoot.querySelectorAll("table"), (table) => ({
    caption: table.caption ? visibleText(table.caption.innerText) || null : null,
    rows: Array.from(table.rows, (row) => Array.from(row.cells, (cell) => visibleText(cell.innerText))),
  })).filter((table) => table.rows.some((row) => row.length > 0));
}

function browserLaunchAttempts(): Array<{ channel?: "chrome" | "msedge"; executablePath?: string }> {
  const executablePath = process.env.OPEN_DASHBOARD_BROWSER_EXECUTABLE?.trim();
  if (executablePath) return [{ executablePath }];

  const configured = process.env.OPEN_DASHBOARD_BROWSER_CHANNEL?.trim().toLowerCase();
  if (configured === "chrome" || configured === "msedge") return [{ channel: configured }];

  // Playwright's bundled Chromium is the final attempt. Windows installations
  // commonly expose an already-managed Chrome or Edge channel instead.
  return process.platform === "win32"
    ? [{ channel: "chrome" }, { channel: "msedge" }, {}]
    : [{}];
}

/**
 * Render a provider page in a real browser, wait for a settled DOM, then
 * return only the visible table-cell text. This is never a raw HTML fetch.
 */
export const fetchRenderedPageWithPlaywright = async (
  { url, timeoutMs }: Parameters<RenderedPageFetcher>[0],
  serverlessLaunch?: { executablePath: string; args: string[] },
): Promise<RenderedPageSnapshot> => {
  const target = new URL(url);
  if (target.protocol !== "https:") throw new Error("RENDERED_PAGE_URL_REJECTED");
  const boundedTimeout = Math.min(Math.max(timeoutMs, 1), 30_000);
  let lastError: unknown;

  for (const launchOptions of serverlessLaunch ? [serverlessLaunch] : browserLaunchAttempts()) {
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      browser = await chromium.launch({ headless: true, ...launchOptions });
      const page = await browser.newPage();
      page.setDefaultTimeout(boundedTimeout);
      await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: boundedTimeout });
      await page.waitForFunction(() => document.readyState === "complete", undefined, { timeout: boundedTimeout });
      const tableFingerprint = async () => page.evaluate(() => JSON.stringify(
        Array.from(document.querySelectorAll("table"), (table) => Array.from(table.rows, (row) =>
          Array.from(row.cells, (cell) => cell.innerText.replace(/\s+/g, " ").trim()),
        )),
      ));
      // A fresh page can reach `complete` before its client-rendered table
      // arrives. Require two identical visible-table snapshots instead of
      // comparing a later DOM to the pre-render loading shell.
      const deadline = Date.now() + boundedTimeout;
      const settleMs = Math.min(1_000, Math.max(100, Math.floor(boundedTimeout / 10)));
      let previousFingerprint = await tableFingerprint();
      let settled = false;
      while (Date.now() < deadline) {
        await page.waitForTimeout(Math.min(settleMs, Math.max(1, deadline - Date.now())));
        const currentFingerprint = await tableFingerprint();
        if (currentFingerprint === previousFingerprint) {
          settled = true;
          break;
        }
        previousFingerprint = currentFingerprint;
      }
      if (!settled) throw new Error("RENDERED_PAGE_DOM_UNSETTLED");
      const tables = await page.evaluate(() => Array.from(document.querySelectorAll("table"), (table) => ({
        caption: table.caption ? table.caption.innerText.replace(/\s+/g, " ").trim() || null : null,
        rows: Array.from(table.rows, (row) => Array.from(row.cells, (cell) => cell.innerText.replace(/\s+/g, " ").trim())),
      })).filter((table) => table.rows.some((row) => row.length > 0)));
      return { url: page.url(), fetchedAt: new Date().toISOString(), domSettled: true, tables };
    } catch (error) {
      lastError = error;
    } finally {
      await browser?.close().catch(() => undefined);
    }
  }
  // The caller records an unread renderer as UNKNOWN; error detail is not
  // serialized because browser paths and remote response data are not evidence.
  void lastError;
  throw new Error("RENDERED_PAGE_FETCH_FAILED");
};

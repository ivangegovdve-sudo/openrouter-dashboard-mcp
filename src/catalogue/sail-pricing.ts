import { createHash } from "node:crypto";

import { exactDecimalRatio } from "./decimal.js";
import { normalizePricePoint } from "./price-set.js";
import type { PricePoint } from "../contract.js";

/**
 * Sail's prices live only in a human-readable document; its /models returns
 * ids and nothing else. The document is quoted only when its bytes hash to the
 * pinned digest, so a restructured or repriced page silences Sail instead of
 * feeding a parser that no longer knows what it is reading.
 *
 * Re-pinned 2026-09-26: the previous pin (32447697...) priced 10 models; the live
 * document now prices all 12 catalogue ids. Five models were added, five
 * repriced (GLM-5.3 ASAP 1.40/4.40 -> 0.98/3.08 per million), two retired.
 * The fixture `sail-pricing.md` is these exact bytes.
 */
export const SAIL_PRICING_URL = "https://docs.sailresearch.com/pricing.md";
export const SAIL_PRICING_DIGEST = "2a939cfdb7c54fdd9a298f0cfec6e43fcc08d2d75620ea8344c568657ddca7cf";

export type SailPricing =
  | { state: "verified"; digest: string; prices: Map<string, PricePoint[]> }
  | { state: "stale"; digest: string };

/** Hash, verify and parse the Sail pricing document. Never falls back to old prices. */
export function parseSailPricing(doc: Buffer, readAt: string): SailPricing {
  const digest = createHash("sha256").update(doc).digest("hex");
  if (digest !== SAIL_PRICING_DIGEST) return { state: "stale", digest };
  const prices = new Map<string, PricePoint[]>();
  const docStr = doc.toString("utf-8");
  const groupRe = /data-model="([^"]+)"(.*?)(?=data-model="|$)/gs;
  let match;
  while ((match = groupRe.exec(docStr)) !== null) {
    const modelId = match[1] || "";
    const block = match[2] || "";
    const rowRe = /aria-label="([^"]*?) pricing: input \$([\d.]+), cached \$([\d.]+), output \$([\d.]+)/g;
    const pricePoints: PricePoint[] = [];
    let rowMatch;
    while ((rowMatch = rowRe.exec(block)) !== null) {
      if (!rowMatch[1] || !rowMatch[2] || !rowMatch[3] || !rowMatch[4]) continue;
      const labelLower = rowMatch[1].toLowerCase();
      let rowWindow: "asap" | "balanced" | "flex" | null = null;
      if (labelLower.includes("asap")) rowWindow = "asap";
      else if (labelLower.includes("balanced")) rowWindow = "balanced";
      else if (labelLower.includes("flex")) rowWindow = "flex";
      else continue;
      const condition = {
        kind: "latency_window" as const,
        name: rowWindow === "asap" ? "ASAP" as const : rowWindow === "balanced" ? "Balanced" as const : "Flex" as const,
      };
      for (const [leg, value, unit] of [
        ["input", rowMatch[2], "token_in"],
        ["cached", rowMatch[3], "token_cached"],
        ["output", rowMatch[4], "token_out"],
      ] as const) {
        pricePoints.push(normalizePricePoint({
          id: `sail:${modelId}:${rowWindow}:${leg}`,
          value: exactDecimalRatio(value, "1", "1000000").value!,
          unit,
          condition,
          sourceUrl: SAIL_PRICING_URL,
          readAt,
          provenance: "published",
          measurementOrigin: "catalogue",
          observed: null,
          sourceText: rowMatch[0],
        }));
      }
    }
    if (pricePoints.length > 0) prices.set(modelId, pricePoints);
  }
  return { state: "verified", digest, prices };
}

import type { ExactPrice } from "./schemas.js";

type Ratio = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => b === 0n ? a : gcd(b, a % b);
function decimal(input: string): Ratio {
  const m = /^(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(input.trim());
  if (!m) throw new Error("Invalid nonnegative decimal");
  const exponent = Number(m[3] ?? 0) - (m[2]?.length ?? 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000 || input.length > 2000) throw new Error("Decimal exceeds bounds");
  const n = BigInt(m[1]! + (m[2] ?? ""));
  return exponent >= 0 ? { n: n * 10n ** BigInt(exponent), d: 1n } : { n, d: 10n ** BigInt(-exponent) };
}
/** Decimal digits and integer division only: never binary floating point price arithmetic. */
export function exactDecimalRatio(value: string, multiplier = "1", divisor = "1"): { numerator: string; denominator: string; value?: string } {
  const a = decimal(value), b = decimal(multiplier), c = decimal(divisor);
  if (c.n === 0n) throw new Error("Zero price conversion divisor");
  let n = a.n * b.n * c.d, d = a.d * b.d * c.n;
  const factor = gcd(n, d); n /= factor; d /= factor;
  const result: { numerator: string; denominator: string; value?: string } = { numerator: String(n), denominator: String(d) };
  let remainder = d, twos = 0, fives = 0;
  while (remainder % 2n === 0n) { remainder /= 2n; twos++; }
  while (remainder % 5n === 0n) { remainder /= 5n; fives++; }
  if (remainder !== 1n) return result; // A recurring decimal remains an exact rational; never round silently.
  const places = Math.max(twos, fives);
  const digits = String(n * 2n ** BigInt(places - twos) * 5n ** BigInt(places - fives)).padStart(places + 1, "0");
  result.value = places ? `${digits.slice(0, -places)}.${digits.slice(-places)}`.replace(/0+$/, "").replace(/\.$/, "") : digits;
  return result;
}
export function normalizeExactPrice(args: {
  value: string; nativeUnit: string; sourceField: string; unit: ExactPrice["unit"];
  sourceUrl: string; multiplier?: string; divisor?: string; conditions?: Record<string, unknown>;
}): ExactPrice {
  const multiplier = args.multiplier ?? "1", divisor = args.divisor ?? "1";
  const { value, ...exact } = exactDecimalRatio(args.value, multiplier, divisor);
  return {
    unit: args.unit, ...(value === undefined ? {} : { value }), exact,
    native: { value: args.value, unit: args.nativeUnit, sourceField: args.sourceField },
    conversion: { operation: "multiply_then_divide", multiplier, divisor, formula: `${args.value} * ${multiplier} / ${divisor}` },
    conditions: args.conditions ?? {}, sourceUrl: args.sourceUrl,
  };
}

import { exactDecimalRatio, normalizeExactPrice } from "./decimal.js";
import { parseNativeJson } from "./json.js";
import { record, type NativeRecord } from "./normalize.js";
import { catalogueModelSchema, catalogueProviderSchema, type CatalogueModel, type CatalogueProvider, type ExactPrice, type MediaKind } from "./schemas.js";

export const CRAZYROUTER_MODELS_URL = "https://api.crazyrouter.com/v1/models";
export const CRAZYROUTER_PRICING_URL = "https://crazyrouter.com/api/pricing";
/** Provider-owned code linked by /pricing, inspected 2026-09-08; not an inferred upstream-provider price. */
export const CRAZYROUTER_FORMULA_SOURCE = "https://crazyrouter.com/assets/mtrgex7b/pricingHelpers-Dhu58xYK.js";
export interface CollectCrazyrouterOptions {
  apiKey?: string | null;
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  /** Public pricing group to quote; does not establish the account's billing group. */
  group?: string;
}
export type CrazyrouterCollection = { provider: CatalogueProvider; models: CatalogueModel[] };
class SourceError extends Error {}
const safeError = (error: unknown) => error instanceof SourceError ? error.message : "SOURCE_FETCH_OR_SHAPE_FAILED";
const string = (value: unknown): string | undefined => typeof value === "string" && value.length > 0 ? value : undefined;
function decimal(value: unknown): string {
  const text = string(value);
  if (text === undefined) throw new Error("Missing source decimal");
  exactDecimalRatio(text); // Validates signs and bounded precision without Number conversion.
  return text;
}
function multiply(...values: string[]): string {
  return values.reduce((product, value) => exactDecimalRatio(product, value).value!, "1");
}
async function readJson(fetchImpl: typeof fetch, url: string, timeout: number, apiKey?: string): Promise<NativeRecord> {
  if (![CRAZYROUTER_MODELS_URL, CRAZYROUTER_PRICING_URL].includes(url) || (apiKey && url !== CRAZYROUTER_MODELS_URL)) throw new SourceError("UNAPPROVED_SOURCE");
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetchImpl(url, { method: "GET", redirect: "error", signal: controller.signal,
      headers: { Accept: "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) } });
    if (!response.ok) throw new SourceError(`HTTP_${response.status}`);
    if (!response.body) throw new SourceError("EMPTY_RESPONSE_BODY");
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, text = "";
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 12 * 1024 * 1024) { await reader.cancel(); throw new SourceError("RESPONSE_SIZE_LIMIT"); }
      text += decoder.decode(value, { stream: true });
    }
    const payload = record(parseNativeJson(text + decoder.decode()));
    if (apiKey && (text.includes(apiKey) || JSON.stringify(payload).includes(apiKey))) throw new SourceError("UNSAFE_REFLECTED_CREDENTIAL");
    if (payload.success !== true || !Array.isArray(payload.data) || payload.data.length > 20000) throw new SourceError("SOURCE_SHAPE_CHANGED");
    if (url === CRAZYROUTER_MODELS_URL && payload.object !== "list") throw new SourceError("MODELS_SHAPE_CHANGED");
    return payload;
  } catch (error) {
    if (controller.signal.aborted) throw new SourceError("SOURCE_TIMEOUT");
    throw error;
  } finally { clearTimeout(timer); }
}

function normalizeModel(args: {
  id: string; catalogueRow: NativeRecord; priceRow?: NativeRecord; priceIndex?: number; vendor?: NativeRecord | undefined;
  groupRatios: NativeRecord; group: string; sourceUrl: string; observedAt: string; sourceIndex: number; absentReason: string;
}): CatalogueModel {
  const row = args.priceRow, prices: ExactPrice[] = [];
  let reason = args.absentReason;
  const nativeType = string(row?.billing_mode) ?? (row?.quota_type === "0" ? "per_token" : null);
  const profile = record(record(row?.video_pricing).profile), imageProfile = record(record(row?.image_pricing).profile);
  const publishedModalities = args.catalogueRow.output_modalities ?? row?.output_modalities;
  const outputModalities = Array.isArray(publishedModalities) && publishedModalities.every(value => typeof value === "string") ? publishedModalities as string[] : undefined;
  const modality = outputModalities?.[0] ?? profile.modality ?? imageProfile.modality ?? (nativeType === "per_image" ? "image" : nativeType === "per_second" && row?.video_pricing ? "video" : undefined);
  const mediaKind: MediaKind = ["image", "video", "text", "audio"].includes(String(modality)) ? modality as MediaKind : "unknown";
  if (row) {
    reason = "native_billing_not_supported";
    if (row.quota_type === "0" && !row.billing_expr && !row.tiered_expr && !row.time_pricing && !row.video_pricing && !row.image_pricing && (!row.billing_mode || row.billing_mode === "per_token")) {
      reason = "missing_or_invalid_price_coefficient";
      try {
        if (!Array.isArray(row.enable_groups) || !row.enable_groups.includes(args.group) || !Object.hasOwn(args.groupRatios, args.group)) throw new Error("Group not published");
        const ratio = decimal(row.model_ratio), completion = decimal(row.completion_ratio), discount = decimal(row.discount), groupRatio = decimal(args.groupRatios[args.group]);
        for (const [leg, coefficient, unit] of [["input", "1", "usd_per_input_token"], ["output", completion, "usd_per_output_token"]] as const) {
          const gross = multiply(ratio, "2", coefficient, groupRatio), net = multiply(gross, discount);
          prices.push(normalizeExactPrice({ value: ratio, nativeUnit: "crazyrouter_model_ratio", sourceField: `data[${args.priceIndex}].model_ratio`,
            unit, sourceUrl: CRAZYROUTER_PRICING_URL, multiplier: multiply("2", coefficient, groupRatio, discount), divisor: "1000000",
            conditions: { currency: "USD", leg, basis: "public_group_quote_not_account_settlement", group: args.group, groupRatio,
              modelRatio: ratio, completionRatio: completion, discount, accountGroupVerified: false, grossUsdPerMillionTokens: gross,
              netUsdPerMillionTokens: net, formula: `model_ratio * 2 * ${leg === "output" ? "completion_ratio * " : ""}group_ratio * discount / 1000000`,
              formulaSourceUrl: CRAZYROUTER_FORMULA_SOURCE, formulaObservedAt: "2026-09-08", priceObservedAt: args.observedAt,
              excludes: ["cache token categories", "tool or search fees", "account-specific billing adjustments"] } }));
        }
      } catch { prices.length = 0; }
    }
  }
  return catalogueModelSchema.parse({ provider: "crazyrouter", id: args.id, displayName: args.id, mediaKind, nativeType,
    ...(outputModalities ? { outputModalities } : {}),
    pricing: { status: prices.length ? "available" : "price_not_available", prices, ...(prices.length ? {} : { reason }),
      native: { catalogueRow: args.catalogueRow, pricingRow: row ?? null, vendor: args.vendor ?? null, groupRatios: args.groupRatios, identitySource: args.sourceUrl } },
    provenance: { sourceUrl: args.sourceUrl, observedAt: args.observedAt, sourceIndex: args.sourceIndex } });
}

export async function collectCrazyrouterCatalogue(options: CollectCrazyrouterOptions = {}): Promise<CrazyrouterCollection> {
  const apiKey = options.apiKey === null ? undefined : options.apiKey ?? process.env.CRAZYROUTER_API_KEY;
  const authenticated = Boolean(apiKey), sourceUrl = authenticated ? CRAZYROUTER_MODELS_URL : CRAZYROUTER_PRICING_URL;
  const observedAt = (options.now ?? (() => new Date()))().toISOString(), group = options.group ?? "default";
  const timeout = Math.min(30000, Math.max(1, options.timeoutMs ?? 10000)), fetchImpl = options.fetchImpl ?? fetch;
  const requestParameters: Record<string, unknown> = { providerKind: "aggregator", modelFilter: "none", priceFilter: "none", includeUnpriced: true,
    populationScope: authenticated ? "models_visible_to_current_api_key" : "public_pricing_rows_only", platformModelCount: null,
    authenticatedCatalogueStatus: authenticated ? "requested" : "not_configured", pricingSourceUrl: CRAZYROUTER_PRICING_URL,
    pricingGroup: group, pricingGroupAccountVerified: false, timeoutMs: timeout, priceJoinRule: "exact case-sensitive model id only" };
  let payload: NativeRecord;
  try { payload = await readJson(fetchImpl, sourceUrl, timeout, authenticated ? apiKey : undefined); }
  catch (error) {
    if (authenticated) requestParameters.authenticatedCatalogueStatus = "unavailable";
    requestParameters.acquisitionError = safeError(error);
    requestParameters.sourceListedCount = null; requestParameters.excludedCount = null; requestParameters.exclusionRules = [];
    return { provider: catalogueProviderSchema.parse({ provider: "crazyrouter", status: "unavailable", sourceUrl, observedAt, error: safeError(error), requestParameters,
      population: { listed: null, received: null, retained: null, excluded: null, exclusionRules: [], completeness: "unavailable" } }), models: [] };
  }
  if (authenticated) requestParameters.authenticatedCatalogueStatus = "available";
  let pricingPayload: NativeRecord = payload, pricingFailed = false;
  try {
    if (authenticated) pricingPayload = await readJson(fetchImpl, CRAZYROUTER_PRICING_URL, timeout);
    requestParameters.pricingAcquisitionStatus = "available";
    requestParameters.publicPricingRowCount = (pricingPayload.data as unknown[]).length;
  } catch (error) {
    pricingPayload = {}; pricingFailed = true;
    requestParameters.pricingAcquisitionStatus = "unavailable"; requestParameters.pricingError = safeError(error);
  }
  const priceMap = new Map<string, Array<{ row: NativeRecord; index: number }>>();
  const priceRows = Array.isArray(pricingPayload.data) ? pricingPayload.data : [], pricingExclusions: string[] = [];
  let pricingIncomplete = pricingPayload.has_more === true || Boolean(pricingPayload.next_cursor) || (pricingPayload.total !== undefined && String(pricingPayload.total) !== String(priceRows.length));
  for (const [index, raw] of priceRows.entries()) {
    const row = record(raw), id = string(row.model_name);
    if (!id) { pricingExclusions.push(`pricing row ${index}: missing stable native model identity`); pricingIncomplete = true; continue; }
    const values = priceMap.get(id) ?? []; values.push({ row, index }); priceMap.set(id, values);
    if (values.length > 1) pricingIncomplete = true;
  }
  requestParameters.pricingExcludedCount = pricingFailed ? null : pricingExclusions.length;
  requestParameters.pricingExclusionRules = pricingExclusions;
  if (pricingIncomplete && !pricingFailed) {
    requestParameters.pricingAcquisitionStatus = "partial";
    requestParameters.pricingError = "INCOMPLETE_OR_AMBIGUOUS_PRICING_OBSERVATION";
  }
  const vendors = new Map<string, NativeRecord[]>();
  for (const raw of (Array.isArray(pricingPayload.vendors) ? pricingPayload.vendors : [])) {
    const vendor = record(raw), id = string(vendor.id); if (!id) continue;
    const matches = vendors.get(id) ?? []; matches.push(vendor); vendors.set(id, matches);
  }
  const models: CatalogueModel[] = [], exclusions: string[] = [], identities = new Set<string>();
  const rows = payload.data as unknown[];
  let duplicate = false;
  for (const [index, raw] of rows.entries()) {
    const row = record(raw), id = string(authenticated ? row.id : row.model_name);
    if (!id) { exclusions.push(`row ${index}: missing stable native model identity`); continue; }
    if (identities.has(id)) duplicate = true;
    identities.add(id);
    const matches = priceMap.get(id) ?? [], matched = matches.length === 1 ? matches[0] : undefined;
    const vendorId = string(matched?.row.vendor_id), vendorMatches = vendorId ? vendors.get(vendorId) ?? [] : [];
    models.push(normalizeModel({ id, catalogueRow: row, ...(matched ? { priceRow: matched.row, priceIndex: matched.index, vendor: vendorMatches.length === 1 ? vendorMatches[0] : undefined } : {}),
      groupRatios: record(pricingPayload.group_ratio), group, sourceUrl, observedAt, sourceIndex: index,
      absentReason: pricingFailed ? "pricing_source_unavailable" : matches.length > 1 ? "ambiguous_public_pricing_identity" : pricingIncomplete ? "pricing_observation_incomplete" : "price_absent_from_public_pricing" }));
  }
  const totalText = string(payload.total), parsedTotal = totalText && /^\d+$/.test(totalText) ? Number(totalText) : NaN;
  const declaredTotal = Number.isSafeInteger(parsedTotal) ? parsedTotal : null;
  const paginationUnknown = payload.has_more === true || Boolean(payload.next_cursor) || (payload.total !== undefined && declaredTotal !== rows.length);
  const incomplete = duplicate || exclusions.length > 0 || paginationUnknown;
  requestParameters.returnedIdentityRows = rows.length;
  requestParameters.sourceListedCount = authenticated ? (payload.total === undefined ? rows.length : declaredTotal) : null;
  requestParameters.excludedCount = exclusions.length; requestParameters.exclusionRules = exclusions;
  requestParameters.pricingMatchedModels = models.filter(model => model.pricing.status === "available").length;
  const provider = catalogueProviderSchema.parse({ provider: "crazyrouter", status: pricingFailed || pricingIncomplete || incomplete ? "partial" : "available", sourceUrl, observedAt, requestParameters,
    ...(incomplete ? { error: duplicate ? "DUPLICATE_IDENTITY" : exclusions.length ? "INVALID_MODEL_IDENTITY" : "UNEXPECTED_PAGINATION_OR_TOTAL" } : {}),
    population: { listed: authenticated ? (payload.total === undefined ? rows.length : declaredTotal) : null, received: rows.length, retained: models.length, excluded: exclusions.length,
      exclusionRules: exclusions, completeness: incomplete ? "partial" : authenticated ? "full" : "unknown" } });
  return { provider, models };
}

export type CrazyrouterIdentity = {
  exactModelAlias: string;
  authorNamespace?: string;
  nativeVendorName: string | null;
  nativeOwner: string | null;
  basis: string;
  snapshotEquivalence: "not_established";
};
/** Explicit provider-author namespace evidence, never a display-name similarity join. */
export function crazyrouterIdentity(model: CatalogueModel): CrazyrouterIdentity {
  const native = record(model.pricing.native), vendor = record(native.vendor), catalogueRow = record(native.catalogueRow);
  const vendorName = string(vendor.name), owner = string(catalogueRow.owned_by);
  const vendorNamespaces: Record<string, string> = { OpenAI: "openai", Anthropic: "anthropic", Google: "google" };
  const ownerNamespaces: Record<string, string> = { openai: "openai", anthropic: "anthropic", google: "google" };
  const vendorAuthor = vendorName && Object.hasOwn(vendorNamespaces, vendorName) ? vendorNamespaces[vendorName] : undefined;
  const ownerAuthor = owner && Object.hasOwn(ownerNamespaces, owner) ? ownerNamespaces[owner] : undefined;
  const conflict = vendorAuthor && ownerAuthor && vendorAuthor !== ownerAuthor;
  const author = model.provider === "crazyrouter" && !conflict ? vendorAuthor ?? ownerAuthor : undefined;
  return { exactModelAlias: model.id, ...(author ? { authorNamespace: author } : {}), nativeVendorName: vendorName ?? null, nativeOwner: owner ?? null,
    basis: conflict ? "conflicting_native_author_evidence" : author ? "explicit_native_vendor_or_owner_namespace_and_exact_alias" : "author_namespace_not_established",
    snapshotEquivalence: "not_established" };
}

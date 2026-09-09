import { mediaCatalogueSchema, type CatalogueModel, type CatalogueProvider, type MediaCatalogue, type MediaCatalogueProviderId } from "./schemas.js";
import { normalizeChutes, normalizeDeepInfra, normalizeFal, normalizeFalAuthenticated, normalizeWaveSpeed, parseFalPricingPage, record, scalar, type NativeRecord } from "./normalize.js";
import { parseNativeJson } from "./json.js";
export * from "./schemas.js";
export * from "./decimal.js";
export * from "./json.js";
export * from "./price-set.js";

export const MEDIA_CATALOGUE_PROVIDER_IDS: MediaCatalogueProviderId[] = ["deepinfra", "wavespeed", "fal", "chutes"];
export const MEDIA_CATALOGUE_SOURCES: Record<MediaCatalogueProviderId, string> = {
  deepinfra: "https://api.deepinfra.com/models/list",
  wavespeed: "https://wavespeed.ai/api/models",
  fal: "https://api.fal.ai/v1/models",
  chutes: "https://api.chutes.ai/chutes/",
};
export const DEFAULT_WAVESPEED_ENRICH_IDS = [
  "wavespeed-ai/wan-2.2/t2v-720p",
  "wavespeed-ai/wan-2.2/i2v-720p",
  "wavespeed-ai/wan-2.2/t2v-720p-ultra-fast",
  "wavespeed-ai/wan-2.2/i2v-720p-ultra-fast",
] as const;
export interface CollectMediaCatalogueOptions {
  providers?: MediaCatalogueProviderId[];
  fetchImpl?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  maxPages?: number;
  /** Omit to use FAL_API_KEY; an explicit empty string selects public sources. */
  falApiKey?: string;
  /** Maximum authenticated fal batches (50 model ids each), default 40, cap 64. */
  maxFalPriceBatches?: number;
  /** Additional WaveSpeed ids to resolve pricing for; all identities still collected. */
  enrichIds?: string[];
}
function count(value: unknown): number | null {
  if (value == null || !/^\d+$/.test(String(value))) return null;
  const n = Number(value); return Number.isSafeInteger(n) ? n : null;
}
class CatalogueFetchError extends Error {}
function safeError(error: unknown): string {
  // Never reflect remote response bodies, URLs, credentials, or exception messages.
  return error instanceof CatalogueFetchError ? error.message : "SOURCE_FETCH_OR_SHAPE_FAILED";
}
async function readSource(fetchImpl: typeof fetch, url: string, timeoutMs: number, authorization?: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { method: "GET", headers: { Accept: "application/json,text/html", "User-Agent": "open-dashboard-mcp catalogue/0.9", ...(authorization ? { Authorization: authorization } : {}) }, signal: controller.signal, redirect: "error" });
    if (!response.ok) throw new CatalogueFetchError(`HTTP_${response.status}`);
    if (Number(response.headers.get("content-length")) > 12 * 1024 * 1024) throw new CatalogueFetchError("RESPONSE_SIZE_LIMIT");
    if (!response.body) throw new CatalogueFetchError("EMPTY_RESPONSE_BODY");
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, text = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 12 * 1024 * 1024) { await reader.cancel(); throw new CatalogueFetchError("RESPONSE_SIZE_LIMIT"); }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    if (controller.signal.aborted) throw new CatalogueFetchError("SOURCE_TIMEOUT");
    throw error;
  } finally { clearTimeout(timer); }
}
type Collection = { provider: CatalogueProvider; models: CatalogueModel[] };
async function collectProvider(provider: MediaCatalogueProviderId, options: CollectMediaCatalogueOptions): Promise<Collection> {
  const sourceUrl = MEDIA_CATALOGUE_SOURCES[provider], observedAt = (options.now ?? (() => new Date()))().toISOString();
  const fetchImpl = options.fetchImpl ?? fetch, timeout = Math.min(Math.max(options.timeoutMs ?? 10000, 1), 30000), maxPages = Math.min(Math.max(options.maxPages ?? 32, 1), 64);
  const deadline = Date.now() + 60000;
  const falApiKey = provider === "fal" ? (options.falApiKey ?? process.env.FAL_API_KEY)?.trim() : undefined;
  const request = async (url: string) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new CatalogueFetchError("PROVIDER_TIME_BUDGET");
    const target = new URL(url);
    const authorization = falApiKey && target.origin === "https://api.fal.ai" && ["/v1/models", "/v1/models/pricing"].includes(target.pathname) ? `Key ${falApiKey}` : undefined;
    const text = await readSource(fetchImpl, url, Math.min(timeout, remaining), authorization);
    // Authenticated metadata is still untrusted: reject a reflected credential
    // before parsing or retaining any successful response fields.
    if (authorization && falApiKey && text.includes(falApiKey)) throw new CatalogueFetchError("SOURCE_CREDENTIAL_REFLECTION");
    return text;
  };
  const rows: NativeRecord[] = [], rowUrls: string[] = [];
  let listed: number | null = null, complete = false, pricingFailed = false, error: string | undefined, pageCount = 0, received = false;
  const requestParameters: Record<string, unknown> = { modelFilter: "none", priceFilter: "none", includeUnpriced: true, pageLimit: maxPages, timeoutMs: timeout, providerBudgetMs: 60000 };
  const cursors = new Set<string>(); let cursor: string | undefined;
  try {
    for (let page = 0; page < maxPages; page++) {
      const url = new URL(sourceUrl);
      if (provider === "wavespeed") { url.searchParams.set("page", String(page + 1)); url.searchParams.set("page_size", "200"); }
      if (provider === "fal") { url.searchParams.set("limit", "1000"); if (cursor) url.searchParams.set("cursor", cursor); }
      if (provider === "chutes") { url.searchParams.set("include_public", "true"); url.searchParams.set("limit", "1000"); url.searchParams.set("page", String(page)); }
      const payload = parseNativeJson(await request(url.href)), obj = record(payload);
      const pageRows = provider === "deepinfra" ? payload : provider === "fal" ? obj.models : obj.items;
      if (!Array.isArray(pageRows)) throw new CatalogueFetchError("CATALOGUE_SHAPE_CHANGED");
      if (pageRows.some(row => !row || typeof row !== "object" || Array.isArray(row))) throw new CatalogueFetchError("MODEL_ROW_SHAPE_CHANGED");
      const reportedTotal = count(obj.total);
      if (reportedTotal !== null) {
        if (listed !== null && listed !== reportedTotal) throw new CatalogueFetchError("POPULATION_CHANGED_DURING_PAGINATION");
        listed = reportedTotal;
      }
      rows.push(...pageRows as NativeRecord[]); rowUrls.push(...pageRows.map(() => url.href)); received = true; pageCount++;
      if (rows.length > 20000) throw new CatalogueFetchError("MODEL_COUNT_LIMIT");
      if (provider === "deepinfra") { listed = rows.length; complete = true; break; }
      if (provider === "fal") {
        if (obj.has_more === false && obj.next_cursor === null) {
          if (listed !== null && listed !== rows.length) throw new CatalogueFetchError("POPULATION_COUNT_MISMATCH");
          if (listed === null) listed = rows.length;
          complete = true; break;
        }
        cursor = scalar(obj.next_cursor);
        if (obj.has_more !== true || !cursor || cursors.has(cursor) || pageRows.length === 0) throw new CatalogueFetchError("INVALID_PAGINATION_CURSOR");
        cursors.add(cursor);
      } else {
        if (listed === null) throw new CatalogueFetchError("POPULATION_DENOMINATOR_MISSING");
        if (rows.length === listed) { complete = true; break; }
        if (rows.length > listed || pageRows.length === 0) throw new CatalogueFetchError("POPULATION_COUNT_MISMATCH");
      }
    }
    if (!complete) throw new CatalogueFetchError("PAGE_BUDGET_EXHAUSTED");
    if (rows.length === 0) throw new CatalogueFetchError("EMPTY_CATALOGUE_UNVERIFIED");
  } catch (cause) { error = safeError(cause); complete = false; }
  requestParameters.pagesFetched = pageCount;

  const models: CatalogueModel[] = [], exclusions: string[] = [], identities = new Set<string>();
  for (let index = 0; index < rows.length; index++) {
    try {
      const row = rows[index]!, url = rowUrls[index]!;
      const model = provider === "deepinfra" ? normalizeDeepInfra(row, url, observedAt, index) : provider === "wavespeed" ? normalizeWaveSpeed(row, url, observedAt, index) : provider === "fal" ? normalizeFal(row, url, observedAt, index) : normalizeChutes(row, url, observedAt, index);
      if (identities.has(model.id)) { complete = false; error = "DUPLICATE_IDENTITY_DURING_PAGINATION"; }
      identities.add(model.id); models.push(model);
    } catch { exclusions.push(`row ${index}: missing stable native model identity`); complete = false; error = "INVALID_MODEL_IDENTITY"; }
  }
  if (provider === "fal") requestParameters.pricingAuthentication = falApiKey ? "api_key" : "none";
  if (provider === "fal" && models.length && falApiKey) {
    const priceIds = [...new Set(models.map(model => model.id))], checked = new Set<string>(), requested = new Set<string>();
    const priceById = new Map<string, NativeRecord[]>();
    const failedIds = new Set<string>();
    const batchLimit = Math.min(Math.max(Math.floor(options.maxFalPriceBatches ?? 40), 1), 64);
    let batchesFetched = 0, receivedPriceRows = 0, priceError: string | undefined;
    requestParameters.priceSource = "https://api.fal.ai/v1/models/pricing";
    requestParameters.priceScope = "authenticated_account";
    requestParameters.priceBatchSize = 50; requestParameters.priceBatchLimit = batchLimit;
    requestParameters.priceCoverageRule = "Request every collected identity in batches of at most 50. No identity is excluded by price. Native billing units and account prices are retained; unsupported currencies, output quantities, ambiguous units and multiple entries are not converted. Pricing cursor traversal is not documented: a nonterminal batch is a failed price observation.";
    for (let offset = 0; offset < priceIds.length; offset += 50) {
      if (batchesFetched >= batchLimit) { priceError = "PRICE_BATCH_BUDGET_EXHAUSTED"; break; }
      const batch = priceIds.slice(offset, offset + 50), batchSet = new Set(batch);
      const url = new URL("https://api.fal.ai/v1/models/pricing");
      for (const id of batch) { url.searchParams.append("endpoint_id", id); requested.add(id); }
      try {
        const body = record(parseNativeJson(await request(url.href)));
        if (!Array.isArray(body.prices)) throw new CatalogueFetchError("PRICING_RESPONSE_SHAPE_CHANGED");
        if (body.has_more !== false || body.next_cursor !== null) throw new CatalogueFetchError("PRICING_PAGINATION_UNSUPPORTED");
        const nativeRows = body.prices.map(record);
        if (nativeRows.some(row => typeof row.endpoint_id !== "string" || !batchSet.has(row.endpoint_id))) throw new CatalogueFetchError("PRICING_IDENTITY_MISMATCH");
        if (nativeRows.some(row => typeof row.unit !== "string" || typeof row.currency !== "string" || scalar(row.unit_price) === undefined)) throw new CatalogueFetchError("PRICING_ROW_SHAPE_CHANGED");
        for (const row of nativeRows) {
          const id = row.endpoint_id as string;
          const entries = priceById.get(id) ?? []; entries.push(row); priceById.set(id, entries);
        }
        for (const id of batch) checked.add(id);
        receivedPriceRows += nativeRows.length; batchesFetched++;
      } catch (cause) {
        priceError = safeError(cause);
        for (const id of batch) failedIds.add(id);
        break; // Never retry auth, quota, shape or resource failures.
      }
    }
    for (let index = 0; index < models.length; index++) {
      const model = models[index]!;
      if (checked.has(model.id)) models[index] = normalizeFalAuthenticated(rows[model.provenance.sourceIndex]!, model.provenance.sourceUrl, observedAt, model.provenance.sourceIndex, priceById.get(model.id) ?? []);
      else {
        model.pricePoints = [];
        model.pricingState = "unknown";
        model.pricingNote = failedIds.has(model.id)
          ? "pricing_source_unavailable"
          : priceError === "PRICE_BATCH_BUDGET_EXHAUSTED"
            ? "pricing_not_observed_price_batch_budget"
            : "pricing_not_observed_after_source_failure";
        model.nativePricing = null;
      }
    }
    // Pricing requests are deduplicated by endpoint id, unlike retained source
    // rows. Keep every price denominator on that same identity basis even if
    // upstream pagination repeats a model (the catalogue stays partial).
    const normalized = new Set(models.filter(model => model.pricePoints.length > 0).map(model => model.id)).size;
    const priceExclusionReasons: Record<string, number> = {};
    const reasonIds = new Map<string, Set<string>>();
    for (const model of models) if (model.pricingNote) {
      const ids = reasonIds.get(model.pricingNote) ?? new Set<string>(); ids.add(model.id); reasonIds.set(model.pricingNote, ids);
    }
    for (const [reason, ids] of reasonIds) priceExclusionReasons[reason] = ids.size;
    requestParameters.pricePopulationBasis = "Unique endpoint ids; catalogue received and retained counts remain source-row counts. Reason counts are distinct ids per reason.";
    requestParameters.pricePopulation = { listed: priceIds.length, requested: requested.size, observed: checked.size, receivedPriceRows, withNativePrice: priceById.size, withoutNativePrice: checked.size - priceById.size, unobserved: priceIds.length - checked.size, normalized, uncomparable: priceById.size - normalized };
    requestParameters.priceExclusionReasons = priceExclusionReasons;
    requestParameters.priceBatchesFetched = batchesFetched;
    requestParameters.pricingAcquisitionStatus = priceError ? checked.size ? "partial" : "unavailable" : "available";
    if (priceError) { pricingFailed = true; requestParameters.pricingError = priceError; }
  }
  if (provider === "fal" && models.length && !falApiKey) {
    requestParameters.priceSource = "https://fal.ai/pricing";
    try {
      const published = parseFalPricingPage(await request("https://fal.ai/pricing"));
      if (published.size === 0) throw new CatalogueFetchError("PRICING_TABLE_SHAPE_CHANGED");
      requestParameters.pricingAcquisitionStatus = "available";
      requestParameters.publishedPricingRows = published.size;
      requestParameters.priceCoverageRule = "Only exact endpoint ids in public pricing table; individual model pages not observed. Image reference is 1MP. Whole-video prices without duration withheld.";
      for (let index = 0; index < models.length; index++) {
        const model = models[index]!;
        models[index] = normalizeFal(rows[model.provenance.sourceIndex]!, model.provenance.sourceUrl, observedAt, model.provenance.sourceIndex, published.get(model.id));
      }
    } catch (cause) {
      // Identity acquisition and price acquisition are independent: retain the
      // proven catalogue denominator, but never describe an unread table as
      // successfully checked and missing its prices.
      pricingFailed = true;
      requestParameters.pricingAcquisitionStatus = "unavailable";
      requestParameters.pricingError = safeError(cause);
      requestParameters.priceCoverageRule = "Pricing source acquisition failed; no conclusion about price publication can be drawn. Collected model identities are retained.";
      delete requestParameters.publishedPricingRows;
      for (const model of models) {
        model.pricePoints = [];
        model.pricingState = "unknown";
        model.pricingNote = "pricing_source_unavailable";
      }
    }
  }
  if (provider === "wavespeed" && models.length) {
    const ids = [...new Set([...DEFAULT_WAVESPEED_ENRICH_IDS, ...(options.enrichIds ?? []).slice(0, 20)])];
    const observed: string[] = [], failures: Array<{ id: string; error: string }> = [];
    const detailPriceObservations: Array<Record<string, unknown>> = [];
    for (const id of ids) {
      const index = models.findIndex(model => model.id === id);
      if (index < 0) continue;
      if (!id.split("/").every(segment => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(segment) && segment !== "..")) { failures.push({ id, error: "INVALID_MODEL_ID_FOR_DETAIL" }); continue; }
      const detailUrl = `https://api.wavespeed.ai/center/default/api/v1/model_product/detail/${id.split("/").map(encodeURIComponent).join("/")}`;
      try {
        const text = await request(detailUrl);
        let payload: unknown;
        try { payload = parseNativeJson(text); } catch { throw new CatalogueFetchError("DETAIL_JSON_INVALID"); }
        const body = record(payload), detail = record(body.data);
        if (String(body.code) !== "200") {
          if (/^[45]\d\d$/.test(String(body.code))) throw new CatalogueFetchError(`HTTP_${body.code}`);
          throw new CatalogueFetchError("DETAIL_RESPONSE_SHAPE_CHANGED");
        }
        if (detail.model_uuid !== id) throw new CatalogueFetchError("DETAIL_IDENTITY_MISMATCH");
        const original = models[index]!;
        const candidate = normalizeWaveSpeed({ ...rows[original.provenance.sourceIndex], ...detail }, detailUrl, observedAt, original.provenance.sourceIndex);
        // A supplementary read must establish its own replacement price before
        // superseding an already verified catalogue price and source. Merely
        // inheriting old price fields would invent detail-source provenance.
        const independentDetail = normalizeWaveSpeed({ type: original.nativeType, ...detail }, detailUrl, observedAt, original.provenance.sourceIndex);
        if (original.pricePoints.length > 0 && independentDetail.pricePoints.length === 0) {
          const detailError = "DETAIL_PRICE_NOT_ESTABLISHED";
          failures.push({ id, error: detailError });
          detailPriceObservations.push({ id, sourceUrl: detailUrl, status: "price_not_comparable", error: detailError, reason: independentDetail.pricingNote, retainedPriceSourceUrl: original.provenance.sourceUrl });
          continue;
        }
        models[index] = candidate;
        detailPriceObservations.push({ id, sourceUrl: detailUrl, status: candidate.pricePoints.length > 0 ? "available" : "price_not_comparable", ...(candidate.pricingNote ? { reason: candidate.pricingNote } : {}) });
        observed.push(id);
      } catch (cause) {
        const detailError = safeError(cause);
        failures.push({ id, error: detailError });
        const model = models[index]!;
        detailPriceObservations.push({ id, sourceUrl: detailUrl, status: "unavailable", error: detailError, ...(model.pricePoints.length > 0 ? { retainedPriceSourceUrl: model.provenance.sourceUrl } : {}) });
        if (model.pricePoints.length === 0) {
          model.pricingState = "unknown";
          model.pricingNote = "pricing_source_unavailable";
        }
        // A missing or malformed individual model does not invalidate another
        // model's read. Shared auth, resource, network and deadline failures
        // stop the bounded batch; neither kind is retried.
        if (!["HTTP_404", "HTTP_410", "DETAIL_JSON_INVALID", "DETAIL_RESPONSE_SHAPE_CHANGED", "DETAIL_IDENTITY_MISMATCH"].includes(detailError)) {
          requestParameters.detailStopReason = detailError;
          break;
        }
      }
    }
    if (failures.length) pricingFailed = true;
    requestParameters.pricingAcquisitionStatus = failures.length ? observed.length ? "partial" : "unavailable" : observed.length ? "available" : "not_attempted";
    requestParameters.priceCoverageRule = "All base prices retained; canonical prices only for observed simple formulas with established output quantity. No account discount applied. Other dynamic formulas require parameter selection.";
    requestParameters.detailBudget = 24; requestParameters.enrichedIds = observed; requestParameters.detailFailures = failures;
    requestParameters.detailPriceObservations = detailPriceObservations;
  }
  if (provider === "chutes") requestParameters.priceCoverageRule = "Public deployments retained by chute_id, including custom deployments; explicit USD per-million token legs converted per token. Compute rental rates retained natively and never labelled output prices. Null template means modality unknown.";
  return { models, provider: {
    provider, status: !received ? "unavailable" : complete && !pricingFailed ? "available" : "partial", sourceUrl, observedAt,
    population: { listed, received: received ? rows.length : null, retained: received ? models.length : null, excluded: received ? exclusions.length : null, exclusionRules: exclusions, completeness: !received ? "unavailable" : complete ? "full" : "partial" },
    requestParameters, ...(error ? { error } : {}),
  } };
}
export async function collectMediaCatalogue(options: CollectMediaCatalogueOptions = {}): Promise<MediaCatalogue> {
  const ids = [...new Set(options.providers ?? MEDIA_CATALOGUE_PROVIDER_IDS)];
  if (ids.some(id => !MEDIA_CATALOGUE_PROVIDER_IDS.includes(id))) throw new Error("Unsupported native catalogue provider");
  const collections: Collection[] = [];
  // At most two providers are in flight, with no retries. Only fal can receive
  // a caller-supplied key, scoped to its fixed read-only API routes above.
  for (let index = 0; index < ids.length; index += 2) collections.push(...await Promise.all(ids.slice(index, index + 2).map(provider => collectProvider(provider, options))));
  const providers = collections.map(c => c.provider), models = collections.flatMap(c => c.models);
  const total = (key: "listed" | "received" | "retained" | "excluded") => providers.every(p => p.population[key] !== null) ? providers.reduce((sum, p) => sum + p.population[key]!, 0) : null;
  const complete = providers.every(p => p.population.completeness === "full");
  return mediaCatalogueSchema.parse({ providers, models, population: { listed: total("listed"), received: total("received"), retained: total("retained"), excluded: total("excluded"), exclusionRules: providers.flatMap(p => p.population.exclusionRules.map(rule => `${p.provider}: ${rule}`)), completeness: complete ? "full" : models.length ? "partial" : "unavailable" } });
}

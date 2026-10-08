import { pricePoint } from "./price-set.js";
import { mediaCatalogueSchema, type CatalogueModel, type CatalogueProvider, type MediaCatalogue } from "./schemas.js";

export const TTS_CATALOGUE_PROVIDER_IDS = ["elevenlabs", "cartesia"] as const;
export type TtsCatalogueProviderId = (typeof TTS_CATALOGUE_PROVIDER_IDS)[number];

export const TTS_CATALOGUE_SOURCES: Record<TtsCatalogueProviderId, string> = {
  elevenlabs: "https://elevenlabs.io/pricing/api",
  cartesia: "https://www.cartesia.ai/pricing",
};

const MOS_SOURCE = "https://huggingface.co/datasets/Trelis/tricky-tts-public";
const OBSERVED_AT = "2026-10-08T00:00:00.000Z";

type TtsSnapshot = {
  provider: TtsCatalogueProviderId;
  id: string;
  displayName: string;
  price: {
    amount: string;
    unit: "character_1k" | "plan_month";
    label: string;
    scope: string;
    sourceUrl: string;
  };
  quality: {
    metric: "MOS";
    value: string;
    method: "UTMOS predicted MOS";
    scope: string;
    sourceUrl: string;
  };
};

const SNAPSHOTS: Record<TtsCatalogueProviderId, TtsSnapshot> = {
  elevenlabs: {
    provider: "elevenlabs",
    id: "eleven-v3",
    displayName: "Eleven v3",
    price: {
      amount: "0.08",
      unit: "character_1k",
      label: "$0.08 / 1K characters",
      scope: "Text to Speech v3 published API rate",
      sourceUrl: TTS_CATALOGUE_SOURCES.elevenlabs,
    },
    quality: {
      metric: "MOS",
      value: "4.273",
      method: "UTMOS predicted MOS",
      scope: "ElevenLabs row in the Trelis Tricky TTS public benchmark",
      sourceUrl: MOS_SOURCE,
    },
  },
  cartesia: {
    provider: "cartesia",
    id: "sonic-3.6",
    displayName: "Sonic-3.6 plan / Sonic-3 benchmark",
    price: {
      amount: "49",
      unit: "plan_month",
      label: "$49 / month · 1.25M credits",
      scope: "Startup plan; public text-to-speech credits",
      sourceUrl: TTS_CATALOGUE_SOURCES.cartesia,
    },
    quality: {
      metric: "MOS",
      value: "4.019",
      method: "UTMOS predicted MOS",
      scope: "Cartesia Sonic-3 row in the Trelis Tricky TTS public benchmark; not a Sonic-3.6 measurement",
      sourceUrl: MOS_SOURCE,
    },
  },
};

function snapshotModel(snapshot: TtsSnapshot): CatalogueModel {
  const point = pricePoint({
    id: `${snapshot.provider}:${snapshot.id}:${snapshot.price.unit}`,
    amount: snapshot.price.amount,
    unit: snapshot.price.unit,
    condition: { kind: "price_scope", name: "public_list", rateClass: "list" },
    sourceUrl: snapshot.price.sourceUrl,
    readAt: OBSERVED_AT,
    provenance: "published",
    measurementOrigin: "catalogue",
    observed: null,
  });
  return {
    provider: snapshot.provider,
    id: snapshot.id,
    displayName: snapshot.displayName,
    mediaKind: "audio",
    nativeType: "text-to-speech",
    outputModalities: ["audio"],
    pricePoints: [point],
    pricingState: "published",
    pricingNote: `${snapshot.price.label}; ${snapshot.price.scope}. Voice quality ${snapshot.quality.metric} ${snapshot.quality.value} (${snapshot.quality.method}) is a third-party benchmark observation, not a synthesis call.`,
    nativePricing: {
      publishedPrice: {
        label: snapshot.price.label,
        unit: snapshot.price.unit,
        scope: snapshot.price.scope,
        sourceUrl: snapshot.price.sourceUrl,
        checkedAt: OBSERVED_AT,
      },
      quality: {
        metric: snapshot.quality.metric,
        value: snapshot.quality.value,
        method: snapshot.quality.method,
        scope: snapshot.quality.scope,
        sourceUrl: snapshot.quality.sourceUrl,
        checkedAt: OBSERVED_AT,
      },
      acquisition: "bundled_public_snapshot",
      inferenceCalls: 0,
    },
    provenance: {
      sourceUrl: snapshot.price.sourceUrl,
      observedAt: OBSERVED_AT,
      sourceIndex: 0,
    },
  };
}

function snapshotProvider(snapshot: TtsSnapshot): CatalogueProvider {
  return {
    provider: snapshot.provider,
    status: "available",
    sourceUrl: snapshot.price.sourceUrl,
    observedAt: OBSERVED_AT,
    population: {
      listed: 1,
      received: 1,
      retained: 1,
      excluded: 0,
      exclusionRules: [],
      completeness: "full",
    },
    requestParameters: {
      acquisition: "bundled_public_snapshot",
      readOnly: true,
      inferenceCalls: 0,
      priceCheckedAt: OBSERVED_AT,
      qualitySource: MOS_SOURCE,
      qualityCheckedAt: OBSERVED_AT,
      scope: "One representative public TTS plan/model row per provider; not a full voice inventory.",
    },
  };
}

export function collectTtsCatalogue(options: { providers?: TtsCatalogueProviderId[] } = {}): MediaCatalogue {
  const ids = [...new Set(options.providers ?? [...TTS_CATALOGUE_PROVIDER_IDS])];
  if (ids.some((id) => !TTS_CATALOGUE_PROVIDER_IDS.includes(id))) {
    throw new Error("Unsupported TTS catalogue provider");
  }
  const snapshots = ids.map((id) => SNAPSHOTS[id]);
  return mediaCatalogueSchema.parse({
    providers: snapshots.map(snapshotProvider),
    models: snapshots.map(snapshotModel),
    population: {
      listed: snapshots.length,
      received: snapshots.length,
      retained: snapshots.length,
      excluded: 0,
      exclusionRules: [],
      completeness: "full",
    },
  });
}


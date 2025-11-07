import 'server-only';

import {
  DEMO_PLAN_INTERVAL_FALLBACK,
  DEMO_PLAN_PRICE_FALLBACK,
  HEADER_API_VERSION,
  HEADER_AUTHORIZATION,
  HEADER_GAME_ID,
  ONCADE_API_VERSION_HEADER_VALUE,
} from '@/lib/constants';
import { resolveOncadeApiBaseUrl } from '@/lib/env/apiBaseUrl.server';
import { normalizePlanCode } from '@/lib/subscription/coinflowNormalization';
import type { DemoPlanConfigDto } from './config.types';

const DEFAULT_PLAN_NAME = 'Partner Trial Access';
const DEFAULT_PLAN_CODE = 'demo-play-trial';
const PLAN_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedPlanEntry {
  readonly plan: DemoPlanConfigDto;
  readonly expiresAt: number;
}

let cachedPlan: CachedPlanEntry | undefined;
let planFetchPromise: Promise<DemoPlanConfigDto> | undefined;
let planFetchWarning: string | undefined;

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return undefined;
    }
    const parsed = Number.parseFloat(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function safeRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  if (Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function centsToUsd(cents: number | undefined): number | undefined {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) {
    return undefined;
  }
  return Math.max(0, cents) / 100;
}

function inferUsdPrice(item: Record<string, unknown>): number | undefined {
  const priceCents = toNumber(item.priceCents) ?? toNumber(item.unitPriceCents);
  if (typeof priceCents === 'number') {
    return centsToUsd(priceCents);
  }

  const price = item.price;
  if (typeof price === 'number') {
    // API responses occasionally encode price directly in cents.
    const direct = centsToUsd(price);
    if (typeof direct === 'number') {
      return direct;
    }
    return price > 0 ? price : undefined;
  }

  const priceRecord = safeRecord(price);
  if (priceRecord) {
    const nestedCents = toNumber(priceRecord.cents) ?? toNumber(priceRecord.amount);
    if (typeof nestedCents === 'number') {
      return centsToUsd(nestedCents);
    }
  }

  const metadata = safeRecord(item.metadata);
  if (metadata) {
    const metadataCents = toNumber(metadata.priceCents) ?? toNumber(metadata.price);
    if (typeof metadataCents === 'number') {
      return centsToUsd(metadataCents);
    }
  }
  return undefined;
}

function inferInterval(item: Record<string, unknown>): string | undefined {
  const direct = item.interval ?? item.billingInterval ?? item.frequency;
  if (typeof direct === 'string' && direct.trim()) {
    return direct.trim();
  }

  const metadata = safeRecord(item.metadata);
  if (!metadata) {
    return undefined;
  }

  const metadataInterval = metadata.interval ?? metadata.billingInterval ?? metadata.subscriptionInterval;
  if (typeof metadataInterval === 'string' && metadataInterval.trim()) {
    return metadataInterval.trim();
  }
  return undefined;
}

function resolveRemotePlanCode(item: Record<string, unknown>): string | undefined {
  const metadata = safeRecord(item.metadata);
  const candidates: Array<unknown> = [
    item.planCode,
    item.code,
    metadata?.planCode,
    metadata?.code,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePlanCode(candidate, { lowercase: false });
    if (normalized) {
      return normalized;
    }
  }

  const fallbackIdentifiers: Array<unknown> = [item.itemId, item.id];
  for (const identifier of fallbackIdentifiers) {
    if (typeof identifier === 'string') {
      const trimmed = identifier.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return undefined;
}

function extractPlanFromPayload(payload: unknown): Partial<DemoPlanConfigDto> | undefined {
  const root = safeRecord(payload);
  if (!root) {
    return undefined;
  }

  const data = safeRecord(root.data);
  const item =
    safeRecord(root.item) ??
    (data ? safeRecord(data.item) ?? safeRecord(data.subscription) ?? safeRecord(data.plan) : undefined);

  if (!item) {
    return undefined;
  }

  const name = typeof item.name === 'string' ? item.name.trim() : undefined;
  const planCode = resolveRemotePlanCode(item);
  const interval = inferInterval(item);
  const priceUsd = inferUsdPrice(item);

  const update: Partial<DemoPlanConfigDto> = {
    ...(name ? { name } : {}),
    ...(planCode ? { code: planCode } : {}),
    ...(typeof priceUsd === 'number' ? { priceUsd } : {}),
    ...(interval ? { interval } : {}),
  };

  return Object.keys(update).length > 0 ? update : undefined;
}

function buildAuthorizedHeaders(): HeadersInit {
  const headers: Record<string, string> = {};
  const apiKey = process.env.DEMO_SERVER_API_KEY?.trim();
  const gameId = process.env.DEMO_GAME_ID?.trim();
  if (apiKey) {
    headers[HEADER_AUTHORIZATION] = `Bearer ${apiKey}`;
  }
  headers[HEADER_API_VERSION] = ONCADE_API_VERSION_HEADER_VALUE;
  if (gameId) {
    headers[HEADER_GAME_ID] = gameId;
  }
  return headers;
}

async function fetchPlanUpdate(url: string, headers: HeadersInit): Promise<Partial<DemoPlanConfigDto> | undefined> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });
    if (!response.ok) {
      return undefined;
    }
    const payload = (await response.json().catch(() => undefined)) as unknown;
    return extractPlanFromPayload(payload);
  } catch (error) {
    console.warn('Unable to fetch plan details from endpoint', { url, error });
    return undefined;
  }
}

async function fetchRemotePlan(fallback: DemoPlanConfigDto): Promise<Partial<DemoPlanConfigDto> | undefined> {
  if (!fallback.itemId) {
    return undefined;
  }
  const apiKey = process.env.DEMO_SERVER_API_KEY?.trim();
  const gameId = process.env.DEMO_GAME_ID?.trim();
  if (!apiKey || !gameId) {
    return undefined;
  }

  const baseUrl = resolveOncadeApiBaseUrl();
  const headers = buildAuthorizedHeaders();
  const encodedItemId = encodeURIComponent(fallback.itemId);

  const endpoints: readonly string[] = [
    `${baseUrl}/api/v1/dashboard/store/items/${encodedItemId}`,
    `${baseUrl}/api/v1/store/items/${encodedItemId}`,
    `${baseUrl}/api/store/items/${encodedItemId}`,
    `${baseUrl}/api/games/${encodeURIComponent(gameId)}/items/${encodedItemId}`,
  ];

  for (const endpoint of endpoints) {
    const update = await fetchPlanUpdate(endpoint, headers);
    if (update) {
      return update;
    }
  }

  planFetchWarning = `Unable to load plan details for item ${fallback.itemId}. Falling back to environment configuration.`;
  return undefined;
}

function mergePlan(fallback: DemoPlanConfigDto, remote?: Partial<DemoPlanConfigDto>): DemoPlanConfigDto {
  if (!remote) {
    return fallback;
  }

  return {
    ...fallback,
    ...remote,
    itemId: fallback.itemId,
  };
}

function deriveFallbackPrice(): number {
  return DEMO_PLAN_PRICE_FALLBACK / 100;
}

export function buildPlanConfigFromEnv(): DemoPlanConfigDto {
  return {
    code: DEFAULT_PLAN_CODE,
    name: DEFAULT_PLAN_NAME,
    priceUsd: deriveFallbackPrice(),
    interval: DEMO_PLAN_INTERVAL_FALLBACK,
    itemId: process.env.DEMO_PLAN_ITEM_ID?.trim() ?? '',
  };
}

async function ensureResolvedPlan(forceRefresh: boolean): Promise<DemoPlanConfigDto> {
  if (!forceRefresh) {
    const current = cachedPlan;
    if (current && current.expiresAt > Date.now()) {
      return current.plan;
    }
    if (planFetchPromise) {
      return planFetchPromise;
    }
  }

  const execution = (async () => {
    const fallback = buildPlanConfigFromEnv();
    planFetchWarning = undefined;
    const remoteUpdate = await fetchRemotePlan(fallback);
    if (!remoteUpdate && !planFetchWarning && fallback.itemId) {
      planFetchWarning = `Subscription plan ${fallback.itemId} not reachable. Using fallback values.`;
    }
    const plan = mergePlan(fallback, remoteUpdate);
    cachedPlan = {
      plan,
      expiresAt: Date.now() + PLAN_CACHE_TTL_MS,
    };
    return plan;
  })();

  planFetchPromise = execution;
  try {
    return await execution;
  } finally {
    planFetchPromise = undefined;
  }
}

export async function resolveDemoPlanConfig(options?: { readonly forceRefresh?: boolean }): Promise<DemoPlanConfigDto> {
  const forceRefresh = Boolean(options?.forceRefresh);
  return ensureResolvedPlan(forceRefresh);
}

export function getPlanFetchWarning(): string | undefined {
  return planFetchWarning;
}

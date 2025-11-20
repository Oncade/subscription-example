import 'server-only';

import crypto from 'crypto';
import { NextRequest } from 'next/server';

import { ACCOUNT_LINK_STATUS, type AccountLinkStatus } from '@/lib/accountLink/accountLink.types';
import {
  HEADER_API_VERSION,
  HEADER_AUTHORIZATION,
  HEADER_GAME_ID,
  SESSION_HEADER,
  SESSION_STATE_HEADER,
  ONCADE_API_VERSION_HEADER_VALUE,
} from '@/lib/constants';
import { emitDemoEvent } from '@/lib/events/eventBus.server';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
import { getOncadeIntegrationConfig } from '@/lib/env/config.server';
import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from '@/lib/subscription/subscription.types';
import type { DemoSessionDto, DemoSessionId, DemoSessionRecord } from '@/lib/session/session.types';

export const SESSION_ERROR_MISSING_IDENTIFIER = 'Missing session identifier' as const;
export const SESSION_ERROR_UNKNOWN_IDENTIFIER = 'Unknown session identifier' as const;

interface SessionStoreInternal {
  readonly records: Map<DemoSessionId, DemoSessionRecord>;
  readonly linkToSession: Map<string, DemoSessionId>;
  readonly emailToSession: Map<string, DemoSessionId>;
  readonly userRefToSession: Map<string, DemoSessionId>;
}

function normalizeUserRef(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

const SESSION_ID_SALT = process.env.DEMO_SESSION_ID_SALT ?? 'subscription.demo.session';

function deriveSessionId(email: string): DemoSessionId {
  return crypto.createHash('sha1').update(`${SESSION_ID_SALT}:${email}`).digest('hex');
}

const GLOBAL_KEY = Symbol.for('subscription.demo.sessionStore');

type GlobalWithSessionStore = typeof globalThis & {
  [GLOBAL_KEY]?: SessionStoreInternal;
};

function createStore(): SessionStoreInternal {
  return {
    records: new Map(),
    linkToSession: new Map(),
    emailToSession: new Map(),
    userRefToSession: new Map(),
  };
}

const globalWithStore = globalThis as GlobalWithSessionStore;
if (!globalWithStore[GLOBAL_KEY]) {
  globalWithStore[GLOBAL_KEY] = createStore();
}

const store = globalWithStore[GLOBAL_KEY]!;

function toDto(record: DemoSessionRecord): DemoSessionDto {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    email: record.email,
    accountLinkStatus: record.accountLinkStatus,
    subscriptionStatus: record.subscriptionStatus,
    linkedUserRef: record.linkedUserRef,
    linkSessionKey: record.linkSessionKey,
    linkExpiresAt: record.linkExpiresAt?.toISOString(),
    subscriptionActivatedAt: record.subscriptionActivatedAt?.toISOString(),
    lastWebhookAt: record.lastWebhookAt?.toISOString(),
  };
}

interface PersistOptions {
  readonly previousEmail?: string;
  readonly previousUserRef?: string;
}

function persist(record: DemoSessionRecord, options: PersistOptions = {}): DemoSessionRecord {
  const previous = store.records.get(record.id);
  if (previous) {
    const trackedPreviousEmail = options.previousEmail ?? previous.email;
    const previousEmail = normalizeEmail(trackedPreviousEmail);
    const nextEmail = normalizeEmail(record.email);
    if (previousEmail && previousEmail !== nextEmail) {
      store.emailToSession.delete(previousEmail);
    }
    const trackedPreviousUserRef = options.previousUserRef ?? previous.linkedUserRef;
    const previousUserRef = normalizeUserRef(trackedPreviousUserRef);
    const nextUserRef = normalizeUserRef(record.linkedUserRef);
    if (previousUserRef && previousUserRef !== nextUserRef) {
      store.userRefToSession.delete(previousUserRef);
    }
  }
  store.records.set(record.id, record);
  if (record.linkSessionKey) {
    store.linkToSession.set(record.linkSessionKey, record.id);
  }
  const normalizedEmail = normalizeEmail(record.email);
  if (normalizedEmail) {
    store.emailToSession.set(normalizedEmail, record.id);
  }
  const normalizedUserRef = normalizeUserRef(record.linkedUserRef);
  if (normalizedUserRef) {
    store.userRefToSession.set(normalizedUserRef, record.id);
  }
  return record;
}

function ensureRecordForEmail(email: string): { record: DemoSessionRecord; created: boolean } {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Invalid email provided for session record.');
  }
  const sessionId = deriveSessionId(normalizedEmail);
  const existing = store.records.get(sessionId);
  if (existing) {
    if (existing.email !== normalizedEmail) {
      existing.email = normalizedEmail;
    }
    return { record: existing, created: false };
  }
  const record: DemoSessionRecord = {
    id: sessionId,
    createdAt: new Date(),
    email: normalizedEmail,
    accountLinkStatus: ACCOUNT_LINK_STATUS.Idle,
    subscriptionStatus: SUBSCRIPTION_STATUS.Inactive,
  };
  return { record, created: true };
}

const TRAILING_SLASHES = /\/+$/;

function sanitizeBaseUrl(value: string): string {
  return value.replace(TRAILING_SLASHES, '');
}

async function fetchLinkSessionDetails(
  sessionKey: string,
): Promise<{ email?: string; userRef?: string | null } | undefined> {
  const { apiBaseUrl } = getOncadeIntegrationConfig();
  const baseUrl = sanitizeBaseUrl(apiBaseUrl);
  try {
    const response = await fetch(`${baseUrl}/api/v1/users/link/details?session=${encodeURIComponent(sessionKey)}`);
    if (!response.ok) {
      return undefined;
    }
    const payload = (await response.json().catch(() => undefined)) as
      | { prefilledEmail?: string; userRef?: string | null }
      | undefined;
    if (!payload) {
      return undefined;
    }
    return {
      email: typeof payload.prefilledEmail === 'string' ? payload.prefilledEmail : undefined,
      userRef: typeof payload.userRef === 'string' || payload.userRef === null ? payload.userRef : undefined,
    };
  } catch (error) {
    console.warn('Failed to fetch link session details', { sessionKey, error });
    return undefined;
  }
}

function buildServerHeaders(serverApiKey: string, gameId: string): Record<string, string> {
  return {
    [HEADER_AUTHORIZATION]: `Bearer ${serverApiKey}`,
    [HEADER_API_VERSION]: ONCADE_API_VERSION_HEADER_VALUE,
    [HEADER_GAME_ID]: gameId,
    accept: 'application/json',
  };
}

async function fetchUserEmailByRef(userRef: string): Promise<string | undefined> {
  const { apiBaseUrl, serverApiKey, gameId } = getOncadeIntegrationConfig();
  const baseUrl = sanitizeBaseUrl(apiBaseUrl);
  try {
    const response = await fetch(`${baseUrl}/api/v1/users/${encodeURIComponent(userRef)}`, {
      method: 'GET',
      headers: buildServerHeaders(serverApiKey, gameId),
    });
    if (!response.ok) {
      return undefined;
    }
    const payload = (await response.json().catch(() => undefined)) as
      | { email?: string | null; userEmail?: string | null }
      | undefined;
    const candidate =
      typeof payload?.email === 'string'
        ? payload.email
        : typeof payload?.userEmail === 'string'
          ? payload.userEmail
          : undefined;
    return normalizeEmail(candidate);
  } catch (error) {
    console.warn('Failed to fetch user by reference', { userRef, error });
    return undefined;
  }
}

function parseSessionStateHeader(value: string | null): DemoSessionDto | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const decoded = decodeURIComponent(value);
    const parsed = JSON.parse(decoded) as Partial<DemoSessionDto>;
    if (!parsed || typeof parsed !== 'object') {
      return undefined;
    }
    if (typeof parsed.id !== 'string' || typeof parsed.email !== 'string') {
      return undefined;
    }
    return {
      id: parsed.id,
      createdAt: typeof parsed.createdAt === 'string' ? parsed.createdAt : new Date().toISOString(),
      email: parsed.email,
      accountLinkStatus: parsed.accountLinkStatus ?? ACCOUNT_LINK_STATUS.Idle,
      subscriptionStatus: parsed.subscriptionStatus ?? SUBSCRIPTION_STATUS.Inactive,
      linkedUserRef: parsed.linkedUserRef ?? undefined,
      linkSessionKey: parsed.linkSessionKey ?? undefined,
      linkExpiresAt: parsed.linkExpiresAt ?? undefined,
      subscriptionActivatedAt: parsed.subscriptionActivatedAt ?? undefined,
      lastWebhookAt: parsed.lastWebhookAt ?? undefined,
    };
  } catch (error) {
    console.warn('Failed to parse session sync payload.', error);
    return undefined;
  }
}

function rehydrateSessionFromDto(dto: DemoSessionDto): DemoSessionRecord {
  const record: DemoSessionRecord = {
    id: dto.id,
    createdAt: dto.createdAt ? new Date(dto.createdAt) : new Date(),
    email: dto.email,
    accountLinkStatus: dto.accountLinkStatus,
    subscriptionStatus: dto.subscriptionStatus,
    linkedUserRef: dto.linkedUserRef,
    linkSessionKey: dto.linkSessionKey,
    linkExpiresAt: dto.linkExpiresAt ? new Date(dto.linkExpiresAt) : undefined,
    subscriptionActivatedAt: dto.subscriptionActivatedAt ? new Date(dto.subscriptionActivatedAt) : undefined,
    lastWebhookAt: dto.lastWebhookAt ? new Date(dto.lastWebhookAt) : undefined,
  };
  return persist(record);
}

export function createDemoSession(email: string): DemoSessionDto {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Email is required to create demo session.');
  }
  const { record } = ensureRecordForEmail(normalizedEmail);
  record.email = normalizedEmail;
  persist(record);
  emitSessionEvent(record);
  return toDto(record);
}

function emitSessionEvent(record: DemoSessionRecord): void {
  emitDemoEvent({
    type: DEMO_EVENT_TYPE.SessionUpdated,
    payload: toDto(record),
  });
}

export function getSessionRecord(id: DemoSessionId): DemoSessionRecord | undefined {
  return store.records.get(id);
}

export function getSessionDto(id: DemoSessionId): DemoSessionDto | undefined {
  const record = getSessionRecord(id);
  return record ? toDto(record) : undefined;
}

export function setAccountLinkStatus(
  sessionId: DemoSessionId,
  status: AccountLinkStatus,
  options: { sessionKey?: string; expiresAt?: Date; preserveMapping?: boolean; userRef?: string | null } = {},
): DemoSessionDto {
  const record = getSessionRecord(sessionId);
  if (!record) {
    throw new Error(`Session ${sessionId} not found`);
  }
  const previousUserRef = record.linkedUserRef;

  record.accountLinkStatus = status;
  if (options.sessionKey) {
    record.linkSessionKey = options.sessionKey;
    store.linkToSession.set(options.sessionKey, sessionId);
  }
  if (options.expiresAt) {
    record.linkExpiresAt = options.expiresAt;
  }
  if (status !== ACCOUNT_LINK_STATUS.Started) {
    const previousKey = record.linkSessionKey;
    if (previousKey && !options.preserveMapping) {
      store.linkToSession.delete(previousKey);
    }
    if (!options.sessionKey && !options.preserveMapping) {
      record.linkSessionKey = undefined;
    }
    record.linkExpiresAt = undefined;
  }

  if (options.userRef !== undefined) {
    const normalized = options.userRef === null ? undefined : normalizeUserRef(options.userRef);
    record.linkedUserRef = normalized;
  } else if (status === ACCOUNT_LINK_STATUS.Canceled) {
    record.linkedUserRef = undefined;
  }

  if (status === ACCOUNT_LINK_STATUS.Linked) {
    record.subscriptionStatus =
      record.subscriptionStatus === SUBSCRIPTION_STATUS.Active
        ? SUBSCRIPTION_STATUS.Active
        : SUBSCRIPTION_STATUS.Inactive;
  }

  persist(record, { previousUserRef });
  emitSessionEvent(record);
  return toDto(record);
}

export function setSubscriptionStatus(
  sessionId: DemoSessionId,
  status: SubscriptionStatus,
  options: { occurredAt?: Date } = {},
): DemoSessionDto {
  const record = getSessionRecord(sessionId);
  if (!record) {
    throw new Error(`Session ${sessionId} not found`);
  }

  record.subscriptionStatus = status;
  if (status === SUBSCRIPTION_STATUS.Active) {
    record.subscriptionActivatedAt = options.occurredAt ?? new Date();
  }
  persist(record);
  emitSessionEvent(record);
  return toDto(record);
}

export function mapLinkSessionToSessionId(linkSessionKey: string): DemoSessionId | undefined {
  return store.linkToSession.get(linkSessionKey);
}

export function resolveSessionIdByEmail(email: string): DemoSessionId | undefined {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return undefined;
  }
  const existing = store.emailToSession.get(normalized);
  if (existing) {
    return existing;
  }
  const { record } = ensureRecordForEmail(normalized);
  persist(record, { previousEmail: normalized });
  return record.id;
}

export function resolveSessionIdByUserRef(userRef: string): DemoSessionId | undefined {
  const normalized = normalizeUserRef(userRef);
  if (!normalized) {
    return undefined;
  }
  return store.userRefToSession.get(normalized);
}

export async function resolveSessionIdFromLinkWithLookup(sessionKey: string): Promise<DemoSessionId | undefined> {
  const existing = mapLinkSessionToSessionId(sessionKey);
  if (existing) {
    return existing;
  }
  const record = await rehydrateSessionFromLink(sessionKey);
  return record?.id;
}

export async function resolveSessionIdByUserRefWithLookup(userRef: string): Promise<DemoSessionId | undefined> {
  const existing = resolveSessionIdByUserRef(userRef);
  if (existing) {
    return existing;
  }
  const record = await rehydrateSessionFromUserRef(userRef);
  return record?.id;
}

export function touchWebhook(sessionId: DemoSessionId): void {
  const record = getSessionRecord(sessionId);
  if (!record) {
    throw new Error(`Session ${sessionId} not found`);
  }
  record.lastWebhookAt = new Date();
  persist(record);
  emitSessionEvent(record);
}

async function rehydrateSessionFromLink(sessionKey: string): Promise<DemoSessionRecord | undefined> {
  const details = await fetchLinkSessionDetails(sessionKey);
  const email = details?.email ? normalizeEmail(details.email) : undefined;
  if (!email) {
    return undefined;
  }
  const { record } = ensureRecordForEmail(email);
  const previousUserRef = record.linkedUserRef;
  record.linkSessionKey = sessionKey;
  if (typeof details?.userRef === 'string') {
    record.linkedUserRef = details.userRef;
    record.accountLinkStatus = ACCOUNT_LINK_STATUS.Linked;
  } else if (record.accountLinkStatus === ACCOUNT_LINK_STATUS.Idle) {
    record.accountLinkStatus = ACCOUNT_LINK_STATUS.Started;
  }
  persist(record, { previousEmail: email, previousUserRef });
  emitSessionEvent(record);
  return record;
}

async function rehydrateSessionFromUserRef(userRef: string): Promise<DemoSessionRecord | undefined> {
  const email = await fetchUserEmailByRef(userRef);
  if (!email) {
    return undefined;
  }
  const { record } = ensureRecordForEmail(email);
  const previousUserRef = record.linkedUserRef;
  record.linkedUserRef = userRef;
  persist(record, { previousEmail: email, previousUserRef });
  emitSessionEvent(record);
  return record;
}

function restoreSessionFromRequest(request: NextRequest, sessionId: DemoSessionId): DemoSessionRecord | undefined {
  const encodedPayload = request.headers.get(SESSION_STATE_HEADER);
  if (!encodedPayload) {
    return undefined;
  }
  const dto = parseSessionStateHeader(encodedPayload);
  if (!dto || dto.id !== sessionId) {
    return undefined;
  }
  return rehydrateSessionFromDto(dto);
}

export function requireSessionFromRequest(request: NextRequest): DemoSessionRecord {
  const sessionId = request.headers.get(SESSION_HEADER);
  if (!sessionId) {
    throw new Error(SESSION_ERROR_MISSING_IDENTIFIER);
  }

  const record = getSessionRecord(sessionId);
  if (record) {
    return record;
  }

  const restored = restoreSessionFromRequest(request, sessionId);
  if (restored) {
    return restored;
  }

  throw new Error(SESSION_ERROR_UNKNOWN_IDENTIFIER);
}

export function resolveSessionErrorStatus(error: Error, fallbackStatus = 400): number {
  if (error.message === SESSION_ERROR_MISSING_IDENTIFIER) {
    return 401;
  }
  if (error.message === SESSION_ERROR_UNKNOWN_IDENTIFIER) {
    return 404;
  }
  return fallbackStatus;
}

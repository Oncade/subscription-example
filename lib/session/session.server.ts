import 'server-only';

import crypto from 'crypto';
import { NextRequest } from 'next/server';

import { ACCOUNT_LINK_STATUS, type AccountLinkStatus } from '@/lib/accountLink/accountLink.types';
import { SESSION_HEADER, SESSION_STATE_HEADER } from '@/lib/constants';
import { emitDemoEvent } from '@/lib/events/eventBus.server';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
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
  const id = crypto.randomUUID();
  const now = new Date();
  const record: DemoSessionRecord = {
    id,
    createdAt: now,
    email,
    accountLinkStatus: ACCOUNT_LINK_STATUS.Idle,
    subscriptionStatus: SUBSCRIPTION_STATUS.Inactive,
  };

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
  return store.emailToSession.get(normalized);
}

export function resolveSessionIdByUserRef(userRef: string): DemoSessionId | undefined {
  const normalized = normalizeUserRef(userRef);
  if (!normalized) {
    return undefined;
  }
  return store.userRefToSession.get(normalized);
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

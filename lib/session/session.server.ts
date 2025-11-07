import 'server-only';

import crypto from 'crypto';
import { NextRequest } from 'next/server';

import { ACCOUNT_LINK_STATUS, type AccountLinkStatus } from '@/lib/accountLink/accountLink.types';
import { SESSION_HEADER } from '@/lib/constants';
import { emitDemoEvent } from '@/lib/events/eventBus.server';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from '@/lib/subscription/subscription.types';
import type { DemoSessionDto, DemoSessionId, DemoSessionRecord } from '@/lib/session/session.types';

export const SESSION_ERROR_MISSING_IDENTIFIER = 'Missing session identifier' as const;
export const SESSION_ERROR_UNKNOWN_IDENTIFIER = 'Unknown session identifier' as const;

interface SessionStoreInternal {
  readonly records: Map<DemoSessionId, DemoSessionRecord>;
  readonly linkToSession: Map<string, DemoSessionId>;
}

function normalizeUserRef(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
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

function persist(record: DemoSessionRecord): DemoSessionRecord {
  store.records.set(record.id, record);
  if (record.linkSessionKey) {
    store.linkToSession.set(record.linkSessionKey, record.id);
  }
  return record;
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

  persist(record);
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

export function touchWebhook(sessionId: DemoSessionId): void {
  const record = getSessionRecord(sessionId);
  if (!record) {
    throw new Error(`Session ${sessionId} not found`);
  }
  record.lastWebhookAt = new Date();
  persist(record);
  emitSessionEvent(record);
}

export function requireSessionFromRequest(request: NextRequest): DemoSessionRecord {
  const sessionId = request.headers.get(SESSION_HEADER);
  if (!sessionId) {
    throw new Error(SESSION_ERROR_MISSING_IDENTIFIER);
  }

  const record = getSessionRecord(sessionId);
  if (!record) {
    throw new Error(SESSION_ERROR_UNKNOWN_IDENTIFIER);
  }

  return record;
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

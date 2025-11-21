import 'server-only';

import crypto from 'crypto';
import { NextRequest } from 'next/server';

import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import {
  HEADER_API_VERSION,
  HEADER_AUTHORIZATION,
  HEADER_GAME_ID,
  SESSION_HEADER,
  SESSION_STATE_HEADER,
  ONCADE_API_VERSION_HEADER_VALUE,
} from '@/lib/constants';
import { getOncadeIntegrationConfig } from '@/lib/env/config.server';
import { SUBSCRIPTION_STATUS } from '@/lib/subscription/subscription.types';
import type { DemoSessionDto, DemoSessionId, DemoSessionRecord } from '@/lib/session/session.types';

export const SESSION_ERROR_MISSING_IDENTIFIER = 'Missing session identifier' as const;
export const SESSION_ERROR_UNKNOWN_IDENTIFIER = 'Unknown session identifier' as const;


function normalizeEmail(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

const SESSION_ID_SALT = process.env.DEMO_SESSION_ID_SALT ?? 'subscription.demo.session';

export function deriveSessionId(email: string): DemoSessionId {
  return crypto.createHash('sha1').update(`${SESSION_ID_SALT}:${email}`).digest('hex');
}

function toDto(record: DemoSessionRecord): DemoSessionDto {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    email: record.email,
    accountLinkStatus: record.accountLinkStatus,
    subscriptionStatus: record.subscriptionStatus,
    linkedUserRef: record.linkedUserRef,
    linkSessionKey: record.linkSessionKey,
    linkIdempotencyKey: record.linkIdempotencyKey,
    linkExpiresAt: record.linkExpiresAt?.toISOString(),
    subscriptionActivatedAt: record.subscriptionActivatedAt?.toISOString(),
    lastWebhookAt: record.lastWebhookAt?.toISOString(),
  }
}

const TRAILING_SLASHES = /\/+$/;

function sanitizeBaseUrl(value: string): string {
  return value.replace(TRAILING_SLASHES, '');
}

export async function fetchLinkSessionDetails(
  sessionKey: string,
): Promise<{ email?: string; userRef?: string | null } | undefined> {
  const { apiBaseUrl, serverApiKey, gameId } = getOncadeIntegrationConfig();
  const baseUrl = sanitizeBaseUrl(apiBaseUrl);
  try {
    const headers = buildServerHeaders(serverApiKey, gameId);
    const response = await fetch(`${baseUrl}/api/v1/users/link/details?session=${encodeURIComponent(sessionKey)}`, {
      headers,
    });
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
      linkIdempotencyKey: parsed.linkIdempotencyKey ?? undefined,
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
  return {
    id: dto.id,
    createdAt: dto.createdAt ? new Date(dto.createdAt) : new Date(),
    email: dto.email,
    accountLinkStatus: dto.accountLinkStatus,
    subscriptionStatus: dto.subscriptionStatus,
    linkedUserRef: dto.linkedUserRef,
    linkSessionKey: dto.linkSessionKey,
    linkIdempotencyKey: dto.linkIdempotencyKey,
    linkExpiresAt: dto.linkExpiresAt ? new Date(dto.linkExpiresAt) : undefined,
    subscriptionActivatedAt: dto.subscriptionActivatedAt ? new Date(dto.subscriptionActivatedAt) : undefined,
    lastWebhookAt: dto.lastWebhookAt ? new Date(dto.lastWebhookAt) : undefined,
  };
}

// Create a fresh session DTO (no memory storage)
export function createDemoSession(email: string): DemoSessionDto {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error('Email is required to create demo session.');
  }
  const sessionId = deriveSessionId(normalizedEmail);
  return {
    id: sessionId,
    createdAt: new Date().toISOString(),
    email: normalizedEmail,
    accountLinkStatus: ACCOUNT_LINK_STATUS.Idle,
    subscriptionStatus: SUBSCRIPTION_STATUS.Inactive,
  };
}

// Get session from request headers only (no memory lookup)
export function requireSessionFromRequest(request: NextRequest): DemoSessionRecord {
  const sessionId = request.headers.get(SESSION_HEADER);
  if (!sessionId) {
    throw new Error(SESSION_ERROR_MISSING_IDENTIFIER);
  }

  const encodedPayload = request.headers.get(SESSION_STATE_HEADER);
  if (!encodedPayload) {
    throw new Error(SESSION_ERROR_UNKNOWN_IDENTIFIER);
  }

  const dto = parseSessionStateHeader(encodedPayload);
  if (!dto || dto.id !== sessionId) {
    throw new Error(SESSION_ERROR_UNKNOWN_IDENTIFIER);
  }

  return rehydrateSessionFromDto(dto);
}

// Get session DTO from request (for API routes that need DTO format)
export function getSessionDtoFromRequest(request: NextRequest): DemoSessionDto | undefined {
  try {
    const record = requireSessionFromRequest(request);
    return toDto(record);
  } catch {
    return undefined;
  }
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

// Helper functions for webhook handlers - these resolve session ID from external data
// They don't store anything, just help identify which session a webhook belongs to

export async function resolveSessionIdFromLink(sessionKey: string): Promise<DemoSessionId | undefined> {
  const details = await fetchLinkSessionDetails(sessionKey);
  const email = details?.email ? normalizeEmail(details.email) : undefined;
  if (!email) {
    return undefined;
  }
  return deriveSessionId(email);
}

export async function resolveSessionIdByUserRef(userRef: string): Promise<DemoSessionId | undefined> {
  const email = await fetchUserEmailByRef(userRef);
  if (!email) {
    return undefined;
  }
  return deriveSessionId(email);
}

export function resolveSessionIdByEmail(email: string): DemoSessionId | undefined {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return undefined;
  }
  return deriveSessionId(normalized);
}

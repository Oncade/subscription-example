import 'server-only';

import { randomUUID } from 'crypto';

import { DEMO_LINK_TIMEOUT_MS, ONCADE_API_VERSION_HEADER_VALUE } from '@/lib/constants';
import type { AccountLinkSessionDto } from '@/lib/accountLink/accountLink.types';
import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import { getOncadeIntegrationConfig } from '@/lib/env/config.server';
import type { DemoSessionId } from '@/lib/session/session.types';

interface RemoteInitiateResponse {
  readonly url: string;
  readonly sessionKey: string;
}

interface InitiateAccountLinkOptions {
  readonly idempotencyKey?: string;
}

export async function initiateAccountLinkSession(
  sessionId: DemoSessionId,
  email: string,
  origin: string,
  options?: InitiateAccountLinkOptions,
): Promise<AccountLinkSessionDto> {
  // Session state is managed client-side, we just need the sessionId and email to initiate the link

  const { apiBaseUrl, serverApiKey, gameId } = getOncadeIntegrationConfig();
  const trimmedBaseUrl = apiBaseUrl.replace(/\/$/, '');
  const resolvedIdempotencyKey =
    options?.idempotencyKey && options.idempotencyKey.trim().length > 0
      ? options.idempotencyKey.trim()
      : randomUUID();

  const requestBody = {
    email: email.trim().toLowerCase(),
  };

  const response = await fetch(`${trimmedBaseUrl}/api/v1/users/link/initiate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serverApiKey}`,
      'X-Oncade-API-Version': ONCADE_API_VERSION_HEADER_VALUE,
      'X-Game-Id': gameId,
      'Idempotency-Key': resolvedIdempotencyKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  const payload = (await response.json()) as Partial<RemoteInitiateResponse> & { error?: string };
  if (!response.ok || !payload.sessionKey || !payload.url) {
    throw new Error(payload.error || 'Failed to initiate account linking session');
  }

  const status = response.status === 200 ? ACCOUNT_LINK_STATUS.Linked : ACCOUNT_LINK_STATUS.Started;
  const expiresAt = status === ACCOUNT_LINK_STATUS.Started ? new Date(Date.now() + DEMO_LINK_TIMEOUT_MS) : undefined;
  const redirectUrl = resolveLinkUrl(payload.url, apiBaseUrl, payload.sessionKey, origin);
  
  // Session state is managed client-side, no need to store on server
  // Events are sent directly to clients via webhook handlers

  return {
    sessionKey: payload.sessionKey,
    status,
    expiresAt: expiresAt?.toISOString(),
    redirectUrl,
  };
}

function resolveLinkUrl(urlFromApi: string | undefined, apiBaseUrl: string, sessionKey: string, requestOrigin: string | undefined): string {
  const trimmedApiBase = apiBaseUrl.replace(/\/$/, '');
  const normalizedOrigin = requestOrigin && typeof requestOrigin === 'string' ? requestOrigin.trim() : '';
  const trimmedOrigin = normalizedOrigin ? normalizedOrigin.replace(/\/$/, '') : '';
  const preferredBase = trimmedApiBase || trimmedOrigin;
  const fallbackBase = preferredBase || trimmedOrigin || trimmedApiBase;
  const fallback = fallbackBase ? `${fallbackBase}/link?session=${encodeURIComponent(sessionKey)}` : `/link?session=${encodeURIComponent(sessionKey)}`;
  if (!urlFromApi) {
    return fallback;
  }

  const baseCandidates = [trimmedApiBase, trimmedOrigin, apiBaseUrl, normalizedOrigin].filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of baseCandidates) {
    try {
      const base = new URL(candidate);
      const resolved = new URL(urlFromApi, base);
      resolved.protocol = base.protocol;
      resolved.host = base.host;
      resolved.port = base.port;
      return resolved.toString();
    } catch {
      // continue trying other candidates
    }
  }

  return fallback;
}

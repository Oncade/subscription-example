import 'server-only';

import { randomUUID } from 'crypto';

import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import {
  HEADER_API_VERSION,
  HEADER_AUTHORIZATION,
  HEADER_GAME_ID,
  ONCADE_API_VERSION_HEADER_VALUE,
} from '@/lib/constants';
import { getOncadeIntegrationConfig } from '@/lib/env/config.server';
import type { DemoSessionRecord } from '@/lib/session/session.types';
import { COINFLOW_ACTIVE_STATUS } from '@/lib/subscription/coinflow.constants';
import { normalizeIdentifier, normalizeStatus } from '@/lib/subscription/coinflowNormalization';

import type {
  CancellationResult,
  RemoteUserSubscriptionResponse,
  SubscriptionLookupResult,
} from './subscriptionCancellation.types';

const TRAILING_SLASHES = /\/+$/;

function sanitizeBaseUrl(value: string): string {
  return value.replace(TRAILING_SLASHES, '');
}

function buildServerHeaders(serverApiKey: string, gameId: string): Record<string, string> {
  return {
    [HEADER_AUTHORIZATION]: `Bearer ${serverApiKey}`,
    [HEADER_API_VERSION]: ONCADE_API_VERSION_HEADER_VALUE,
    [HEADER_GAME_ID]: gameId,
  };
}

async function extractRemoteErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    if (payload?.error?.trim()) {
      return payload.error;
    }
  }
  return fallback;
}

export async function lookupActiveSubscription(
  session: DemoSessionRecord,
  planItemId: string,
): Promise<SubscriptionLookupResult> {
  if (!planItemId) {
    return {
      success: false,
      status: 500,
      error: 'Demo plan is missing the checkout item identifier required for cancellation.',
    };
  }

  if (session.accountLinkStatus !== ACCOUNT_LINK_STATUS.Linked) {
    return {
      success: false,
      status: 409,
      error: 'Link your Oncade account before canceling the subscription.',
    };
  }

  const userRef = session.linkedUserRef?.trim();
  if (!userRef) {
    return {
      success: false,
      status: 409,
      error: 'Linked user reference not available yet. Wait for the linking webhook to complete.',
    };
  }

  const { apiBaseUrl, serverApiKey, gameId } = getOncadeIntegrationConfig();
  const headers = {
    ...buildServerHeaders(serverApiKey, gameId),
    accept: 'application/json',
  };

  let response: Response;
  try {
    response = await fetch(`${sanitizeBaseUrl(apiBaseUrl)}/api/v1/users/${encodeURIComponent(userRef)}`, {
      method: 'GET',
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed.';
    return { success: false, status: 502, error: `Unable to reach user API: ${message}` };
  }

  if (!response.ok) {
    const message = await extractRemoteErrorMessage(
      response,
      `User lookup failed with status ${response.status}`,
    );
    return { success: false, status: response.status, error: message };
  }

  const payload = (await response.json().catch(() => undefined)) as RemoteUserSubscriptionResponse | undefined;
  if (!payload) {
    return { success: false, status: 502, error: 'Unable to parse user API response.' };
  }

  const normalizedStatus = normalizeStatus(payload.subscriptionStatus);
  const normalizedPlanItemId = normalizeIdentifier(planItemId);
  const normalizedRemoteItemId = normalizeIdentifier(payload.subscriptionItemId);

  if (!payload.subscriptionId || normalizedStatus !== COINFLOW_ACTIVE_STATUS) {
    return {
      success: false,
      status: 404,
      error: 'Linked account does not have an active subscription.',
    };
  }

  if (normalizedPlanItemId && normalizedRemoteItemId && normalizedPlanItemId !== normalizedRemoteItemId) {
    return {
      success: false,
      status: 404,
      error: 'Linked subscription does not match the configured demo plan.',
    };
  }

  return {
    success: true,
    match: {
      userRef,
      subscriptionId: payload.subscriptionId,
    },
  };
}

export async function forwardCancellation(userRef: string, planItemId: string): Promise<CancellationResult> {
  const { apiBaseUrl, serverApiKey, gameId } = getOncadeIntegrationConfig();
  const headers = {
    ...buildServerHeaders(serverApiKey, gameId),
    accept: 'application/json',
    'content-type': 'application/json',
    'Idempotency-Key': randomUUID(),
  };

  try {
    const response = await fetch(
      `${sanitizeBaseUrl(apiBaseUrl)}/api/v1/users/${encodeURIComponent(userRef)}/subscriptions/${encodeURIComponent(planItemId)}/cancel`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      },
    );

    if (!response.ok) {
      const message = await extractRemoteErrorMessage(
        response,
        `Cancel request failed with status ${response.status}`,
      );
      return { success: false, status: response.status, error: message };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed.';
    return { success: false, status: 502, error: `Unable to reach cancel endpoint: ${message}` };
  }

  return { success: true };
}

import { describe, expect, it, vi } from 'vitest';

import { handleSubscriptionSubscribePost } from '@/app/api/routes/subscriptionSubscribe';
import { DEFAULT_ONCADE_API_BASE_URL, SESSION_HEADER, SESSION_STATE_HEADER } from '@/lib/constants';
import { createDemoSession } from '@/lib/session/session.server';
import { SUBSCRIPTION_STATUS } from '@/lib/subscription/subscription.types';
import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import { buildAppUrl, buildJsonRequest, jsonResponse } from './helpers/http';

const TEST_REDIRECT_URL = buildAppUrl('/success');
const SUBSCRIPTION_SUBSCRIBE_URL = buildAppUrl('/api/subscription/subscribe');
const STORE_REDIRECT_URL = `${DEFAULT_ONCADE_API_BASE_URL}/games/demo/items/demo-plan-item-id`;

function resolveApiBaseUrl(): string {
  const raw = process.env.DEMO_API_BASE_URL ?? DEFAULT_ONCADE_API_BASE_URL;
  return raw.replace(/\/$/, '');
}

function buildRemoteCheckoutUrl(redirectUrl: string = TEST_REDIRECT_URL): string {
  const target = new URL(`${resolveApiBaseUrl()}/api/v1/checkout/redirect`);
  target.searchParams.set('gameId', 'test-game-id');
  target.searchParams.set('itemId', 'demo-plan-item-id');
  target.searchParams.set('redirectUrl', redirectUrl);
  return target.toString();
}

function buildRequest(sessionId: string, redirectUrl: string = TEST_REDIRECT_URL, sessionState?: unknown) {
  const headers: Record<string, string> = {
    [SESSION_HEADER]: sessionId,
  };
  if (sessionState) {
    headers[SESSION_STATE_HEADER] = encodeURIComponent(JSON.stringify(sessionState));
  }
  return buildJsonRequest(SUBSCRIPTION_SUBSCRIBE_URL, {
    method: 'POST',
    body: { redirectUrl },
    headers,
  });
}

function buildPlanResponse() {
  return jsonResponse({
    success: true,
    data: {
      item: {
        name: 'Remote Plan',
        planCode: 'remote-plan-code',
        priceCents: 799,
        metadata: { interval: 'Monthly' },
      },
    },
  });
}

describe('POST /api/subscription/subscribe', () => {
  it('returns redirect url from checkout endpoint', async () => {
    const session = createDemoSession('checkout@test.com');
    const sessionState = {
      ...session,
      accountLinkStatus: ACCOUNT_LINK_STATUS.Linked,
      subscriptionStatus: SUBSCRIPTION_STATUS.Inactive,
    };

    const planResponse = buildPlanResponse();
    const checkoutResponse = new Response(null, {
      status: 302,
      headers: { location: STORE_REDIRECT_URL },
    });

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(planResponse)
      .mockResolvedValueOnce(checkoutResponse);

    const response = await handleSubscriptionSubscribePost(buildRequest(session.id, TEST_REDIRECT_URL, sessionState));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.redirectUrl).toBe(STORE_REDIRECT_URL);

    expect(fetchSpy).toHaveBeenCalledTimes(2);

    const [, options] = fetchSpy.mock.calls[1];
    expect(fetchSpy.mock.calls[1]?.[0]).toBe(buildRemoteCheckoutUrl());
    expect(options?.headers).toMatchObject({
      authorization: 'Bearer test-api-key',
      'x-game-id': 'test-game-id',
      'x-oncade-api-version': 'v1',
    });
  });

  it('propagates error responses from checkout endpoint', async () => {
    const session = createDemoSession('failure@test.com');
    const sessionState = {
      ...session,
      accountLinkStatus: ACCOUNT_LINK_STATUS.Linked,
      subscriptionStatus: SUBSCRIPTION_STATUS.Inactive,
    };

    const planResponse = buildPlanResponse();
    const errorResponse = jsonResponse({ error: 'Item not found' }, 404);

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(planResponse)
      .mockResolvedValueOnce(errorResponse);

    const response = await handleSubscriptionSubscribePost(buildRequest(session.id, TEST_REDIRECT_URL, sessionState));
    expect(response.status).toBe(404);

    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Item not found');
  });

  it('handles network failures when requesting checkout redirect', async () => {
    const session = createDemoSession('network@test.com');
    const sessionState = {
      ...session,
      accountLinkStatus: ACCOUNT_LINK_STATUS.Linked,
      subscriptionStatus: SUBSCRIPTION_STATUS.Inactive,
    };

    const planResponse = buildPlanResponse();

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(planResponse).mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    const response = await handleSubscriptionSubscribePost(buildRequest(session.id, TEST_REDIRECT_URL, sessionState));
    expect(response.status).toBe(502);

    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/Checkout redirect request failed/);
  });

  it('returns configuration error when checkout item id is missing', async () => {
    const session = createDemoSession('config@test.com');
    const sessionState = {
      ...session,
      accountLinkStatus: ACCOUNT_LINK_STATUS.Linked,
      subscriptionStatus: SUBSCRIPTION_STATUS.Inactive,
    };
    const originalItemId = process.env.DEMO_PLAN_ITEM_ID;
    delete process.env.DEMO_PLAN_ITEM_ID;

    const fetchSpy = vi.spyOn(global, 'fetch');
    const response = await handleSubscriptionSubscribePost(buildRequest(session.id, TEST_REDIRECT_URL, sessionState));

    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/checkout item identifier/);
    expect(fetchSpy).not.toHaveBeenCalled();

    if (originalItemId) {
      process.env.DEMO_PLAN_ITEM_ID = originalItemId;
    } else {
      delete process.env.DEMO_PLAN_ITEM_ID;
    }
  });
});

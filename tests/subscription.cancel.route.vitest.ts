import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

import { POST as cancelRoute } from '@/app/api/subscription/cancel/route';
import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import { SESSION_HEADER } from '@/lib/constants';
import { createDemoSession, setAccountLinkStatus } from '@/lib/session/session.server';
import * as planConfig from '@/lib/env/planConfig.server';
import { buildAppUrl, buildJsonRequest, jsonResponse } from './helpers/http';

const TEST_PLAN = {
  code: 'demo-plan-code',
  name: 'Demo Plan',
  priceUsd: 4.99,
  interval: 'Monthly',
  itemId: 'demo-plan-item-id',
};

const SUBSCRIPTION_CANCEL_URL = buildAppUrl('/api/subscription/cancel');

function buildRequest(sessionId: string) {
  return buildJsonRequest(SUBSCRIPTION_CANCEL_URL, {
    method: 'POST',
    headers: {
      [SESSION_HEADER]: sessionId,
    },
  });
}

describe('POST /api/subscription/cancel', () => {
  let planSpy: MockInstance;

  beforeEach(() => {
    planSpy = vi.spyOn(planConfig, 'resolveDemoPlanConfig').mockResolvedValue(TEST_PLAN);
  });

  it('cancels subscriptions via server API when linked account has an active match', async () => {
    const session = createDemoSession('cancel-success@test.com');
    setAccountLinkStatus(session.id, ACCOUNT_LINK_STATUS.Linked, {
      sessionKey: 'session_remote',
      preserveMapping: true,
      userRef: 'link_usr_123',
    });

    const fetchSpy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          subscriptionId: 'sub_123',
          subscriptionItemId: TEST_PLAN.itemId,
          subscriptionStatus: 'Active',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ success: true }, 200));

    const response = await cancelRoute(buildRequest(session.id));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.success).toBe(true);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const expectedBase = (process.env.DEMO_API_BASE_URL ?? 'https://oncade.gg').replace(/\/$/, '');
    expect(fetchSpy.mock.calls[0]?.[0]).toBe(`${expectedBase}/api/v1/users/link_usr_123`);
    expect(fetchSpy.mock.calls[1]?.[0]).toBe(
      `${expectedBase}/api/v1/users/link_usr_123/subscriptions/${TEST_PLAN.itemId}/cancel`,
    );
    expect(planSpy).toHaveBeenCalledWith({ forceRefresh: true });
  });

  it('rejects cancellation when linked account has no active subscription', async () => {
    const session = createDemoSession('cancel-missing@test.com');
    setAccountLinkStatus(session.id, ACCOUNT_LINK_STATUS.Linked, {
      sessionKey: 'session_remote',
      preserveMapping: true,
      userRef: 'link_usr_999',
    });

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        subscriptionId: 'sub_999',
        subscriptionItemId: TEST_PLAN.itemId,
        subscriptionStatus: 'inactive',
      }),
    );

    const response = await cancelRoute(buildRequest(session.id));
    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/does not have an active subscription/i);
  });

  it('rejects cancellation when linked subscription item differs from the demo plan', async () => {
    const session = createDemoSession('cancel-mismatch@test.com');
    setAccountLinkStatus(session.id, ACCOUNT_LINK_STATUS.Linked, {
      sessionKey: 'session_remote',
      preserveMapping: true,
      userRef: 'link_usr_item_mismatch',
    });

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        subscriptionId: 'sub_mismatch',
        subscriptionItemId: 'other-item',
        subscriptionStatus: 'Active',
      }),
    );

    const response = await cancelRoute(buildRequest(session.id));
    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/does not match the configured demo plan/i);
  });

  it('returns 409 when linked user reference is unavailable', async () => {
    const session = createDemoSession('cancel-missing-ref@test.com');
    setAccountLinkStatus(session.id, ACCOUNT_LINK_STATUS.Linked, {
      sessionKey: 'session_remote',
      preserveMapping: true,
    });

    const response = await cancelRoute(buildRequest(session.id));
    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/linked user reference/i);
  });

  it('returns 409 when account has not been linked', async () => {
    const session = createDemoSession('cancel-not-linked@test.com');
    const response = await cancelRoute(buildRequest(session.id));
    expect(response.status).toBe(409);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/link your oncade account/i);
  });

  it('propagates cancellation API failures', async () => {
    const session = createDemoSession('cancel-failure@test.com');
    setAccountLinkStatus(session.id, ACCOUNT_LINK_STATUS.Linked, {
      sessionKey: 'session_remote',
      preserveMapping: true,
      userRef: 'link_usr_555',
    });

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({
          subscriptionId: 'sub_555',
          subscriptionItemId: TEST_PLAN.itemId,
          subscriptionStatus: 'Active',
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ error: 'Cancel failed' }, 500));

    const response = await cancelRoute(buildRequest(session.id));
    expect(response.status).toBe(500);
    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toBe('Cancel failed');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GET as getSubscriptionStatus } from '@/app/api/subscription/status/route';
import { SESSION_HEADER } from '@/lib/constants';
import { createDemoSession, setSubscriptionStatus } from '@/lib/session/session.server';
import { SUBSCRIPTION_STATUS } from '@/lib/subscription/subscription.types';
import * as planConfig from '@/lib/env/planConfig.server';
import { buildAppUrl, buildJsonRequest } from './helpers/http';

const SUBSCRIPTION_STATUS_URL = buildAppUrl('/api/subscription/status');

function buildRequest(sessionId: string) {
  return buildJsonRequest(SUBSCRIPTION_STATUS_URL, {
    headers: {
      [SESSION_HEADER]: sessionId,
    },
  });
}

describe('GET /api/subscription/status', () => {
  beforeEach(() => {
    process.env.DEMO_SERVER_API_KEY = 'test-api-key';
    process.env.DEMO_GAME_ID = 'test-game-id';
  });

  afterEach(() => {
    delete process.env.DEMO_SERVER_API_KEY;
    delete process.env.DEMO_GAME_ID;
  });

  it('returns subscription status with plan details from remote resolution', async () => {
    const planSpy = vi
      .spyOn(planConfig, 'resolveDemoPlanConfig')
      .mockResolvedValue({
        code: 'remote-plan',
        name: 'Remote Plan',
        priceUsd: 12.34,
        interval: 'Monthly',
        itemId: 'remote-item-id',
      });
    vi.spyOn(planConfig, 'getPlanFetchWarning').mockReturnValue(undefined);

    const session = createDemoSession('subscription-status@test.com');
    setSubscriptionStatus(session.id, SUBSCRIPTION_STATUS.Active, { occurredAt: new Date() });

    const response = await getSubscriptionStatus(buildRequest(session.id));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.status).toBe(SUBSCRIPTION_STATUS.Active);
    expect(payload.data.plan).toEqual({
      code: 'remote-plan',
      name: 'Remote Plan',
      priceUsd: 12.34,
      interval: 'Monthly',
      itemId: 'remote-item-id',
    });

    expect(planSpy).toHaveBeenCalled();
  });

  it('omits plan details when server credentials are not configured', async () => {
    delete process.env.DEMO_SERVER_API_KEY;
    delete process.env.DEMO_GAME_ID;

    const planSpy = vi.spyOn(planConfig, 'resolveDemoPlanConfig').mockResolvedValue({
      code: 'should-not-load',
      name: 'Plan should not load',
      priceUsd: 4.99,
      interval: 'Monthly',
      itemId: 'missing-key-item',
    });
    vi.spyOn(planConfig, 'getPlanFetchWarning').mockReturnValue(undefined);

    const session = createDemoSession('missing-plan@test.com');
    setSubscriptionStatus(session.id, SUBSCRIPTION_STATUS.Pending, { occurredAt: new Date() });

    const response = await getSubscriptionStatus(buildRequest(session.id));
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.plan).toBeNull();
    expect(planSpy).not.toHaveBeenCalled();
  });

  it('returns 404 when session is missing', async () => {
    vi.spyOn(planConfig, 'resolveDemoPlanConfig').mockResolvedValue({
      code: 'fallback-plan',
      name: 'Fallback',
      priceUsd: 4.99,
      interval: 'Monthly',
      itemId: 'fallback-item-id',
    });
    vi.spyOn(planConfig, 'getPlanFetchWarning').mockReturnValue(undefined);

    const response = await getSubscriptionStatus(buildRequest('unknown-session'));
    expect(response.status).toBe(404);

    const payload = await response.json();
    expect(payload.success).toBe(false);
    expect(payload.error).toMatch(/Session not found/);
  });
});

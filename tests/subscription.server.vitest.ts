import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markSubscriptionPending, activateSubscription, cancelSubscription } from '@/lib/subscription/subscription.server';
import { SUBSCRIPTION_STATUS } from '@/lib/subscription/subscription.types';
import { createDemoSession, getSessionDto } from '@/lib/session/session.server';
import * as planConfig from '@/lib/env/planConfig.server';

describe('subscription.server', () => {
  beforeEach(() => {
    vi.spyOn(planConfig, 'resolveDemoPlanConfig').mockResolvedValue({
      code: 'demo-plan-code',
      name: 'Demo Plan',
      priceUsd: 4.99,
      interval: 'Monthly',
      itemId: 'demo-plan-item-id',
    });
    vi.spyOn(planConfig, 'getPlanFetchWarning').mockReturnValue(undefined);
  });

  it('transitions subscription to pending and active', async () => {
    const session = createDemoSession('subscriber@ea.com');

    await markSubscriptionPending(session.id, 'demo');
    let updated = getSessionDto(session.id);
    expect(updated?.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.Pending);

    await activateSubscription(session.id, 'demo');
    updated = getSessionDto(session.id);
    expect(updated?.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.Active);
    expect(updated?.subscriptionActivatedAt).toBeDefined();
  });

  it('handles cancel webhook', async () => {
    const session = createDemoSession('subscriber@ea.com');
    await activateSubscription(session.id, 'demo');
    await cancelSubscription(session.id, 'demo');

    const updated = getSessionDto(session.id);
    expect(updated?.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.Canceled);
  });
});

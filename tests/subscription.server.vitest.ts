import { beforeEach, describe, expect, it, vi } from 'vitest';

import { markSubscriptionPending, activateSubscription, cancelSubscription } from '@/lib/subscription/subscription.server';
import { createDemoSession } from '@/lib/session/session.server';
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

  it('transitions subscription to pending and active (no-ops, state managed client-side)', async () => {
    const session = createDemoSession('subscriber@ea.com');

    // These functions are now no-ops since state is managed client-side
    // They should not throw errors
    await expect(markSubscriptionPending(session.id, 'demo')).resolves.not.toThrow();
    await expect(activateSubscription(session.id, 'demo')).resolves.not.toThrow();
  });

  it('handles cancel webhook (no-op, state managed client-side)', async () => {
    const session = createDemoSession('subscriber@ea.com');
    
    // These functions are now no-ops since state is managed client-side
    await expect(activateSubscription(session.id, 'demo')).resolves.not.toThrow();
    await expect(cancelSubscription(session.id, 'demo')).resolves.not.toThrow();
  });
});

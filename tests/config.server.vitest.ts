import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDemoEnvironmentSummary } from '@/lib/env/config.server';
import * as planConfig from '@/lib/env/planConfig.server';

const TEST_PLAN = {
  code: 'test-plan',
  name: 'Test Plan',
  priceUsd: 9.99,
  interval: 'Monthly',
  itemId: 'test-plan-item',
} as const;

describe('getDemoEnvironmentSummary', () => {
  afterEach(() => {
    delete process.env.DEMO_SERVER_API_KEY;
    delete process.env.DEMO_GAME_ID;
    delete process.env.DEMO_PLAN_ITEM_ID;
  });

  it('returns plan details when server credentials are configured', async () => {
    process.env.DEMO_SERVER_API_KEY = 'demo-server-key';
    process.env.DEMO_GAME_ID = 'demo-game-id';
    process.env.DEMO_PLAN_ITEM_ID = TEST_PLAN.itemId;

    vi.spyOn(planConfig, 'resolveDemoPlanConfig').mockResolvedValue(TEST_PLAN);
    vi.spyOn(planConfig, 'getPlanFetchWarning').mockReturnValue(undefined);

    const summary = await getDemoEnvironmentSummary();

    expect(summary.plan).toEqual(TEST_PLAN);
    expect(planConfig.resolveDemoPlanConfig).toHaveBeenCalledWith({ forceRefresh: true });
  });

  it('omits plan details when server credentials are missing', async () => {
    process.env.DEMO_PLAN_ITEM_ID = TEST_PLAN.itemId;

    const planSpy = vi.spyOn(planConfig, 'resolveDemoPlanConfig').mockResolvedValue(TEST_PLAN);
    vi.spyOn(planConfig, 'getPlanFetchWarning').mockReturnValue(undefined);

    const summary = await getDemoEnvironmentSummary();

    expect(summary.plan).toBeNull();
    expect(planSpy).not.toHaveBeenCalled();
    expect(summary.warnings).toContain(
      'Server API key is missing. Plan details and account linking requests will fail.',
    );
    expect(summary.warnings).toContain(
      'Game identifier is missing. Plan details and account linking requests will fail.',
    );
  });
});

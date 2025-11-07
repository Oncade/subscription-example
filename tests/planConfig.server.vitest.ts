import { describe, expect, it, vi } from 'vitest';

import { buildPlanConfigFromEnv, getPlanFetchWarning, resolveDemoPlanConfig } from '@/lib/env/planConfig.server';

describe('planConfig.server', () => {
  it('merges remote plan data when Oncade item endpoint succeeds', async () => {
    const planPayload = {
      success: true,
      data: {
        item: {
          name: 'API Plan Name',
          planCode: 'api-plan-code',
          priceCents: 1_599,
          metadata: {
            interval: 'Yearly',
          },
        },
      },
    } as const;

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(planPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const plan = await resolveDemoPlanConfig({ forceRefresh: true });

    expect(plan.name).toBe('API Plan Name');
    expect(plan.code).toBe('api-plan-code');
    expect(plan.priceUsd).toBeCloseTo(15.99, 2);
    expect(plan.interval).toBe('Yearly');
    expect(getPlanFetchWarning()).toBeUndefined();
  });

  it('derives plan code from remote identifiers when planCode is absent', async () => {
    const planPayload = {
      success: true,
      data: {
        item: {
          name: 'Identifier Plan',
          itemId: 'remote-item-identifier',
          metadata: { interval: 'Monthly' },
        },
      },
    } as const;

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(planPayload), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const plan = await resolveDemoPlanConfig({ forceRefresh: true });

    expect(plan.code).toBe('remote-item-identifier');
    expect(plan.name).toBe('Identifier Plan');
    expect(plan.interval).toBe('Monthly');
    expect(getPlanFetchWarning()).toBeUndefined();
  });

  it('falls back to environment values when fetch fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));

    const fallback = buildPlanConfigFromEnv();
    const plan = await resolveDemoPlanConfig({ forceRefresh: true });

    expect(plan).toEqual(fallback);
    expect(getPlanFetchWarning()).toContain('Unable to load plan details');
  });
});

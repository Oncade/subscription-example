import crypto from 'crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { handleWebhookSubscriptionPost } from '@/app/api/routes/webhookSubscription';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
import * as eventStream from '@/lib/events/eventStream.server';
import { WEBHOOK_SIGNATURE_HEADER } from '@/lib/constants';
import * as planConfig from '@/lib/env/planConfig.server';
import { SUBSCRIPTION_STATUS } from '@/lib/subscription/subscription.types';
import { buildAppUrl } from './helpers/http';

function makeSignedRequest(path: string, body: unknown, secret: string): NextRequest {
  const rawBody = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return new NextRequest(buildAppUrl(path), {
    method: 'POST',
    body: rawBody,
    headers: {
      'Content-Type': 'application/json',
      [WEBHOOK_SIGNATURE_HEADER]: signature,
    },
  });
}

describe('subscription webhook route', () => {
  beforeEach(() => {
    process.env.DEMO_WEBHOOK_SECRET = 'test-secret';
    vi.spyOn(planConfig, 'resolveDemoPlanConfig').mockResolvedValue({
      code: 'demo-plan-code',
      name: 'Demo Plan',
      priceUsd: 4.99,
      interval: 'Monthly',
      itemId: 'demo-plan-item-id',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('validates signature and pushes subscription events to clients', async () => {
    const pushSpy = vi.spyOn(eventStream, 'pushEventToClients').mockImplementation(() => {});
    const secret = process.env.DEMO_WEBHOOK_SECRET ?? 'test-secret';

    const request = makeSignedRequest(
      '/api/webhooks/subscription',
      {
        sessionId: 'session_sub',
        status: SUBSCRIPTION_STATUS.Active,
      },
      secret,
    );

    const response = await handleWebhookSubscriptionPost(request);
    expect(response.status).toBe(200);
    expect(pushSpy).toHaveBeenCalledTimes(1);
    expect(pushSpy).toHaveBeenCalledWith({
      type: DEMO_EVENT_TYPE.SubscriptionEvent,
      payload: expect.objectContaining({
        sessionId: 'session_sub',
        status: SUBSCRIPTION_STATUS.Active,
        provider: 'coinflow',
        planCode: 'demo-plan-code',
        topic: 'coinflow.subscription.active',
      }),
    });
  });

  it('rejects invalid signatures', async () => {
    const request = makeSignedRequest(
      '/api/webhooks/subscription',
      {
        sessionId: 'session_bad_sig',
        status: SUBSCRIPTION_STATUS.Canceled,
      },
      'invalid-secret',
    );

    const response = await handleWebhookSubscriptionPost(request);
    expect(response.status).toBe(401);
  });
});

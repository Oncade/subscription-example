import crypto from 'crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST as oncadeWebhook } from '@/app/api/webhook/route';
import { createDemoSession, getSessionDto, setAccountLinkStatus } from '@/lib/session/session.server';
import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import { markSubscriptionPending } from '@/lib/subscription/subscription.server';
import { SUBSCRIPTION_STATUS } from '@/lib/subscription/subscription.types';
import { ONCADE_WEBHOOK_SIGNATURE_HEADER } from '@/lib/constants';
import * as planConfig from '@/lib/env/planConfig.server';
import * as eventBus from '@/lib/events/eventBus.server';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
import { EVENT_LOG_TONE } from '@/lib/events/eventLog.types';
import type { DemoEvent } from '@/lib/events/eventBus.types';
import { buildAppUrl } from './helpers/http';

type AccountLinkEvent = Extract<DemoEvent, { readonly type: typeof DEMO_EVENT_TYPE.AccountLinkEvent }>;

function makeSignedRequest(path: string, body: unknown, secret: string): NextRequest {
  const rawBody = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return new NextRequest(buildAppUrl(path), {
    method: 'POST',
    body: rawBody,
    headers: {
      'Content-Type': 'application/json',
      [ONCADE_WEBHOOK_SIGNATURE_HEADER]: signature,
    },
  });
}

describe('Oncade webhook route', () => {
  beforeEach(() => {
    vi.spyOn(planConfig, 'resolveDemoPlanConfig').mockResolvedValue({
      code: 'demo-plan-code',
      name: 'Demo Plan',
      priceUsd: 4.99,
      interval: 'Monthly',
      itemId: 'demo-plan-item-id',
    });
    vi.spyOn(planConfig, 'getPlanFetchWarning').mockReturnValue(undefined);
    process.env.DEMO_WEBHOOK_SECRET = 'test-secret';
  });

  it('updates account linking status when approval completes', async () => {
    const secret = process.env.DEMO_WEBHOOK_SECRET ?? 'test-secret';
    const session = createDemoSession('listen-account@test.com');
    setAccountLinkStatus(session.id, ACCOUNT_LINK_STATUS.Started, {
      sessionKey: 'session_remote',
      preserveMapping: true,
    });

    const request = makeSignedRequest(
      '/api/webhook',
      {
        event: 'User.Account.Link.Succeeded',
        timestamp: new Date().toISOString(),
        data: { sessionKey: 'session_remote', user_ref: 'user_ref_abc' },
      },
      secret,
    );

    const response = await oncadeWebhook(request);
    expect(response.status).toBe(200);

    const updated = getSessionDto(session.id);
    expect(updated?.accountLinkStatus).toBe(ACCOUNT_LINK_STATUS.Linked);
    expect(updated?.linkedUserRef).toBe('user_ref_abc');
  });

  it('emits account link started event when Oncade webhook arrives', async () => {
    const secret = process.env.DEMO_WEBHOOK_SECRET ?? 'test-secret';
    const session = createDemoSession('listen-started@test.com');
    setAccountLinkStatus(session.id, ACCOUNT_LINK_STATUS.Started, {
      sessionKey: 'session_started',
      preserveMapping: true,
    });

    const emitSpy = vi.spyOn(eventBus, 'emitDemoEvent');
    try {
      const occurredAt = new Date().toISOString();

      const request = makeSignedRequest(
        '/api/webhook',
        {
          event: 'User.Account.Link.Started',
          timestamp: occurredAt,
          data: { sessionKey: 'session_started' },
        },
        secret,
      );

      const response = await oncadeWebhook(request);
      expect(response.status).toBe(200);

      const accountLinkEvents = emitSpy.mock.calls
        .map(([event]) => event)
        .filter((event): event is AccountLinkEvent => event.type === DEMO_EVENT_TYPE.AccountLinkEvent)
        .filter((event) => event.payload.status === ACCOUNT_LINK_STATUS.Started);
      expect(accountLinkEvents).toHaveLength(1);
      expect(accountLinkEvents[0]?.payload.triggeredAt).toBe(occurredAt);
      expect(accountLinkEvents[0]?.payload.topic).toBe('User.Account.Link.Started');
    } finally {
      emitSpy.mockRestore();
    }
  });

  it('transitions subscription to active when completed webhook arrives', async () => {
    const secret = process.env.DEMO_WEBHOOK_SECRET ?? 'test-secret';
    const session = createDemoSession('listen-subscription@test.com');
    setAccountLinkStatus(session.id, ACCOUNT_LINK_STATUS.Started, {
      sessionKey: 'session_subscription',
      preserveMapping: true,
    });
    await markSubscriptionPending(session.id, 'demo');

    const request = makeSignedRequest(
      '/api/webhook',
      {
        event: 'Purchases.Subscriptions.Completed',
        timestamp: new Date().toISOString(),
        data: { metadata: { sessionKey: 'session_subscription' } },
      },
      secret,
    );

    const response = await oncadeWebhook(request);
    expect(response.status).toBe(200);

    const updated = getSessionDto(session.id);
    expect(updated?.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.Active);
  });

  it('matches subscriptions by user reference when session key is missing', async () => {
    const secret = process.env.DEMO_WEBHOOK_SECRET ?? 'test-secret';
    const session = createDemoSession('user-ref-only@test.com');
    setAccountLinkStatus(session.id, ACCOUNT_LINK_STATUS.Linked, {
      sessionKey: 'session_user_ref_only',
      preserveMapping: true,
      userRef: 'user_ref_only',
    });
    await markSubscriptionPending(session.id, 'demo');

    const request = makeSignedRequest(
      '/api/webhook',
      {
        event: 'Purchases.Subscriptions.Completed',
        timestamp: new Date().toISOString(),
        data: { user_ref: 'user_ref_only' },
      },
      secret,
    );

    const response = await oncadeWebhook(request);
    expect(response.status).toBe(200);

    const updated = getSessionDto(session.id);
    expect(updated?.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.Active);
  });

  it('falls back to email when subscription webhook is missing session key', async () => {
    const secret = process.env.DEMO_WEBHOOK_SECRET ?? 'test-secret';
    const session = createDemoSession('email-only@test.com');
    await markSubscriptionPending(session.id, 'demo');

    const request = makeSignedRequest(
      '/api/webhook',
      {
        event: 'Purchases.Subscriptions.Completed',
        timestamp: new Date().toISOString(),
        data: { userEmail: 'email-only@test.com' },
      },
      secret,
    );

    const response = await oncadeWebhook(request);
    expect(response.status).toBe(200);

    const updated = getSessionDto(session.id);
    expect(updated?.subscriptionStatus).toBe(SUBSCRIPTION_STATUS.Active);
  });

  it('returns 401 when webhook signature is missing', async () => {
    const request = new NextRequest(buildAppUrl('/api/webhook'), {
      method: 'POST',
      body: JSON.stringify({
        event: 'Webhook.Test',
        timestamp: new Date().toISOString(),
        data: {},
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const response = await oncadeWebhook(request);
    expect(response.status).toBe(401);
  });

  it('returns 202 for unknown session references', async () => {
    const secret = process.env.DEMO_WEBHOOK_SECRET ?? 'test-secret';
    const request = makeSignedRequest(
      '/api/webhook',
      {
        event: 'User.Account.Link.Succeeded',
        timestamp: new Date().toISOString(),
        data: { sessionKey: 'unknown-session-key' },
      },
      secret,
    );

    const response = await oncadeWebhook(request);
    expect(response.status).toBe(202);
  });

  it('emits webhook notification when signature verification fails', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emitDemoEvent');
    try {
      const request = makeSignedRequest(
        '/api/webhook',
        {
          event: 'Webhook.Test',
          timestamp: new Date().toISOString(),
          data: {},
        },
        'invalid-secret',
      );

      const response = await oncadeWebhook(request);
      expect(response.status).toBe(401);

      const notificationEvents = emitSpy.mock.calls
        .map(([event]) => event)
        .filter((event) => event.type === DEMO_EVENT_TYPE.WebhookNotification);
      expect(notificationEvents).toHaveLength(1);
      expect(notificationEvents[0]?.payload.summary).toContain('invalid signature');
      expect(notificationEvents[0]?.payload.tone).toBe(EVENT_LOG_TONE.Warning);
    } finally {
      emitSpy.mockRestore();
    }
  });
});

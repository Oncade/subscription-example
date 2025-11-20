import crypto from 'crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { handleOncadeWebhookPost } from '@/app/api/routes/webhookOncade';
import { createDemoSession } from '@/lib/session/session.server';
import { ONCADE_WEBHOOK_SIGNATURE_HEADER } from '@/lib/constants';
import * as planConfig from '@/lib/env/planConfig.server';
import { buildAppUrl } from './helpers/http';

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
    createDemoSession('listen-account@test.com');

    const request = makeSignedRequest(
      '/api/webhook',
      {
        event: 'User.Account.Link.Succeeded',
        timestamp: new Date().toISOString(),
        data: { sessionKey: 'session_remote', user_ref: 'user_ref_abc' },
      },
      secret,
    );

    const response = await handleOncadeWebhookPost(request);
    expect(response.status).toBe(200);
    // Webhook events are now pushed directly to clients, not stored server-side
  });

  it('emits account link started event when Oncade webhook arrives', async () => {
    const secret = process.env.DEMO_WEBHOOK_SECRET ?? 'test-secret';
    createDemoSession('listen-started@test.com');

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

    const response = await handleOncadeWebhookPost(request);
    expect(response.status).toBe(200);
    // Webhook events are now pushed directly to clients via pushEventToClients
  });

  it('transitions subscription to active when completed webhook arrives', async () => {
    const secret = process.env.DEMO_WEBHOOK_SECRET ?? 'test-secret';
    createDemoSession('listen-subscription@test.com');

    const request = makeSignedRequest(
      '/api/webhook',
      {
        event: 'Purchases.Subscriptions.Completed',
        timestamp: new Date().toISOString(),
        data: { metadata: { sessionKey: 'session_subscription' } },
      },
      secret,
    );

    const response = await handleOncadeWebhookPost(request);
    expect(response.status).toBe(200);
    // Webhook events are now pushed directly to clients, not stored server-side
  });

  it('matches subscriptions by user reference when session key is missing', async () => {
    const secret = process.env.DEMO_WEBHOOK_SECRET ?? 'test-secret';
    createDemoSession('user-ref-only@test.com');

    const request = makeSignedRequest(
      '/api/webhook',
      {
        event: 'Purchases.Subscriptions.Completed',
        timestamp: new Date().toISOString(),
        data: { user_ref: 'user_ref_only' },
      },
      secret,
    );

    const response = await handleOncadeWebhookPost(request);
    expect(response.status).toBe(200);
    // Webhook events are now pushed directly to clients, not stored server-side
  });

  it('falls back to email when subscription webhook is missing session key', async () => {
    const secret = process.env.DEMO_WEBHOOK_SECRET ?? 'test-secret';
    createDemoSession('email-only@test.com');

    const request = makeSignedRequest(
      '/api/webhook',
      {
        event: 'Purchases.Subscriptions.Completed',
        timestamp: new Date().toISOString(),
        data: { userEmail: 'email-only@test.com' },
      },
      secret,
    );

    const response = await handleOncadeWebhookPost(request);
    expect(response.status).toBe(200);
    // Webhook events are now pushed directly to clients, not stored server-side
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

    const response = await handleOncadeWebhookPost(request);
    expect(response.status).toBe(401);
  });

  it('returns 200 for unknown session references (events pushed to clients)', async () => {
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

    const response = await handleOncadeWebhookPost(request);
    // Now always returns 200 since we push events to all clients, not just matching sessions
    expect(response.status).toBe(200);
  });

  it('returns 401 when signature verification fails', async () => {
    const request = makeSignedRequest(
      '/api/webhook',
      {
        event: 'Webhook.Test',
        timestamp: new Date().toISOString(),
        data: {},
      },
      'invalid-secret',
    );

    const response = await handleOncadeWebhookPost(request);
    expect(response.status).toBe(401);
    // Webhook notifications are no longer emitted server-side
  });
});

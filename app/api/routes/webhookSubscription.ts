'use server';

import { NextRequest, NextResponse } from 'next/server';

import { WEBHOOK_SIGNATURE_HEADER } from '@/lib/constants';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
import { pushEventToClients } from '@/lib/events/eventStream.server';
import { resolveDemoPlanConfig } from '@/lib/env/planConfig.server';
import { SUBSCRIPTION_STATUS } from '@/lib/subscription/subscription.types';
import type { SubscriptionWebhookBody } from '@/lib/subscription/subscriptionWebhook.types';
import {
  findWebhookSignature,
  resolveWebhookSecret,
  verifyWebhookSignature,
} from '@/lib/webhooks/webhookVerification.server';

export async function handleWebhookSubscriptionPost(request: NextRequest): Promise<NextResponse> {
  const secret = resolveWebhookSecret();
  if (!secret) {
    return NextResponse.json({ success: false, error: 'Webhook secret not configured.' }, { status: 500 });
  }

  const signature = findWebhookSignature(request, [WEBHOOK_SIGNATURE_HEADER]);
  if (!signature) {
    return NextResponse.json({ success: false, error: 'Missing webhook signature.' }, { status: 401 });
  }

  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ success: false, error: 'Invalid webhook signature.' }, { status: 401 });
  }

  let payload: SubscriptionWebhookBody;
  try {
    payload = JSON.parse(rawBody) as SubscriptionWebhookBody;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!payload.sessionId || typeof payload.sessionId !== 'string') {
    return NextResponse.json({ success: false, error: 'Session identifier missing.' }, { status: 400 });
  }

  if (payload.status !== SUBSCRIPTION_STATUS.Active && payload.status !== SUBSCRIPTION_STATUS.Canceled) {
    return NextResponse.json({ success: false, error: 'Unsupported subscription status.' }, { status: 400 });
  }

  const plan = await resolveDemoPlanConfig().catch(() => undefined);
  const planCode = plan?.code || plan?.itemId || 'demo-plan';

  pushEventToClients({
    type: DEMO_EVENT_TYPE.SubscriptionEvent,
    payload: {
      sessionId: payload.sessionId,
      status: payload.status,
      occurredAt: new Date().toISOString(),
      provider: 'coinflow',
      planCode,
      topic: `coinflow.subscription.${payload.status}`,
    },
  });

  return NextResponse.json({ success: true });
}

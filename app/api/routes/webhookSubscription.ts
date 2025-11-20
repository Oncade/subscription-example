'use server';

import { NextRequest, NextResponse } from 'next/server';

import { WEBHOOK_SIGNATURE_HEADER } from '@/lib/constants';
import { activateSubscription, cancelSubscription } from '@/lib/subscription/subscription.server';
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

  const payload = JSON.parse(rawBody) as SubscriptionWebhookBody;
  if (!payload.sessionId) {
    return NextResponse.json({ success: false, error: 'Session identifier missing.' }, { status: 400 });
  }

  if (payload.status === SUBSCRIPTION_STATUS.Active) {
    await activateSubscription(payload.sessionId, 'coinflow', `coinflow.subscription.${payload.status}`);
  } else if (payload.status === SUBSCRIPTION_STATUS.Canceled) {
    await cancelSubscription(payload.sessionId, 'coinflow', `coinflow.subscription.${payload.status}`);
  } else {
    return NextResponse.json({ success: false, error: 'Unsupported subscription status.' }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}

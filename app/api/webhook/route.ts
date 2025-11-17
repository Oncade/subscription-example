import { NextRequest, NextResponse } from 'next/server';

import {
  WEBHOOK_SIGNATURE_HEADERS,
  WEBHOOK_SIGNATURE_HEADER,
  ONCADE_WEBHOOK_SIGNATURE_HEADER,
} from '@/lib/constants';
import {
  findWebhookSignature,
  resolveWebhookSecret,
  verifyWebhookSignature,
} from '@/lib/webhooks/webhookVerification.server';
import { emitWebhookSignatureFailure } from '@/lib/webhooks/webhookEvents.server';
import {
  isOncadeAccountLinkEvent,
  mapOncadeSubscriptionEvent,
} from '@/lib/webhooks/oncadeWebhook.constants';
import { handleAccountLinkWebhook, handleSubscriptionWebhook } from '@/lib/webhooks/oncadeWebhookHandlers.server';
import type { OncadeWebhookEnvelope } from '@/lib/webhooks/oncadeWebhook.types';
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_INTERNAL_ERROR = 500;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const secret = resolveWebhookSecret();
  if (!secret) {
    return NextResponse.json({ success: false, error: 'Webhook secret not configured.' }, { status: HTTP_STATUS_INTERNAL_ERROR });
  }

  const signature = findWebhookSignature(request, WEBHOOK_SIGNATURE_HEADERS);
  if (!signature) {
    return NextResponse.json({ success: false, error: 'Missing webhook signature.' }, { status: HTTP_STATUS_UNAUTHORIZED });
  }

  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    const legacyHeader = WEBHOOK_SIGNATURE_HEADER;
    const headerUsed = request.headers.has(legacyHeader) ? legacyHeader : ONCADE_WEBHOOK_SIGNATURE_HEADER;
    console.warn(`Rejected webhook due to invalid signature (${headerUsed}).`);
    emitWebhookSignatureFailure(headerUsed);
    return NextResponse.json({ success: false, error: 'Invalid webhook signature.' }, { status: HTTP_STATUS_UNAUTHORIZED });
  }

  let payload: OncadeWebhookEnvelope;
  try {
    payload = JSON.parse(rawBody) as OncadeWebhookEnvelope;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON webhook payload.' }, { status: HTTP_STATUS_BAD_REQUEST });
  }

  console.log('payload', payload)

  if (!payload.event || typeof payload.event !== 'string') {
    return NextResponse.json({ success: false, error: 'Missing event identifier.' }, { status: HTTP_STATUS_BAD_REQUEST });
  }

  if (isOncadeAccountLinkEvent(payload.event)) {
    return handleAccountLinkWebhook(payload);
  }

  const subscriptionTransition = mapOncadeSubscriptionEvent(payload.event);
  if (subscriptionTransition) {
    return await handleSubscriptionWebhook(payload.event, payload, subscriptionTransition);
  }

  console.info('Received unsupported Oncade webhook event; skipping', payload.event);
  return NextResponse.json({ success: true }, { status: HTTP_STATUS_OK });
}

'use server';

import { NextRequest, NextResponse } from 'next/server';

import { WEBHOOK_SIGNATURE_HEADER } from '@/lib/constants';
import {
  findWebhookSignature,
  resolveWebhookSecret,
  verifyWebhookSignature,
} from '@/lib/webhooks/webhookVerification.server';
import { pushEventToClients } from '@/lib/events/eventStream.server';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
import type { AccountLinkWebhookEnvelope } from '@/lib/webhooks/oncadeWebhook.types';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_INTERNAL_ERROR = 500;

export async function handleWebhookAccountLinkingPost(request: NextRequest): Promise<NextResponse> {
  const secret = resolveWebhookSecret();
  if (!secret) {
    return NextResponse.json(
      { success: false, error: 'Webhook secret not configured.' },
      { status: HTTP_STATUS_INTERNAL_ERROR },
    );
  }

  const signature = findWebhookSignature(request, [WEBHOOK_SIGNATURE_HEADER]);
  if (!signature) {
    return NextResponse.json(
      { success: false, error: 'Missing webhook signature.' },
      { status: HTTP_STATUS_UNAUTHORIZED },
    );
  }

  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json(
      { success: false, error: 'Invalid webhook signature.' },
      { status: HTTP_STATUS_UNAUTHORIZED },
    );
  }

  let payload: AccountLinkWebhookEnvelope;
  try {
    payload = JSON.parse(rawBody) as AccountLinkWebhookEnvelope;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON webhook payload.' },
      { status: HTTP_STATUS_BAD_REQUEST },
    );
  }

  if (!payload.event || typeof payload.event !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing event identifier.' },
      { status: HTTP_STATUS_BAD_REQUEST },
    );
  }

  // Send raw webhook event directly to all connected clients
  // Session state is managed client-side in localStorage
  pushEventToClients({
    type: DEMO_EVENT_TYPE.RawWebhookEvent,
    payload,
  });

  return NextResponse.json({ success: true }, { status: HTTP_STATUS_OK });
}

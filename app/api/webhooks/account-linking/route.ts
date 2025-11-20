import { NextRequest, NextResponse } from 'next/server';

import { ACCOUNT_LINK_STATUS, type AccountLinkStatus } from '@/lib/accountLink/accountLink.types';
import {
  cancelAccountLink,
  completeAccountLink,
  resolveSessionIdFromLink,
  emitAccountLinkEvent,
} from '@/lib/accountLink/accountLink.server';
import { setAccountLinkStatus } from '@/lib/session/session.server';
import { WEBHOOK_SIGNATURE_HEADER } from '@/lib/constants';
import { ONCADE_ACCOUNT_LINK_WEBHOOK_EVENTS as ACCOUNT_LINK_WEBHOOK_EVENTS } from '@/lib/webhooks/oncadeWebhook.constants';
import { EVENT_LOG_TONE } from '@/lib/events/eventLog.types';
import {
  findWebhookSignature,
  resolveWebhookSecret,
  verifyWebhookSignature,
} from '@/lib/webhooks/webhookVerification.server';
import type { AccountLinkWebhookEnvelope } from '@/lib/webhooks/oncadeWebhook.types';
import { emitWebhookNotification } from '@/lib/webhooks/webhookEvents.server';

function formatWebhookSummary(event: string, status: AccountLinkStatus): string {
  const topic = event && event.trim().length > 0 ? event : `account-link.${status}`;
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  return `Oncade webhook • ${topic} • ${statusLabel}`;
}

function emitAccountLinkNotification(event: string, status: AccountLinkStatus): void {
  const tone =
    status === ACCOUNT_LINK_STATUS.Linked
      ? EVENT_LOG_TONE.Success
      : status === ACCOUNT_LINK_STATUS.Canceled
        ? EVENT_LOG_TONE.Warning
        : EVENT_LOG_TONE.Info;
  emitWebhookNotification(formatWebhookSummary(event, status), tone);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  const payload = JSON.parse(rawBody) as AccountLinkWebhookEnvelope;
  const sessionKey = payload.data?.sessionKey;
  if (!sessionKey) {
    return NextResponse.json({ success: false, error: 'Missing session key in webhook payload.' }, { status: 400 });
  }

  const sessionId = resolveSessionIdFromLink(sessionKey);
  if (!sessionId) {
    return NextResponse.json({ success: false, error: 'Session for webhook not found.' }, { status: 202 });
  }

  const remoteUserRef = payload.data?.user_ref ?? undefined;

  switch (payload.event) {
    case ACCOUNT_LINK_WEBHOOK_EVENTS.Completed:
      completeAccountLink(sessionId, sessionKey, 'oncade', remoteUserRef, payload.timestamp, payload.event);
      emitAccountLinkNotification(payload.event, ACCOUNT_LINK_STATUS.Linked);
      break;
    case ACCOUNT_LINK_WEBHOOK_EVENTS.Canceled:
    case ACCOUNT_LINK_WEBHOOK_EVENTS.Removed:
    case ACCOUNT_LINK_WEBHOOK_EVENTS.Failed:
      cancelAccountLink(sessionId, sessionKey, 'oncade', remoteUserRef, payload.timestamp, payload.event);
      emitAccountLinkNotification(payload.event, ACCOUNT_LINK_STATUS.Canceled);
      break;
    case ACCOUNT_LINK_WEBHOOK_EVENTS.Started:
      setAccountLinkStatus(sessionId, ACCOUNT_LINK_STATUS.Started, {
        sessionKey,
        preserveMapping: true,
      });
      emitAccountLinkEvent({
        sessionId,
        sessionKey,
        status: ACCOUNT_LINK_STATUS.Started,
        provider: 'oncade',
        triggeredAt: payload.timestamp,
        topic: payload.event,
      });
      emitAccountLinkNotification(payload.event, ACCOUNT_LINK_STATUS.Started);
      break;
    default:
      console.warn('Received unsupported account link webhook event', payload.event);
      break;
  }

  return NextResponse.json({ success: true });
}

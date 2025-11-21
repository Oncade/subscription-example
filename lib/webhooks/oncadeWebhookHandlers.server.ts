import 'server-only';

import { NextResponse } from 'next/server';

import { cancelAccountLink, completeAccountLink } from '@/lib/accountLink/accountLink.server';
import { resolveSessionIdFromLink } from '@/lib/session/session.server';

import { ONCADE_ACCOUNT_LINK_WEBHOOK_EVENTS } from './oncadeWebhook.constants';
import { extractSessionKey, extractUserRef } from './oncadeWebhook.helpers';
import type { OncadeWebhookEnvelope } from './oncadeWebhook.types';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_ACCEPTED = 202;
const HTTP_STATUS_BAD_REQUEST = 400;

export async function handleAccountLinkWebhook(payload: OncadeWebhookEnvelope): Promise<NextResponse> {
  const sessionKey = extractSessionKey(payload.data);
  const userRef = extractUserRef(payload.data);

  if (!sessionKey) {
    console.warn('account-link webhook missing session key', payload);
    return NextResponse.json(
      { success: false, error: 'Missing session key in webhook payload.' },
      { status: HTTP_STATUS_BAD_REQUEST },
    );
  }

  const sessionId = await resolveSessionIdFromLink(sessionKey);
  if (!sessionId) {
    console.warn('account-link webhook session not found', { event: payload.event, sessionKey });
    return NextResponse.json(
      { success: false, error: 'Session for webhook not found.' },
      { status: HTTP_STATUS_ACCEPTED },
    );
  }

  switch (payload.event) {
    case ONCADE_ACCOUNT_LINK_WEBHOOK_EVENTS.Completed:
      completeAccountLink(sessionId, sessionKey, 'oncade', userRef, payload.timestamp, payload.event);
      break;
    case ONCADE_ACCOUNT_LINK_WEBHOOK_EVENTS.Canceled:
    case ONCADE_ACCOUNT_LINK_WEBHOOK_EVENTS.Removed:
    case ONCADE_ACCOUNT_LINK_WEBHOOK_EVENTS.Failed:
      cancelAccountLink(sessionId, sessionKey, 'oncade', userRef, payload.timestamp, payload.event);
      break;
    case ONCADE_ACCOUNT_LINK_WEBHOOK_EVENTS.Started:
      // Session state is managed client-side, no server-side storage
      // Events are sent directly to clients via webhookOncade.ts
      break;
    default:
      console.warn('Received unsupported account link webhook event', payload.event);
      break;
  }

  return NextResponse.json({ success: true }, { status: HTTP_STATUS_OK });
}

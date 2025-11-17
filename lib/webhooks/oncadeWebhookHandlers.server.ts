import 'server-only';

import { NextResponse } from 'next/server';

import {
  resolveSessionIdFromLink,
  cancelAccountLink,
  completeAccountLink,
  emitAccountLinkEvent,
} from '@/lib/accountLink/accountLink.server';
import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import { setAccountLinkStatus, getSessionRecord, resolveSessionIdByEmail, resolveSessionIdByUserRef } from '@/lib/session/session.server';
import { activateSubscription, cancelSubscription, markSubscriptionPending } from '@/lib/subscription/subscription.server';

import {
  ONCADE_ACCOUNT_LINK_WEBHOOK_EVENTS,
  type OncadeSubscriptionTransition,
} from './oncadeWebhook.constants';
import {
  extractSessionKey,
  extractSubscriptionSessionKey,
  extractUserEmail,
  extractUserRef,
} from './oncadeWebhook.helpers';
import type { OncadeWebhookEnvelope } from './oncadeWebhook.types';

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_ACCEPTED = 202;
const HTTP_STATUS_BAD_REQUEST = 400;

export function handleAccountLinkWebhook(payload: OncadeWebhookEnvelope): NextResponse {
  const sessionKey = extractSessionKey(payload.data);
  const userRef = extractUserRef(payload.data);

  if (!sessionKey) {
    console.warn('account-link webhook missing session key', payload);
    return NextResponse.json(
      { success: false, error: 'Missing session key in webhook payload.' },
      { status: HTTP_STATUS_BAD_REQUEST },
    );
  }

  const sessionId = resolveSessionIdFromLink(sessionKey);
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
      break;
    default:
      console.warn('Received unsupported account link webhook event', payload.event);
      break;
  }

  return NextResponse.json({ success: true }, { status: HTTP_STATUS_OK });
}

export async function handleSubscriptionWebhook(
  event: string,
  payload: OncadeWebhookEnvelope,
  transition: OncadeSubscriptionTransition,
): Promise<NextResponse> {
  const subscriptionSessionKey = extractSubscriptionSessionKey(payload.data);
  const payloadEmail = extractUserEmail(payload.data);
  const payloadUserRef = extractUserRef(payload.data);

  if (!subscriptionSessionKey && !payloadUserRef && !payloadEmail) {
    return NextResponse.json(
      { success: false, error: 'Session identifier missing.' },
      { status: HTTP_STATUS_BAD_REQUEST },
    );
  }

  let sessionId = subscriptionSessionKey ? resolveSessionIdFromLink(subscriptionSessionKey) : undefined;

  if (!sessionId && payloadUserRef) {
    sessionId = resolveSessionIdByUserRef(payloadUserRef);
  }

  if (!sessionId && payloadEmail) {
    sessionId = resolveSessionIdByEmail(payloadEmail);
  }

  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: 'Session for webhook not found.' },
      { status: HTTP_STATUS_ACCEPTED },
    );
  }

  const record = getSessionRecord(sessionId);
  if (!record) {
    return NextResponse.json({ success: false, error: 'Session for webhook not found.' }, { status: HTTP_STATUS_ACCEPTED });
  }

  switch (transition) {
    case 'pending':
      await markSubscriptionPending(sessionId, 'oncade', event);
      break;
    case 'active':
      await activateSubscription(sessionId, 'oncade', event);
      break;
    case 'canceled':
      await cancelSubscription(sessionId, 'oncade', event);
      break;
    default:
      console.warn('Unhandled subscription transition for event', event);
      break;
  }

  return NextResponse.json({ success: true }, { status: HTTP_STATUS_OK });
}

import 'server-only';

import { emitDemoEvent } from '@/lib/events/eventBus.server';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
import { resolveDemoPlanConfig } from '@/lib/env/planConfig.server';
// Session state is managed client-side, no server-side storage needed
import type { DemoSessionId } from '@/lib/session/session.types';

import type { SubscriptionEventPayload } from './subscription.types';
import { SUBSCRIPTION_STATUS } from './subscription.types';

async function emitSubscriptionEvent(
  sessionId: DemoSessionId,
  status: SubscriptionEventPayload['status'],
  provider: SubscriptionEventPayload['provider'],
  topic?: string,
): Promise<void> {
  // No-op - webhooks are handled client-side
  // Session state is managed client-side in localStorage
}

export async function activateSubscription(
  sessionId: DemoSessionId,
  provider: SubscriptionEventPayload['provider'],
  topic?: string,
): Promise<void> {
  await emitSubscriptionEvent(sessionId, SUBSCRIPTION_STATUS.Active, provider, topic);
}

export async function cancelSubscription(
  sessionId: DemoSessionId,
  provider: SubscriptionEventPayload['provider'],
  topic?: string,
): Promise<void> {
  await emitSubscriptionEvent(sessionId, SUBSCRIPTION_STATUS.Canceled, provider, topic);
}

export async function markSubscriptionPending(
  sessionId: DemoSessionId,
  provider: SubscriptionEventPayload['provider'],
  topic?: string,
): Promise<void> {
  await emitSubscriptionEvent(sessionId, SUBSCRIPTION_STATUS.Pending, provider, topic);
}

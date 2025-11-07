import 'server-only';

import { emitDemoEvent } from '@/lib/events/eventBus.server';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
import { resolveDemoPlanConfig } from '@/lib/env/planConfig.server';
import { setSubscriptionStatus, touchWebhook } from '@/lib/session/session.server';
import type { DemoSessionId } from '@/lib/session/session.types';

import type { SubscriptionEventPayload } from './subscription.types';
import { SUBSCRIPTION_STATUS } from './subscription.types';

async function emitSubscriptionEvent(
  sessionId: DemoSessionId,
  status: SubscriptionEventPayload['status'],
  provider: SubscriptionEventPayload['provider'],
  topic?: string,
): Promise<void> {
  const plan = await resolveDemoPlanConfig();
  const occurredAt = new Date();
  const resolvedTopic =
    topic && topic.trim().length > 0 ? topic : `${provider}.subscription.${status}`;

  setSubscriptionStatus(sessionId, status, { occurredAt });
  touchWebhook(sessionId);
  emitDemoEvent({
    type: DEMO_EVENT_TYPE.SubscriptionEvent,
    payload: {
      sessionId,
      status,
      occurredAt: occurredAt.toISOString(),
      provider,
      planCode: plan.code,
      topic: resolvedTopic,
    },
  });
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

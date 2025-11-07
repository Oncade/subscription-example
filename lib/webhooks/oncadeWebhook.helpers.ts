import type { AccountLinkWebhookData, SubscriptionWebhookData } from './oncadeWebhook.types';

export function extractSessionKey(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const { sessionKey } = data as AccountLinkWebhookData;
  return typeof sessionKey === 'string' && sessionKey.trim() ? sessionKey : undefined;
}

export function extractUserRef(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const { user_ref: snakeUserRef, userRef } = data as AccountLinkWebhookData;
  const candidate = typeof snakeUserRef === 'string' ? snakeUserRef : typeof userRef === 'string' ? userRef : undefined;
  if (!candidate) {
    return undefined;
  }
  const trimmed = candidate.trim();
  return trimmed ? trimmed : undefined;
}

export function extractSessionId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const { sessionId } = data as SubscriptionWebhookData;
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId : undefined;
}

import type { AccountLinkWebhookData, SubscriptionWebhookData } from './oncadeWebhook.types';

type UserRefPayload = AccountLinkWebhookData | SubscriptionWebhookData;

export function extractSessionKey(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const { sessionKey } = data as AccountLinkWebhookData;
  return typeof sessionKey === 'string' && sessionKey.trim() ? sessionKey : undefined;
}

export function extractSubscriptionSessionKey(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const { sessionKey, metadata } = data as SubscriptionWebhookData;
  const directKey = typeof sessionKey === 'string' ? sessionKey : undefined;
  const metadataKey =
    metadata && typeof metadata === 'object' && typeof (metadata as Record<string, unknown>).sessionKey === 'string'
      ? ((metadata as Record<string, unknown>).sessionKey as string)
      : undefined;
  const candidate = directKey ?? metadataKey;
  if (!candidate) {
    return undefined;
  }
  const trimmed = candidate.trim();
  return trimmed || undefined;
}

export function extractUserRef(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const { user_ref: snakeUserRef, userRef } = data as UserRefPayload;
  const candidate = typeof snakeUserRef === 'string' ? snakeUserRef : typeof userRef === 'string' ? userRef : undefined;
  if (!candidate) {
    return undefined;
  }
  const trimmed = candidate.trim();
  return trimmed ? trimmed : undefined;
}

export function extractUserEmail(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const { userEmail } = data as SubscriptionWebhookData;
  if (typeof userEmail !== 'string') {
    return undefined;
  }
  const trimmed = userEmail.trim();
  return trimmed ? trimmed : undefined;
}

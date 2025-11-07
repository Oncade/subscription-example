import type { AccountLinkStatus } from '@/lib/accountLink/accountLink.types';
import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import type { DemoEnvironmentSummaryDto } from '@/lib/env/config.types';
import type { SubscriptionStatus } from '@/lib/subscription/subscription.types';
import { SUBSCRIPTION_STATUS } from '@/lib/subscription/subscription.types';

import type { EventLogTone } from '@/lib/events/eventLog.types';

import type { EnvironmentStatus } from './landingExperience.types';

export function makeEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `evt-${Math.random().toString(36).slice(2)}`;
}

export function computeEnvStatus(environment: DemoEnvironmentSummaryDto): EnvironmentStatus {
  const missing = environment.required.filter((entry) => !entry.configured);
  return {
    ready: missing.length === 0,
    missing,
  };
}

export function getAccountLinkEventTone(status: AccountLinkStatus): EventLogTone {
  if (status === ACCOUNT_LINK_STATUS.Linked) {
    return 'success';
  }
  if (status === ACCOUNT_LINK_STATUS.Canceled) {
    return 'warning';
  }
  return 'info';
}

export function getSubscriptionEventTone(status: SubscriptionStatus): EventLogTone {
  return status === SUBSCRIPTION_STATUS.Active ? 'success' : 'warning';
}

function capitalize(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatProviderLabel(provider: string): string {
  if (provider === 'oncade') {
    return 'Oncade webhook';
  }
  if (provider === 'coinflow') {
    return 'Coinflow webhook';
  }
  return 'Demo signal';
}

function resolveTopic(topic: string | undefined, fallback: string): string {
  const trimmed = topic?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function formatAccountLinkSummary(
  provider: string,
  topic: string,
  status: AccountLinkStatus,
): string {
  const providerLabel = formatProviderLabel(provider);
  const topicLabel = resolveTopic(topic, `account-link.${status}`);
  const statusLabel = capitalize(status);
  return `${providerLabel} • ${topicLabel} • ${statusLabel}`;
}

export function formatSubscriptionSummary(
  provider: string,
  topic: string,
  status: SubscriptionStatus,
): string {
  const providerLabel = formatProviderLabel(provider);
  const topicLabel = resolveTopic(topic, `subscription.${status}`);
  const statusLabel = capitalize(status);
  return `${providerLabel} • ${topicLabel} • ${statusLabel}`;
}

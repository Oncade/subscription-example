import { COINFLOW_ACTIVE_STATUS } from './coinflow.constants';
import type { CoinflowSubscriptionSummary } from './coinflow.types';

export interface NormalizePlanCodeOptions {
  readonly lowercase?: boolean;
}

export function normalizePlanCode(value: unknown, options?: NormalizePlanCodeOptions): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (options?.lowercase === false) {
    return trimmed;
  }
  return trimmed.toLowerCase();
}

export function normalizeStatus(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

export function normalizeIdentifier(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.toLowerCase();
}

export function resolvePlanCodes(subscription: CoinflowSubscriptionSummary): readonly string[] {
  const codes: string[] = [];
  const direct = normalizePlanCode(subscription.planCode);
  if (direct) {
    codes.push(direct);
  }
  const nestedPlan = subscription.plan;
  if (nestedPlan && typeof nestedPlan === 'object') {
    const nestedCode = normalizePlanCode(nestedPlan.code);
    if (nestedCode) {
      codes.push(nestedCode);
    }
    const nestedPlanCode = normalizePlanCode(nestedPlan.planCode);
    if (nestedPlanCode) {
      codes.push(nestedPlanCode);
    }
  }
  return codes;
}

export function resolveItemIds(subscription: CoinflowSubscriptionSummary): readonly string[] {
  const identifiers: string[] = [];
  const direct = normalizeIdentifier(subscription.itemId);
  if (direct) {
    identifiers.push(direct);
  }
  const item = subscription.item;
  if (item) {
    const itemId = normalizeIdentifier(item.itemId);
    if (itemId) {
      identifiers.push(itemId);
    }
    const nestedId = normalizeIdentifier(item.id);
    if (nestedId) {
      identifiers.push(nestedId);
    }
  }
  const plan = subscription.plan;
  if (plan && typeof plan === 'object') {
    const planItemId = normalizeIdentifier(plan.itemId);
    if (planItemId) {
      identifiers.push(planItemId);
    }
    const internalItem = plan.item;
    if (internalItem) {
      const internalItemId = normalizeIdentifier(internalItem.itemId);
      if (internalItemId) {
        identifiers.push(internalItemId);
      }
      const internalId = normalizeIdentifier(internalItem.id);
      if (internalId) {
        identifiers.push(internalId);
      }
    }
  }
  return identifiers;
}

export function hasMatchingPlan(
  subscription: CoinflowSubscriptionSummary,
  normalizedPlanCode: string | undefined,
  normalizedPlanItemId: string | undefined,
): boolean {
  const normalizedStatus = normalizeStatus(subscription.status);
  if (normalizedStatus !== COINFLOW_ACTIVE_STATUS) {
    return false;
  }

  const matchesCode = normalizedPlanCode
    ? resolvePlanCodes(subscription).some((candidate) => candidate === normalizedPlanCode)
    : false;
  const matchesItem = normalizedPlanItemId
    ? resolveItemIds(subscription).some((candidate) => candidate === normalizedPlanItemId)
    : false;

  return matchesCode || matchesItem;
}

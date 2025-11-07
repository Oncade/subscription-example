export const SUBSCRIPTION_STATUS = {
  Inactive: 'inactive',
  Pending: 'pending',
  Active: 'active',
  Canceled: 'canceled',
} as const;

export type SubscriptionStatus = typeof SUBSCRIPTION_STATUS[keyof typeof SUBSCRIPTION_STATUS];

export interface SubscriptionEventPayload {
  readonly sessionId: string;
  readonly status: SubscriptionStatus;
  readonly occurredAt: string;
  readonly provider: 'demo' | 'coinflow' | 'oncade';
  readonly planCode: string;
  readonly topic: string;
}

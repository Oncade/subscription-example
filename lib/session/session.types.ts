import type { AccountLinkStatus } from '../accountLink/accountLink.types';
import type { SubscriptionStatus } from '../subscription/subscription.types';

export type DemoSessionId = string;

export interface DemoSessionRecord {
  readonly id: DemoSessionId;
  readonly createdAt: Date;
  email: string;
  accountLinkStatus: AccountLinkStatus;
  subscriptionStatus: SubscriptionStatus;
  linkedUserRef?: string;
  linkSessionKey?: string;
  linkIdempotencyKey?: string;
  subscriptionActivatedAt?: Date;
  lastWebhookAt?: Date;
}

export interface DemoSessionDto {
  readonly id: DemoSessionId;
  readonly createdAt: string;
  readonly email: string;
  readonly accountLinkStatus: AccountLinkStatus;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly linkedUserRef?: string;
  readonly linkSessionKey?: string;
  readonly linkIdempotencyKey?: string;
  readonly subscriptionActivatedAt?: string;
  readonly lastWebhookAt?: string;
}

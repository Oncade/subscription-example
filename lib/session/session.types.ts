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
  linkExpiresAt?: Date;
  subscriptionActivatedAt?: Date;
  lastWebhookAt?: Date;
}

export interface DemoSessionDto {
  readonly id: DemoSessionId;
  readonly email: string;
  readonly accountLinkStatus: AccountLinkStatus;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly linkedUserRef?: string;
  readonly linkSessionKey?: string;
  readonly linkExpiresAt?: string;
  readonly subscriptionActivatedAt?: string;
  readonly lastWebhookAt?: string;
}

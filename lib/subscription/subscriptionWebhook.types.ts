import { SUBSCRIPTION_STATUS } from './subscription.types';

export interface SubscriptionWebhookBody {
  readonly sessionId: string;
  readonly status: typeof SUBSCRIPTION_STATUS.Active | typeof SUBSCRIPTION_STATUS.Canceled;
}

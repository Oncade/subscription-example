export const ONCADE_ACCOUNT_LINK_WEBHOOK_EVENTS = {
  Started: 'User.Account.Link.Started',
  Completed: 'User.Account.Link.Succeeded',
  Canceled: 'User.Account.Link.Canceled',
  Removed: 'User.Account.Link.Removed',
  Failed: 'User.Account.Link.Failed',
} as const;

export type OncadeAccountLinkEvent =
  (typeof ONCADE_ACCOUNT_LINK_WEBHOOK_EVENTS)[keyof typeof ONCADE_ACCOUNT_LINK_WEBHOOK_EVENTS];

const ONCADE_ACCOUNT_LINK_EVENT_SET = new Set<OncadeAccountLinkEvent>(
  Object.values(ONCADE_ACCOUNT_LINK_WEBHOOK_EVENTS),
);

export function isOncadeAccountLinkEvent(event: string): event is OncadeAccountLinkEvent {
  return ONCADE_ACCOUNT_LINK_EVENT_SET.has(event as OncadeAccountLinkEvent);
}

export const ONCADE_SUBSCRIPTION_WEBHOOK_EVENTS = {
  SubscriptionStarted: 'Subscription.Started',
  SubscriptionCompleted: 'Subscription.Completed',
  SubscriptionCanceled: 'Subscriptions.Canceled',
  SubscriptionFailed: 'Subscriptions.Failed',
  PurchaseStarted: 'Purchases.Subscriptions.Started',
  PurchaseCompleted: 'Purchases.Subscriptions.Completed',
  PurchaseCanceled: 'Purchases.Subscriptions.Canceled',
  PurchaseFailed: 'Purchases.Subscriptions.Failed',
} as const;

export type OncadeSubscriptionEvent =
  (typeof ONCADE_SUBSCRIPTION_WEBHOOK_EVENTS)[keyof typeof ONCADE_SUBSCRIPTION_WEBHOOK_EVENTS];

export type OncadeSubscriptionTransition = 'pending' | 'active' | 'canceled';

const SUBSCRIPTION_EVENT_TO_TRANSITION = new Map<OncadeSubscriptionEvent, OncadeSubscriptionTransition>([
  [ONCADE_SUBSCRIPTION_WEBHOOK_EVENTS.SubscriptionStarted, 'pending'],
  [ONCADE_SUBSCRIPTION_WEBHOOK_EVENTS.PurchaseStarted, 'pending'],
  [ONCADE_SUBSCRIPTION_WEBHOOK_EVENTS.SubscriptionCompleted, 'active'],
  [ONCADE_SUBSCRIPTION_WEBHOOK_EVENTS.PurchaseCompleted, 'active'],
  [ONCADE_SUBSCRIPTION_WEBHOOK_EVENTS.SubscriptionCanceled, 'canceled'],
  [ONCADE_SUBSCRIPTION_WEBHOOK_EVENTS.SubscriptionFailed, 'canceled'],
  [ONCADE_SUBSCRIPTION_WEBHOOK_EVENTS.PurchaseCanceled, 'canceled'],
  [ONCADE_SUBSCRIPTION_WEBHOOK_EVENTS.PurchaseFailed, 'canceled'],
]);

export function mapOncadeSubscriptionEvent(event: string): OncadeSubscriptionTransition | undefined {
  return SUBSCRIPTION_EVENT_TO_TRANSITION.get(event as OncadeSubscriptionEvent);
}

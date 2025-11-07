export const DEMO_EVENT_TYPE = {
  SessionUpdated: 'session.updated',
  AccountLinkEvent: 'account-link.event',
  SubscriptionEvent: 'subscription.event',
  WebhookNotification: 'webhook.notification',
} as const;

export type DemoEventType = (typeof DEMO_EVENT_TYPE)[keyof typeof DEMO_EVENT_TYPE];

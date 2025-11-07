export const SUBSCRIPTION_ENVIRONMENTS = ['test', 'live'] as const;
export type SubscriptionEnvironment = (typeof SUBSCRIPTION_ENVIRONMENTS)[number];

export const COINFLOW_ACTIVE_STATUS = 'active' as const;

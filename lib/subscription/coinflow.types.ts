export interface CoinflowSubscriptionItemSummary {
  readonly id?: string | null;
  readonly itemId?: string | null;
}

export interface CoinflowSubscriptionPlanSummary {
  readonly code?: string | null;
  readonly planCode?: string | null;
  readonly itemId?: string | null;
  readonly item?: CoinflowSubscriptionItemSummary;
  readonly id?: string | null;
}

export interface CoinflowSubscriptionSummary {
  readonly id: string;
  readonly status?: string | null;
  readonly planCode?: string | null;
  readonly itemId?: string | null;
  readonly item?: CoinflowSubscriptionItemSummary;
  readonly plan?: CoinflowSubscriptionPlanSummary | string | null;
}

export interface DashboardSubscriptionsPayload {
  readonly subscriptions?: readonly CoinflowSubscriptionSummary[];
}

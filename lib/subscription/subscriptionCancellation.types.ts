export interface SubscriptionLookupResult {
  readonly success: boolean;
  readonly status?: number;
  readonly error?: string;
  readonly match?: {
    readonly userRef: string;
    readonly subscriptionId: string;
  };
}

export interface CancellationResult {
  readonly success: boolean;
  readonly status?: number;
  readonly error?: string;
}

export interface RemoteUserSubscriptionResponse {
  readonly subscriptionId?: string;
  readonly subscriptionItemId?: string | null;
  readonly subscriptionStatus?: string | null;
}

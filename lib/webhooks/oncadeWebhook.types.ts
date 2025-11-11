export interface OncadeWebhookEnvelope {
  readonly event: string;
  readonly timestamp?: string;
  readonly data?: Record<string, unknown>;
}

export interface AccountLinkWebhookData {
  readonly sessionKey?: unknown;
  readonly user_ref?: unknown;
  readonly userRef?: unknown;
}

export interface SubscriptionWebhookData {
  readonly sessionKey?: unknown;
  readonly userEmail?: unknown;
  readonly metadata?: Record<string, unknown> | null;
}

export interface AccountLinkWebhookEnvelope {
  readonly event: string;
  readonly timestamp?: string;
  readonly data?: {
    readonly sessionKey?: string;
    readonly user_ref?: string | null;
  };
}

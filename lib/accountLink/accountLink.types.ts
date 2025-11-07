export const ACCOUNT_LINK_STATUS = {
  Idle: 'idle',
  Started: 'started',
  Linked: 'linked',
  Canceled: 'canceled',
} as const;

export type AccountLinkStatus = typeof ACCOUNT_LINK_STATUS[keyof typeof ACCOUNT_LINK_STATUS];

export interface AccountLinkSessionDto {
  readonly sessionKey: string;
  readonly status: AccountLinkStatus;
  readonly expiresAt?: string;
  readonly redirectUrl: string;
}

export interface AccountLinkEventPayload {
  readonly sessionId: string;
  readonly sessionKey: string;
  readonly status: AccountLinkStatus;
  readonly triggeredAt: string;
  readonly provider: 'demo' | 'oncade';
  readonly topic: string;
  readonly userRef?: string;
}

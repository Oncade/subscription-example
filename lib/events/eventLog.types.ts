export const EVENT_LOG_TONE = {
  Info: 'info',
  Success: 'success',
  Warning: 'warning',
} as const;

export type EventLogTone = typeof EVENT_LOG_TONE[keyof typeof EVENT_LOG_TONE];

export interface WebhookLogEventPayload {
  readonly summary: string;
  readonly timestamp: string;
  readonly tone: EventLogTone;
}

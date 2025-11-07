import 'server-only';

import { emitDemoEvent } from '@/lib/events/eventBus.server';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
import { EVENT_LOG_TONE, type EventLogTone } from '@/lib/events/eventLog.types';

export function emitWebhookNotification(summary: string, tone: EventLogTone = EVENT_LOG_TONE.Info): void {
  emitDemoEvent({
    type: DEMO_EVENT_TYPE.WebhookNotification,
    payload: {
      summary,
      tone,
      timestamp: new Date().toISOString(),
    },
  });
}

export function emitWebhookSignatureFailure(headerName: string): void {
  const headerLabel = headerName && headerName.trim().length > 0 ? headerName : 'unknown header';
  emitWebhookNotification(
    `Oncade webhook rejected: invalid signature (${headerLabel}).`,
    EVENT_LOG_TONE.Warning,
  );
}

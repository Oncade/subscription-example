import type { AccountLinkEventPayload } from '../accountLink/accountLink.types';
import type { DemoSessionDto } from '../session/session.types';
import type { SubscriptionEventPayload } from '../subscription/subscription.types';
import type { WebhookLogEventPayload } from './eventLog.types';
import type { OncadeWebhookEnvelope } from '../webhooks/oncadeWebhook.types';
import { DEMO_EVENT_TYPE } from './eventBus.constants';

export type DemoEvent =
  | { readonly type: typeof DEMO_EVENT_TYPE.SessionUpdated; readonly payload: DemoSessionDto }
  | { readonly type: typeof DEMO_EVENT_TYPE.AccountLinkEvent; readonly payload: AccountLinkEventPayload }
  | { readonly type: typeof DEMO_EVENT_TYPE.SubscriptionEvent; readonly payload: SubscriptionEventPayload }
  | { readonly type: typeof DEMO_EVENT_TYPE.WebhookNotification; readonly payload: WebhookLogEventPayload }
  | { readonly type: typeof DEMO_EVENT_TYPE.RawWebhookEvent; readonly payload: OncadeWebhookEnvelope };

export type DemoEventListener = (event: DemoEvent) => void;

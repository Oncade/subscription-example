export const SESSION_HEADER = 'x-demo-session-id' as const;
export const LINK_SESSION_QUERY_KEY = 'sessionKey' as const;
export const MOCK_ACCOUNT_LINK_WINDOW_NAME = 'subscription-demo-account-link' as const;
export const DEMO_EVENT_STREAM_URL = '/api/events/stream' as const;
export const SESSION_STORAGE_KEY = 'subscription-demo-session-id' as const;

export const WEBHOOK_SIGNATURE_HEADER = 'x-demo-signature' as const;
export const ONCADE_WEBHOOK_SIGNATURE_HEADER = 'x-oncade-signature' as const;
export const WEBHOOK_SIGNATURE_HEADERS = [WEBHOOK_SIGNATURE_HEADER, ONCADE_WEBHOOK_SIGNATURE_HEADER] as const;
export const HEADER_AUTHORIZATION = 'authorization' as const;
export const HEADER_API_VERSION = 'x-oncade-api-version' as const;
export const HEADER_GAME_ID = 'x-game-id' as const;

export const DEMO_LINK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const DEMO_SUBSCRIPTION_REFRESH_INTERVAL_MS = 5_000;

export const REQUIRED_ENV_VARS = [
  'DEMO_PLAN_ITEM_ID',
  'DEMO_WEBHOOK_SECRET',
  'DEMO_SERVER_API_KEY',
  'DEMO_GAME_ID',
] as const;

export const OPTIONAL_ENV_VARS = ['DEMO_API_BASE_URL'] as const;

export const DEMO_PLAN_PRICE_FALLBACK = 4_99;
export const DEMO_PLAN_INTERVAL_FALLBACK = 'Monthly' as const;

export const DEFAULT_ONCADE_API_BASE_URL = 'https://oncade.gg' as const;
export const ONCADE_API_VERSION_HEADER_VALUE = 'v1' as const;
export const COINFLOW_REDIRECT_QUERY_GAME_ID = 'gameId' as const;
export const COINFLOW_REDIRECT_QUERY_ITEM_ID = 'itemId' as const;
export const COINFLOW_REDIRECT_QUERY_REDIRECT_URL = 'redirectUrl' as const;
export const COINFLOW_REDIRECT_QUERY_EXTERNAL_SESSION_ID = 'externalSessionId' as const;

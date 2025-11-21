export const MAX_EVENT_LOG_ENTRIES = 12;

export const HERO_TITLE = 'Subscription demo for partner account linking';
export const HERO_SUBTITLE =
  'Follow the same journey players will see: custom sign in, account linking, webhook-driven subscription activation.';
export const HERO_SUPPORT_TEXT = 'No real money involved, everything runs in the sandbox.';

export const PLAN_PREVIEW_TITLE = 'Plan preview';

export const LINK_ACCOUNT_TITLE = 'Link your game account';
export const LINK_ACCOUNT_DESCRIPTION =
  'We\'ll open the linking dialog in a new window. Approve the connection and the webhook will push an update back here.';
export const LINK_ACCOUNT_BUTTON_READY = 'Open linking dialog';
export const LINK_ACCOUNT_BUTTON_BUSY = 'Preparing...';

export const SUBSCRIPTION_CARD_TITLE = 'Subscribe to unlock partner rewards';
export const SUBSCRIPTION_CARD_DESCRIPTION =
  'The checkout uses the Oncade sandbox endpoints, and the webhook flow mirrors production.';
export const SUBSCRIPTION_PLAN_BADGE = 'Plan';
export const SUBSCRIPTION_BUTTON_READY = 'Subscribe';
export const SUBSCRIPTION_BUTTON_BUSY = 'Submitting...';

export const SUBSCRIPTION_BLOCKED_TITLE = 'Subscription setup incomplete';
export const SUBSCRIPTION_BLOCKED_DESCRIPTION =
  'Configure the required environment variables to load the subscription plan before attempting checkout';
export const SUBSCRIPTION_REQUIRED_ENV_VARS = ['DEMO_SERVER_API_KEY', 'DEMO_GAME_ID'] as const;

export const ACTIVE_SUBSCRIPTION_TITLE = 'You\'re subscribed!';
export const CANCEL_SUBSCRIPTION_BUTTON_READY = 'Cancel subscription';
export const CANCEL_SUBSCRIPTION_BUTTON_BUSY = 'Processing...';

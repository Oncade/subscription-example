import { beforeEach, beforeAll, afterEach, vi } from 'vitest';

const SESSION_STORE_KEY = Symbol.for('subscription.demo.sessionStore');
const EVENT_BUS_KEY = Symbol.for('subscription.demo.eventBus');

interface GlobalWithStores {
  [SESSION_STORE_KEY]?: unknown;
  [EVENT_BUS_KEY]?: unknown;
}

beforeAll(() => {
  process.env.DEMO_WEBHOOK_SECRET = process.env.DEMO_WEBHOOK_SECRET ?? 'test-secret';
  process.env.DEMO_SERVER_API_KEY = process.env.DEMO_SERVER_API_KEY ?? 'test-api-key';
  process.env.DEMO_GAME_ID = process.env.DEMO_GAME_ID ?? 'test-game-id';
  process.env.DEMO_API_BASE_URL = process.env.DEMO_API_BASE_URL ?? 'https://api.test.oncade.gg';
  process.env.DEMO_PLAN_ITEM_ID = process.env.DEMO_PLAN_ITEM_ID ?? 'demo-plan-item-id';
});

beforeEach(() => {
  const globalWithStores = globalThis as GlobalWithStores;
  delete globalWithStores[SESSION_STORE_KEY];
  delete globalWithStores[EVENT_BUS_KEY];
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

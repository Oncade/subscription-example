# Subscription Demo

This Next.js 16 application walks publishing partners through the end-to-end subscription journey:

- Lightweight email sign-in using the custom login modal pattern.
- Account linking flow with a dedicated popup, webhook validation, and live status updates.
- Subscription activation with mock Coinflow-style webhooks to prove reactivity.
- Environment checklist that highlights any missing configuration before showcasing the flow.

## Quick start

```bash
# from repository root
npm install
npm run dev
```

Visit `http://localhost:3000` to explore the dashboard.

## Environment configuration

Create `.env.local` with the following values:

```bash
DEMO_PLAN_ITEM_ID=your_store_item_id
DEMO_WEBHOOK_SECRET=replace-me-with-hmac-secret
DEMO_SERVER_API_KEY=your_oncade_server_api_key
DEMO_GAME_ID=your_game_id

# Optional override (defaults to https://oncade.gg)
# DEMO_API_BASE_URL=https://staging.oncade.gg
```

The plan code displayed in the UI is now fetched directly from the Oncade item metadata, so no additional env override is required.

The landing page surfaces missing values and explains how to configure each one. Webhook validation requires `DEMO_WEBHOOK_SECRET`, and real account linking calls will fail unless both the server API key and game ID are configured. Once the item ID, server API key, and game ID are present the demo fetches live plan details from Oncade, so display name, price, and interval no longer need to be set manually.

## Testing the flow

1. Sign in with any email address.
2. Click **Open linking dialog**. The demo now initiates a real `POST /api/v1/users/link/initiate` request against the Oncade API, opening the returned linking URL in the presale experience. Approving that flow will trigger a genuine webhook.
3. Subscribe to the plan and trigger the webhook success directly from the dashboard (the subscription step still uses the mock Coinflow endpoints).
4. Watch the webhook event log update in real time through the Server-Sent Events stream.

## Scripts

```bash
npm run dev   # start the Next.js dev server
npm run build # production build
npm run test  # Vitest unit suite (server logic + API routes)
```

## Project structure

- `app/api/**` – Demo API routes for sessions, account linking, subscriptions, events, and webhooks.
- `lib/**` – Server-only modules, DTOs, and configuration helpers.
- `components/**` – Client-side experience (auth provider, login modal, landing UI, subscription cards).
- `hooks/**` – `useApi` wrapper with session header injection and `useEventStream` SSE helper.
- `tests/**` – Vitest coverage for session management, subscription transitions, and webhook routes.

The code follows the shared DTO pattern (server logic in `*.server.ts`, client-safe types in `*.types.ts`) to keep boundaries clear.

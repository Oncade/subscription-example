import { NextRequest, NextResponse } from 'next/server';

import { handleSessionGet, handleSessionOptions, handleSessionPost } from '@/app/api/routes/session';
import { handleAccountLinkInitiatePost } from '@/app/api/routes/accountLinkInitiate';
import { handleAccountLinkStatusGet } from '@/app/api/routes/accountLinkStatus';
import { handleSubscriptionSubscribePost } from '@/app/api/routes/subscriptionSubscribe';
import { handleSubscriptionCancelPost } from '@/app/api/routes/subscriptionCancel';
import { handleSubscriptionStatusGet } from '@/app/api/routes/subscriptionStatus';
import { handleWebhookAccountLinkingPost } from '@/app/api/routes/webhookAccountLinking';
import { handleWebhookSubscriptionPost } from '@/app/api/routes/webhookSubscription';
import { handleOncadeWebhookPost } from '@/app/api/routes/webhookOncade';
import { handleEventsStreamGet } from '@/app/api/routes/eventsStream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type RouteHandler = (request: NextRequest) => Promise<Response> | Response;
type SimpleHandler = () => Promise<Response> | Response;

interface RouteConfig {
  readonly GET?: RouteHandler | SimpleHandler;
  readonly POST?: RouteHandler | SimpleHandler;
  readonly OPTIONS?: RouteHandler | SimpleHandler;
}

const ROUTES: Record<string, RouteConfig> = {
  session: {
    GET: handleSessionGet,
    POST: handleSessionPost,
    OPTIONS: handleSessionOptions,
  },
  'account/link/initiate': {
    POST: handleAccountLinkInitiatePost,
  },
  'account/link/status': {
    GET: handleAccountLinkStatusGet,
  },
  'subscription/subscribe': {
    POST: handleSubscriptionSubscribePost,
  },
  'subscription/cancel': {
    POST: handleSubscriptionCancelPost,
  },
  'subscription/status': {
    GET: handleSubscriptionStatusGet,
  },
  'webhooks/account-linking': {
    POST: handleWebhookAccountLinkingPost,
  },
  'webhooks/subscription': {
    POST: handleWebhookSubscriptionPost,
  },
  webhook: {
    POST: handleOncadeWebhookPost,
  },
  'events/stream': {
    GET: handleEventsStreamGet,
  },
};

function buildRouteKey(segments: string[] | undefined): string {
  if (!segments || segments.length === 0) {
    return '';
  }
  return segments.join('/').toLowerCase();
}

function resolveHandler(method: keyof RouteConfig, segments: string[] | undefined) {
  const key = buildRouteKey(segments);
  const config = ROUTES[key];
  if (!config) {
    return undefined;
  }
  return config[method];
}

async function routeRequest(
  method: keyof RouteConfig,
  request: NextRequest,
  segments: string[] | undefined,
): Promise<Response> {
  const handler = resolveHandler(method, segments);
  if (!handler) {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }
  const result = handler.length === 0 ? (handler as SimpleHandler)() : (handler as RouteHandler)(request);
  return result instanceof Promise ? result : result;
}

interface RouteContext {
  params: Promise<{
    segments?: string[];
  }>;
}

async function readSegments(context: RouteContext): Promise<string[] | undefined> {
  const resolved = await context.params;
  return resolved.segments;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<Response> {
  const segments = await readSegments(context);
  return routeRequest('GET', request, segments);
}

export async function POST(request: NextRequest, context: RouteContext): Promise<Response> {
  const segments = await readSegments(context);
  return routeRequest('POST', request, segments);
}

export async function OPTIONS(request: NextRequest, context: RouteContext): Promise<Response> {
  const segments = await readSegments(context);
  return routeRequest('OPTIONS', request, segments);
}

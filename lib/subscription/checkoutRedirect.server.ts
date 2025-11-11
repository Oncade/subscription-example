import 'server-only';

import { CheckoutRedirectError } from '@/lib/errors/checkoutRedirectError';
import {
  COINFLOW_REDIRECT_QUERY_GAME_ID,
  COINFLOW_REDIRECT_QUERY_ITEM_ID,
  COINFLOW_REDIRECT_QUERY_REDIRECT_URL,
} from '@/lib/constants';

const CHECKOUT_REDIRECT_PATH = '/api/v1/checkout/redirect' as const;
const HTTP_STATUS_FOUND = 302;
const HTTP_STATUS_BAD_GATEWAY = 502;
const HTTP_PROTOCOL_HTTP = 'http:' as const;
const HTTP_PROTOCOL_HTTPS = 'https:' as const;
const LOCATION_HEADER = 'location' as const;

export function sanitizeRedirectUrl(candidate?: string): string | undefined {
  if (!candidate) {
    return undefined;
  }
  const trimmed = candidate.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== HTTP_PROTOCOL_HTTP && url.protocol !== HTTP_PROTOCOL_HTTPS) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function buildCheckoutUrl(
  baseUrl: string,
  gameId: string,
  itemId: string,
  redirectUrl: string | undefined,
): string {
  const resolvedBase = baseUrl.trim();
  const target = new URL(CHECKOUT_REDIRECT_PATH, resolvedBase);
  target.searchParams.set(COINFLOW_REDIRECT_QUERY_GAME_ID, gameId);
  target.searchParams.set(COINFLOW_REDIRECT_QUERY_ITEM_ID, itemId);
  if (redirectUrl) {
    target.searchParams.set(COINFLOW_REDIRECT_QUERY_REDIRECT_URL, redirectUrl);
  }
  return target.toString();
}

async function resolveCheckoutErrorMessage(response: Response): Promise<string> {
  const fallback = `Checkout redirect failed with status ${response.status}`;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const payload = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    if (payload?.error?.trim()) {
      return payload.error;
    }
  }
  return fallback;
}

export async function requestCheckoutRedirect(
  baseUrl: string,
  headers: Record<string, string>,
  gameId: string,
  itemId: string,
  redirectUrl?: string,
): Promise<string> {
  const requestUrl = buildCheckoutUrl(baseUrl, gameId, itemId, redirectUrl);

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: 'GET',
      headers,
      redirect: 'manual',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error';
    throw new CheckoutRedirectError(`Checkout redirect request failed: ${message}`, HTTP_STATUS_BAD_GATEWAY);
  }

  if (response.status === HTTP_STATUS_FOUND) {
    const location = response.headers.get(LOCATION_HEADER);
    if (!location) {
      throw new CheckoutRedirectError('Checkout redirect missing Location header', HTTP_STATUS_BAD_GATEWAY);
    }
    return location;
  }

  const message = await resolveCheckoutErrorMessage(response);
  const status = response.status >= 400 && response.status < 600 ? response.status : HTTP_STATUS_BAD_GATEWAY;
  throw new CheckoutRedirectError(message, status);
}

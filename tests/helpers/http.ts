import { NextRequest } from 'next/server';

export interface JsonRequestOptions {
  readonly method?: string;
  readonly headers?: HeadersInit;
  readonly body?: unknown;
}

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

export const DEMO_APP_ORIGIN = 'https://demo.local' as const;

export function buildAppUrl(path = '/'): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${DEMO_APP_ORIGIN}${normalized}`;
}

export function buildJsonRequest(url: string, options: JsonRequestOptions = {}): NextRequest {
  const { method = 'GET', headers, body } = options;
  const requestHeaders = new Headers(headers);

  if (body !== undefined && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const init: NextRequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  return new NextRequest(url, init);
}

export function jsonResponse(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers({ 'content-type': 'application/json' });
  if (headers) {
    const extraHeaders = new Headers(headers);
    extraHeaders.forEach((value, key) => responseHeaders.set(key, value));
  }

  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders,
  });
}

'use client';

import { useCallback, useMemo } from 'react';

import { SESSION_HEADER, SESSION_STATE_HEADER } from '@/lib/constants';
import { useAuth } from '@/components/AuthProvider';

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly status?: number;
  readonly headers?: Headers;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function parseJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Error('Failed to parse server response.');
  }
}

export function useApi() {
  const { session } = useAuth();

  const fetchWithAuth = useCallback(
    async <T>(url: string, method: HttpMethod, body?: unknown): Promise<ApiResponse<T>> => {
      try {
        const requestHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (session) {
          requestHeaders[SESSION_HEADER] = session.id;
          requestHeaders[SESSION_STATE_HEADER] = encodeURIComponent(JSON.stringify(session));
        }

        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });

        const status = response.status;
        const responseHeaders = response.headers;
        if (!response.ok) {
          const payload = await parseJson<{ error?: string }>(response).catch(() => undefined);
          return {
            success: false,
            status,
            error: payload?.error || `Request failed with status ${status}`,
            headers: responseHeaders,
          };
        }

        const payload = await parseJson<{ success?: boolean; data?: T } | T>(response);
        if (typeof payload === 'object' && payload !== null && 'success' in payload) {
          const structured = payload as { success: boolean; data?: T; error?: string };
          return {
            success: structured.success,
            data: structured.data,
            status,
            error: structured.error,
            headers: responseHeaders,
          };
        }

        return { success: true, data: payload as T, status, headers: responseHeaders };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unexpected error during request.',
        };
      }
    },
    [session],
  );

  const api = useMemo(
    () => ({
      get: <T>(url: string) => fetchWithAuth<T>(url, 'GET'),
      post: <T>(url: string, body?: unknown) => fetchWithAuth<T>(url, 'POST', body),
      put: <T>(url: string, body?: unknown) => fetchWithAuth<T>(url, 'PUT', body),
      delete: <T>(url: string) => fetchWithAuth<T>(url, 'DELETE'),
      fetchWithAuth,
    }),
    [fetchWithAuth],
  );

  return api;
}

import 'server-only';

import { DEFAULT_ONCADE_API_BASE_URL } from '@/lib/constants';

const TRAILING_SLASHES = /\/+$/;

export function resolveOncadeApiBaseUrl(): string {
  const fromEnv = process.env.DEMO_API_BASE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(TRAILING_SLASHES, '');
  }
  return DEFAULT_ONCADE_API_BASE_URL;
}

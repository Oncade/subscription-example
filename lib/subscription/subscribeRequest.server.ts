import 'server-only';

import { NextRequest } from 'next/server';

import type { SubscribeRequestBody } from './subscribe.types';

export async function parseSubscribeRequestBody(request: NextRequest): Promise<SubscribeRequestBody> {
  try {
    const raw = await request.json();
    if (raw && typeof raw === 'object') {
      const { redirectUrl } = raw as SubscribeRequestBody;
      return {
        redirectUrl,
      };
    }
    return {};
  } catch {
    return {};
  }
}

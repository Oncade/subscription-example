import 'server-only';

import crypto from 'crypto';
import type { NextRequest } from 'next/server';

const HEX_ENCODING = 'hex';

export type WebhookSecretEnvKey = string;

export function resolveWebhookSecret(envKey: WebhookSecretEnvKey = 'DEMO_WEBHOOK_SECRET'): string | undefined {
  const raw = process.env[envKey];
  if (!raw) {
    return undefined;
  }
  const trimmed = raw.trim();
  return trimmed ? trimmed : undefined;
}

export function findWebhookSignature(
  request: NextRequest,
  candidateHeaders: readonly string[],
): string | undefined {
  for (const header of candidateHeaders) {
    const signature = request.headers.get(header);
    if (signature) {
      return signature;
    }
  }
  return undefined;
}

export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature || !secret) {
    return false;
  }

  try {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest(HEX_ENCODING);
    const expectedBuffer = Buffer.from(expected, HEX_ENCODING);
    const actualBuffer = Buffer.from(signature, HEX_ENCODING);
    return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

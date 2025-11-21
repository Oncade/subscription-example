import crypto from 'crypto';

import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { handleWebhookAccountLinkingPost } from '@/app/api/routes/webhookAccountLinking';
import { initiateAccountLinkSession } from '@/lib/accountLink/accountLink.server';
import { WEBHOOK_SIGNATURE_HEADER } from '@/lib/constants';
import { createDemoSession } from '@/lib/session/session.server';
import { DEMO_APP_ORIGIN, buildAppUrl } from './helpers/http';

function makeSignedRequest(path: string, body: unknown, secret: string): NextRequest {
  const rawBody = JSON.stringify(body);
  const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return new NextRequest(buildAppUrl(path), {
    method: 'POST',
    body: rawBody,
    headers: {
      'Content-Type': 'application/json',
      [WEBHOOK_SIGNATURE_HEADER]: signature,
    },
  });
}

describe('account-linking webhook route', () => {
  it('validates signature and pushes events to clients', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          url: 'https://oncade.gg/link?session=session_remote',
          sessionKey: 'session_remote',
        }),
      }),
    );

    const secret = process.env.DEMO_WEBHOOK_SECRET ?? 'test-secret';
    const session = createDemoSession('webhook@test.com');
    const linkSession = await initiateAccountLinkSession(session.email, DEMO_APP_ORIGIN);

    const request = makeSignedRequest(
      '/api/webhooks/account-linking',
      {
        event: 'User.Account.Link.Succeeded',
        timestamp: new Date().toISOString(),
        data: { sessionKey: linkSession.sessionKey, user_ref: 'ref_123' },
      },
      secret,
    );

    const response = await handleWebhookAccountLinkingPost(request);
    expect(response.status).toBe(200);
  });

  it('rejects invalid signature', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        json: async () => ({
          url: 'https://oncade.gg/link?session=session_remote',
          sessionKey: 'session_remote',
        }),
      }),
    );

    const session = createDemoSession('bad-signature@test.com');
    const linkSession = await initiateAccountLinkSession(session.email, DEMO_APP_ORIGIN);

    const request = new NextRequest(buildAppUrl('/api/webhooks/account-linking'), {
      method: 'POST',
      body: JSON.stringify({
        event: 'User.Account.Link.Succeeded',
        timestamp: new Date().toISOString(),
        data: { sessionKey: linkSession.sessionKey, user_ref: 'ref_123' },
      }),
      headers: {
        'Content-Type': 'application/json',
        [WEBHOOK_SIGNATURE_HEADER]: 'invalid-signature',
      },
    });

    const response = await handleWebhookAccountLinkingPost(request);
    expect(response.status).toBe(401);
  });
});

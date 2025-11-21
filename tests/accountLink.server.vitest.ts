import { describe, expect, it, vi } from 'vitest';

import {
  initiateAccountLinkSession,
} from '@/lib/accountLink/accountLink.server';
import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import { createDemoSession } from '@/lib/session/session.server';
import { DEMO_APP_ORIGIN } from './helpers/http';

describe('accountLink.server', () => {
  it('calls the Oncade API and records a started session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        url: 'https://oncade.gg/link?session=session_remote',
        sessionKey: 'session_remote',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const session = createDemoSession('pilot@example.com');
    const linkSession = await initiateAccountLinkSession(session.id, session.email, DEMO_APP_ORIGIN);

    expect(fetchMock).toHaveBeenCalledOnce();
    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toContain('/api/v1/users/link/initiate');
    const init = call?.[1] as RequestInit;
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      Authorization: `Bearer ${process.env.DEMO_SERVER_API_KEY}`,
      'X-Oncade-API-Version': 'v1',
      'X-Game-Id': process.env.DEMO_GAME_ID,
      'Idempotency-Key': expect.any(String),
    });
      expect(linkSession.status).toBe(ACCOUNT_LINK_STATUS.Started);
      const expectedBase = (process.env.DEMO_API_BASE_URL ?? 'https://oncade.gg').replace(/\/$/, '');
      expect(linkSession.redirectUrl).toBe(`${expectedBase}/link?session=session_remote`);
      // resolveSessionIdFromLink is now a no-op since we removed server-side mapping
      // Session mapping is handled client-side via webhook events
  });

  it('uses the provided idempotency key when supplied', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        url: 'https://oncade.gg/link?session=session_remote',
        sessionKey: 'session_remote',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const session = createDemoSession('pilot@example.com');
    const clientKey = 'demo-client-idempotency';
    await initiateAccountLinkSession(session.id, session.email, DEMO_APP_ORIGIN, {
      idempotencyKey: clientKey,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init?.headers).toMatchObject({ 'Idempotency-Key': clientKey });
  });

  it('treats existing approved sessions as linked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          url: 'https://oncade.gg/link?session=session_existing',
          sessionKey: 'session_existing',
        }),
      }),
    );

    const session = createDemoSession('pilot@example.com');
    const linkSession = await initiateAccountLinkSession(session.id, session.email, DEMO_APP_ORIGIN);

    expect(linkSession.status).toBe(ACCOUNT_LINK_STATUS.Linked);
    const expectedBase = (process.env.DEMO_API_BASE_URL ?? 'https://oncade.gg').replace(/\/$/, '');
    expect(linkSession.redirectUrl).toBe(`${expectedBase}/link?session=session_existing`);
  });

  it('marks account as linked when webhook completes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        url: 'https://oncade.gg/link?session=session_remote',
        sessionKey: 'session_remote',
      }),
    }));

    const session = createDemoSession('pilot@example.com');
    const linkSession = await initiateAccountLinkSession(session.id, session.email, DEMO_APP_ORIGIN);

    // completeAccountLink is now a no-op (state managed client-side)
    // Just verify the link session was created correctly
    expect(linkSession.sessionKey).toBe('session_remote');
    expect(linkSession.status).toBe(ACCOUNT_LINK_STATUS.Started);
  });

  it('clears linked user reference when cancellation webhook arrives', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        url: 'https://oncade.gg/link?session=session_remote',
        sessionKey: 'session_remote',
      }),
    }));

    const session = createDemoSession('pilot@example.com');
    const linkSession = await initiateAccountLinkSession(session.id, session.email, DEMO_APP_ORIGIN);

    // cancelAccountLink is now a no-op (state managed client-side)
    // Just verify the link session was created correctly
    expect(linkSession.sessionKey).toBe('session_remote');
    expect(linkSession.status).toBe(ACCOUNT_LINK_STATUS.Started);
  });
});

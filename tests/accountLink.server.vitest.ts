import { describe, expect, it, vi } from 'vitest';

import {
  initiateAccountLinkSession,
  completeAccountLink,
  resolveSessionIdFromLink,
  cancelAccountLink,
} from '@/lib/accountLink/accountLink.server';
import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import { createDemoSession, getSessionDto } from '@/lib/session/session.server';
import * as eventBus from '@/lib/events/eventBus.server';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
import type { DemoEvent } from '@/lib/events/eventBus.types';
import { DEMO_APP_ORIGIN } from './helpers/http';

type AccountLinkEvent = Extract<DemoEvent, { readonly type: typeof DEMO_EVENT_TYPE.AccountLinkEvent }>;

describe('accountLink.server', () => {
  it('calls the Oncade API and records a started session', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emitDemoEvent');
    try {
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
      const linkSession = await initiateAccountLinkSession(session.id, DEMO_APP_ORIGIN);

      expect(fetchMock).toHaveBeenCalledOnce();
      const call = fetchMock.mock.calls[0];
      expect(call?.[0]).toContain('/api/v1/users/link/initiate');
      const init = call?.[1] as RequestInit;
      expect(init?.method).toBe('POST');
      expect(init?.headers).toMatchObject({
        Authorization: `Bearer ${process.env.DEMO_SERVER_API_KEY}`,
        'X-Oncade-API-Version': 'v1',
        'X-Game-Id': process.env.DEMO_GAME_ID,
      });
      expect(linkSession.status).toBe(ACCOUNT_LINK_STATUS.Started);
      const expectedBase = (process.env.DEMO_API_BASE_URL ?? 'https://oncade.gg').replace(/\/$/, '');
      expect(linkSession.redirectUrl).toBe(`${expectedBase}/link?session=session_remote`);
      expect(resolveSessionIdFromLink(linkSession.sessionKey)).toBe(session.id);

      const updated = getSessionDto(session.id);
      expect(updated?.accountLinkStatus).toBe(ACCOUNT_LINK_STATUS.Started);
      expect(updated?.linkSessionKey).toBe(linkSession.sessionKey);

      const accountLinkEvents = emitSpy.mock.calls
        .map(([event]) => event)
        .filter((event): event is AccountLinkEvent => event.type === DEMO_EVENT_TYPE.AccountLinkEvent);
      expect(accountLinkEvents).toHaveLength(0);
    } finally {
      emitSpy.mockRestore();
    }
  });

  it('treats existing approved sessions as linked', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emitDemoEvent');
    try {
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
      const linkSession = await initiateAccountLinkSession(session.id, DEMO_APP_ORIGIN);

      expect(linkSession.status).toBe(ACCOUNT_LINK_STATUS.Linked);
      const expectedBase = (process.env.DEMO_API_BASE_URL ?? 'https://oncade.gg').replace(/\/$/, '');
      expect(linkSession.redirectUrl).toBe(`${expectedBase}/link?session=session_existing`);

      const accountLinkEvents = emitSpy.mock.calls
        .map(([event]) => event)
        .filter((event): event is AccountLinkEvent => event.type === DEMO_EVENT_TYPE.AccountLinkEvent);
      expect(accountLinkEvents).toHaveLength(1);
      expect(accountLinkEvents[0]?.payload.status).toBe(ACCOUNT_LINK_STATUS.Linked);
      expect(accountLinkEvents[0]?.payload.topic).toBe('oncade.account-link.linked');
    } finally {
      emitSpy.mockRestore();
    }
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
    const linkSession = await initiateAccountLinkSession(session.id, DEMO_APP_ORIGIN);

    completeAccountLink(session.id, linkSession.sessionKey, 'demo', 'user_ref_123');

    const updated = getSessionDto(session.id);
    expect(updated?.accountLinkStatus).toBe(ACCOUNT_LINK_STATUS.Linked);
    expect(updated?.linkSessionKey).toBe(linkSession.sessionKey);
    expect(updated?.linkedUserRef).toBe('user_ref_123');
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
    const linkSession = await initiateAccountLinkSession(session.id, DEMO_APP_ORIGIN);

    completeAccountLink(session.id, linkSession.sessionKey, 'demo', 'user_ref_456');
    cancelAccountLink(session.id, linkSession.sessionKey, 'demo');

    const updated = getSessionDto(session.id);
    expect(updated?.accountLinkStatus).toBe(ACCOUNT_LINK_STATUS.Canceled);
    expect(updated?.linkedUserRef).toBeUndefined();
    expect(updated?.linkSessionKey).toBe(linkSession.sessionKey);
  });
});

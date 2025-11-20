import { describe, expect, it, vi } from 'vitest';

import { handleAccountLinkStatusGet } from '@/app/api/routes/accountLinkStatus';
import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import { SESSION_HEADER, SESSION_STATE_HEADER } from '@/lib/constants';
import * as sessionStore from '@/lib/session/session.server';
import { SUBSCRIPTION_STATUS } from '@/lib/subscription/subscription.types';
import { buildAppUrl, buildJsonRequest } from './helpers/http';

const ACCOUNT_LINK_STATUS_URL = buildAppUrl('/api/account/link/status');

function buildRequest(sessionId: string) {
  return buildJsonRequest(ACCOUNT_LINK_STATUS_URL, {
    headers: {
      [SESSION_HEADER]: sessionId,
    },
  });
}

describe('GET /api/account/link/status', () => {
  it('returns started when details endpoint reports no user_ref', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          namespaceType: 'game',
          gameId: 'demo',
          prefilledEmail: 'pending@example.com',
        }),
      }),
    );

    const session = sessionStore.createDemoSession('pending@example.com');
    sessionStore.setAccountLinkStatus(session.id, ACCOUNT_LINK_STATUS.Started, {
      sessionKey: 'session_pending',
      preserveMapping: true,
    });

    const response = await handleAccountLinkStatusGet(buildRequest(session.id));
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.accountLinkStatus).toBe(ACCOUNT_LINK_STATUS.Started);
    expect(payload.data.linkedUserRef).toBeUndefined();
  });

  it('rehydrates session state from request headers when store is empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      }),
    );

    const session = {
      id: 'rehydrate-session',
      createdAt: new Date().toISOString(),
      email: 'rehydrate@example.com',
      accountLinkStatus: ACCOUNT_LINK_STATUS.Started,
      subscriptionStatus: SUBSCRIPTION_STATUS.Inactive,
      linkSessionKey: 'rehydrate-key',
    };
    const encodedState = encodeURIComponent(JSON.stringify(session));

    const response = await handleAccountLinkStatusGet(
      buildJsonRequest(ACCOUNT_LINK_STATUS_URL, {
        headers: {
          [SESSION_HEADER]: session.id,
          [SESSION_STATE_HEADER]: encodedState,
        },
      }),
    );
    const payload = await response.json();
    expect(payload.success).toBe(true);
  });

  it('returns linked when details endpoint includes user_ref', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          namespaceType: 'game',
          gameId: 'demo',
          prefilledEmail: 'linked@example.com',
          userRef: 'user_ref_123',
        }),
      }),
    );

    const session = sessionStore.createDemoSession('linked@example.com');
    sessionStore.setAccountLinkStatus(session.id, ACCOUNT_LINK_STATUS.Started, {
      sessionKey: 'session_linked',
      preserveMapping: true,
    });

    const response = await handleAccountLinkStatusGet(buildRequest(session.id));
    const payload = await response.json();
    expect(payload.success).toBe(true);
    expect(payload.data.accountLinkStatus).toBe(ACCOUNT_LINK_STATUS.Linked);
    expect(payload.data.linkedUserRef).toBe('user_ref_123');

    const updated = sessionStore.getSessionDto(session.id);
    expect(updated?.linkedUserRef).toBe('user_ref_123');
  });

  it('updates linked user reference even when status is unchanged', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          namespaceType: 'game',
          gameId: 'demo',
          prefilledEmail: 'linked@example.com',
          userRef: 'user_ref_123',
        }),
      }),
    );

    const session = sessionStore.createDemoSession('linked@example.com');
    sessionStore.setAccountLinkStatus(session.id, ACCOUNT_LINK_STATUS.Linked, {
      sessionKey: 'session_linked',
      preserveMapping: true,
    });

    const setStatusSpy = vi.spyOn(sessionStore, 'setAccountLinkStatus');

    const response = await handleAccountLinkStatusGet(buildRequest(session.id));
    const payload = await response.json();

    expect(payload.success).toBe(true);
    expect(payload.data.accountLinkStatus).toBe(ACCOUNT_LINK_STATUS.Linked);
    expect(payload.data.accountLinkStatus).toBe(ACCOUNT_LINK_STATUS.Linked);
    expect(payload.data.linkedUserRef).toBe('user_ref_123');
    expect(setStatusSpy).toHaveBeenCalled();
  });
});

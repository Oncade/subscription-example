'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { SESSION_HEADER, SESSION_STATE_HEADER, SESSION_STORAGE_KEY } from '@/lib/constants';
import type { DemoSessionDto } from '@/lib/session/session.types';

interface AuthContextValue {
  readonly session: DemoSessionDto | null;
  readonly loading: boolean;
  readonly loginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  setSession: (session: DemoSessionDto | null, persist?: boolean) => void;
  refreshSession: () => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchSession(sessionId: string, sessionState?: DemoSessionDto): Promise<DemoSessionDto | null> {
  const headers: Record<string, string> = {
    [SESSION_HEADER]: sessionId,
  };
  if (sessionState) {
    headers[SESSION_STATE_HEADER] = encodeURIComponent(JSON.stringify(sessionState));
  }
  const response = await fetch('/api/session', {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    return null;
  }

  const json = (await response.json()) as { success: boolean; data?: DemoSessionDto };
  if (!json.success || !json.data) {
    return null;
  }

  return json.data;
}

interface AuthProviderProps {
  readonly children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSessionState] = useState<DemoSessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const persistSessionValue = useCallback((value: DemoSessionDto | null) => {
    if (value) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(value));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  const readPersistedSession = useCallback((): { id: string; dto?: DemoSessionDto } | null => {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      return null;
    }
    try {
      const parsed = JSON.parse(stored) as DemoSessionDto;
      if (parsed && typeof parsed === 'object' && typeof parsed.id === 'string') {
        return { id: parsed.id, dto: parsed };
      }
      return null;
    } catch {
      return { id: stored };
    }
  }, []);

  const setSession = useCallback(
    (next: DemoSessionDto | null, persist = true) => {
      setSessionState(next);
      if (persist) {
        persistSessionValue(next);
      } else if (!next) {
        persistSessionValue(null);
      }
    },
    [persistSessionValue],
  );

  const refreshSession = useCallback(async () => {
    const stored = readPersistedSession();
    if (!stored) {
      setSessionState(null);
      return;
    }

    // Use localStorage as source of truth - only use server to create new sessions
    // Don't fetch from server as it has in-memory state we don't want
    if (stored.dto) {
      setSessionState(stored.dto);
      return;
    }

    // If we only have an ID but no DTO, try to fetch (for backwards compatibility)
    const next = await fetchSession(stored.id, stored.dto);
    setSessionState(next);
    if (next) {
      persistSessionValue(next);
    } else {
      persistSessionValue(null);
    }
  }, [persistSessionValue, readPersistedSession]);

  const signOut = useCallback(() => {
    setSessionState(null);
    persistSessionValue(null);
  }, [persistSessionValue]);

  const openLoginModal = useCallback(() => setLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setLoginModalOpen(false), []);

  useEffect(() => {
    void (async () => {
      await refreshSession();
      setLoading(false);
    })();
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      loginModalOpen,
      openLoginModal,
      closeLoginModal,
      setSession,
      refreshSession,
      signOut,
    }),
    [session, loading, loginModalOpen, openLoginModal, closeLoginModal, setSession, refreshSession, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

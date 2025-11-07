'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { SESSION_HEADER, SESSION_STORAGE_KEY } from '@/lib/constants';
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

async function fetchSession(sessionId: string): Promise<DemoSessionDto | null> {
  const response = await fetch('/api/session', {
    method: 'GET',
    headers: {
      [SESSION_HEADER]: sessionId,
    },
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

  const setSession = useCallback((next: DemoSessionDto | null, persist = true) => {
    setSessionState(next);
    if (persist && next) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, next.id);
    } else if (!next) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  const refreshSession = useCallback(async () => {
    const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!stored) {
      setSessionState(null);
      return;
    }

    const next = await fetchSession(stored);
    setSessionState(next);
    if (!next) {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  const signOut = useCallback(() => {
    setSessionState(null);
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const openLoginModal = useCallback(() => setLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setLoginModalOpen(false), []);

  useEffect(() => {
    void (async () => {
      const stored = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (stored) {
        const next = await fetchSession(stored);
        if (next) {
          setSessionState(next);
        } else {
          window.localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      }
      setLoading(false);
    })();
  }, []);

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

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DemoButton } from '@/components/DemoButton';
import { SESSION_HEADER } from '@/lib/constants';
import type { DemoSessionDto } from '@/lib/session/session.types';
import { useAuth } from '@/components/AuthProvider';
import { useApi } from '@/hooks/useApi';

export function CustomLoginModal() {
  const { loginModalOpen, closeLoginModal } = useAuth();

  useEffect(() => {
    if (!loginModalOpen) {
      return;
    }
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeLoginModal();
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [loginModalOpen, closeLoginModal]);

  if (!loginModalOpen) {
    return null;
  }

  return <LoginModalContent />;
}

function LoginModalContent() {
  const { closeLoginModal, setSession } = useAuth();
  const api = useApi();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const dialogRef = useRef<HTMLDivElement>(null);

  const canSubmit = useMemo(() => email.trim().length > 3 && email.includes('@'), [email]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  const handleOverlayClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) {
        closeLoginModal();
      }
    },
    [closeLoginModal],
  );

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit) {
        return;
      }

      setLoading(true);
      setError(undefined);

      try {
        const response = await api.post<DemoSessionDto>('/api/session', { email });

        if (!response.success || !response.data) {
          setError(response.error || 'Unable to sign in.');
          return;
        }

        const sessionHeader = response.headers?.get(SESSION_HEADER);
        // Create a fresh session object, ignoring any server state
        // This ensures we start with a clean session in localStorage
        // The server might return old state from in-memory storage, but we ignore it
        const sessionData: DemoSessionDto = {
          id: sessionHeader ?? response.data.id,
          createdAt: new Date().toISOString(),
          email: email.trim().toLowerCase(),
          accountLinkStatus: 'idle',
          subscriptionStatus: 'inactive',
        };

        setSession(sessionData, true);
        closeLoginModal();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unexpected sign-in error.');
      } finally {
        setLoading(false);
      }
    },
    [api, canSubmit, email, setSession, closeLoginModal],
  );

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur"
      onClick={handleOverlayClick}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-emerald-500/40 bg-zinc-950/95 p-8 shadow-2xl shadow-emerald-500/20">
        <h2 className="text-2xl font-semibold tracking-tight text-emerald-300">Demo sign in</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Use any email address. We will create a temporary session to walk through the subscription journey.
        </p>

        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-2 text-sm font-medium text-zinc-200">
            Email
            <input
              type="email"
              value={email}
              placeholder="player@example.com"
              onChange={(event) => setEmail(event.target.value)}
              className="rounded-lg border border-emerald-500/40 bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
            />
          </label>

          {error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p>}

          <DemoButton
            tone="emerald"
            strength="strong"
            type="submit"
            disabled={!canSubmit || loading}
            className="gap-2"
          >
            {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-900 border-t-transparent" />}
            <span>Start demo session</span>
          </DemoButton>
        </form>

        <DemoButton
          tone="zinc"
          variant="link"
          size="small"
          onClick={closeLoginModal}
          fullWidth
          className="mt-3"
        >
          Cancel
        </DemoButton>
      </div>
    </div>
  );
}

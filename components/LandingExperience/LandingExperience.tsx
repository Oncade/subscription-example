'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/AuthProvider';
import { Card } from '@/components/Card';
import { CustomLoginModal } from '@/components/CustomLoginModal';
import { DemoStatusCard } from '@/components/DemoStatusCard';
import { HowTheDemoWorksCard } from '@/components/HowTheDemoWorksCard';
import { ACCOUNT_LINK_STATUS, type AccountLinkStatus } from '@/lib/accountLink/accountLink.types';
import { MOCK_ACCOUNT_LINK_WINDOW_NAME } from '@/lib/constants';
import { formatTimestamp } from '@/lib/format/formatTimestamp';
import { useApi } from '@/hooks/useApi';
import { usePopup } from '@/hooks/usePopup';
import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from '@/lib/subscription/subscription.types';
import { POPUP_BLOCKED_MESSAGE, SUBSCRIPTION_CHECKOUT_WINDOW_NAME } from '@/lib/popup/popup.constants';

import { HeroSection } from './HeroSection';
import { EnvironmentChecklist } from './EnvironmentChecklist';
import { EventLog } from './EventLog';
import { computeEnvStatus } from './landingExperience.utils';
import { ActiveSubscriptionCard } from './cards/ActiveSubscriptionCard';
import { ErrorBanner } from './cards/ErrorBanner';
import { LinkAccountCard } from './cards/LinkAccountCard';
import { PlanPreviewCard } from './cards/PlanPreviewCard';
import { SubscriptionActionCard } from './cards/SubscriptionActionCard';
import { SubscriptionBlockedCard } from './cards/SubscriptionBlockedCard';
import type { LandingExperienceInnerProps, LandingExperienceProps } from './landingExperience.types';
import {
  LandingExperienceEventsProvider,
  useLandingExperienceEvents,
} from './LandingExperienceEventsProvider';

function createClientIdempotencyKey(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function LandingExperience({ environment }: LandingExperienceProps) {
  const auth = useAuth();
  const sessionKey = auth.session?.id ?? 'anonymous-session';

  return (
    <LandingExperienceEventsProvider key={sessionKey} session={auth.session} setSession={auth.setSession}>
      <LandingExperienceInner
        environment={environment}
        session={auth.session}
        setSession={auth.setSession}
        openLoginModal={auth.openLoginModal}
        loading={auth.loading}
        signOut={auth.signOut}
      />
    </LandingExperienceEventsProvider>
  );
}

function LandingExperienceInner({
  environment,
  session,
  setSession,
  openLoginModal,
  loading,
  signOut,
}: LandingExperienceInnerProps) {
  const api = useApi();
  const { openPopup } = usePopup();
  const sessionId = session?.id ?? null;
  const {
    accountLinkStatus,
    subscriptionStatus,
    activatedAt,
    eventLog,
    setAccountLinkStatus,
    setSubscriptionStatus,
    setActivatedAt,
  } = useLandingExperienceEvents();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  const envStatus = useMemo(() => computeEnvStatus(environment), [environment]);
  const plan = environment.plan;
  const planAvailable = Boolean(plan);

  const refreshStatuses = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    const [linkResponse, subscriptionResponse] = await Promise.all([
      api.get<{
        accountLinkStatus: AccountLinkStatus;
        linkSessionKey?: string;
        linkedUserRef?: string;
      }>(
        '/api/account/link/status',
      ),
      api.get<{ status: SubscriptionStatus; activatedAt?: string }>('/api/subscription/status'),
    ]);

    if (linkResponse.success && linkResponse.data) {
      setAccountLinkStatus(linkResponse.data.accountLinkStatus);
    }

    if (subscriptionResponse.success && subscriptionResponse.data) {
      setSubscriptionStatus(subscriptionResponse.data.status);
      setActivatedAt(subscriptionResponse.data.activatedAt);
    }

  }, [api, sessionId, setAccountLinkStatus, setActivatedAt, setSubscriptionStatus]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void refreshStatuses();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [sessionId, refreshStatuses]);

  const handleLinkAccount = useCallback(async () => {
    if (!session) {
      setErrorMessage('Create a demo session before starting account linking.');
      return;
    }

    setBusy(true);
    setErrorMessage(undefined);

    const idempotencyKey = createClientIdempotencyKey();
    setSession({ ...session, linkIdempotencyKey: idempotencyKey }, true);

    try {
      const response = await api.post<{
        sessionKey: string;
        redirectUrl: string;
        status: AccountLinkStatus;
        expiresAt?: string;
      }>('/api/account/link/initiate', { idempotencyKey });

      if (!response.success || !response.data) {
        setErrorMessage(response.error || 'Failed to start account linking.');
        return;
      }

      const { status, redirectUrl } = response.data;

      setAccountLinkStatus(status);

      if (status !== ACCOUNT_LINK_STATUS.Linked) {
        const { blocked } = openPopup({ url: redirectUrl, target: MOCK_ACCOUNT_LINK_WINDOW_NAME });
        if (blocked) {
          setErrorMessage(POPUP_BLOCKED_MESSAGE);
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start account linking.');
    } finally {
      setBusy(false);
    }
  }, [api, openPopup, session, setAccountLinkStatus, setSession]);

  const handleSubscribe = useCallback(async () => {
    if (!plan) {
      setErrorMessage('Configure DEMO_SERVER_API_KEY and DEMO_GAME_ID before subscribing.');
      return;
    }
    setBusy(true);
    setErrorMessage(undefined);
    try {
      const response = await api.post<{ redirectUrl: string }>('/api/subscription/subscribe');

      if (!response.success || !response.data?.redirectUrl) {
        setErrorMessage(response.error || 'Failed to start subscription.');
        return;
      }

      const { blocked } = openPopup({
        url: response.data.redirectUrl,
        target: SUBSCRIPTION_CHECKOUT_WINDOW_NAME,
      });

      if (blocked) {
        setErrorMessage(POPUP_BLOCKED_MESSAGE);
        return;
      }

      setSubscriptionStatus(SUBSCRIPTION_STATUS.Pending);
      setActivatedAt(undefined);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to start subscription.');
    } finally {
      setBusy(false);
    }
  }, [api, openPopup, plan, setActivatedAt, setSubscriptionStatus]);

  const handleCancelSubscription = useCallback(async () => {
    setBusy(true);
    setErrorMessage(undefined);
    try {
      const response = await api.post('/api/subscription/cancel');
      if (!response.success) {
        setErrorMessage(response.error || 'Failed to cancel subscription.');
        return;
      }

      await refreshStatuses();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to cancel subscription.');
    } finally {
      setBusy(false);
    }
  }, [api, refreshStatuses]);

  const showLinkCard = session && accountLinkStatus !== ACCOUNT_LINK_STATUS.Linked;
  const showSubscriptionCard =
    planAvailable &&
    session &&
    accountLinkStatus === ACCOUNT_LINK_STATUS.Linked &&
    subscriptionStatus !== SUBSCRIPTION_STATUS.Active;
  const showSubscriptionBlockedCard =
    !planAvailable &&
    session &&
    accountLinkStatus === ACCOUNT_LINK_STATUS.Linked &&
    subscriptionStatus !== SUBSCRIPTION_STATUS.Active;

  const activatedAtDisplay = formatTimestamp(activatedAt);

  return (
    <>
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-16 lg:flex-row lg:items-start">
        <Card as="article" className="flex-1">
          <HeroSection session={session} onOpenLoginModal={openLoginModal} onSignOut={signOut} />

          <EnvironmentChecklist environment={environment} status={envStatus} />

          <EventLog entries={eventLog} />
        </Card>

        <aside className="flex w-full max-w-md flex-col gap-6">
          <DemoStatusCard
            accountLinkStatus={accountLinkStatus}
            formattedActivatedAt={activatedAtDisplay}
            sessionEmail={session?.email}
            subscriptionStatus={subscriptionStatus}
          />

          <PlanPreviewCard plan={plan} session={session} />

          {!session && <HowTheDemoWorksCard />}

        <LinkAccountCard
          visible={Boolean(showLinkCard)}
          busy={busy}
          onLinkAccount={handleLinkAccount}
        />

          <SubscriptionActionCard
            visible={Boolean(showSubscriptionCard)}
            plan={plan}
            busy={busy}
            onSubscribe={handleSubscribe}
          />

          <SubscriptionBlockedCard visible={Boolean(showSubscriptionBlockedCard)} />

          <ActiveSubscriptionCard
            visible={Boolean(session && subscriptionStatus === SUBSCRIPTION_STATUS.Active)}
            busy={busy}
            onCancel={handleCancelSubscription}
          />

          <ErrorBanner message={errorMessage} />
        </aside>
      </section>

      {!loading && <CustomLoginModal />}
    </>
  );
}

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { DemoSessionDto } from '@/lib/session/session.types';
import type { DemoEvent } from '@/lib/events/eventBus.types';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
import { ACCOUNT_LINK_STATUS, type AccountLinkStatus } from '@/lib/accountLink/accountLink.types';
import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from '@/lib/subscription/subscription.types';
import { useEventStream } from '@/hooks/useEventStream';

import { MAX_EVENT_LOG_ENTRIES } from './landingExperience.constants';
import type {
  EventLogEntry,
  LandingExperienceEventsContextValue,
  LandingExperienceEventsProviderProps,
} from './landingExperience.types';
import {
  formatAccountLinkSummary,
  formatSubscriptionSummary,
  getAccountLinkEventTone,
  getSubscriptionEventTone,
  makeEventId,
} from './landingExperience.utils';

const LandingExperienceEventsContext = createContext<LandingExperienceEventsContextValue | undefined>(undefined);

export function LandingExperienceEventsProvider({
  session,
  setSession,
  children,
}: LandingExperienceEventsProviderProps) {
  const sessionRef = useRef<DemoSessionDto | null>(session);

  const [accountLinkStatus, setAccountLinkStatusState] = useState<AccountLinkStatus>(
    () => session?.accountLinkStatus ?? ACCOUNT_LINK_STATUS.Idle,
  );
  const [linkExpiresAt, setLinkExpiresAtState] = useState<string | undefined>(() => session?.linkExpiresAt);
  const [subscriptionStatus, setSubscriptionStatusState] = useState<SubscriptionStatus>(
    () => session?.subscriptionStatus ?? SUBSCRIPTION_STATUS.Inactive,
  );
  const [activatedAt, setActivatedAtState] = useState<string | undefined>(() => session?.subscriptionActivatedAt);
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const appendEvent = useCallback((entry: Omit<EventLogEntry, 'id'>) => {
    setEventLog((prev) => {
      const next: EventLogEntry[] = [{ ...entry, id: makeEventId() }, ...prev];
      return next.slice(0, MAX_EVENT_LOG_ENTRIES);
    });
  }, []);

  const updateAccountLinkStatus = useCallback((status: AccountLinkStatus) => {
    setAccountLinkStatusState(status);
  }, []);

  const updateLinkExpiresAt = useCallback((expiresAt: string | undefined) => {
    setLinkExpiresAtState(expiresAt);
  }, []);

  const updateSubscriptionStatus = useCallback((status: SubscriptionStatus) => {
    setSubscriptionStatusState(status);
  }, []);

  const updateActivatedAt = useCallback((value: string | undefined) => {
    setActivatedAtState(value);
  }, []);

  const handleDemoEvent = useCallback(
    (event: DemoEvent) => {
      const currentSession = sessionRef.current;
      const currentSessionId = currentSession?.id;
      if (!currentSessionId) {
        return;
      }

      if (event.type === DEMO_EVENT_TYPE.SessionUpdated) {
        if (event.payload.id === currentSessionId) {
          setSession(event.payload, true);
          updateAccountLinkStatus(event.payload.accountLinkStatus);
          updateSubscriptionStatus(event.payload.subscriptionStatus);
          updateLinkExpiresAt(event.payload.linkExpiresAt);
          updateActivatedAt(event.payload.subscriptionActivatedAt);
        }
        return;
      }

      if (event.type === DEMO_EVENT_TYPE.AccountLinkEvent && event.payload.sessionId === currentSessionId) {
        updateAccountLinkStatus(event.payload.status);
        appendEvent({
          summary: formatAccountLinkSummary(event.payload.provider, event.payload.topic, event.payload.status),
          timestamp: event.payload.triggeredAt,
          tone: getAccountLinkEventTone(event.payload.status),
        });
      }

      if (event.type === DEMO_EVENT_TYPE.SubscriptionEvent && event.payload.sessionId === currentSessionId) {
        updateSubscriptionStatus(event.payload.status);
        if (event.payload.status === SUBSCRIPTION_STATUS.Active) {
          updateActivatedAt(event.payload.occurredAt);
        }
        appendEvent({
          summary: formatSubscriptionSummary(event.payload.provider, event.payload.topic, event.payload.status),
          timestamp: event.payload.occurredAt,
          tone: getSubscriptionEventTone(event.payload.status),
        });
      }

      if (event.type === DEMO_EVENT_TYPE.WebhookNotification) {
        appendEvent({
          summary: event.payload.summary,
          timestamp: event.payload.timestamp,
          tone: event.payload.tone,
        });
      }
    },
    [appendEvent, setSession, updateAccountLinkStatus, updateActivatedAt, updateLinkExpiresAt, updateSubscriptionStatus],
  );

  useEventStream(Boolean(session), handleDemoEvent);

  const value = useMemo<LandingExperienceEventsContextValue>(
    () => ({
      accountLinkStatus,
      linkExpiresAt,
      subscriptionStatus,
      activatedAt,
      eventLog,
      setAccountLinkStatus: updateAccountLinkStatus,
      setLinkExpiresAt: updateLinkExpiresAt,
      setSubscriptionStatus: updateSubscriptionStatus,
      setActivatedAt: updateActivatedAt,
    }),
    [
      accountLinkStatus,
      activatedAt,
      eventLog,
      linkExpiresAt,
      subscriptionStatus,
      updateAccountLinkStatus,
      updateActivatedAt,
      updateLinkExpiresAt,
      updateSubscriptionStatus,
    ],
  );

  return <LandingExperienceEventsContext.Provider value={value}>{children}</LandingExperienceEventsContext.Provider>;
}

export function useLandingExperienceEvents(): LandingExperienceEventsContextValue {
  const context = useContext(LandingExperienceEventsContext);
  if (!context) {
    throw new Error('useLandingExperienceEvents must be used within LandingExperienceEventsProvider');
  }
  return context;
}

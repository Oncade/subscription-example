'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { DemoSessionDto } from '@/lib/session/session.types';
import type { DemoEvent } from '@/lib/events/eventBus.types';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
import { ACCOUNT_LINK_STATUS, type AccountLinkStatus } from '@/lib/accountLink/accountLink.types';
import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from '@/lib/subscription/subscription.types';
import { useEventStream } from '@/hooks/useEventStream';
import type { OncadeWebhookEnvelope } from '@/lib/webhooks/oncadeWebhook.types';

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

const PROCESSED_EVENTS_STORAGE_KEY = 'demo.processedWebhookEvents';
const MAX_STORED_EVENTS = 1000;

function getEventKey(payload: OncadeWebhookEnvelope): string {
  const idempotencyKey = payload.data?.metadata && typeof payload.data.metadata === 'object' && 'idempotencyKey' in payload.data.metadata
    ? String(payload.data.metadata.idempotencyKey)
    : null;
  
  if (idempotencyKey) {
    return `${payload.event}:${idempotencyKey}`;
  }
  
  return `${payload.event}:${payload.timestamp || Date.now()}`;
}

function isEventProcessed(eventKey: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  
  try {
    const stored = localStorage.getItem(PROCESSED_EVENTS_STORAGE_KEY);
    if (!stored) {
      return false;
    }
    const processedEvents: string[] = JSON.parse(stored);
    return processedEvents.includes(eventKey);
  } catch {
    return false;
  }
}

function markEventAsProcessed(eventKey: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    const stored = localStorage.getItem(PROCESSED_EVENTS_STORAGE_KEY);
    const processedEvents: string[] = stored ? JSON.parse(stored) : [];
    
    if (!processedEvents.includes(eventKey)) {
      processedEvents.push(eventKey);
      // Keep only the most recent events
      if (processedEvents.length > MAX_STORED_EVENTS) {
        processedEvents.shift();
      }
      localStorage.setItem(PROCESSED_EVENTS_STORAGE_KEY, JSON.stringify(processedEvents));
    }
  } catch {
    // Ignore localStorage errors
  }
}

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

  // Sync state from session when it changes
  // Using refs to track previous values and only update when changed
  // This is a legitimate use case for syncing derived state from props
  const prevSessionRef = useRef<DemoSessionDto | null>(session);
  
  useEffect(() => {
    sessionRef.current = session;
    const prevSession = prevSessionRef.current;
    
    if (session && session !== prevSession) {
      // Only update if values actually changed to avoid unnecessary renders
      if (prevSession?.accountLinkStatus !== session.accountLinkStatus) {
        setAccountLinkStatusState(session.accountLinkStatus);
      }
      if (prevSession?.subscriptionStatus !== session.subscriptionStatus) {
        setSubscriptionStatusState(session.subscriptionStatus);
      }
      if (prevSession?.linkExpiresAt !== session.linkExpiresAt) {
        setLinkExpiresAtState(session.linkExpiresAt);
      }
      if (prevSession?.subscriptionActivatedAt !== session.subscriptionActivatedAt) {
        setActivatedAtState(session.subscriptionActivatedAt);
      }
      prevSessionRef.current = session;
    } else if (!session && prevSession) {
      prevSessionRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/set-state-in-effect
  }, [session?.id, session?.accountLinkStatus, session?.subscriptionStatus, session?.linkExpiresAt, session?.subscriptionActivatedAt]);

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

      if (event.type === DEMO_EVENT_TYPE.RawWebhookEvent) {
        const webhookPayload = event.payload;
        const eventKey = getEventKey(webhookPayload);
        
        const sessionKey = webhookPayload.data?.sessionKey as string | undefined;
        const rawUserRef = (webhookPayload.data?.user_ref || webhookPayload.data?.userRef);
        // Handle case where user_ref might be the string 'null' or actual null
        const userRef = rawUserRef && rawUserRef !== 'null' ? String(rawUserRef) : undefined;
        const userEmail = webhookPayload.data?.userEmail as string | undefined;

        // Check if this event is relevant to the current session FIRST
        // Match by: sessionKey (exact match), userRef, or email
        // For account link events, we also accept if session doesn't have linkSessionKey yet AND email matches
        const isAccountLinkEvent = webhookPayload.event?.startsWith('User.Account.Link.');
        const isSubscriptionEvent = webhookPayload.event?.startsWith('Purchases.Subscriptions.') || 
                                     webhookPayload.event?.startsWith('Subscription.');
        
        const sessionKeyMatches = sessionKey && currentSession?.linkSessionKey === sessionKey;
        const userRefMatches = userRef && currentSession?.linkedUserRef === userRef;
        const emailMatches = userEmail && currentSession?.email?.toLowerCase() === userEmail?.toLowerCase();
        
        // For first-time account link events: if session doesn't have linkSessionKey yet, accept if email matches OR if we have a sessionKey
        const firstTimeAccountLinkMatch = isAccountLinkEvent && 
          sessionKey && 
          !currentSession?.linkSessionKey && 
          (emailMatches || !userEmail); // Accept if email matches OR if no email in webhook (we'll match by sessionKey)
        
        // For subscription events: always match by email if provided, even if userRef doesn't match yet
        const subscriptionEmailMatch = isSubscriptionEvent && emailMatches;
        
        // For account link events without email, try to match by sessionKey if session doesn't have linkSessionKey yet
        const accountLinkSessionKeyMatch = isAccountLinkEvent && 
          sessionKey && 
          !currentSession?.linkSessionKey;
        
        // For account link events: if status is Canceled or Idle, accept new sessionKey (allows retry after cancel)
        const canAcceptNewAccountLink = isAccountLinkEvent && 
          sessionKey && 
          (currentSession?.accountLinkStatus === ACCOUNT_LINK_STATUS.Canceled || 
           currentSession?.accountLinkStatus === ACCOUNT_LINK_STATUS.Idle);
        
        const isRelevantToSession = sessionKeyMatches || userRefMatches || emailMatches || firstTimeAccountLinkMatch || subscriptionEmailMatch || accountLinkSessionKeyMatch || canAcceptNewAccountLink;

        console.log('Webhook event received', {
          event: webhookPayload.event,
          sessionKey,
          userRef,
          userEmail,
          currentSessionEmail: currentSession?.email,
          currentSessionLinkSessionKey: currentSession?.linkSessionKey,
          currentSessionLinkedUserRef: currentSession?.linkedUserRef,
          sessionKeyMatches,
          userRefMatches,
          emailMatches,
          firstTimeAccountLinkMatch,
          subscriptionEmailMatch,
          accountLinkSessionKeyMatch,
          canAcceptNewAccountLink,
          isRelevantToSession,
          eventKey,
          alreadyProcessed: isEventProcessed(eventKey),
        });

        // Only check if processed AFTER checking relevance
        // This way, if an event doesn't match, it won't be marked as processed
        if (!isRelevantToSession) {
          console.log('Event not relevant to current session, skipping (not marking as processed)');
          return;
        }

        // Check if event was already processed (only for relevant events)
        if (isEventProcessed(eventKey)) {
          console.log('Event already processed, skipping', eventKey);
          return;
        }

        // Mark as processed ONLY after we've confirmed it's relevant and not already processed
        markEventAsProcessed(eventKey);
        console.log('Processing webhook event', eventKey);

        // Handle account link events
        if (
          webhookPayload.event === 'User.Account.Link.Started' ||
          webhookPayload.event === 'User.Account.Link.Succeeded' ||
          webhookPayload.event === 'User.Account.Link.Completed' ||
          webhookPayload.event === 'User.Account.Link.Canceled' ||
          webhookPayload.event === 'User.Account.Link.Removed' ||
          webhookPayload.event === 'User.Account.Link.Failed'
        ) {
          let status: AccountLinkStatus = ACCOUNT_LINK_STATUS.Idle;
          let tone: 'success' | 'warning' | 'info' = 'info';

          if (
            webhookPayload.event === 'User.Account.Link.Succeeded' ||
            webhookPayload.event === 'User.Account.Link.Completed'
          ) {
            status = ACCOUNT_LINK_STATUS.Linked;
            tone = 'success';
          } else if (
            webhookPayload.event === 'User.Account.Link.Canceled' ||
            webhookPayload.event === 'User.Account.Link.Removed' ||
            webhookPayload.event === 'User.Account.Link.Failed'
          ) {
            status = ACCOUNT_LINK_STATUS.Canceled;
            tone = 'warning';
          } else if (webhookPayload.event === 'User.Account.Link.Started') {
            status = ACCOUNT_LINK_STATUS.Started;
            tone = 'info';
          }

          updateAccountLinkStatus(status);
          
          // Update session object with new state
          if (currentSession) {
            const updatedSession: DemoSessionDto = {
              ...currentSession,
              accountLinkStatus: status,
              // Update linkSessionKey: set it for Started events, clear it for Canceled events
              linkSessionKey: status === ACCOUNT_LINK_STATUS.Canceled 
                ? undefined 
                : (sessionKey || currentSession.linkSessionKey),
              // Update linkedUserRef if we received one, or clear it on cancel
              linkedUserRef: status === ACCOUNT_LINK_STATUS.Canceled
                ? undefined
                : (userRef !== undefined ? userRef : currentSession.linkedUserRef),
            };
            setSession(updatedSession, true);
            // Update the ref so subsequent events can match
            sessionRef.current = updatedSession;
          }
          
          appendEvent({
            summary: `Oncade webhook • ${webhookPayload.event} • ${status}`,
            timestamp: webhookPayload.timestamp || new Date().toISOString(),
            tone,
          });
          return;
        }

        // Handle subscription events
        if (
          webhookPayload.event === 'Purchases.Subscriptions.Started' ||
          webhookPayload.event === 'Purchases.Subscriptions.Completed' ||
          webhookPayload.event === 'Purchases.Subscriptions.Canceled' ||
          webhookPayload.event === 'Purchases.Subscriptions.Failed'
        ) {
          let status: SubscriptionStatus = SUBSCRIPTION_STATUS.Inactive;
          let tone: 'success' | 'warning' | 'info' = 'info';

          if (webhookPayload.event === 'Purchases.Subscriptions.Completed') {
            status = SUBSCRIPTION_STATUS.Active;
            tone = 'success';
            if (webhookPayload.timestamp) {
              updateActivatedAt(webhookPayload.timestamp);
            }
          } else if (webhookPayload.event === 'Purchases.Subscriptions.Canceled') {
            status = SUBSCRIPTION_STATUS.Canceled;
            tone = 'warning';
          } else if (webhookPayload.event === 'Purchases.Subscriptions.Started') {
            status = SUBSCRIPTION_STATUS.Pending;
            tone = 'info';
          }

          updateSubscriptionStatus(status);
          
          // Update session object with new state
          if (currentSession) {
            const updatedSession: DemoSessionDto = {
              ...currentSession,
              subscriptionStatus: status,
              subscriptionActivatedAt: status === SUBSCRIPTION_STATUS.Active && webhookPayload.timestamp
                ? webhookPayload.timestamp
                : currentSession.subscriptionActivatedAt,
              // Update linkedUserRef if provided in webhook (for subscription events)
              linkedUserRef: userRef || currentSession.linkedUserRef,
            };
            setSession(updatedSession, true);
            // Update the ref so subsequent events can match
            sessionRef.current = updatedSession;
          }
          
          appendEvent({
            summary: `Oncade webhook • ${webhookPayload.event} • ${status}`,
            timestamp: webhookPayload.timestamp || new Date().toISOString(),
            tone,
          });
          return;
        }

        // Handle other events as generic webhook notifications
        appendEvent({
          summary: `Oncade webhook • ${webhookPayload.event}`,
          timestamp: webhookPayload.timestamp || new Date().toISOString(),
          tone: 'info',
        });
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

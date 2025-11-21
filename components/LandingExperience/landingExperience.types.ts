import type { ReactNode } from 'react';

import type { EventLogTone } from '@/lib/events/eventLog.types';
import type { DemoEnvVarStatus, DemoEnvironmentSummaryDto, DemoPlanConfigDto } from '@/lib/env/config.types';
import type { DemoSessionDto } from '@/lib/session/session.types';
import type { AccountLinkStatus } from '@/lib/accountLink/accountLink.types';
import type { SubscriptionStatus } from '@/lib/subscription/subscription.types';

export interface EventLogEntry {
  readonly id: string;
  readonly summary: string;
  readonly timestamp: string;
  readonly tone: EventLogTone;
}

export interface EnvironmentStatus {
  readonly ready: boolean;
  readonly missing: readonly DemoEnvVarStatus[];
}

export interface LandingExperienceProps {
  readonly environment: DemoEnvironmentSummaryDto;
}

export interface LandingExperienceInnerProps {
  readonly environment: DemoEnvironmentSummaryDto;
  readonly session: DemoSessionDto | null;
  readonly setSession: (session: DemoSessionDto | null, persist?: boolean) => void;
  readonly openLoginModal: () => void;
  readonly loading: boolean;
  readonly signOut: () => void;
}

export interface LandingExperienceEventsProviderProps {
  readonly session: DemoSessionDto | null;
  readonly setSession: (session: DemoSessionDto | null, persist?: boolean) => void;
  readonly children: ReactNode;
}

export interface LandingExperienceEventsContextValue {
  readonly accountLinkStatus: AccountLinkStatus;
  readonly linkExpiresAt?: string;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly activatedAt?: string;
  readonly eventLog: EventLogEntry[];
  setAccountLinkStatus: (status: AccountLinkStatus) => void;
  setLinkExpiresAt: (expiresAt: string | undefined) => void;
  setSubscriptionStatus: (status: SubscriptionStatus) => void;
  setActivatedAt: (activatedAt: string | undefined) => void;
}

export interface HeroSectionProps {
  readonly session: DemoSessionDto | null;
  readonly onOpenLoginModal: () => void;
  readonly onSignOut: () => void;
}

export interface PlanPreviewCardProps {
  readonly plan: DemoPlanConfigDto | null;
  readonly session: DemoSessionDto | null;
}

export interface LinkAccountCardProps {
  readonly visible: boolean;
  readonly busy: boolean;
  readonly linkExpiresAt?: string;
  readonly onLinkAccount: () => Promise<void> | void;
}

export interface SubscriptionActionCardProps {
  readonly visible: boolean;
  readonly plan: DemoPlanConfigDto | null;
  readonly busy: boolean;
  readonly onSubscribe: () => Promise<void> | void;
}

export interface SubscriptionBlockedCardProps {
  readonly visible: boolean;
}

export interface ActiveSubscriptionCardProps {
  readonly visible: boolean;
  readonly busy: boolean;
  readonly onCancel: () => Promise<void> | void;
}

export interface ErrorBannerProps {
  readonly message?: string;
}

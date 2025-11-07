'use client';

import { Card } from '@/components/Card';

import {
  SUBSCRIPTION_BLOCKED_DESCRIPTION,
  SUBSCRIPTION_BLOCKED_TITLE,
  SUBSCRIPTION_REQUIRED_ENV_VARS,
} from '../landingExperience.constants';
import type { SubscriptionBlockedCardProps } from '../landingExperience.types';

export function SubscriptionBlockedCard({ visible }: SubscriptionBlockedCardProps) {
  if (!visible) {
    return null;
  }

  return (
    <Card padding="compact" className="bg-amber-500/10 text-sm text-amber-100">
      <h3 className="text-lg font-semibold text-amber-200">{SUBSCRIPTION_BLOCKED_TITLE}</h3>
      <p className="mt-2 text-amber-100/80">
        {SUBSCRIPTION_BLOCKED_DESCRIPTION}{' '}
        {SUBSCRIPTION_REQUIRED_ENV_VARS.map((variable, index) => {
          const isLast = index === SUBSCRIPTION_REQUIRED_ENV_VARS.length - 1;
          const needsComma = index < SUBSCRIPTION_REQUIRED_ENV_VARS.length - 2;
          const needsAnd = index === SUBSCRIPTION_REQUIRED_ENV_VARS.length - 2;
          return (
            <span key={variable} className="whitespace-nowrap">
              <code className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-900">{variable}</code>
              {needsComma && ', '}
              {needsAnd && ' and '}
              {isLast && '.'}
            </span>
          );
        })}
      </p>
    </Card>
  );
}

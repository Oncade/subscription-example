'use client';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { DemoButton } from '@/components/DemoButton';

import {
  SUBSCRIPTION_BUTTON_BUSY,
  SUBSCRIPTION_BUTTON_READY,
  SUBSCRIPTION_CARD_DESCRIPTION,
  SUBSCRIPTION_CARD_TITLE,
  SUBSCRIPTION_PLAN_BADGE,
} from '../landingExperience.constants';
import type { SubscriptionActionCardProps } from '../landingExperience.types';

export function SubscriptionActionCard({ visible, plan, busy, onSubscribe }: SubscriptionActionCardProps) {
  if (!visible || !plan) {
    return null;
  }

  return (
    <Card padding="compact" className="bg-emerald-500/10 text-sm text-emerald-100">
      <h3 className="text-lg font-semibold text-emerald-200">{SUBSCRIPTION_CARD_TITLE}</h3>
      <p className="mt-2 text-emerald-100/80">{SUBSCRIPTION_CARD_DESCRIPTION}</p>
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2">
          <Badge tone="emerald" className="uppercase tracking-widest text-emerald-200">
            {SUBSCRIPTION_PLAN_BADGE}
          </Badge>
          <span className="text-sm">
            {plan.name}
            {' \u2022 '}
            ${plan.priceUsd.toFixed(2)} / {plan.interval}
          </span>
        </div>
      </div>
      <DemoButton tone="emerald" onClick={onSubscribe} disabled={busy} fullWidth className="mt-4">
        {busy ? SUBSCRIPTION_BUTTON_BUSY : SUBSCRIPTION_BUTTON_READY}
      </DemoButton>
    </Card>
  );
}

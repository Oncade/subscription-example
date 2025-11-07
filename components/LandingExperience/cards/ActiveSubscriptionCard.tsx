'use client';

import { Card } from '@/components/Card';
import { DemoButton } from '@/components/DemoButton';

import {
  ACTIVE_SUBSCRIPTION_TITLE,
  CANCEL_SUBSCRIPTION_BUTTON_BUSY,
  CANCEL_SUBSCRIPTION_BUTTON_READY,
} from '../landingExperience.constants';
import type { ActiveSubscriptionCardProps } from '../landingExperience.types';

export function ActiveSubscriptionCard({ visible, busy, onCancel }: ActiveSubscriptionCardProps) {
  if (!visible) {
    return null;
  }

  return (
    <Card padding="compact" className="bg-emerald-500/15 text-sm text-emerald-100">
      <h3 className="text-lg font-semibold text-emerald-200">{ACTIVE_SUBSCRIPTION_TITLE}</h3>
      <DemoButton
        tone="emerald"
        variant="outline"
        strength="strong"
        onClick={onCancel}
        disabled={busy}
        fullWidth
        className="mt-4"
      >
        {busy ? CANCEL_SUBSCRIPTION_BUTTON_BUSY : CANCEL_SUBSCRIPTION_BUTTON_READY}
      </DemoButton>
    </Card>
  );
}

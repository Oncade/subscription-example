'use client';

import { Card } from '@/components/Card';
import { DemoButton } from '@/components/DemoButton';

import {
  LINK_ACCOUNT_BUTTON_BUSY,
  LINK_ACCOUNT_BUTTON_READY,
  LINK_ACCOUNT_DESCRIPTION,
  LINK_ACCOUNT_TITLE,
} from '../landingExperience.constants';
import type { LinkAccountCardProps } from '../landingExperience.types';

export function LinkAccountCard({ visible, busy, onLinkAccount }: LinkAccountCardProps) {
  if (!visible) {
    return null;
  }

  return (
    <Card padding="compact" className="bg-sky-500/10 text-sm text-sky-100">
      <h3 className="text-lg font-semibold text-sky-200">{LINK_ACCOUNT_TITLE}</h3>
      <p className="mt-2 text-sky-100/80">{LINK_ACCOUNT_DESCRIPTION}</p>
      <DemoButton tone="sky" onClick={onLinkAccount} disabled={busy} fullWidth className="mt-4">
        {busy ? LINK_ACCOUNT_BUTTON_BUSY : LINK_ACCOUNT_BUTTON_READY}
      </DemoButton>
    </Card>
  );
}

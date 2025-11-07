'use client';

import { Card } from '@/components/Card';

import { PLAN_PREVIEW_TITLE } from '../landingExperience.constants';
import type { PlanPreviewCardProps } from '../landingExperience.types';

export function PlanPreviewCard({ plan, session }: PlanPreviewCardProps) {
  if (!session || !plan) {
    return null;
  }

  return (
    <Card padding="compact" className="bg-emerald-500/10 text-sm text-emerald-100">
      <h3 className="text-lg font-semibold text-emerald-200">{PLAN_PREVIEW_TITLE}</h3>
      <p className="mt-2 text-sm text-emerald-100/80">
        {plan.name}
        {' \u2022 '}
        ${plan.priceUsd.toFixed(2)} / {plan.interval}
      </p>
    </Card>
  );
}

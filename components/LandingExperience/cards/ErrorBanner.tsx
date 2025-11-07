'use client';

import { Card } from '@/components/Card';

import type { ErrorBannerProps } from '../landingExperience.types';

export function ErrorBanner({ message }: ErrorBannerProps) {
  if (!message) {
    return null;
  }

  return (
    <Card padding="compact" className="border-red-500/40 bg-red-500/10 text-sm text-red-200">
      {message}
    </Card>
  );
}

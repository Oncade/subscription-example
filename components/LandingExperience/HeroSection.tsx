'use client';

import { DemoButton } from '@/components/DemoButton';
import { PreviewBadge } from '@/components/PreviewBadge';

import { HERO_SUBTITLE, HERO_SUPPORT_TEXT, HERO_TITLE } from './landingExperience.constants';
import type { HeroSectionProps } from './landingExperience.types';

export function HeroSection({ session, onOpenLoginModal, onSignOut }: HeroSectionProps) {
  return (
    <header className="space-y-4">
      <PreviewBadge />
      <h1 className="text-4xl font-semibold leading-tight text-zinc-50 sm:text-5xl">{HERO_TITLE}</h1>
      <p className="text-lg text-zinc-400">{HERO_SUBTITLE}</p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {session ? (
          <DemoButton tone="zinc" variant="outline" onClick={onSignOut} className="px-5">
            Sign out
          </DemoButton>
        ) : (
          <DemoButton tone="emerald" strength="strong" elevated onClick={onOpenLoginModal} className="px-6">
            Sign in to start the demo
          </DemoButton>
        )}
        <span className="text-sm text-zinc-500">{HERO_SUPPORT_TEXT}</span>
      </div>
    </header>
  );
}

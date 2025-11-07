import { Suspense } from 'react';

import { getDemoEnvironmentSummary } from '@/lib/env/config.server';

import { LandingExperience } from '@/components/LandingExperience';
import { LoadingBanner } from '@/components/LoadingBanner';

export default async function Home() {
  const envSummary = await getDemoEnvironmentSummary();

  return (
    <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-50">
      <Suspense fallback={<LoadingBanner />}>
        <LandingExperience environment={envSummary} />
      </Suspense>
    </main>
  );
}

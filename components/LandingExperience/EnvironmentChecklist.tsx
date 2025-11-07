import { Fragment, type ReactNode } from 'react';

import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import type { DemoEnvironmentSummaryDto } from '@/lib/env/config.types';

import type { EnvironmentStatus } from './landingExperience.types';

interface EnvironmentChecklistProps {
  readonly environment: DemoEnvironmentSummaryDto;
  readonly status: EnvironmentStatus;
}

export function EnvironmentChecklist({ environment, status }: EnvironmentChecklistProps) {
  const missingNames = status.missing.map((entry) => entry.name);
  const missingSet = new Set(missingNames);

  const guidanceMessages: Array<{ key: string; content: ReactNode }> = [];

  if (missingSet.has('DEMO_WEBHOOK_SECRET')) {
    guidanceMessages.push({
      key: 'webhook',
      content: (
        <>
          Webhook validation requires{' '}
          <code className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-50">DEMO_WEBHOOK_SECRET</code>.
        </>
      ),
    });
    missingSet.delete('DEMO_WEBHOOK_SECRET');
  }

  const planEnvVars = ['DEMO_SERVER_API_KEY', 'DEMO_GAME_ID'] as const;
  const missingPlanVars = planEnvVars.filter((name) => missingSet.has(name));
  if (missingPlanVars.length > 0) {
    guidanceMessages.push({
      key: 'plan',
      content: (
        <>
          Plan previews and account linking require{' '}
          {missingPlanVars.map((name, index) => (
            <Fragment key={name}>
              <code className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-50">{name}</code>
              {index < missingPlanVars.length - 2 ? ', ' : ''}
              {index === missingPlanVars.length - 2 ? ' and ' : ''}
            </Fragment>
          ))}
          .
        </>
      ),
    });
    missingPlanVars.forEach((name) => missingSet.delete(name));
  }

  missingSet.forEach((name) => {
    guidanceMessages.push({
      key: name,
      content: (
        <>
          Complete setup by configuring{' '}
          <code className="rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-50">{name}</code>.
        </>
      ),
    });
  });

  return (
    <section className="mt-12 space-y-6">
      <h2 className="text-xl font-semibold text-zinc-100">Environment checklist</h2>
      <ul className="space-y-3">
        {environment.required.map((entry) => (
          <li key={entry.name}>
            <Card padding="compact" className="text-sm text-zinc-300 shadow-none">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">{entry.name}</span>
                <Badge tone={entry.configured ? 'emerald' : 'red'} className="uppercase tracking-widest">
                  {entry.configured ? 'Configured' : 'Missing'}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-zinc-400">{entry.description}</p>
              {!entry.configured && (
                <p className="mt-2 text-xs text-red-300">
                  Configure <code className="rounded bg-zinc-800 px-1.5 py-0.5">{entry.name}</code> in{' '}
                  <code className="rounded bg-zinc-800 px-1.5 py-0.5">.env.local</code>.
                </p>
              )}
            </Card>
          </li>
        ))}
      </ul>
      {!status.ready && (
        <Card padding="compact" className="border-amber-500/40 bg-amber-500/10 text-sm text-amber-200 shadow-none">
          <p className="text-sm text-amber-100">
            The demo can load with partial configuration, but the following values are still required:
          </p>
          <ul className="mt-3 space-y-2 text-xs text-amber-100/90">
            {guidanceMessages.length === 0 ? (
              <li key="fallback" className="flex gap-2">
                <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                <span>Complete setup by configuring the remaining environment variables.</span>
              </li>
            ) : (
              guidanceMessages.map((message) => (
                <li key={message.key} className="flex gap-2">
                  <span aria-hidden className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span>{message.content}</span>
                </li>
              ))
            )}
          </ul>
        </Card>
      )}
      <Card padding="compact" className="text-sm text-zinc-400 shadow-none">
        <p className="text-sm font-semibold text-zinc-200">Optional extras</p>
        <ul className="mt-2 space-y-2 text-xs text-zinc-500">
          {environment.optional.map((entry) => (
            <li key={entry.name}>
              <span className="font-mono text-xs uppercase tracking-widest">{entry.name}</span> — {entry.description}
            </li>
          ))}
        </ul>
      </Card>
      <Card padding="compact" className="bg-emerald-500/5 text-sm text-emerald-100 shadow-none">
        <p className="text-sm font-semibold text-emerald-200">Account linking target</p>
        <p className="mt-1 text-xs text-emerald-100/80">
          Requests are sent to <span className="font-mono text-emerald-200">{environment.linking.apiBaseUrl}</span>
        </p>
        <ul className="mt-3 space-y-2 text-xs text-emerald-100/70">
          <li>
            <span className="font-semibold text-emerald-200">Server API key</span> —{' '}
            {environment.linking.hasServerApiKey ? 'configured' : 'missing'}
          </li>
          <li>
            <span className="font-semibold text-emerald-200">Game ID</span> —{' '}
            {environment.linking.hasGameId ? 'configured' : 'missing'}
          </li>
        </ul>
      </Card>
    </section>
  );
}

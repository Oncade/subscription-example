import { Card } from '@/components/Card';
import { formatTimestamp } from '@/lib/format/formatTimestamp';

import type { EventLogEntry } from './landingExperience.types';

interface EventLogProps {
  readonly entries: readonly EventLogEntry[];
}

export function EventLog({ entries }: EventLogProps) {
  return (
    <section className="mt-12 space-y-4">
      <h2 className="text-xl font-semibold text-zinc-100">Webhook event log</h2>
      <Card padding="compact" className="bg-zinc-950/60 shadow-none">
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Once you start the flow we will display account link and subscription webhook events here.
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-zinc-800 bg-zinc-900/70 px-4 py-3">
                <div
                  className={`text-xs font-semibold uppercase tracking-widest ${
                    entry.tone === 'success'
                      ? 'text-emerald-300'
                      : entry.tone === 'warning'
                        ? 'text-amber-300'
                        : 'text-sky-300'
                  }`}
                >
                  {entry.summary}
                </div>
                <div className="text-xs text-zinc-500">{formatTimestamp(entry.timestamp)}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}


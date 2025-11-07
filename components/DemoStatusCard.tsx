import type { AccountLinkStatus } from '@/lib/accountLink/accountLink.types';
import type { SubscriptionStatus } from '@/lib/subscription/subscription.types';

import { Card } from './Card';

interface DemoStatusCardProps {
  readonly accountLinkStatus: AccountLinkStatus;
  readonly formattedActivatedAt: string;
  readonly sessionEmail?: string;
  readonly subscriptionStatus: SubscriptionStatus;
}

export function DemoStatusCard({
  accountLinkStatus,
  formattedActivatedAt,
  sessionEmail,
  subscriptionStatus,
}: DemoStatusCardProps) {
  return (
    <Card>
      <h3 className="text-lg font-semibold text-zinc-50">Demo status</h3>
      <dl className="mt-4 space-y-3 text-sm text-zinc-400">
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Session</dt>
          <dd className="font-medium text-zinc-200">{sessionEmail ?? 'Not signed in'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Account link</dt>
          <dd className="font-medium text-zinc-200">{accountLinkStatus}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Subscription</dt>
          <dd className="font-medium text-zinc-200">{subscriptionStatus}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-zinc-500">Activated</dt>
          <dd className="font-mono text-xs uppercase tracking-widest text-zinc-400">{formattedActivatedAt}</dd>
        </div>
      </dl>
    </Card>
  );
}

'use server';

import { NextRequest, NextResponse } from 'next/server';

import { resolveDemoPlanConfig } from '@/lib/env/planConfig.server';
import { resolveSessionErrorStatus, requireSessionFromRequest } from '@/lib/session/session.server';
import { forwardCancellation, lookupActiveSubscription } from '@/lib/subscription/subscriptionCancellation.server';

export async function handleSubscriptionCancelPost(request: NextRequest): Promise<NextResponse> {
  try {
    const session = requireSessionFromRequest(request);
    const plan = await resolveDemoPlanConfig({ forceRefresh: true });
    const lookup = await lookupActiveSubscription(session, plan.itemId);
    if (!lookup.success || !lookup.match) {
      const status = lookup.status ?? 400;
      const error = lookup.error ?? 'Unable to locate subscription to cancel.';
      return NextResponse.json({ success: false, error }, { status });
    }

    const cancellation = await forwardCancellation(lookup.match.userRef, plan.itemId);
    if (!cancellation.success) {
      const status = cancellation.status ?? 500;
      const error = cancellation.error ?? 'Unable to cancel subscription.';
      return NextResponse.json({ success: false, error }, { status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      const status = resolveSessionErrorStatus(error);
      return NextResponse.json({ success: false, error: error.message }, { status });
    }
    return NextResponse.json({ success: false, error: 'Unable to cancel subscription' }, { status: 500 });
  }
}

'use server';

import { NextRequest, NextResponse } from 'next/server';

import { getDemoEnvironmentSummary } from '@/lib/env/config.server';
import {
  getSessionDtoFromRequest,
  resolveSessionErrorStatus,
  SESSION_ERROR_UNKNOWN_IDENTIFIER,
} from '@/lib/session/session.server';

export async function handleSubscriptionStatusGet(request: NextRequest): Promise<NextResponse> {
  try {
    const session = getSessionDtoFromRequest(request);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const summary = await getDemoEnvironmentSummary();

    // Return session state from request (client-side storage)
    // Server doesn't modify or store session state
    return NextResponse.json({
      success: true,
      data: {
        status: session.subscriptionStatus,
        activatedAt: session.subscriptionActivatedAt,
        plan: summary.plan,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      const status = resolveSessionErrorStatus(error);
      const errorMessage = error.message === SESSION_ERROR_UNKNOWN_IDENTIFIER ? 'Session not found' : error.message;
      return NextResponse.json({ success: false, error: errorMessage }, { status });
    }
    return NextResponse.json({ success: false, error: 'Unable to fetch subscription status' }, { status: 500 });
  }
}

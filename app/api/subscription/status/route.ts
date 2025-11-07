import { NextRequest, NextResponse } from 'next/server';

import { getDemoEnvironmentSummary } from '@/lib/env/config.server';
import {
  getSessionDto,
  requireSessionFromRequest,
  resolveSessionErrorStatus,
  SESSION_ERROR_UNKNOWN_IDENTIFIER,
} from '@/lib/session/session.server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const record = requireSessionFromRequest(request);
    const session = getSessionDto(record.id);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    const summary = await getDemoEnvironmentSummary();

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

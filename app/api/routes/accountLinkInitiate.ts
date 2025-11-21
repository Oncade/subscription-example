'use server';

import { NextRequest, NextResponse } from 'next/server';

import { initiateAccountLinkSession } from '@/lib/accountLink/accountLink.server';
import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import { requireSessionFromRequest, resolveSessionErrorStatus } from '@/lib/session/session.server';

export async function handleAccountLinkInitiatePost(request: NextRequest): Promise<NextResponse> {
  try {
    const record = requireSessionFromRequest(request);
    let clientIdempotencyKey: string | undefined;
    try {
      const payload = (await request.json()) as { idempotencyKey?: unknown };
      if (payload && typeof payload.idempotencyKey === 'string') {
        const trimmed = payload.idempotencyKey.trim();
        if (trimmed.length > 0) {
          clientIdempotencyKey = trimmed;
        }
      }
    } catch {
      // Request body is optional
    }

    const linkSession = await initiateAccountLinkSession(record.id, record.email, request.nextUrl.origin, {
      idempotencyKey: clientIdempotencyKey,
    });
    const status = linkSession.status === ACCOUNT_LINK_STATUS.Linked ? 200 : 201;

    const response = NextResponse.json({ success: true, data: linkSession }, { status });
    if (linkSession.status === ACCOUNT_LINK_STATUS.Linked) {
      response.headers.set('Location', linkSession.redirectUrl);
    }
    return response;
  } catch (error) {
    if (error instanceof Error) {
      const status = resolveSessionErrorStatus(error);
      return NextResponse.json({ success: false, error: error.message }, { status });
    }
    return NextResponse.json({ success: false, error: 'Unable to initiate account link' }, { status: 500 });
  }
}

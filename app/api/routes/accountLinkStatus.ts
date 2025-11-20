'use server';

import { NextRequest, NextResponse } from 'next/server';

import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import { getOncadeIntegrationConfig } from '@/lib/env/config.server';
import {
  getSessionDtoFromRequest,
  resolveSessionErrorStatus,
} from '@/lib/session/session.server';

export async function handleAccountLinkStatusGet(request: NextRequest): Promise<NextResponse> {
  try {
    const dto = getSessionDtoFromRequest(request);
    if (!dto) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    // Return session state from request (client-side storage)
    // Server doesn't modify or store session state
    return NextResponse.json({
      success: true,
      data: {
        accountLinkStatus: dto.accountLinkStatus,
        linkSessionKey: dto.linkSessionKey,
        linkExpiresAt: dto.linkExpiresAt,
        linkedUserRef: dto.linkedUserRef,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      const status = resolveSessionErrorStatus(error);
      return NextResponse.json({ success: false, error: error.message }, { status });
    }
    return NextResponse.json({ success: false, error: 'Unable to load account link status' }, { status: 500 });
  }
}

'use server';

import { NextRequest, NextResponse } from 'next/server';

import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import {
  fetchLinkSessionDetails,
  getSessionDtoFromRequest,
  resolveSessionErrorStatus,
} from '@/lib/session/session.server';

export async function handleAccountLinkStatusGet(request: NextRequest): Promise<NextResponse> {
  try {
    const dto = getSessionDtoFromRequest(request);
    if (!dto) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    // Fetch current status from remote API if we have a linkSessionKey
    // This allows the client to sync with the remote state
    let accountLinkStatus = dto.accountLinkStatus;
    let linkedUserRef = dto.linkedUserRef;

    if (dto.linkSessionKey) {
      try {
        const details = await fetchLinkSessionDetails(dto.linkSessionKey);
        if (details) {
          // Update status based on whether userRef exists
          if (details.userRef) {
            // If remote has userRef, account is linked
            accountLinkStatus = ACCOUNT_LINK_STATUS.Linked;
            linkedUserRef = details.userRef;
          } else if (accountLinkStatus !== ACCOUNT_LINK_STATUS.Linked) {
            // If no userRef and not already Linked, status should be Started
            accountLinkStatus = ACCOUNT_LINK_STATUS.Started;
            linkedUserRef = undefined;
          }
          // If already Linked but remote has no userRef, keep Linked status
          // (might be in transition or remote state is stale)
        }
      } catch (error) {
        // If fetch fails, return current session state
        console.warn('Failed to fetch link session details', error);
      }
    }

    // Return current status (fetched from remote if available)
    // Server doesn't store session state - client will update localStorage
    return NextResponse.json({
      success: true,
      data: {
        accountLinkStatus,
        linkSessionKey: dto.linkSessionKey,
        linkExpiresAt: dto.linkExpiresAt,
        linkedUserRef,
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

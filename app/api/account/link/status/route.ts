import { NextRequest, NextResponse } from 'next/server';

import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import { getOncadeIntegrationConfig } from '@/lib/env/config.server';
import {
  getSessionDto,
  requireSessionFromRequest,
  resolveSessionErrorStatus,
  setAccountLinkStatus,
} from '@/lib/session/session.server';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const record = requireSessionFromRequest(request);
    let dto = getSessionDto(record.id);
    if (!dto) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }

    if (dto.linkSessionKey) {
      try {
        const { apiBaseUrl } = getOncadeIntegrationConfig();
        const trimmedBaseUrl = apiBaseUrl.replace(/\/$/, '');
        const response = await fetch(
          `${trimmedBaseUrl}/api/v1/users/link/details?session=${encodeURIComponent(dto.linkSessionKey)}`,
        );

        if (response.ok) {
          const data = (await response.json()) as { userRef?: string | null };
          const remoteUserRef = data?.userRef ?? null;
          const resolvedStatus =
            data && typeof data === 'object' && data.userRef && data.userRef !== 'null'
              ? ACCOUNT_LINK_STATUS.Linked
              : ACCOUNT_LINK_STATUS.Started;
          if (resolvedStatus !== dto.accountLinkStatus) {
            dto = setAccountLinkStatus(record.id, resolvedStatus, {
              sessionKey: dto.linkSessionKey,
              preserveMapping: true,
              userRef: remoteUserRef,
            });
          } else if (remoteUserRef && remoteUserRef !== dto.linkedUserRef) {
            dto = setAccountLinkStatus(record.id, dto.accountLinkStatus, {
              sessionKey: dto.linkSessionKey,
              preserveMapping: true,
              userRef: remoteUserRef,
            });
          }
        } else if (response.status === 404 || response.status === 410) {
          if (dto.accountLinkStatus !== ACCOUNT_LINK_STATUS.Canceled) {
            dto = setAccountLinkStatus(record.id, ACCOUNT_LINK_STATUS.Canceled, {
              sessionKey: dto.linkSessionKey,
              preserveMapping: true,
              userRef: null,
            });
          }
        }
      } catch (fetchError) {
        console.error('Failed to resolve account link status', fetchError);
      }
    }

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

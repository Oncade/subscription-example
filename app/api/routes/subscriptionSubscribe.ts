'use server';

import { NextRequest, NextResponse } from 'next/server';

import { getOncadeIntegrationConfig } from '@/lib/env/config.server';
import { resolveDemoPlanConfig } from '@/lib/env/planConfig.server';
import { resolveSessionErrorStatus } from '@/lib/session/session.server';
import { HEADER_API_VERSION, HEADER_AUTHORIZATION, HEADER_GAME_ID, ONCADE_API_VERSION_HEADER_VALUE } from '@/lib/constants';
import { CheckoutRedirectError } from '@/lib/errors/checkoutRedirectError';
import { requestCheckoutRedirect, sanitizeRedirectUrl } from '@/lib/subscription/checkoutRedirect.server';
import { parseSubscribeRequestBody } from '@/lib/subscription/subscribeRequest.server';

const HTTP_STATUS_BAD_REQUEST = 400;
const HTTP_STATUS_INTERNAL_ERROR = 500;

export async function handleSubscriptionSubscribePost(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await parseSubscribeRequestBody(request);
    const safeRedirectUrl = sanitizeRedirectUrl(body.redirectUrl);

    const { apiBaseUrl, serverApiKey, gameId } = getOncadeIntegrationConfig();
    const plan = await resolveDemoPlanConfig({ forceRefresh: true });

    if (!plan.itemId) {
      throw new CheckoutRedirectError(
        'Subscription plan configuration missing checkout item identifier',
        HTTP_STATUS_INTERNAL_ERROR,
      );
    }

    const redirectTarget = await requestCheckoutRedirect(
      apiBaseUrl,
      {
        [HEADER_AUTHORIZATION]: `Bearer ${serverApiKey}`,
        [HEADER_API_VERSION]: ONCADE_API_VERSION_HEADER_VALUE,
        [HEADER_GAME_ID]: gameId,
      },
      gameId,
      plan.itemId,
      safeRedirectUrl,
    );

    return NextResponse.json({
      success: true,
      data: {
        redirectUrl: redirectTarget,
      },
    });
  } catch (error) {
    if (error instanceof CheckoutRedirectError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    if (error instanceof Error) {
      const status = resolveSessionErrorStatus(error, HTTP_STATUS_BAD_REQUEST);
      return NextResponse.json({ success: false, error: error.message }, { status });
    }
    return NextResponse.json(
      { success: false, error: 'Unable to trigger subscription' },
      { status: HTTP_STATUS_INTERNAL_ERROR },
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

import { SESSION_HEADER } from '@/lib/constants';
import {
  createDemoSession,
  getSessionDto,
  requireSessionFromRequest,
  SESSION_ERROR_MISSING_IDENTIFIER,
  SESSION_ERROR_UNKNOWN_IDENTIFIER,
} from '@/lib/session/session.server';
import { sessionInvalidResponse } from '@/lib/session/sessionApi.helpers';
import type { CreateSessionBody } from '@/lib/session/sessionApi.types';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Partial<CreateSessionBody> | undefined;
  try {
    body = (await request.json()) as Partial<CreateSessionBody>;
  } catch (error) {
    if (error instanceof SyntaxError) {
      return sessionInvalidResponse('Request body must be valid JSON.', 400);
    }
    throw error;
  }

  if (!body?.email || typeof body.email !== 'string') {
    return sessionInvalidResponse('Email is required to sign in.');
  }

  const session = createDemoSession(body.email.trim().toLowerCase());
  return NextResponse.json(
    { success: true, data: session },
    {
      status: 201,
      headers: {
        Location: `/api/session`,
        [SESSION_HEADER]: session.id,
      },
    },
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const record = requireSessionFromRequest(request);
    const dto = getSessionDto(record.id);
    if (!dto) {
      return sessionInvalidResponse('Session not found', 404);
    }

    return NextResponse.json({ success: true, data: dto });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === SESSION_ERROR_MISSING_IDENTIFIER) {
        return sessionInvalidResponse('Provide session header for lookup', 401);
      }
      if (error.message === SESSION_ERROR_UNKNOWN_IDENTIFIER) {
        return sessionInvalidResponse('Session not found', 404);
      }
      return sessionInvalidResponse(error.message, 500);
    }
    return sessionInvalidResponse('Unexpected error', 500);
  }
}

export const dynamic = 'force-dynamic';

export function OPTIONS(): NextResponse {
  return NextResponse.json(
    { success: true },
    {
      headers: {
        'Access-Control-Expose-Headers': SESSION_HEADER,
      },
    },
  );
}

import 'server-only';

import { NextResponse } from 'next/server';

export function sessionInvalidResponse(message: string, status = 400): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status });
}

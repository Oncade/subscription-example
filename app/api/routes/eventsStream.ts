'use server';

import { NextResponse } from 'next/server';

import { createDemoEventStream } from '@/lib/events/eventStream.server';

export async function handleEventsStreamGet(): Promise<Response> {
  const stream = createDemoEventStream();
  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

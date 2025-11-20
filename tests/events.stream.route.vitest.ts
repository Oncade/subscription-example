import { describe, expect, it, vi } from 'vitest';

import { handleEventsStreamGet } from '@/app/api/routes/eventsStream';
import { ACCOUNT_LINK_STATUS } from '@/lib/accountLink/accountLink.types';
import * as eventBus from '@/lib/events/eventBus.server';
import { DEMO_EVENT_TYPE } from '@/lib/events/eventBus.constants';
import type { DemoEvent } from '@/lib/events/eventBus.types';
import { SUBSCRIPTION_STATUS } from '@/lib/subscription/subscription.types';

const decoder = new TextDecoder();

function decodeChunk(chunk?: Uint8Array): string {
  if (!chunk) {
    throw new Error('Missing SSE chunk payload.');
  }
  return decoder.decode(chunk);
}

function extractDataPayload(message: string): unknown {
  const dataLine = message
    .split('\n')
    .find((line) => line.startsWith('data: '));

  if (!dataLine) {
    throw new Error(`Missing data line in SSE message: ${message}`);
  }

  const jsonPayload = dataLine.replace(/^data:\s*/, '');
  return JSON.parse(jsonPayload);
}

describe('GET /api/events/stream', () => {
  it('emits the ready signal, forwards demo events, and streams heartbeat pings', async () => {
    vi.useFakeTimers();
    const response = await handleEventsStreamGet();

    try {
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('text/event-stream');
      expect(response.headers.get('cache-control')).toBe('no-cache, no-transform');
      expect(response.headers.get('connection')).toBe('keep-alive');

      const reader = response.body?.getReader();
      expect(reader).toBeTruthy();
      if (!reader) {
        throw new Error('Readable stream not available.');
      }

      const openChunk = await reader.read();
      expect(openChunk.done).toBe(false);
      const openText = decodeChunk(openChunk.value);
      expect(openText).toContain('event: open');
      expect(extractDataPayload(openText)).toBe('ready');

      const demoEvent: DemoEvent = {
        type: DEMO_EVENT_TYPE.SessionUpdated,
        payload: {
          id: 'demo-session',
          createdAt: new Date().toISOString(),
          email: 'demo@example.com',
          accountLinkStatus: ACCOUNT_LINK_STATUS.Linked,
          subscriptionStatus: SUBSCRIPTION_STATUS.Active,
        },
      };

      const eventReadPromise = reader.read();
      eventBus.emitDemoEvent(demoEvent);

      const eventChunk = await eventReadPromise;
      expect(eventChunk.done).toBe(false);
      const eventText = decodeChunk(eventChunk.value);
      expect(extractDataPayload(eventText)).toEqual(demoEvent);

      const pingPromise = reader.read();
      await vi.advanceTimersByTimeAsync(30_000);

      const pingChunk = await pingPromise;
      expect(pingChunk.done).toBe(false);
      const pingText = decodeChunk(pingChunk.value);
      expect(pingText).toContain('event: ping');
      const pingPayload = extractDataPayload(pingText);
      expect(typeof pingPayload).toBe('string');
      expect((pingPayload as string).length).toBeGreaterThan(0);

      await reader.cancel();
    } finally {
      vi.useRealTimers();
    }
  });

  it('cleans up the event bus subscription when the stream is canceled', async () => {
    const unsubscribe = vi.fn();
    const subscribeSpy = vi.spyOn(eventBus, 'subscribeToDemoEvents').mockReturnValue(unsubscribe);

    const response = await handleEventsStreamGet();
    expect(subscribeSpy).toHaveBeenCalledTimes(1);

    const reader = response.body?.getReader();
    expect(reader).toBeTruthy();
    if (!reader) {
      throw new Error('Readable stream not available for cancellation.');
    }

    await reader.cancel();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

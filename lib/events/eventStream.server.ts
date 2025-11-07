import 'server-only';

import { subscribeToDemoEvents } from '@/lib/events/eventBus.server';
import type { DemoEvent } from '@/lib/events/eventBus.types';

const encoder = new TextEncoder();

function formatEvent(event: DemoEvent): Uint8Array {
  const payload = JSON.stringify(event);
  return encoder.encode(`data: ${payload}\n\n`);
}

export function createDemoEventStream(): ReadableStream<Uint8Array> {
  let cleanup: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let pingInterval: ReturnType<typeof setInterval> | null = null;
      let unsubscribe: () => void = () => {};

      const performCleanup = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        try {
          unsubscribe();
        } catch {
          // ignore unsubscribe errors during cleanup
        }
        try {
          controller.close();
        } catch {
          // controller might already be closed or in errored state
        }
        cleanup = null;
      };

      cleanup = performCleanup;

      controller.enqueue(encoder.encode('event: open\ndata: "ready"\n\n'));

      unsubscribe = subscribeToDemoEvents((event) => {
        if (!closed) {
          try {
            controller.enqueue(formatEvent(event));
          } catch {
            performCleanup();
          }
        }
      });

      const interval = setInterval(() => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(`event: ping\ndata: "${Date.now()}"\n\n`));
        } catch {
          performCleanup();
        }
      }, 30_000);
      pingInterval = interval;
    },
    cancel() {
      cleanup?.();
    },
  });

  return stream;
}

import 'server-only';

import type { DemoEvent } from '@/lib/events/eventBus.types';

const encoder = new TextEncoder();

type StreamController = ReadableStreamDefaultController<Uint8Array>;

const GLOBAL_KEY = Symbol.for('subscription.demo.eventStream.clients');

type GlobalWithStreams = typeof globalThis & {
  [GLOBAL_KEY]?: Set<StreamController>;
};

const globalWithStreams = globalThis as GlobalWithStreams;

if (!globalWithStreams[GLOBAL_KEY]) {
  globalWithStreams[GLOBAL_KEY] = new Set<StreamController>();
}

const connectedClients = globalWithStreams[GLOBAL_KEY]!;

function formatEvent(event: DemoEvent): Uint8Array {
  const payload = JSON.stringify(event);
  return encoder.encode(`data: ${payload}\n\n`);
}

export function pushEventToClients(event: DemoEvent): void {
  const deadClients: StreamController[] = [];
  
  connectedClients.forEach((controller) => {
    try {
      controller.enqueue(formatEvent(event));
    } catch {
      // Client disconnected or errored
      deadClients.push(controller);
    }
  });

  // Clean up dead clients
  deadClients.forEach((client) => {
    connectedClients.delete(client);
  });
}

export function createDemoEventStream(): ReadableStream<Uint8Array> {
  let cleanup: (() => void) | null = null;
  let streamController: StreamController | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      let closed = false;
      let pingInterval: ReturnType<typeof setInterval> | null = null;

      // Add this client to connected clients
      connectedClients.add(controller);

      const performCleanup = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        // Remove from connected clients
        connectedClients.delete(controller);
        try {
          controller.close();
        } catch {
          // controller might already be closed or in errored state
        }
        cleanup = null;
        streamController = null;
      };

      cleanup = performCleanup;

      controller.enqueue(encoder.encode('event: open\ndata: "ready"\n\n'));

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
      if (streamController) {
        connectedClients.delete(streamController);
      }
      cleanup?.();
    },
  });

  return stream;
}

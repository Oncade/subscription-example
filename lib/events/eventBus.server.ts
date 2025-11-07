import 'server-only';

import type { DemoEvent, DemoEventListener } from './eventBus.types';

interface EventBusInternal {
  readonly subscribe: (listener: DemoEventListener) => () => void;
  readonly emit: (event: DemoEvent) => void;
}

const GLOBAL_KEY = Symbol.for('subscription.demo.eventBus');

type GlobalWithBus = typeof globalThis & {
  [GLOBAL_KEY]?: EventBusInternal;
};

function createEventBus(): EventBusInternal {
  let counter = 0;
  const listeners = new Map<number, DemoEventListener>();

  const subscribe = (listener: DemoEventListener) => {
    const id = counter++;
    listeners.set(id, listener);
    return () => {
      listeners.delete(id);
    };
  };

  const emit = (event: DemoEvent) => {
    listeners.forEach((listener) => {
      listener(event);
    });
  };

  return { subscribe, emit };
}

const globalWithBus = globalThis as GlobalWithBus;

if (!globalWithBus[GLOBAL_KEY]) {
  globalWithBus[GLOBAL_KEY] = createEventBus();
}

const eventBus = globalWithBus[GLOBAL_KEY]!;

export function subscribeToDemoEvents(listener: DemoEventListener): () => void {
  return eventBus.subscribe(listener);
}

export function emitDemoEvent(event: DemoEvent): void {
  eventBus.emit(event);
}

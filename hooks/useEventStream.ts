'use client';

import { useEffect } from 'react';

import { DEMO_EVENT_STREAM_URL } from '@/lib/constants';
import type { DemoEvent } from '@/lib/events/eventBus.types';

export function useEventStream(enabled: boolean, onEvent: (event: DemoEvent) => void): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const source = new EventSource(DEMO_EVENT_STREAM_URL);

    source.onmessage = (event) => {
      try {
        const payload: DemoEvent = JSON.parse(event.data) as DemoEvent;
        onEvent(payload);
      } catch (error) {
        console.error('Failed to parse demo event', error);
      }
    };

    source.onerror = (event) => {
      console.warn('Demo event stream error', event);
    };

    return () => {
      source.close();
    };
  }, [enabled, onEvent]);
}

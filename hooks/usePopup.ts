'use client';

import { useCallback } from 'react';

import {
  POPUP_DEFAULT_FEATURES,
  POPUP_DEFAULT_HEIGHT,
  POPUP_DEFAULT_WIDTH,
} from '@/lib/popup/popup.constants';
import type { PopupLaunchOptions, PopupLaunchResult } from '@/lib/popup/popup.types';

const TOP_LEFT_MIN_VALUE = 0;

const DEFAULT_TARGET = '_blank' as const;

const WINDOW_COORD_FALLBACK = 0;

export function usePopup() {
  const openPopup = useCallback(
    ({ url, target = DEFAULT_TARGET, width, height, features, focus = true }: PopupLaunchOptions): PopupLaunchResult => {
      if (typeof window === 'undefined') {
        return { popup: null, blocked: true };
      }

      const popupWidth = width ?? POPUP_DEFAULT_WIDTH;
      const popupHeight = height ?? POPUP_DEFAULT_HEIGHT;

      const left =
        Math.max(
          Math.round(
            (window.screenX ?? window.screenLeft ?? WINDOW_COORD_FALLBACK) +
              ((window.outerWidth ?? popupWidth) - popupWidth) / 2,
          ),
          TOP_LEFT_MIN_VALUE,
        ) || TOP_LEFT_MIN_VALUE;

      const top =
        Math.max(
          Math.round(
            (window.screenY ?? window.screenTop ?? WINDOW_COORD_FALLBACK) +
              ((window.outerHeight ?? popupHeight) - popupHeight) / 2,
          ),
          TOP_LEFT_MIN_VALUE,
        ) || TOP_LEFT_MIN_VALUE;

      const popupFeatures = `${features ?? POPUP_DEFAULT_FEATURES},width=${popupWidth},height=${popupHeight},left=${left},top=${top}`;

      const popup = window.open(url, target, popupFeatures);

      if (!popup) {
        return { popup: null, blocked: true };
      }

      try {
        popup.opener = null;
      } catch {
        // Some browsers throw if the window is cross-origin. Ignore safely.
      }

      if (focus && typeof popup.focus === 'function') {
        popup.focus();
      }

      return { popup, blocked: false };
    },
    [],
  );

  return { openPopup };
}

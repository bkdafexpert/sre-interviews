'use client';

import { useCallback, useRef, useState } from 'react';
import { shortUrlAbsolute } from './format';

// Tracks which code was most recently copied, resetting after a short delay — matches the
// design's momentary "Copié !" affirmation. Copies the branded short URL (https://<domain>/<code>).
export function useCopy(resetMs = 1600) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    (code: string) => {
      const text = shortUrlAbsolute(code);
      try {
        void navigator.clipboard?.writeText(text);
      } catch {
        /* clipboard unavailable (e.g. non-secure context) — still show the affirmation */
      }
      setCopiedCode(code);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopiedCode(null), resetMs);
    },
    [resetMs],
  );

  return { copiedCode, copy };
}

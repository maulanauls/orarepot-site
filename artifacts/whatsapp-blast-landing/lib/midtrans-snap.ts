'use client';

import {
  midtransClientKey,
  midtransSnapScriptUrl,
  type MidtransSnap,
} from '@/lib/midtrans';

declare global {
  interface Window {
    snap?: MidtransSnap;
  }
}

function findSnapScript() {
  return document.querySelector<HTMLScriptElement>('script[data-midtrans-snap]');
}

export function loadMidtransSnap(): Promise<MidtransSnap> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Snap is browser-only'));
  }
  if (window.snap) return Promise.resolve(window.snap);
  if (!midtransClientKey) {
    return Promise.reject(new Error('NEXT_PUBLIC_MIDTRANS_CLIENT_KEY is not set'));
  }

  return new Promise((resolve, reject) => {
    const existing = findSnapScript();
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.snap) resolve(window.snap);
        else reject(new Error('snap.js loaded without window.snap'));
      });
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Midtrans snap.js')),
      );
      return;
    }

    const script = document.createElement('script');
    script.src = midtransSnapScriptUrl();
    script.async = true;
    script.setAttribute('data-client-key', midtransClientKey);
    script.setAttribute('data-midtrans-snap', 'true');
    script.onload = () => {
      if (window.snap) resolve(window.snap);
      else reject(new Error('snap.js loaded without window.snap'));
    };
    script.onerror = () => reject(new Error('Failed to load Midtrans snap.js'));
    document.head.appendChild(script);
  });
}

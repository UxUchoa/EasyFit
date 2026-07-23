'use client';

import { useEffect } from 'react';

export function SessionRotation() {
  useEffect(() => {
    const rotate = () => { void fetch('/api/auth/rotate', { method: 'POST' }).catch(() => undefined); };
    queueMicrotask(rotate);
    const interval = window.setInterval(rotate, 15 * 60_000);
    return () => window.clearInterval(interval);
  }, []);
  return null;
}

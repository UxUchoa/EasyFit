'use client';

import { useEffect } from 'react';

let rotationRequest: Promise<void> | null = null;

function rotateSession() {
  if (rotationRequest) return rotationRequest;
  rotationRequest = fetch('/api/auth/rotate', { method: 'POST' })
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => { rotationRequest = null; });
  return rotationRequest;
}

export function SessionRotation() {
  useEffect(() => {
    // Wait until hydration and the initial RSC requests have settled before
    // invalidating the previous token. This also survives React Strict Mode
    // without issuing concurrent rotations in development.
    const initial = window.setTimeout(() => { void rotateSession(); }, 750);
    const interval = window.setInterval(() => { void rotateSession(); }, 15 * 60_000);
    return () => { window.clearTimeout(initial); window.clearInterval(interval); };
  }, []);
  return null;
}

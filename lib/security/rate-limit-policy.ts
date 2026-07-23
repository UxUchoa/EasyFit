export type RateLimitState = { attempts: number; resetAt: Date };

export function nextRateLimitState(current: RateLimitState | null, now: Date, windowMs: number) {
  if (!current || current.resetAt <= now) return { attempts: 1, resetAt: new Date(now.getTime() + windowMs) };
  return { attempts: current.attempts + 1, resetAt: current.resetAt };
}

export function rateLimitDecision(state: RateLimitState, now: Date, maxAttempts: number) {
  const allowed = state.attempts <= maxAttempts;
  return { allowed, retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((state.resetAt.getTime() - now.getTime()) / 1000)) };
}

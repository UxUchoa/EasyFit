import type { NextRequest } from "next/server";

export function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET" || request.method === "HEAD";

  // Trust the public origin that actually received the request. This keeps
  // same-origin mutations working for Vercel aliases without trusting a
  // different website.
  const allowedOrigins = new Set<string>([request.nextUrl.origin]);
  for (const value of [process.env.APP_URL, ...(process.env.ALLOWED_ORIGINS?.split(",") ?? [])]) {
    if (!value?.trim()) continue;
    try { allowedOrigins.add(new URL(value.trim()).origin); } catch { /* Ignore malformed deployment configuration. */ }
  }
  if (process.env.VERCEL_URL) allowedOrigins.add(`https://${process.env.VERCEL_URL}`);

  return allowedOrigins.has(origin);
}

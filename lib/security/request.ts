import type { NextRequest } from "next/server";

export function hasTrustedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET" || request.method === "HEAD";

  const allowedOrigins = new Set<string>();
  for (const value of [process.env.APP_URL, ...(process.env.ALLOWED_ORIGINS?.split(",") ?? [])]) {
    if (!value?.trim()) continue;
    try { allowedOrigins.add(new URL(value.trim()).origin); } catch { /* Ignore malformed deployment configuration. */ }
  }
  if (process.env.VERCEL_URL) allowedOrigins.add(`https://${process.env.VERCEL_URL}`);
  if (process.env.NODE_ENV !== "production") allowedOrigins.add(request.nextUrl.origin);

  return allowedOrigins.has(origin);
}

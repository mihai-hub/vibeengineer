/**
 * VibeEngineer Rate Limiter — Next.js Middleware
 *
 * IP-based rate limiting using in-memory Map (per-instance, no Redis needed).
 * Works on Cloud Run — prevents single-instance hammering.
 *
 * Limits:
 *   /api/vibe    → 10 req/min (anonymous), unlimited if has session cookie
 *   /api/vibe/*  → same
 *   everything else → pass through
 */

import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/api/vibe', '/api/vibe/:path*'],
};

// In-memory store: IP → { count, windowStart }
// On Cloud Run, each instance has its own counter — good enough for abuse prevention
const store = new Map<string, { count: number; windowStart: number }>();
const WINDOW_MS  = 60_000; // 1 minute
const ANON_LIMIT = 10;     // anonymous users
const AUTH_LIMIT = 60;     // authenticated users (Supabase session)

// SSE paths — don't rate-limit the streaming itself, only the initial POST
const SSE_STREAM_PATHS = ['/api/vibe'];

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

function isAuthenticated(req: NextRequest): boolean {
  // Supabase sets sb-* cookies on login
  const cookies = req.cookies;
  return (
    !!cookies.get('sb-access-token') ||
    !!cookies.get('supabase-auth-token') ||
    // Also check for sb- prefixed session cookies (Supabase v2 format)
    Array.from(cookies.getAll()).some(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))
  );
}

export function middleware(req: NextRequest): NextResponse {
  // Only rate-limit POST requests (GET is health/status)
  if (req.method !== 'POST') return NextResponse.next();

  const ip    = getIp(req);
  const authed = isAuthenticated(req);
  const limit  = authed ? AUTH_LIMIT : ANON_LIMIT;
  const now    = Date.now();

  // Clean up expired windows periodically (every 1000 requests)
  if (store.size > 1000) {
    for (const [key, val] of store) {
      if (now - val.windowStart > WINDOW_MS) store.delete(key);
    }
  }

  const entry = store.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    store.set(ip, { count: 1, windowStart: now });
    return NextResponse.next();
  }

  entry.count += 1;

  if (entry.count > limit) {
    const retryAfter = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000);
    return new NextResponse(
      JSON.stringify({ error: 'Too many requests. Slow down.', retryAfter }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  return NextResponse.next();
}

import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, SESSION_TTL_SEC, checkCredentials, createSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Simple per-IP brake on password guessing: 10 failures per 15 minutes.
const MAX_FAILS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const fails = new Map<string, { count: number; reset: number }>();

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.ip || 'unknown';
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const now = Date.now();
  const f = fails.get(ip);
  if (f && f.reset > now && f.count >= MAX_FAILS) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a few minutes.' }, { status: 429 });
  }

  let body: { username?: string; password?: string } = {};
  try { body = await req.json(); } catch { /* empty body -> fails below */ }
  const user = (body.username || '').trim();

  if (!user || !body.password || !(await checkCredentials(user, body.password))) {
    const cur = f && f.reset > now ? f : { count: 0, reset: now + WINDOW_MS };
    cur.count++;
    fails.set(ip, cur);
    return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 });
  }

  fails.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.headers.get('x-forwarded-proto') === 'https',
    path: process.env.NEXT_PUBLIC_BASE_PATH || '/',
    maxAge: SESSION_TTL_SEC,
  });
  return res;
}

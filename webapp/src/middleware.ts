import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

// Every page and API route needs a session, except the login screen itself.
// Paths here are relative to basePath (/dashboard).
const PUBLIC = ['/login', '/api/auth/login', '/api/auth/logout'];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC.includes(pathname)) return NextResponse.next();
  if (await verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // '/' is listed on its own: with basePath, the catch-all pattern does not
  // match the bare /dashboard URL (the Overview page).
  matcher: ['/', '/((?!_next/static|_next/image|favicon.ico).*)'],
};

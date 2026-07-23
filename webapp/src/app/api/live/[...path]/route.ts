import { NextRequest, NextResponse } from 'next/server';

const SF   = (process.env.SFLOWRT_URL || 'http://localhost:8008').replace(/\/$/, '');
const USER = process.env.SFLOWRT_USER || '';
const PASS = process.env.SFLOWRT_PASS || '';

const ALLOW = ['agents','metrics','metric','activeflows','dump','events','flows','flow','threshold','version','analyzer'];

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const seg = params.path || [];
  if (!seg.length || !ALLOW.includes(seg[0])) {
    return NextResponse.json({ error: 'path not allowed' }, { status: 403 });
  }
  const qs  = req.nextUrl.search;
  const url = `${SF}/${seg.join('/')}${qs}`;
  const headers: Record<string, string> = {};
  if (USER) headers['Authorization'] = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');

  try {
    const r    = await fetch(url, { headers, cache: 'no-store' });
    const text = await r.text();
    const ct   = r.headers.get('content-type') || 'application/json';
    return new NextResponse(text, { status: r.status, headers: { 'content-type': ct } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

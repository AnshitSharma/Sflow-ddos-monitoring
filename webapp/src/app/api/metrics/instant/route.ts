import { NextRequest, NextResponse } from 'next/server';

const PROM = process.env.PROM_URL || 'http://prometheus:9090';
const PROM_USER = process.env.PROM_USER || '';
const PROM_PASS = process.env.PROM_PASS || '';

function authHeaders(): Record<string, string> {
  if (!PROM_USER) return {};
  return { Authorization: 'Basic ' + Buffer.from(`${PROM_USER}:${PROM_PASS}`).toString('base64') };
}

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('query');
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });
  try {
    const r = await fetch(`${PROM}/api/v1/query?` + new URLSearchParams({ query }), { cache: 'no-store', headers: authHeaders() });
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

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
  const sp = req.nextUrl.searchParams;
  const query = sp.get('query');
  if (!query) return NextResponse.json({ error: 'query required' }, { status: 400 });

  const now = Math.floor(Date.now() / 1000);
  const start = sp.get('start') || String(now - 3600);
  const end   = sp.get('end')   || String(now);
  const step  = sp.get('step')  || '30';

  const url = `${PROM}/api/v1/query_range?` + new URLSearchParams({ query, start, end, step });
  try {
    const r = await fetch(url, { cache: 'no-store', headers: authHeaders() });
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

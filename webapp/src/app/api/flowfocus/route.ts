import { NextRequest, NextResponse } from 'next/server';

// Defines the live-flow definitions the Flow Explorer queries. sFlow-RT cannot
// filter /activeflows at query time, so click-to-filter works by baking the filter
// into a focus flow definition here (mirrors sFlow-RT's own browse-flows tool).
const SF   = (process.env.SFLOWRT_URL || 'http://localhost:8008').replace(/\/$/, '');
const USER = process.env.SFLOWRT_USER || '';
const PASS = process.env.SFLOWRT_PASS || '';

export const dynamic = 'force-dynamic';

const BASE_DEF = { keys: 'ipsource,ipdestination', value: 'bytes', t: 5, n: 50, activeTimeout: 60 };

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (USER) h['Authorization'] = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');
  return h;
}

function putFlow(name: string, body: object) {
  return fetch(`${SF}/flow/${name}/json`, { method: 'PUT', headers: headers(), body: JSON.stringify(body), cache: 'no-store' });
}

// Allow only filter-expression characters (no shell/JSON breakers). sFlow-RT
// filter syntax: field=value joined by & | with : . , ! ~ - and spaces.
function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_.:=&|!~,\- ]/g, '').slice(0, 200);
}

export async function POST(req: NextRequest) {
  let filter = '';
  try { const j = await req.json(); filter = typeof j?.filter === 'string' ? sanitize(j.filter) : ''; } catch { /* empty ok */ }

  try {
    // Ensure the base flow exists (resilient to a sFlow-RT restart).
    await putFlow('ip_pairs', BASE_DEF);
    if (filter) await putFlow('ip_pairs_focus', { ...BASE_DEF, filter });
    return NextResponse.json({ ok: true, filter });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

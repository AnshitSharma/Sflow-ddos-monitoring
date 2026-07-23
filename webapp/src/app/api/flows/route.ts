import { NextRequest, NextResponse } from 'next/server';

const OS = process.env.OPENSEARCH_URL || 'http://opensearch:9200';

export const dynamic = 'force-dynamic';

interface FlowQuery {
  text?: string;
  name?: string;
  agent?: string;
  fromISO?: string;
  toISO?: string;
  size?: number;
}

export async function POST(req: NextRequest) {
  let q: FlowQuery = {};
  try { q = await req.json(); } catch { /* empty body ok */ }

  const must: unknown[] = [];
  if (q.name)  must.push({ term: { name: q.name } });
  if (q.agent) must.push({ term: { agent: q.agent } });
  if (q.text)  must.push({ multi_match: { query: q.text, fields: ['keys', 'flowKeys'] } });
  if (q.fromISO || q.toISO) {
    must.push({ range: { '@timestamp': { gte: q.fromISO || 'now-7d', lte: q.toISO || 'now' } } });
  }

  const dsl = {
    size: Math.min(q.size ?? 100, 1000),
    sort: [{ '@timestamp': 'desc' }],
    query: must.length ? { bool: { must } } : { match_all: {} },
  };

  try {
    const r = await fetch(`${OS}/sflow-flows-*/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dsl),
      cache: 'no-store',
    });
    const body = await r.json();
    const hits = (body?.hits?.hits ?? []).map((h: { _source: unknown }) => h._source);
    return NextResponse.json({ total: body?.hits?.total?.value ?? 0, rows: hits }, { status: r.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}

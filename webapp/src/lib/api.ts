import type { Series, FlowRow, FlowKeyRow, DdosEvent, TopRow, Agent, PromMatrixResult, PromVectorResult } from './types';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || '';

export async function queryRange(
  promql: string, startSec: number, endSec: number, stepSec = 30,
): Promise<PromMatrixResult[]> {
  const u = `${BASE}/api/metrics?` + new URLSearchParams({
    query: promql, start: String(startSec), end: String(endSec), step: String(stepSec),
  });
  const r = await fetch(u);
  const j = await r.json();
  return j?.data?.result ?? [];
}

export async function queryInstant(promql: string): Promise<PromVectorResult[]> {
  const u = `${BASE}/api/metrics/instant?` + new URLSearchParams({ query: promql });
  const r = await fetch(u);
  const j = await r.json();
  return j?.data?.result ?? [];
}

/** Convert an instant vector (e.g. topk(...) by label) into ranked TopRows. */
export function vectorToTopRows(results: PromVectorResult[], labelKey: string): TopRow[] {
  const rows = results.map(r => ({
    key: r.metric[labelKey] ?? r.metric.__name__ ?? '?',
    label: r.metric[labelKey] ?? '(unlabeled)',
    bps: parseFloat(r.value[1]),
    pct: 0,
  })).filter(r => Number.isFinite(r.bps));
  const total = rows.reduce((a, b) => a + b.bps, 0) || 1;
  rows.forEach(r => { r.pct = (r.bps / total) * 100; });
  return rows.sort((a, b) => b.bps - a.bps);
}

/** sFlow-RT /agents/json is an object keyed by agent IP — map it to Agent[]. */
export function parseAgents(raw: unknown): Agent[] {
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw as Record<string, Record<string, number | number[]>>).map(([ip, a]) => {
    const recv = Number(a.sFlowDatagramsReceived ?? 0);
    const lost = Number(a.sFlowDatagramsLost ?? 0);
    const lastSeen = Number(a.lastSeen ?? 0); // ms since last datagram
    return {
      ip,
      name: ip,
      up: lastSeen < 60000, // seen within the last minute
      datagramsReceived: recv,
      datagramsLost: lost,
      lostPct: recv + lost > 0 ? (lost / (recv + lost)) * 100 : 0,
      uptimeMs: Number(a.uptime ?? 0),
    };
  });
}

export async function searchFlows(body: object): Promise<{ total: number; rows: FlowRow[] }> {
  const r = await fetch(`${BASE}/api/flows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

export async function live<T = unknown>(path: string): Promise<T> {
  const r = await fetch(`${BASE}/api/live/${path}`);
  if (!r.ok) throw new Error(`live ${path} → ${r.status}`);
  return r.json();
}

type RawActiveFlow = { agent?: string; value?: number; key?: string; dataSource?: string };

/**
 * Live top talkers from sFlow-RT /activeflows for a flow keyed `ipsource,ipdestination`.
 * Value is bytes/sec → ×8 for bps (same convention as the interface octet metrics).
 * Tolerant: returns [] on any error (e.g. focus flow not defined yet).
 */
export async function activeFlows(name: string, maxFlows = 30): Promise<FlowKeyRow[]> {
  try {
    const r = await fetch(`${BASE}/api/live/activeflows/ALL/${name}/json?maxFlows=${maxFlows}`, { cache: 'no-store' });
    if (!r.ok) return [];
    const raw: RawActiveFlow[] = await r.json();
    if (!Array.isArray(raw)) return [];
    return raw.map(f => {
      const parts = (f.key ?? '').split(',');
      return {
        agent: f.agent ?? '',
        ipsource: parts[0] ?? '',
        ipdestination: parts[1] ?? '',
        key: f.key ?? '',
        bps: (Number(f.value) || 0) * 8,
      };
    });
  } catch { return []; }
}

/** (Re)bake a filter into the ip_pairs_focus flow (and ensure the base ip_pairs flow). */
export async function setFlowFocus(filter: string): Promise<void> {
  try {
    await fetch(`${BASE}/api/flowfocus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filter }),
    });
  } catch { /* best-effort */ }
}

type RawEvent = { agent?: string; metric?: string; thresholdID?: string; flowKey?: string; value?: number; threshold?: number; timestamp?: number };

/** Live DDoS detections from sFlow-RT /events (ddos-protect thresholds, byFlow:true). */
export async function flowEvents(maxEvents = 50): Promise<DdosEvent[]> {
  try {
    const r = await fetch(`${BASE}/api/live/events/json?maxEvents=${maxEvents}`, { cache: 'no-store' });
    if (!r.ok) return [];
    const raw: RawEvent[] = await r.json();
    if (!Array.isArray(raw)) return [];
    return raw.map(e => {
      const fk = String(e.flowKey ?? '');
      const value = Number(e.value) || 0;
      const thr = Number(e.threshold) || 0;
      const ratio = thr > 0 ? value / thr : 1;
      const severity: DdosEvent['severity'] = ratio >= 3 ? 'high' : ratio >= 1.5 ? 'med' : 'low';
      return {
        agent: String(e.agent ?? ''),
        type: String(e.metric ?? e.thresholdID ?? ''),
        thresholdID: String(e.thresholdID ?? ''),
        target: fk.split(',')[0] || '',
        flowKey: fk,
        value,
        thresholdValue: thr,
        ts: Number(e.timestamp) || 0,
        severity,
      };
    });
  } catch { return []; }
}

export function matrixToSeries(results: PromMatrixResult[], labelFn?: (m: Record<string, string>) => string): Series[] {
  return results.map(r => ({
    label: labelFn ? labelFn(r.metric) : (r.metric.agent ?? r.metric.__name__ ?? 'value'),
    points: r.values.map(([t, v]) => ({ t, v: parseFloat(v) })),
  }));
}

export function sumMatrix(results: PromMatrixResult[]): Series {
  if (!results.length) return { label: 'total', points: [] };
  const pts = results[0].values.map(([t]) => ({ t, v: 0 }));
  for (const r of results) {
    for (let i = 0; i < r.values.length; i++) {
      pts[i].v += parseFloat(r.values[i][1]);
    }
  }
  return { label: 'total', points: pts };
}

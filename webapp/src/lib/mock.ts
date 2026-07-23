import { useEffect, useState } from 'react';
import type { Series, Kpi, Agent, TopRow, Ddos, FlowRow } from './types';
import { RANGES, type RangeKey } from './theme';
import { formatBps, formatPct, formatNum } from './format';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

function genSeries(label: string, range: typeof RANGES[number], opts?: { base?: number; amp?: number; noise?: number; seed?: number; floor?: number; daily?: boolean; max?: number }): Series {
  const { base = 1, amp = 0.3, noise = 0.06, seed = 1, floor = 0, daily = true, max = Infinity } = opts || {};
  const rnd = mulberry32(seed);
  const now = Math.floor(Date.now() / 1000);
  const start = now - range.spanSec;
  const pts = [];
  let walk = 0;
  for (let i = 0; i < range.points; i++) {
    const t = start + Math.round((i / (range.points - 1)) * range.spanSec);
    walk += (rnd() - 0.5) * noise * base; walk *= 0.92;
    const hour = ((t % 86400) / 3600 + 5.5) % 24;
    const diurnal = daily ? (0.5 + 0.5 * Math.sin(((hour - 8) / 24) * Math.PI * 2 - Math.PI / 2)) : 1;
    let v = base * (0.55 + amp * diurnal) + walk + (rnd() - 0.5) * noise * base;
    v = Math.max(floor, Math.min(max, v));
    pts.push({ t, v });
  }
  return { label, points: pts };
}

const AGENT_DEFS = [
  { ip: '85.209.161.10', name: 'edge-bom-01',  role: 'Border / Mumbai',     speed: 100 },
  { ip: '85.209.161.11', name: 'edge-bom-02',  role: 'Border / Mumbai',     speed: 100 },
  { ip: '85.209.161.20', name: 'edge-del-01',  role: 'Border / Delhi',      speed: 100 },
  { ip: '85.209.161.21', name: 'edge-del-02',  role: 'Border / Delhi',      speed: 40  },
  { ip: '85.209.162.30', name: 'core-bom-01',  role: 'Core / Mumbai',       speed: 400 },
  { ip: '85.209.162.31', name: 'core-bom-02',  role: 'Core / Mumbai',       speed: 400 },
  { ip: '85.209.162.40', name: 'core-blr-01',  role: 'Core / Bangalore',    speed: 400 },
  { ip: '85.209.163.50', name: 'peer-decix-01',role: 'Peering / DE-CIX',    speed: 100 },
  { ip: '85.209.163.51', name: 'peer-extreme', role: 'Peering / Extreme',   speed: 100 },
  { ip: '85.209.163.60', name: 'peer-nixi-01', role: 'Peering / NIXI',      speed: 40  },
  { ip: '85.209.164.70', name: 'agg-blr-01',   role: 'Aggregation / BLR',   speed: 100 },
  { ip: '85.209.164.71', name: 'agg-blr-02',   role: 'Aggregation / BLR',   speed: 100 },
  { ip: '85.209.164.80', name: 'agg-hyd-01',   role: 'Aggregation / HYD',   speed: 40  },
  { ip: '85.209.165.90', name: 'cdn-cache-01', role: 'CDN cache / BOM',     speed: 100 },
];

const ASN_DEFS = [
  { asn: 'AS15169', name: 'Google',           w: 1.00 },
  { asn: 'AS13335', name: 'Cloudflare',       w: 0.82 },
  { asn: 'AS32934', name: 'Meta',             w: 0.71 },
  { asn: 'AS16509', name: 'Amazon',           w: 0.64 },
  { asn: 'AS2906',  name: 'Netflix',          w: 0.58 },
  { asn: 'AS8075',  name: 'Microsoft',        w: 0.41 },
  { asn: 'AS9498',  name: 'Bharti Airtel',    w: 0.33 },
  { asn: 'AS55836', name: 'Reliance Jio',     w: 0.29 },
  { asn: 'AS45609', name: 'Jio (mobile)',     w: 0.22 },
  { asn: 'AS24560', name: 'Airtel Broadband', w: 0.18 },
];
const COUNTRY_DEFS = [
  { cc: 'IN', name: 'India',           w: 1.00 },
  { cc: 'US', name: 'United States',   w: 0.74 },
  { cc: 'SG', name: 'Singapore',       w: 0.46 },
  { cc: 'DE', name: 'Germany',         w: 0.31 },
  { cc: 'NL', name: 'Netherlands',     w: 0.24 },
  { cc: 'GB', name: 'United Kingdom',  w: 0.19 },
  { cc: 'JP', name: 'Japan',           w: 0.14 },
  { cc: 'AE', name: 'UAE',             w: 0.11 },
];
const PROTO_DEFS = [
  { name: 'TCP', w: 1.00 }, { name: 'UDP', w: 0.52 }, { name: 'QUIC', w: 0.44 },
  { name: 'ESP', w: 0.12 }, { name: 'GRE', w: 0.07 }, { name: 'ICMP', w: 0.03 },
];

function buildTopRows(defs: Array<{ asn?: string; cc?: string; name: string; w: number }>, totalBps: number, seedKey: string): TopRow[] {
  const rnd = mulberry32(hashStr(seedKey));
  const weighted = defs.map(d => ({ ...d, ww: d.w * (0.85 + rnd() * 0.3) }));
  const sum = weighted.reduce((a, b) => a + b.ww, 0);
  return weighted.map(d => ({
    key: d.asn || d.cc || d.name,
    label: d.asn ? d.asn + ' · ' + d.name : (d.cc ? d.cc + ' · ' + d.name : d.name),
    bps: (d.ww / sum) * totalBps,
    pct: (d.ww / sum) * 100,
  })).sort((a, b) => b.bps - a.bps);
}

const DDOS_POOL: Omit<Ddos, 'since'>[] = [
  { target: '85.209.170.44', type: 'UDP flood',         severity: 'high', bps: 412e9, pps: 38e6,  sources: 24817 },
  { target: '85.209.171.9',  type: 'DNS amplification', severity: 'high', bps: 188e9, pps: 12e6,  sources: 9043  },
  { target: '85.209.172.2',  type: 'SYN flood',         severity: 'med',  bps: 24e9,  pps: 41e6,  sources: 61240 },
  { target: '85.209.170.88', type: 'NTP reflection',    severity: 'med',  bps: 47e9,  pps: 3.1e6, sources: 1820  },
  { target: '85.209.173.14', type: 'HTTP/2 rapid reset',severity: 'low',  bps: 2.4e9, pps: 0.8e6, sources: 412   },
];

const FLOW_NAMES = ['top_talkers_ipv4','top_talkers_ipv6','ddos_udp_target','ddos_syn_target','icmp_unreach','tcp_flags','dns_amp','port_scan','bgp_blackhole'];

function buildFlowRows(n: number, seedKey: string): FlowRow[] {
  const rnd = mulberry32(hashStr(seedKey));
  const rows: FlowRow[] = [];
  const now = Date.now();
  for (let i = 0; i < n; i++) {
    const ts = now - Math.floor(rnd() * 3600 * 1000);
    const a = AGENT_DEFS[Math.floor(rnd() * AGENT_DEFS.length)];
    const name = FLOW_NAMES[Math.floor(rnd() * FLOW_NAMES.length)];
    const srcIp = `${Math.floor(rnd()*223)+1}.${Math.floor(rnd()*255)}.${Math.floor(rnd()*255)}.${Math.floor(rnd()*255)}`;
    const dstIp = `85.209.${160 + Math.floor(rnd()*15)}.${Math.floor(rnd()*255)}`;
    const sport = Math.floor(rnd() * 64000) + 1024;
    const dport = [80, 443, 53, 123, 22, 3389, 8080, 5060][Math.floor(rnd() * 8)];
    const proto = ['TCP', 'UDP', 'QUIC'][Math.floor(rnd() * 3)];
    rows.push({ timestamp: new Date(ts).toISOString(), name, agent: a.ip, value: Math.floor(rnd() * 48e9) + 2e6, keys: [proto, `${srcIp}:${sport}`, '→', `${dstIp}:${dport}`, `if${Math.floor(rnd()*48)}`] });
  }
  return rows.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}

export function buildMockAgents(rangeKey: RangeKey): Agent[] {
  const range = RANGES.find(r => r.key === rangeKey) || RANGES[1];
  return AGENT_DEFS.map((d, i) => {
    const rnd = mulberry32(hashStr(d.ip));
    const up = i !== 9;
    const recv = Math.floor(80e6 + rnd() * 220e6);
    const lostPct = up ? rnd() * (i % 4 === 0 ? 1.8 : 0.4) : 0;
    const spark = genSeries(d.ip, RANGES[0], { base: d.speed * 1e9 * (0.2 + rnd() * 0.5), amp: 0.4, noise: 0.08, seed: hashStr(d.ip) % 9999, max: d.speed * 1e9 });
    return { ip: d.ip, name: d.name, role: d.role, speed: d.speed, up, datagramsReceived: recv, datagramsLost: Math.floor(recv * (lostPct / 100)), lostPct, uptimeMs: up ? (rnd() * 60 + 2) * 86400000 : 0, spark };
  });
}

export interface MockSnapshot {
  range: typeof RANGES[number];
  inSeries: Series; outSeries: Series;
  agentName: string;
  ifaceUtil: Series[]; ifaceThru: Series[];
  errSeries: Series; discSeries: Series;
  attackVol: Series;
  kpis: Kpi[];
  topASN: TopRow[]; topCountry: TopRow[]; topProto: TopRow[];
  agents: Agent[];
  ddos: Ddos[];
  flowRows: FlowRow[];
  histo: Series;
  lastUpdated: number;
}

export function buildSnapshot(rangeKey: RangeKey): MockSnapshot {
  const range = RANGES.find(r => r.key === rangeKey) || RANGES[1];
  const totalIn = 847e9, totalOut = 612e9;
  const inSeries  = genSeries('Ingress', range, { base: totalIn,  amp: 0.45, noise: 0.05, seed: 11, max: 1.3e12 });
  const outSeries = genSeries('Egress',  range, { base: totalOut, amp: 0.45, noise: 0.05, seed: 22, max: 1.0e12 });
  const ifaceUtil = [
    genSeries('In · if7',  range, { base: 62, amp: 0.6, noise: 0.05, seed: 31, max: 99, floor: 5 }),
    genSeries('Out · if7', range, { base: 48, amp: 0.6, noise: 0.05, seed: 41, max: 99, floor: 4 }),
    genSeries('In · if12', range, { base: 38, amp: 0.5, noise: 0.06, seed: 51, max: 99, floor: 3 }),
  ];
  const ifaceThru = [
    genSeries('In · if7',  range, { base: 62e9, amp: 0.6, noise: 0.05, seed: 61, max: 100e9 }),
    genSeries('Out · if7', range, { base: 48e9, amp: 0.6, noise: 0.05, seed: 71, max: 100e9 }),
  ];
  const errSeries  = genSeries('Errors',   range, { base: 24, amp: 0.8, noise: 0.5, seed: 81, max: 400, floor: 0, daily: false });
  const discSeries = genSeries('Discards', range, { base: 11, amp: 0.9, noise: 0.6, seed: 91, max: 300, floor: 0, daily: false });
  const attackVol  = genSeries('Attack bps', range, { base: 120e9, amp: 0.9, noise: 0.25, seed: 101, max: 600e9, floor: 0, daily: false });
  const lastIn = inSeries.points.at(-1)!.v, lastOut = outSeries.points.at(-1)!.v;
  const agents = buildMockAgents(rangeKey);
  const kpis: Kpi[] = [
    { label: 'Agents up',    value: `${agents.filter(a => a.up).length}/${agents.length}`, delta: 0, state: 'warn' },
    { label: 'Total ingest', value: formatBps(lastIn), delta: 3.2, state: 'ok' },
    { label: 'In / Out',     value: formatBps(lastIn) + ' / ' + formatBps(lastOut), state: 'ok' },
    { label: 'Active DDoS',  value: '2', unit: 'targets', delta: 1, state: 'crit' },
  ];
  const ddos: Ddos[] = DDOS_POOL.slice(0, 5).map((d, i) => ({ ...d, since: new Date(Date.now() - (i + 1) * (1000 * 60 * (3 + i * 7))).toISOString() })).sort((a, b) => ({ high: 3, med: 2, low: 1 }[b.severity] - { high: 3, med: 2, low: 1 }[a.severity]) || (b.bps - a.bps));
  return {
    range, inSeries, outSeries, agentName: 'core-bom-01', ifaceUtil, ifaceThru, errSeries, discSeries, attackVol,
    kpis, topASN: buildTopRows(ASN_DEFS, lastIn, rangeKey + '-asn'), topCountry: buildTopRows(COUNTRY_DEFS, lastIn, rangeKey + '-cc'), topProto: buildTopRows(PROTO_DEFS, lastIn, rangeKey + '-proto'),
    agents, ddos, flowRows: buildFlowRows(240, rangeKey + '-flow'), histo: genSeries('matches', range, { base: 140, amp: 0.7, noise: 0.4, seed: 202, max: 600, floor: 4, daily: false }),
    lastUpdated: Date.now(),
  };
}

/* Mock data embeds wall-clock timestamps, so it must never be part of the
   server-rendered HTML — generate it after mount to avoid hydration mismatches. */
export function useMockSnapshot(rangeKey: RangeKey): MockSnapshot | null {
  const [snap, setSnap] = useState<MockSnapshot | null>(null);
  useEffect(() => { setSnap(buildSnapshot(rangeKey)); }, [rangeKey]);
  return snap;
}

export function useMockAgents(rangeKey: RangeKey): Agent[] {
  const [agents, setAgents] = useState<Agent[]>([]);
  useEffect(() => { setAgents(buildMockAgents(rangeKey)); }, [rangeKey]);
  return agents;
}

export function advanceSeries(series: Series, stepSec: number): Series {
  const pts = series.points;
  const prev = pts[pts.length - 1];
  const nv = Math.max(0, prev.v + (Math.random() - 0.48) * prev.v * 0.06);
  return { ...series, points: pts.slice(1).concat([{ t: prev.t + stepSec, v: nv }]) };
}

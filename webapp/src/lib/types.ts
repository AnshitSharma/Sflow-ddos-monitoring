export type Point = { t: number; v: number };
export type Series = { label: string; points: Point[] };
export type Kpi = { label: string; value: string; unit?: string; delta?: number; state?: 'ok' | 'warn' | 'crit' };
export type Agent = { ip: string; name?: string; role?: string; speed?: number; up: boolean; datagramsReceived: number; datagramsLost: number; lostPct?: number; uptimeMs: number; spark?: Series };
export type TopRow = { key: string; label: string; bps: number; pct: number };
export type Ddos = { target: string; type: string; bps: number; pps: number; sources: number; since: string; severity: 'low' | 'med' | 'high' };
export type FlowRow = { timestamp: string; name: string; agent: string; value: number; keys: string[]; flowKeys?: string; flowID?: number };

// One live top-talker row from sFlow-RT /activeflows (flow keys: ipsource,ipdestination).
export type FlowKeyRow = { agent: string; ipsource: string; ipdestination: string; key: string; bps: number };
// One DDoS threshold event from sFlow-RT /events (ddos-protect app, byFlow:true).
export type DdosEvent = { agent: string; type: string; thresholdID: string; target: string; flowKey: string; value: number; thresholdValue: number; ts: number; severity: 'low' | 'med' | 'high' };

export type PromMatrixResult = { metric: Record<string, string>; values: [number, string][] };
export type PromVectorResult = { metric: Record<string, string>; value: [number, string] };

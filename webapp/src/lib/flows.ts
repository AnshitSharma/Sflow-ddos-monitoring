// sFlow-RT live-flow definitions used by the Flow Explorer.
//   ip_pairs        — base top-talkers (keys: ipsource,ipdestination), no filter
//   ip_pairs_focus  — same, but with a filter baked in on demand (click-to-filter).
// sFlow-RT does NOT filter /activeflows at query time, so a focus flow carries the
// filter in its definition (this mirrors sFlow-RT's own browse-flows tool).
export const IP_PAIRS = 'ip_pairs';
export const IP_PAIRS_FOCUS = 'ip_pairs_focus';

export type FlowFilter = { ipsource?: string; ipdestination?: string; raw?: string };

/** Build an sFlow-RT filter expression. IP parts are ANDed; `raw` passes through. */
export function buildFilter(f: FlowFilter): string {
  if (f.raw && f.raw.trim()) return f.raw.trim();
  const parts: string[] = [];
  if (f.ipsource) parts.push(`ipsource=${f.ipsource}`);
  if (f.ipdestination) parts.push(`ipdestination=${f.ipdestination}`);
  return parts.join('&');
}

/** Short human label for a filter, for the active-filter chip. */
export function filterLabel(f: FlowFilter): string {
  if (f.ipsource && f.ipdestination) return `${f.ipsource} → ${f.ipdestination}`;
  if (f.ipsource) return `src ${f.ipsource}`;
  if (f.ipdestination) return `dst ${f.ipdestination}`;
  return f.raw || '';
}

/** Strip the ddos-protect prefix for a readable attack-type label. */
export function ddosTypeLabel(metric: string): string {
  return (metric || '').replace(/^ddos_protect_/, '').replace(/_/g, ' ') || 'flood';
}

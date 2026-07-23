// sFlow-RT exports interface octet metrics as bytes/sec (pre-computed rates).
// Multiply by 8 for bps. Do NOT wrap in rate().
// Cumulative analyzer counters (received_bytes etc.) use rate().
export const Q = {
  ingestBps:     'rate(sflow_analyzer_received_bytes[5m]) * 8',
  agentCount:    'sflow_analyzer_agent_count',
  heapUsed:      'sflow_analyzer_heap_used_bytes',
  cpuLoad:       'sflow_analyzer_cpu_load_process',
  datagramsDrop: 'rate(sflow_analyzer_discarded_datagrams[5m])',

  inUtil:    (agent = '.*') => `sflow_ifinutilization{agent=~"${agent}"}`,
  outUtil:   (agent = '.*') => `sflow_ifoututilization{agent=~"${agent}"}`,
  inBps:     (agent = '.*') => `sflow_ifinoctets{agent=~"${agent}"} * 8`,
  outBps:    (agent = '.*') => `sflow_ifoutoctets{agent=~"${agent}"} * 8`,
  inBpsSum:  () => 'sum(sflow_ifinoctets) * 8',
  outBpsSum: () => 'sum(sflow_ifoutoctets) * 8',
  inErrors:  (agent = '.*') => `sflow_ifinerrors{agent=~"${agent}"}`,
  inDiscards:(agent = '.*') => `sflow_ifindiscards{agent=~"${agent}"}`,

  // Engine / analyzer KPIs (already bps/ratio — see notes above).
  ingestDatagrams: 'sum(rate(sflow_analyzer_received_datagrams[5m]))',

  // Flow-derived top-N (already bits/sec). Labels: `src` / `dst` carry the
  // ASN/country name; sum across agents then take the top entries.
  topAsnSrc:     (k = 8) => `topk(${k}, sum by (src) (sflow_asn_bps{job="sflow-rt-asn-src"}))`,
  topAsnDst:     (k = 8) => `topk(${k}, sum by (dst) (sflow_asn_bps{job="sflow-rt-asn-dst"}))`,
  topCountrySrc: (k = 8) => `topk(${k}, sum by (src) (sflow_country_src_bps))`,
  topCountryDst: (k = 8) => `topk(${k}, sum by (dst) (sflow_country_dst_bps))`,
  // 24h-averaged variants for the Analytics "Last 24h" mode.
  topAsnSrcAvg:     (k = 8) => `topk(${k}, sum by (src) (avg_over_time(sflow_asn_bps{job="sflow-rt-asn-src"}[24h])))`,
  topCountrySrcAvg: (k = 8) => `topk(${k}, sum by (src) (avg_over_time(sflow_country_src_bps[24h])))`,

  // Protocol breakdown — NOT collected yet (Part 2). Query is harmless (returns
  // empty) so the panel can switch from DEMO → live the moment the metric exists.
  topProto: (k = 6) => `topk(${k}, sum by (protocol) (sflow_protocol_bps))`,
};

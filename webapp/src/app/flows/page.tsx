'use client';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import useSWR from 'swr';
import { THEME, CAT } from '@/lib/theme';
import { activeFlows, setFlowFocus } from '@/lib/api';
import { IP_PAIRS, IP_PAIRS_FOCUS, buildFilter, filterLabel, type FlowFilter } from '@/lib/flows';
import { formatBps } from '@/lib/format';
import { Panel, DataTable, EmptyState, type ColDef } from '@/components/ui';
import { TimeSeriesChart } from '@/components/charts';
import { FlowLoader } from '@/components/loading';
import { Icon } from '@/components/icons';
import type { FlowKeyRow, Series } from '@/lib/types';

const MAX_POINTS = 60;   // rolling trend window (~3 min at 3s poll)
const POLL_MS = 3000;

export default function FlowsPage() {
  const [filter, setFilter] = useState<FlowFilter>({});
  const [rawInput, setRawInput] = useState('');
  const filterExpr = buildFilter(filter);
  const hasFilter = !!filterExpr;
  const activeName = hasFilter ? IP_PAIRS_FOCUS : IP_PAIRS;

  // Seed from URL once (?ipsource= / ?ipdestination= / ?filter=) — lets other pages deep-link in.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ipsource = p.get('ipsource') || undefined;
    const ipdestination = p.get('ipdestination') || undefined;
    const raw = p.get('filter') || undefined;
    if (ipsource || ipdestination || raw) {
      setFilter({ ipsource, ipdestination, raw });
      setRawInput(buildFilter({ ipsource, ipdestination, raw }));
    }
  }, []);

  // (Re)bake the focus flow whenever the filter changes; this also ensures the base flow exists.
  useEffect(() => { setFlowFocus(filterExpr); }, [filterExpr]);

  // Each poll is stamped with its time: SWR drops responses equal to the last one,
  // which would stall the trend buffer below whenever traffic is steady.
  const { data: poll, isLoading } = useSWR<{ t: number; rows: FlowKeyRow[] }>(
    ['flows', activeName, filterExpr],
    async () => ({ t: Date.now() / 1000, rows: await activeFlows(activeName, 30) }),
    { refreshInterval: POLL_MS, keepPreviousData: true },
  );
  const rows = poll?.rows;
  const flows = rows ?? [];

  // Rolling trend buffer — accumulated client-side from each poll (as sFlow-RT's own UI does).
  const [buf, setBuf] = useState<{ t: number; vals: Record<string, number> }[]>([]);
  const keyRef = useRef<string>('');
  const swrKey = activeName + '|' + filterExpr;
  useEffect(() => {
    if (!poll || isLoading) return;   // skip the previous filter's data kept during a switch
    const vals: Record<string, number> = {};
    for (const r of poll.rows) vals[`${r.ipsource} → ${r.ipdestination}`] = r.bps;
    const snap = { t: poll.t, vals };
    setBuf(prev => {
      const base = keyRef.current === swrKey ? prev : [];   // reset window on filter change
      keyRef.current = swrKey;
      return [...base, snap].slice(-MAX_POINTS);
    });
  }, [poll, swrKey, isLoading]);

  const series: Series[] = useMemo(() => {
    if (buf.length < 2) return [];
    const last = buf[buf.length - 1].vals;
    const topKeys = Object.entries(last).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k]) => k);
    return topKeys.map(k => ({ label: k, points: buf.map(s => ({ t: s.t, v: s.vals[k] ?? 0 })) }));
  }, [buf]);

  const totalBps = flows.reduce((a, b) => a + b.bps, 0);

  const pickSrc = (ip: string) => { const f = { ipsource: ip }; setFilter(f); setRawInput(buildFilter(f)); };
  const pickDst = (ip: string) => { const f = { ipdestination: ip }; setFilter(f); setRawInput(buildFilter(f)); };
  const reset = () => { setFilter({}); setRawInput(''); };
  const submitRaw = () => setFilter(rawInput.trim() ? { raw: rawInput.trim() } : {});

  const columns: ColDef<FlowKeyRow>[] = [
    { key: 'agent', label: 'Agent', width: 130, mono: true, render: r => <span className="text-ink-faint">{r.agent}</span> },
    { key: 'ipsource', label: 'Source IP', width: 170, sortable: false, render: r => (
      <button onClick={() => pickSrc(r.ipsource)}
        className="font-mono text-[12px] text-[#5794f2] hover:text-[#82b1ff] hover:underline decoration-dotted underline-offset-2 transition-colors duration-150">
        {r.ipsource}
      </button>) },
    { key: 'arrow', label: '', width: 24, sortable: false, render: () => <Icon.ArrowRight size={12} className="text-ink-faint" /> },
    { key: 'ipdestination', label: 'Destination IP', width: 170, sortable: false, render: r => (
      <button onClick={() => pickDst(r.ipdestination)}
        className="font-mono text-[12px] text-[#ff9830] hover:text-[#ffb35c] hover:underline decoration-dotted underline-offset-2 transition-colors duration-150">
        {r.ipdestination}
      </button>) },
    { key: 'bps', label: 'Bitrate', align: 'right', mono: true, sortAccessor: r => r.bps,
      render: r => <span className="text-ink">{formatBps(r.bps)}</span> },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Control bar — keys / value / filter / reset / submit (mirrors sFlow-RT browse-flows) */}
      <Panel dense bodyClass="!p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-ink-dim px-2.5 py-1.5 rounded-md border border-edge bg-raised/40">agent, ipsource, ipdestination</span>
          <span className="font-mono text-[11px] text-ink-dim px-2.5 py-1.5 rounded-md border border-edge bg-raised/40">Bps</span>
          <div className="relative flex-1 min-w-[260px]">
            <Icon.Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input value={rawInput} onChange={e => setRawInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitRaw()}
              placeholder="filter, e.g.  ipsource=1.2.3.4   or   ipdestination=8.8.8.8"
              className="w-full bg-raised/40 border border-edge rounded-md pl-9 pr-3 py-2 text-[13px] text-ink placeholder:text-ink-faint/70 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 font-mono transition-colors duration-150" />
          </div>
          <button onClick={reset}
            className="text-[12px] font-medium px-3 py-2 rounded-md border border-edge-strong text-ink-dim hover:bg-raised hover:text-ink transition-colors duration-150">Reset</button>
          <button onClick={submitRaw}
            className="text-[12px] font-medium px-3 py-2 rounded-md bg-accent text-[#0b0d11] hover:brightness-110 transition-all duration-150">Submit</button>
        </div>
        {hasFilter && (
          <div className="mt-2 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-md bg-accent-soft border border-accent/30 text-accent">
              <Icon.Filter size={11} /> {filterLabel(filter)}
              <button onClick={reset} className="ml-1 text-accent hover:text-ink transition-colors duration-150" aria-label="Clear filter"><Icon.X size={11} /></button>
            </span>
            <span className="text-[11px] text-ink-faint">showing this flow only · live</span>
          </div>
        )}
      </Panel>

      {/* Live trend */}
      <Panel icon={Icon.Activity}
        title={hasFilter ? 'Flow trend (filtered)' : 'Live flow trend'}
        subtitle={hasFilter ? filterLabel(filter) : 'Top source→destination pairs across all agents'}
        right={<span className="font-mono text-[12px]" style={{ color: THEME.inbound }}>{formatBps(totalBps)}</span>}>
        {/* series is empty until two polls are buffered; a single filtered flow is still a valid chart */}
        {series.length === 0
          ? rows && flows.length === 0 && !isLoading
            ? <div className="py-10"><EmptyState icon={Icon.Activity} title="No traffic" message={hasFilter ? 'Nothing matches this filter in the current sample window.' : 'Waiting for sFlow samples…'} /></div>
            : <div className="h-[240px] flex items-center justify-center"><FlowLoader label="Sampling live flows — trend builds over a few polls" /></div>
          : <TimeSeriesChart series={series} variant="area" stacked kind="bps" height={240} colors={CAT} />}
      </Panel>

      {/* Top talkers */}
      <Panel icon={Icon.Globe}
        title={hasFilter ? 'Flows (filtered)' : 'Top talkers'}
        subtitle="Click a source or destination IP to filter to that flow only" dense
        loading={isLoading} loadingLabel={hasFilter ? 'Applying filter' : 'Fetching top talkers'}>
        {flows.length === 0
          ? isLoading ? <div className="h-[150px]" /> : <EmptyState icon={Icon.Globe} title={hasFilter ? 'No live flows for this filter' : 'No active flows'} message={hasFilter ? 'This IP has no traffic in the current sample window.' : 'Waiting for sFlow samples…'} />
          : <DataTable columns={columns} rows={flows} dense maxHeight={460}
              rowKey={r => r.key + r.agent} initialSort={{ key: 'bps', dir: 'desc' }} />}
      </Panel>
    </div>
  );
}

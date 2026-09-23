'use client';
import React, { useContext, useEffect, useState, useMemo } from 'react';
import useSWR from 'swr';
import { RangeContext } from '@/components/shell';
import { RANGES, THEME } from '@/lib/theme';
import { searchFlows } from '@/lib/api';
import { useMockSnapshot } from '@/lib/mock';
import { formatBps, formatClockSec, formatNum } from '@/lib/format';
import { Panel, Select, DataTable, EmptyState, DemoBadge, type ColDef } from '@/components/ui';
import { Histogram } from '@/components/charts';
import { Icon } from '@/components/icons';
import type { FlowRow } from '@/lib/types';

const FLOW_NAME_OPTIONS = [
  'all','ddos_protect_target','ixp_flood_local','ixp_badprotocol','ixp_bgp','top_talkers_ipv4',
];

const AGENT_OPTIONS = [
  { value: 'all', label: 'all agents' },
  { value: '85.209.161.10', label: '85.209.161.10' },
  { value: '157.10.98.1',   label: '157.10.98.1'   },
];

export default function ForensicsPage() {
  const { rangeKey } = useContext(RangeContext);
  const range = RANGES.find(r => r.key === rangeKey) || RANGES[1];
  const [q, setQ] = useState('');
  const [name, setName] = useState('all');
  const [agent, setAgent] = useState('all');

  // Query the store once typing pauses, not on every keystroke.
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const searchBody = useMemo(() => ({
    text: debouncedQ || undefined,
    name: name !== 'all' ? name : undefined,
    agent: agent !== 'all' ? agent : undefined,
    fromISO: `now-${range.spanSec}s`,
    size: 200,
  }), [debouncedQ, name, agent, range.spanSec]);

  const { data: real, isLoading } = useSWR(['forensics', JSON.stringify(searchBody)], () => searchFlows(searchBody), { refreshInterval: 30000, keepPreviousData: true });
  const searching = isLoading || q.trim() !== debouncedQ;

  // Mock fallback is generated client-side only (it embeds wall-clock timestamps).
  const mock = useMockSnapshot(rangeKey);
  // Demo data only when OpenSearch can't be reached — an empty store shows as empty.
  const connected = Array.isArray(real?.rows);
  const flowRows: FlowRow[] = useMemo(() => connected ? real!.rows : isLoading ? [] : mock?.flowRows ?? [], [connected, real, isLoading, mock]);
  const totalCount = connected ? real!.total : mock?.flowRows.length ?? 0;

  const filtered = useMemo(() => flowRows.filter(r => {
    if (name !== 'all' && r.name !== name) return false;
    if (agent !== 'all' && r.agent !== agent) return false;
    if (q.trim()) {
      const hay = (r.name + ' ' + r.agent + ' ' + (r.keys ?? []).join(' ')).toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  }), [flowRows, name, agent, q]);

  const columns: ColDef<FlowRow>[] = [
    { key: 'timestamp', label: 'Timestamp', width: 150, mono: true, render: r => <span className="text-ink-faint">{formatClockSec(+new Date(r.timestamp) / 1000)}</span>, sortAccessor: r => +new Date(r.timestamp) },
    { key: 'name',  label: 'Flow',  width: 160, render: r => <span className="text-ink-dim font-mono text-[11px]">{r.name}</span> },
    { key: 'agent', label: 'Agent', width: 130, mono: true, render: r => <span className="text-ink-faint">{r.agent}</span> },
    { key: 'value', label: 'Value', width: 100, align: 'right', mono: true, render: r => <span className="text-ink">{formatBps(r.value)}</span> },
    { key: 'keys',  label: 'Keys', sortable: false, render: r => (
      <div className="flex flex-wrap items-center gap-1">
        {(r.keys ?? []).map((k, i) => k === '→'
          ? <Icon.ArrowRight key={i} size={12} className="text-ink-faint" />
          : <span key={i} className="font-mono text-[10.5px] px-1.5 py-0.5 rounded-md bg-raised text-ink-dim border border-edge">{k}</span>)}
      </div>) },
  ];

  const showingDemo = !connected && !isLoading;

  // Match-volume histogram over the selected range, from whatever rows are shown.
  const histo = useMemo(() => {
    const buckets = 60, end = Date.now() / 1000, start = end - range.spanSec, w = range.spanSec / buckets;
    const points = Array.from({ length: buckets }, (_, i) => ({ t: start + i * w, v: 0 }));
    for (const r of filtered) {
      const i = Math.floor((+new Date(r.timestamp) / 1000 - start) / w);
      if (i >= 0 && i < buckets) points[i].v++;
    }
    return points;
  }, [filtered, range.spanSec]);

  return (
    <div className="flex flex-col gap-3">
      {showingDemo && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2">
          <DemoBadge />
          <span className="text-[12px] text-amber-200/80">Sample flow records — the OpenSearch forensics store can&apos;t be reached right now. Search/filter works on demo data.</span>
        </div>
      )}
      <Panel dense bodyClass="!p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Icon.Forensics size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search IP, port, MAC, or key…" aria-label="Search flow log"
              className="w-full bg-raised/40 border border-edge rounded-md pl-9 pr-3 py-2 text-[13px] text-ink placeholder:text-ink-faint/70 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/50 font-mono transition-colors duration-150" />
            {searching && <span className="absolute inset-x-1.5 bottom-0 h-px overflow-hidden rounded-full" aria-hidden><span className="noc-progress" /></span>}
          </div>
          <Select icon={Icon.Filter} label="Flow" value={name} onChange={setName}
            options={FLOW_NAME_OPTIONS.map(n => ({ value: n, label: n }))} />
          <Select icon={Icon.Server} label="Agent" value={agent} onChange={setAgent} options={AGENT_OPTIONS} />
          <div className="flex items-center gap-1.5 text-[11px] text-ink-faint font-mono px-2 py-1.5 rounded-lg border border-edge">
            <Icon.Clock size={13} />{range.label}
          </div>
        </div>
      </Panel>

      <Panel icon={Icon.Activity} title="Match volume" subtitle={`${formatNum(filtered.length)} records`} dense
        loading={isLoading} loadingLabel={`Scanning last ${range.label}`}>
        {connected || !mock ? <Histogram points={histo} height={84} color={THEME.info} /> : <Histogram points={mock.histo.points} height={84} color={THEME.info} />}
      </Panel>

      <Panel icon={Icon.Forensics} title="Flow log" subtitle={`${formatNum(filtered.length)} / ${formatNum(totalCount)} records`} dense
        loading={isLoading} loadingLabel="Searching flow log">
        <DataTable columns={columns} rows={filtered} dense maxHeight={460}
          rowKey={r => r.timestamp + (r.keys ?? []).join()}
          initialSort={{ key: 'timestamp', dir: 'desc' }} />
      </Panel>
    </div>
  );
}

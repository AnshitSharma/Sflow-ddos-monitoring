'use client';
import React from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { THEME } from '@/lib/theme';
import { flowEvents, live } from '@/lib/api';
import { ddosTypeLabel } from '@/lib/flows';
import { formatPps, formatClockSec } from '@/lib/format';
import { Panel, KpiCard, StatusBadge, EmptyState } from '@/components/ui';
import { Icon } from '@/components/icons';
import type { DdosEvent } from '@/lib/types';

export default function DdosPage() {
  const router = useRouter();

  const { data: events, isLoading } = useSWR<DdosEvent[]>('ddos-events', () => flowEvents(50), { refreshInterval: 10000 });
  // Number of armed ddos-protect signatures (thresholds), for an "is it watching?" indicator.
  const { data: thresholds } = useSWR<Record<string, unknown>>('thresholds', () => live('threshold/json'), { refreshInterval: 60000 });

  const list = events ?? [];
  const armed = thresholds ? Object.keys(thresholds).length : 0;
  const high = list.filter(d => d.severity === 'high').length;
  const targets = new Set(list.map(d => d.target)).size;
  const peak = list.reduce((m, d) => Math.max(m, d.value), 0);
  const peakStr = formatPps(peak).split(' ');

  const investigate = (target: string) => router.push(`/flows?ipdestination=${encodeURIComponent(target)}`);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2.5 rounded-lg border border-edge bg-surface px-3 py-2">
        <span className="relative flex h-2 w-2 shrink-0">
          {!!armed && <span className="noc-live-dot absolute inline-flex h-full w-full rounded-full" style={{ background: THEME.ok }} />}
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: armed ? THEME.ok : THEME.warn }} />
        </span>
        <span className="text-[12px] text-ink-dim">
          {armed
            ? <>Live detection active — <span className="text-ink font-medium">{armed}</span> attack signatures armed via sFlow-RT ddos-protect (UDP/TCP/ICMP flood, amplification, fragmentation).</>
            : 'Connecting to sFlow-RT threshold engine…'}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard kpi={{ label: 'Active detections', value: String(list.length), state: list.length ? 'crit' : 'ok' }} />
        <KpiCard kpi={{ label: 'High severity',     value: String(high),         state: high ? 'crit' : 'ok' }} />
        <KpiCard kpi={{ label: 'Peak attack',       value: peakStr[0] || '0', unit: peakStr[1] || 'pps', state: peak ? 'warn' : 'ok' }} />
        <KpiCard kpi={{ label: 'Targets',           value: String(targets),      state: targets ? 'warn' : 'ok' }} />
      </div>

      <Panel icon={Icon.Ddos} title="Active detections" subtitle="From sFlow-RT ddos-protect thresholds · live" dense
        loading={isLoading} loadingLabel="Checking thresholds">
        <div className="flex flex-col gap-2">
          {list.length === 0 && !isLoading && <EmptyState icon={Icon.Check} title="All clear" message="No DDoS thresholds are currently exceeded." />}
          {list.map((d, i) => <DdosRow key={d.flowKey + d.ts + i} d={d} onInvestigate={() => investigate(d.target)} />)}
        </div>
      </Panel>
    </div>
  );
}

function DdosRow({ d, onInvestigate }: { d: DdosEvent; onInvestigate: () => void }) {
  const sevColor = d.severity === 'high' ? THEME.crit : d.severity === 'med' ? THEME.warn : THEME.info;
  return (
    <div className="rounded-md border border-edge bg-raised/40 px-3 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 transition-colors duration-150 hover:border-edge-strong"
      style={{ borderLeft: `2px solid ${sevColor}` }}>
      <div className="flex items-center gap-2.5 min-w-[210px]">
        <StatusBadge state={d.severity} />
        <div>
          <div className="font-mono text-[13px] text-ink">{d.target}</div>
          <div className="text-[11px] text-ink-faint">{ddosTypeLabel(d.type)}</div>
        </div>
      </div>
      <Stat label="Rate"       value={formatPps(d.value)} color={sevColor} />
      <Stat label="Threshold"  value={d.thresholdValue ? formatPps(d.thresholdValue) : '—'} />
      <Stat label="Agent"      value={d.agent} />
      <Stat label="Detected"   value={d.ts ? formatClockSec(d.ts / 1000) : '—'} />
      <div className="ml-auto">
        <button onClick={onInvestigate}
          className="text-[11px] font-medium px-2.5 py-1.5 rounded-md border border-edge-strong text-ink-dim hover:bg-raised hover:text-ink transition-colors duration-150 flex items-center gap-1">
          Investigate<Icon.ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-[88px]">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
      <div className="font-mono text-[13px] tabular-nums" style={{ color: color || THEME.text }}>{value}</div>
    </div>
  );
}

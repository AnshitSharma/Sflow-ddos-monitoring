'use client';
import React, { useContext, useEffect, useState } from 'react';
import useSWR from 'swr';
import { RangeContext } from '@/components/shell';
import { RANGES, THEME, CAT } from '@/lib/theme';
import { queryRange, queryInstant, live, sumMatrix, vectorToTopRows, parseAgents } from '@/lib/api';
import { Q } from '@/lib/queries';
import { buildSnapshot, advanceSeries, type MockSnapshot } from '@/lib/mock';
import { formatBps, formatPct, formatNum } from '@/lib/format';
import { Panel, KpiCard } from '@/components/ui';
import { TimeSeriesChart, BarList } from '@/components/charts';
import { Icon } from '@/components/icons';
import type { Agent, Series, TopRow } from '@/lib/types';

export default function OverviewPage() {
  const { rangeKey, paused } = useContext(RangeContext);
  const range = RANGES.find(r => r.key === rangeKey) || RANGES[1];
  const getNow = () => Math.floor(Date.now() / 1000);

  const { data: inData }  = useSWR(['inBps', rangeKey], () => queryRange(Q.inBpsSum(), getNow() - range.spanSec, getNow(), range.stepSec), { refreshInterval: 15000, fallbackData: [] });
  const { data: outData } = useSWR(['outBps', rangeKey], () => queryRange(Q.outBpsSum(), getNow() - range.spanSec, getNow(), range.stepSec), { refreshInterval: 15000, fallbackData: [] });
  const { data: agentsRaw } = useSWR('agents', () => live('agents/json'), { refreshInterval: 10000 });
  const { data: asnRows }   = useSWR('topAsnSrc', () => queryInstant(Q.topAsnSrc(8)), { refreshInterval: 15000 });
  const { data: dgRate }    = useSWR('ingestDg',  () => queryInstant(Q.ingestDatagrams), { refreshInterval: 15000 });

  // Mock fallback is generated client-side only (it embeds wall-clock timestamps).
  const [mock, setMock] = useState<MockSnapshot | null>(null);
  useEffect(() => { setMock(buildSnapshot(rangeKey)); }, [rangeKey]);

  useEffect(() => {
    if (paused || (rangeKey !== '10m' && rangeKey !== '1h')) return;
    const id = setInterval(() => {
      setMock(m => m ? { ...m, inSeries: advanceSeries(m.inSeries, range.stepSec), outSeries: advanceSeries(m.outSeries, range.stepSec) } : m);
    }, 2500);
    return () => clearInterval(id);
  }, [paused, rangeKey, range.stepSec]);

  const inSeries: Series  = inData?.length  ? { label: 'Ingress', points: sumMatrix(inData).points }  : mock?.inSeries  ?? { label: 'Ingress', points: [] };
  const outSeries: Series = outData?.length ? { label: 'Egress',  points: sumMatrix(outData).points } : mock?.outSeries ?? { label: 'Egress',  points: [] };
  const lastIn  = inSeries.points.at(-1)?.v  ?? 0;
  const lastOut = outSeries.points.at(-1)?.v ?? 0;

  const realAgents = parseAgents(agentsRaw);
  const agents: Agent[] = realAgents.length ? realAgents : mock?.agents ?? [];
  const upCount = agents.filter(a => a.up).length;
  const topASN: TopRow[] = asnRows?.length ? vectorToTopRows(asnRows, 'src') : mock?.topASN ?? [];
  const dgPerSec = dgRate?.length ? parseFloat(dgRate[0].value[1]) : 0;

  const kpis = [
    { label: 'Agents reporting', value: `${upCount}/${agents.length}`, state: (upCount < agents.length ? 'warn' : 'ok') as 'warn' | 'ok' },
    { label: 'Total ingest',     value: formatBps(lastIn),  state: 'ok' as const },
    { label: 'In / Out',         value: formatBps(lastIn) + ' / ' + formatBps(lastOut), state: 'ok' as const },
    { label: 'Datagrams/s',      value: dgPerSec ? formatNum(Math.round(dgPerSec)) : '—', unit: 'pps', state: 'ok' as const },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <KpiCard key={k.label} kpi={k} spark={i === 1 ? inSeries : i === 2 ? outSeries : undefined} sparkColor={i === 1 ? THEME.inbound : THEME.outbound} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Panel className="xl:col-span-2" icon={Icon.Activity} title="Total throughput — ingress vs egress"
          subtitle={`Aggregate · last ${range.label}`}>
          <TimeSeriesChart series={[inSeries, outSeries]} stacked variant="area" kind="bps" height={260} colors={[THEME.inbound, THEME.outbound]} />
        </Panel>
        <Panel icon={Icon.Globe} title="Top talkers" subtitle="By source ASN">
          <BarList rows={topASN} kind="bps" limit={8} colorFn={(_, i) => CAT[i % CAT.length]} />
        </Panel>
      </div>

      <Panel icon={Icon.Server} title="Agent health" subtitle={`${upCount} up · ${agents.length - upCount} down`} dense>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-7 gap-2">
          {agents.map(a => <AgentChip key={a.ip} agent={a} />)}
        </div>
      </Panel>
    </div>
  );
}

function AgentChip({ agent }: { agent: Agent }) {
  const warnLoss = (agent.lostPct ?? 0) > 1;
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-edge bg-raised/40 px-2.5 py-2 transition-colors duration-150 hover:border-edge-strong hover:bg-raised/70">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {agent.up && !warnLoss && <span className="noc-live-dot absolute inline-flex h-full w-full rounded-full" style={{ background: THEME.ok }} />}
        <span className="relative inline-flex rounded-full h-2.5 w-2.5" style={{ background: agent.up ? (warnLoss ? THEME.warn : THEME.ok) : THEME.crit }} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-ink font-medium truncate leading-tight">{agent.name ?? agent.ip}</div>
        <div className="text-[10px] font-mono text-ink-faint truncate leading-tight">{agent.ip}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-[10px] font-mono leading-tight" style={{ color: agent.up ? (warnLoss ? THEME.warn : THEME.textDim) : THEME.crit }}>
          {agent.up ? formatPct(agent.lostPct ?? 0) : 'DOWN'}
        </div>
        <div className="text-[9px] text-ink-faint leading-tight">{agent.up ? 'loss' : '—'}</div>
      </div>
    </div>
  );
}

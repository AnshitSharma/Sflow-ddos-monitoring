'use client';
import React, { useContext, useEffect, useState } from 'react';
import useSWR from 'swr';
import { RangeContext } from '@/components/shell';
import { RANGES, THEME } from '@/lib/theme';
import { queryRange, matrixToSeries, live, parseAgents } from '@/lib/api';
import { Q } from '@/lib/queries';
import { useMockSnapshot } from '@/lib/mock';
import { Panel, Select, EmptyState } from '@/components/ui';
import { TimeSeriesChart } from '@/components/charts';
import { Icon } from '@/components/icons';
import type { Series } from '@/lib/types';

// Known agent IPs as a fallback if the live agent list can't be fetched.
const FALLBACK_IPS = ['85.209.161.10', '157.10.98.1'];

export default function InterfacesPage() {
  const { rangeKey } = useContext(RangeContext);
  const range = RANGES.find(r => r.key === rangeKey) || RANGES[1];
  const getNow = () => Math.floor(Date.now() / 1000);

  const { data: agentsRaw } = useSWR('agents', () => live('agents/json'), { refreshInterval: 30000 });
  const realAgents = parseAgents(agentsRaw);
  const agentIps = realAgents.length ? realAgents.map(a => a.ip) : FALLBACK_IPS;

  const [agentIp, setAgentIp] = useState(agentIps[0]);
  // Keep selection valid once the real list arrives.
  useEffect(() => { if (!agentIps.includes(agentIp)) setAgentIp(agentIps[0]); }, [agentIps, agentIp]);
  const agent = realAgents.find(a => a.ip === agentIp);

  const { data: inUtilData }  = useSWR(['inUtil', agentIp, rangeKey], () => queryRange(Q.inUtil(agentIp), getNow() - range.spanSec, getNow(), range.stepSec), { refreshInterval: 15000, fallbackData: [] });
  const { data: outUtilData } = useSWR(['outUtil', agentIp, rangeKey], () => queryRange(Q.outUtil(agentIp), getNow() - range.spanSec, getNow(), range.stepSec), { refreshInterval: 15000, fallbackData: [] });
  const { data: inBpsData }   = useSWR(['inBps', agentIp, rangeKey], () => queryRange(Q.inBps(agentIp), getNow() - range.spanSec, getNow(), range.stepSec), { refreshInterval: 15000, fallbackData: [] });
  const { data: outBpsData }  = useSWR(['outBps', agentIp, rangeKey], () => queryRange(Q.outBps(agentIp), getNow() - range.spanSec, getNow(), range.stepSec), { refreshInterval: 15000, fallbackData: [] });
  const { data: errData }     = useSWR(['inErrors', agentIp, rangeKey], () => queryRange(Q.inErrors(agentIp), getNow() - range.spanSec, getNow(), range.stepSec), { refreshInterval: 15000, fallbackData: [] });
  const { data: discData }    = useSWR(['inDiscards', agentIp, rangeKey], () => queryRange(Q.inDiscards(agentIp), getNow() - range.spanSec, getNow(), range.stepSec), { refreshInterval: 15000, fallbackData: [] });

  // Mock fallback is generated client-side only (it embeds wall-clock timestamps).
  const mock = useMockSnapshot(rangeKey);

  const labelFn = (m: Record<string, string>) => `${m.agent ?? agentIp} if${m.ifindex ?? '?'}`;
  const inUtil  = inUtilData?.length  ? matrixToSeries(inUtilData,  labelFn) : mock?.ifaceUtil.slice(0, 1) ?? [];
  const outUtil = outUtilData?.length ? matrixToSeries(outUtilData, labelFn) : mock?.ifaceUtil.slice(1, 2) ?? [];
  const inBps   = inBpsData?.length   ? matrixToSeries(inBpsData,   labelFn) : mock?.ifaceThru.slice(0, 1) ?? [];
  const outBps  = outBpsData?.length  ? matrixToSeries(outBpsData,  labelFn) : mock?.ifaceThru.slice(1, 2) ?? [];
  const errSeries  = errData?.length  ? matrixToSeries(errData, labelFn)  : mock ? [mock.errSeries]  : [];
  const discSeries = discData?.length ? matrixToSeries(discData, labelFn) : mock ? [mock.discSeries] : [];

  const utilSeries = [...inUtil.slice(0,2), ...outUtil.slice(0,2)];
  const bpsSeries  = [...inBps.slice(0,2), ...outBps.slice(0,2)];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select icon={Icon.Server} label="Agent" value={agentIp} onChange={setAgentIp}
          options={agentIps.map(ip => ({ value: ip, label: ip }))} />
        <div className="ml-auto flex items-center gap-2 text-[11px] text-ink-faint">
          <span className="font-mono text-ink-dim">{agent?.up ? 'reporting' : 'agent'}</span>
          {agent && <span className="px-1.5 py-0.5 rounded-md bg-raised border border-edge font-mono text-ink-dim">{agent.lostPct != null ? agent.lostPct.toFixed(2) + '% loss' : ''}</span>}
        </div>
      </div>

      <Panel icon={Icon.Activity} title="Interface utilization" subtitle={`${agentIp} · % of link capacity · last ${range.label}`}>
        {utilSeries.length ? (
          <TimeSeriesChart series={utilSeries} variant="line" kind="pct" yMax={100} height={230} colors={[THEME.inbound, THEME.outbound, THEME.violet, THEME.teal]} />
        ) : <EmptyState title="No utilization data" message="No interface metrics yet. Check that sFlow-RT is scraping." />}
      </Panel>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <Panel className="xl:col-span-2" icon={Icon.Activity} title="Throughput" subtitle="bits per second">
          {bpsSeries.length ? (
            <TimeSeriesChart series={bpsSeries} variant="area" kind="bps" height={210} colors={[THEME.inbound, THEME.outbound, THEME.violet, THEME.teal]} />
          ) : <EmptyState title="No throughput data" />}
        </Panel>
        <Panel icon={Icon.Alert} title="Errors & discards" subtitle="packets / interval">
          <TimeSeriesChart series={[...errSeries.slice(0,1), ...discSeries.slice(0,1)]} variant="line" kind="count" height={210}
            colors={[THEME.crit, THEME.warn]} />
        </Panel>
      </div>
    </div>
  );
}

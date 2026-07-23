'use client';
import React, { useContext } from 'react';
import useSWR from 'swr';
import { RangeContext } from '@/components/shell';
import { THEME } from '@/lib/theme';
import { live, queryRange, sumMatrix, parseAgents } from '@/lib/api';
import { Q } from '@/lib/queries';
import { useMockAgents } from '@/lib/mock';
import { formatPct, formatNum, formatUptime, formatBps } from '@/lib/format';
import { Panel, KpiCard, StatusBadge } from '@/components/ui';
import { Sparkline } from '@/components/charts';
import { Icon } from '@/components/icons';
import type { Agent } from '@/lib/types';

export default function AgentsPage() {
  const { rangeKey } = useContext(RangeContext);
  const { data: liveData } = useSWR('agents', () => live('agents/json'), { refreshInterval: 10000 });

  // sFlow-RT returns an object keyed by IP; fall back to mock only if unreachable.
  // Mock agents are generated client-side only (timestamps would break hydration).
  const mockAgents = useMockAgents(rangeKey);
  const realAgents = parseAgents(liveData);
  const agents: Agent[] = realAgents.length ? realAgents : mockAgents;

  const avgLoss = agents.filter(a => a.up).reduce((s, a) => s + (a.lostPct ?? 0), 0) / Math.max(1, agents.filter(a => a.up).length);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard kpi={{ label: 'Total agents',   value: String(agents.length),                      state: 'ok'  }} />
        <KpiCard kpi={{ label: 'Online',         value: String(agents.filter(a => a.up).length),   state: 'ok'  }} />
        <KpiCard kpi={{ label: 'Offline',        value: String(agents.filter(a => !a.up).length),  state: agents.some(a => !a.up) ? 'crit' : 'ok' }} />
        <KpiCard kpi={{ label: 'Avg loss',       value: formatPct(avgLoss),                         state: avgLoss > 1 ? 'warn' : 'ok' }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        {agents.map(a => <AgentCard key={a.ip} agent={a} />)}
      </div>
    </div>
  );
}

function AgentCard({ agent }: { agent: Agent }) {
  const warnLoss = (agent.lostPct ?? 0) > 1;
  const lossColor = !agent.up ? THEME.crit : warnLoss ? THEME.warn : THEME.ok;

  // Real per-agent throughput sparkline (last 10 min), summed across interfaces.
  const { data: bpsData } = useSWR(agent.up ? ['agentSpark', agent.ip] : null, () => {
    const now = Math.floor(Date.now() / 1000);
    return queryRange(`sum(sflow_ifinoctets{agent="${agent.ip}"}) * 8`, now - 600, now, 10);
  }, { refreshInterval: 15000 });
  const spark = bpsData?.length ? sumMatrix(bpsData) : agent.spark;

  return (
    <div className="rounded-lg border border-edge bg-surface p-3.5 flex flex-col gap-3 transition-colors duration-200 hover:border-edge-strong">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-md bg-raised border border-edge-strong flex items-center justify-center shrink-0">
            <Icon.Server size={16} className="text-ink-dim" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-ink truncate">{agent.name ?? agent.ip}</div>
            <div className="text-[11px] font-mono text-ink-faint truncate">{agent.ip}</div>
          </div>
        </div>
        <StatusBadge state={agent.up ? 'up' : 'down'} size="sm" />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Metric label="Loss"   value={agent.up ? formatPct(agent.lostPct ?? 0) : '—'} color={lossColor} />
        <Metric label="Uptime" value={agent.up ? formatUptime(agent.uptimeMs) : 'down'} />
        <Metric label="Speed"  value={agent.speed ? agent.speed + 'G' : '—'} />
      </div>

      <div className="border-t border-edge pt-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider text-ink-faint">Throughput · 10m</span>
          <span className="text-[11px] font-mono text-ink-dim">{agent.up && spark ? formatBps(spark.points.at(-1)?.v ?? 0) : '—'}</span>
        </div>
        {agent.up && spark && spark.points.length
          ? <Sparkline points={spark.points} color={warnLoss ? THEME.warn : THEME.inbound} width={260} height={36} />
          : <div className="h-9 flex items-center text-[11px] text-ink-faint font-mono">no datagrams received</div>}
      </div>

      <div className="flex items-center justify-between text-[10px] text-ink-faint font-mono">
        <span>{agent.role ?? '—'}</span>
        <span>{formatNum(agent.datagramsReceived)} rx</span>
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-md bg-raised/50 border border-edge py-1.5">
      <div className="font-mono text-[13px] tabular-nums" style={{ color: color || THEME.text }}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-ink-faint mt-0.5">{label}</div>
    </div>
  );
}

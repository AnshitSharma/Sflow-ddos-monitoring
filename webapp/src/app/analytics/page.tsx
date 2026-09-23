'use client';
import React, { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { THEME } from '@/lib/theme';
import { queryInstant, vectorToTopRows } from '@/lib/api';
import { Q } from '@/lib/queries';
import { useMockSnapshot } from '@/lib/mock';
import { formatBps } from '@/lib/format';
import { Panel, DemoBadge } from '@/components/ui';
import { BarList, Donut } from '@/components/charts';
import { Icon } from '@/components/icons';
import type { TopRow } from '@/lib/types';

const protoColors = ['#5794f2','#73bf69','#ff9830','#fade2a','#b877d9','#f2495c'];

export default function AnalyticsPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'live' | '24h'>('live');
  // ASN/country come from Prometheus (aggregate); the actual IPs live in sFlow-RT.
  // Clicking a row jumps to the Flow Explorer's live per-IP top talkers to drill down.
  const drillToFlows = () => router.push('/flows');

  // Real ASN + country breakdowns (instant for Live, 24h-averaged otherwise).
  const { data: asnRows, isLoading: asnLoading } = useSWR(['asn', mode], () =>
    queryInstant(mode === 'live' ? Q.topAsnSrc(8) : Q.topAsnSrcAvg(8)), { refreshInterval: 15000, keepPreviousData: true });
  const { data: ccRows, isLoading: ccLoading } = useSWR(['cc', mode], () =>
    queryInstant(mode === 'live' ? Q.topCountrySrc(8) : Q.topCountrySrcAvg(8)), { refreshInterval: 15000, keepPreviousData: true });
  const loadingLabel = mode === 'live' ? 'Loading live rates' : 'Averaging last 24h';

  // Protocol breakdown has no metric yet (Part 2) → sample data, badged DEMO.
  // Generated client-side only to keep server and client renders identical.
  const mock = useMockSnapshot('1h');

  const topASN: TopRow[]     = asnRows?.length ? vectorToTopRows(asnRows, 'src') : asnLoading ? [] : mock?.topASN ?? [];
  const topCountry: TopRow[] = ccRows?.length  ? vectorToTopRows(ccRows, 'src')  : ccLoading ? [] : mock?.topCountry ?? [];
  const topProto: TopRow[]   = mock?.topProto ?? [];

  // Donut centre = total of the slices it draws.
  const totalBps = topProto.slice(0, 6).reduce((a, b) => a + b.bps, 0);
  const bpsLabel = formatBps(totalBps).split(' ');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-ink-faint">Traffic composition by source ASN, country, and protocol.</p>
        <div className="flex items-center gap-0.5 rounded-lg border border-edge bg-surface p-0.5">
          {[{ k: 'live', l: 'Live' }, { k: '24h', l: 'Last 24h' }].map(o => (
            <button key={o.k} onClick={() => setMode(o.k as 'live' | '24h')}
              aria-pressed={mode === o.k}
              className={`relative overflow-hidden px-3 py-1 rounded-md text-[12px] font-medium transition-all duration-150 ${mode === o.k ? 'bg-accent-soft text-accent shadow-[inset_0_0_0_1px_rgba(77,159,255,0.3)]' : 'text-ink-faint hover:text-ink hover:bg-raised'}`}>
              {o.l}
              {(asnLoading || ccLoading) && mode === o.k && <span className="absolute inset-x-1 bottom-0 h-px overflow-hidden"><span className="noc-progress" /></span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel icon={Icon.Globe} title="Top source ASNs" subtitle="by ingress bps · click to drill into live IPs" loading={asnLoading} loadingLabel={loadingLabel}>
          <BarList rows={topASN} kind="bps" limit={8} colorFn={() => THEME.inbound} onSelect={drillToFlows} />
        </Panel>
        <Panel icon={Icon.Globe} title="Top source countries" subtitle="by ingress bps · click to drill into live IPs" loading={ccLoading} loadingLabel={loadingLabel}>
          <BarList rows={topCountry} kind="bps" limit={8} colorFn={() => THEME.teal} onSelect={drillToFlows} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel icon={Icon.Activity} title="Top protocols" subtitle="by ingress bps" right={<DemoBadge />}>
          <BarList rows={topProto} kind="bps" limit={6} colorFn={(_, i) => protoColors[i % protoColors.length]} />
        </Panel>
        <Panel icon={Icon.Analytics} title="Protocol mix" subtitle="share of total ingress" right={<DemoBadge />}>
          <div className="flex items-center justify-center h-full py-2">
            <Donut rows={topProto.slice(0, 6)} colors={protoColors}
              centerValue={bpsLabel[0]} centerLabel={bpsLabel[1]} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

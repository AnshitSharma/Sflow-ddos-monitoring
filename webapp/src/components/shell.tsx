'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SWRConfig, mutate } from 'swr';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { THEME, type RangeKey } from '@/lib/theme';
import { Icon } from './icons';
import { TimeRangePicker } from './ui';
import { LoadingContext, TopProgress } from './loading';

type NavItem = { key: string; href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }>; sub: string };
const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Monitor',
    items: [
      { key: 'overview',   href: '/',           label: 'Overview',          icon: Icon.Overview,   sub: 'Wall display'          },
      { key: 'interfaces', href: '/interfaces', label: 'Interfaces',        icon: Icon.Interfaces, sub: 'Per-agent links'       },
      { key: 'analytics',  href: '/analytics',  label: 'Traffic Analytics', icon: Icon.Analytics,  sub: 'ASN · country · proto' },
    ],
  },
  {
    title: 'Investigate',
    items: [
      { key: 'flows',     href: '/flows',     label: 'Flow Explorer',   icon: Icon.Flow,      sub: 'Live per-IP drill' },
      { key: 'ddos',      href: '/ddos',      label: 'DDoS / Security', icon: Icon.Ddos,      sub: 'Detections'        },
      { key: 'forensics', href: '/forensics', label: 'Flow Forensics',  icon: Icon.Forensics, sub: 'Flow log search'   },
    ],
  },
  {
    title: 'Infrastructure',
    items: [
      { key: 'agents', href: '/agents', label: 'Agents', icon: Icon.Server, sub: 'Switches & routers' },
    ],
  },
];
const NAV = NAV_GROUPS.flatMap(g => g.items);

export interface ShellCtx { rangeKey: RangeKey; setRangeKey: (k: RangeKey) => void; paused: boolean; }

export const RangeContext = React.createContext<ShellCtx>({ rangeKey: '1h', setRangeKey: () => {}, paused: false });

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [rangeKey, setRangeKey] = useState<RangeKey>('1h');
  const [paused, setPaused] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(Date.now());
  const [, setTick] = useState(0);

  const live = (rangeKey === '10m' || rangeKey === '1h') && !paused;

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Pause stops every SWR poll; a manual refresh still goes through while paused.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const forceRef = useRef(false);
  const swrConfig = useRef({
    isPaused: () => pausedRef.current && !forceRef.current,
    onSuccess: () => setLastUpdated(Date.now()),
  }).current;

  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    forceRef.current = true;
    const done = mutate(() => true);   // revalidate every key on the page
    forceRef.current = false;
    await done.catch(() => {});
    setRefreshing(false);
  }, []);

  // Panels that are fetching user-requested data register here (drives the progress bar).
  const [loadingCount, setLoadingCount] = useState(0);
  const reportLoading = useCallback((d: number) => setLoadingCount(c => Math.max(0, c + d)), []);

  // Show progress immediately on nav click, until the new route mounts.
  const [navTo, setNavTo] = useState<string | null>(null);
  useEffect(() => { setNavTo(null); }, [pathname]);
  const busy = loadingCount > 0 || navTo !== null || refreshing;
  const signOut = useCallback(async () => {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/api/auth/logout`, { method: 'POST' }).catch(() => {});
    window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/login`);
  }, []);
  const ago = Math.max(0, Math.round((Date.now() - lastUpdated) / 1000));

  const active = NAV.find(n => {
    if (n.href === '/') return pathname === '/' || pathname === '';
    return pathname.startsWith(n.href);
  }) || NAV[0];
  const ActiveIco = active.icon;

  if (pathname === '/login') return <>{children}</>;

  return (
    <SWRConfig value={swrConfig}>
    <LoadingContext.Provider value={reportLoading}>
    <RangeContext.Provider value={{ rangeKey, setRangeKey, paused }}>
      <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink">
        {/* Sidebar */}
        <aside className="w-[228px] shrink-0 border-r border-edge bg-[#0e1015] flex flex-col">
          <div className="h-14 flex items-center gap-2.5 px-4 border-b border-edge">
            <div className="w-8 h-8 rounded-md flex items-center justify-center bg-accent-soft border border-accent/30">
              <Icon.Activity size={17} className="text-accent" />
            </div>
            <div className="leading-tight">
              <div className="text-[14px] font-semibold text-ink tracking-tight">sFlow <span className="text-ink-dim font-normal">NOC</span></div>
              <div className="text-[10px] text-ink-faint font-mono">bharat-ix · AS135xxx</div>
            </div>
          </div>

          <nav className="flex-1 px-2 py-3 flex flex-col gap-4 overflow-y-auto noc-scroll">
            {NAV_GROUPS.map(group => (
              <div key={group.title}>
                <div className="px-2.5 mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-faint/80">{group.title}</div>
                <div className="flex flex-col gap-0.5">
                  {group.items.map(n => {
                    const NIco = n.icon; const on = active.key === n.key;
                    return (
                      <Link key={n.key} href={n.href} aria-current={on ? 'page' : undefined}
                        onClick={e => { if (!on && !e.metaKey && !e.ctrlKey && !e.shiftKey) setNavTo(n.href); }}
                        className={`group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors duration-150 no-underline ${on ? 'bg-accent-soft text-ink' : 'text-ink-dim hover:bg-raised/70 hover:text-ink'}`}>
                        {on && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full bg-accent" />}
                        <NIco size={17} className={`transition-colors duration-150 ${on ? 'text-accent' : 'text-ink-faint group-hover:text-ink-dim'}`} />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium leading-tight">{n.label}</div>
                          <div className={`text-[10px] leading-tight truncate transition-colors duration-150 ${on ? 'text-ink-faint' : 'text-ink-faint/70'}`}>{n.sub}</div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="p-3 border-t border-edge">
            <div className="rounded-md bg-surface border border-edge px-2.5 py-2 flex items-center gap-2.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="noc-live-dot absolute inline-flex h-full w-full rounded-full" style={{ background: THEME.ok }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: THEME.ok }} />
              </span>
              <div className="text-[10px] leading-tight">
                <div className="text-ink-dim font-medium">Collector online</div>
                <div className="text-ink-faint font-mono">sflow-rt · v3.2</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="relative h-14 shrink-0 border-b border-edge bg-canvas/80 backdrop-blur flex items-center gap-3 px-4">
            <div className="flex items-center gap-2.5 min-w-0">
              <ActiveIco size={18} className="shrink-0 text-ink-dim" />
              <div className="min-w-0">
                <h1 className="text-[15px] font-semibold text-ink leading-tight truncate">{active.label}</h1>
                <p className="text-[11px] text-ink-faint leading-tight truncate">{active.sub}</p>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <div className="hidden md:flex items-center gap-2 rounded-lg border border-edge bg-surface px-2.5 py-1.5">
                <span className="relative flex h-2 w-2">
                  {(live || busy) && <span className="noc-live-dot absolute inline-flex h-full w-full rounded-full" style={{ background: busy ? THEME.accent : THEME.ok }} />}
                  <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: busy ? THEME.accent : live ? THEME.ok : paused ? THEME.warn : THEME.textFaint }} />
                </span>
                <span className="text-[11px] font-mono uppercase tracking-wider w-[52px]" style={{ color: busy ? THEME.accent : live ? THEME.ok : paused ? THEME.warn : THEME.textDim }}>
                  {busy ? 'Loading' : paused ? 'Paused' : live ? 'Live' : 'Static'}
                </span>
                <span className="text-[11px] text-ink-faint font-mono border-l border-edge pl-2">{ago}s ago</span>
              </div>
              <TimeRangePicker value={rangeKey} onChange={setRangeKey} busy={loadingCount > 0} />
              <button onClick={() => setPaused(p => !p)} title={paused ? 'Resume' : 'Pause'} aria-label={paused ? 'Resume live updates' : 'Pause live updates'}
                className="w-8 h-8 rounded-lg border border-edge bg-surface flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised hover:border-edge-strong transition-colors duration-150">
                {paused ? <Icon.Play size={14} /> : <Icon.Pause size={14} />}
              </button>
              <button onClick={refresh} disabled={refreshing} title="Refresh now" aria-label="Refresh now"
                className="w-8 h-8 disabled:cursor-wait rounded-lg border border-edge bg-surface flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised hover:border-edge-strong transition-colors duration-150">
                <Icon.Refresh size={14} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <button onClick={signOut} title="Sign out" aria-label="Sign out"
                className="w-8 h-8 rounded-lg border border-edge bg-surface flex items-center justify-center text-ink-dim hover:text-ink hover:bg-raised hover:border-edge-strong transition-colors duration-150">
                <Icon.LogOut size={14} />
              </button>
            </div>
            <TopProgress active={busy} />
          </header>
          <main className="flex-1 overflow-y-auto noc-scroll p-4">
            <div key={pathname} className="noc-page mx-auto max-w-[1800px]">{children}</div>
          </main>
        </div>
      </div>
    </RangeContext.Provider>
    </LoadingContext.Provider>
    </SWRConfig>
  );
}

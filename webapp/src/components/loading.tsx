'use client';
import React, { useContext, useEffect, useState } from 'react';

/* ── Loading registry ──────────────────────────────────────────────────────
   Panels report "I'm fetching data the user asked for" here; the shell reads
   the count to drive the header progress bar. Background polls don't report. */
export const LoadingContext = React.createContext<(delta: number) => void>(() => {});

export function useReportLoading(active: boolean) {
  const report = useContext(LoadingContext);
  useEffect(() => {
    if (!active) return;
    report(1);
    return () => report(-1);
  }, [active, report]);
}

/* ── FlowLoader ────────────────────────────────────────────────────────────
   Packets stream along a wire; one in three is "sampled" and drops into the
   collector, which pulses as it lands — sFlow in a 20-node CSS animation. */
const PACKETS = [0, 1, 2, 3, 4, 5];
const CYCLE_S = 1.8;

export function FlowLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-2.5" role="status" aria-live="polite">
      <div className="noc-flow" aria-hidden>
        <span className="noc-flow-wire" />
        {PACKETS.map(i => (
          <span key={i} className={`noc-flow-pkt ${i % 3 === 0 ? 'is-sampled' : ''}`}
            style={{ animationDelay: `${(i * CYCLE_S) / PACKETS.length}s`, ['--i' as string]: i }} />
        ))}
        <span className="noc-flow-drop" />
        <span className="noc-flow-collector" />
      </div>
      {label && <LoaderLabel label={label} />}
      {!label && <span className="sr-only">Loading</span>}
    </div>
  );
}

/** Caption with an elapsed timer, so a slow 30d query visibly keeps working. */
function LoaderLabel({ label }: { label: string }) {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);
  const secs = (now - start) / 1000;
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono">
      <span className="text-ink-dim">{label}</span>
      {secs >= 0.8 && <span className="text-ink-faint tabular-nums noc-fade-in">{secs.toFixed(1)}s</span>}
    </div>
  );
}

/* ── LoadingOverlay ────────────────────────────────────────────────────────
   Keeps the previous content in place (dimmed) while new data loads, so the
   layout never jumps. The loader fades in after a short delay so fast loads
   don't flash. */
export function LoadingOverlay({ show, label, minHeight = 150, children }: { show: boolean; label?: string; minHeight?: number; children: React.ReactNode }) {
  useReportLoading(show);
  return (
    <div className="relative h-full" style={show ? { minHeight } : undefined} aria-busy={show}>
      <div className={`h-full transition-opacity duration-300 ${show ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>{children}</div>
      {show && (
        <div className="absolute inset-0 z-10 flex items-center justify-center noc-overlay-in">
          <div className="rounded-lg border border-edge bg-surface/85 px-5 py-3.5 shadow-xl shadow-black/30">
            <FlowLoader label={label} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── TopProgress ───────────────────────────────────────────────────────────
   2px indeterminate bar pinned to the bottom edge of the header. */
export function TopProgress({ active }: { active: boolean }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-[-1px] h-[2px] overflow-hidden transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0'}`} aria-hidden>
      {active && <span className="noc-progress" />}
    </div>
  );
}

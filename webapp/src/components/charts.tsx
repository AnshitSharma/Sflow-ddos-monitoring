'use client';
import React, { useState, useRef, useLayoutEffect, useMemo, useCallback } from 'react';
import { THEME, CAT } from '@/lib/theme';
import { formatBps, formatPps, formatBytes, formatPct, formatAxis, formatClock, formatClockSec, formatNum } from '@/lib/format';
import type { Series, Point, TopRow } from '@/lib/types';

export function useMeasure(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null!);
  const [w, setW] = useState(640);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(entries => {
      const cw = entries[0].contentRect.width;
      if (cw > 0) setW(cw);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function gradId(c: string) { return 'g' + c.replace(/[^a-z0-9]/gi, ''); }

/* ── Axis helpers (Grafana-style "nice" scales) ────────────────────────── */

/** Round a raw step up to 1/2/5 × 10^n. */
function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nf * pow;
}

/** Y scale with round tick values (0 … top). */
function niceScale(maxVal: number, yMax?: number): { top: number; ticks: number[] } {
  if (yMax) {
    const step = yMax / 4;
    return { top: yMax, ticks: [0, 1, 2, 3, 4].map(i => i * step) };
  }
  const raw = (maxVal || 1) * 1.08;
  const step = niceStep(raw / 4);
  const top = Math.max(step, Math.ceil(raw / step) * step);
  const ticks: number[] = [];
  for (let v = 0; v <= top + step * 0.01; v += step) ticks.push(v);
  return { top, ticks };
}

/** Time ticks snapped to round wall-clock intervals (like Grafana's x-axis). */
const TIME_STEPS = [10, 30, 60, 120, 300, 600, 900, 1800, 3600, 2 * 3600, 3 * 3600, 6 * 3600, 12 * 3600, 86400, 2 * 86400, 7 * 86400];
function timeTicks(t0: number, t1: number): number[] {
  const span = Math.max(1, t1 - t0);
  const step = TIME_STEPS.find(s => span / s <= 7) ?? 2 * 86400;
  const out: number[] = [];
  for (let t = Math.ceil(t0 / step) * step; t <= t1; t += step) out.push(t);
  return out;
}

function formatTimeTick(tSec: number, spanSec: number): string {
  if (spanSec > 8 * 86400) {
    return new Date(tSec * 1000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
  if (spanSec > 2 * 86400) {
    const d = new Date(tSec * 1000);
    return d.toLocaleDateString('en-GB', { weekday: 'short' }) + ' ' + formatClock(tSec);
  }
  return formatClock(tSec);
}

/* ── TimeSeriesChart ───────────────────────────────────────────────────── */

interface TSProps {
  series: Series[];
  height?: number;
  kind?: string;
  variant?: 'area' | 'line';
  stacked?: boolean;
  colors?: string[];
  yMax?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  formatVal?: (v: number) => string;
}

export function TimeSeriesChart({ series, height = 220, kind = 'bps', variant = 'area', stacked = false, colors = CAT, yMax, showLegend = true, showGrid = true, formatVal }: TSProps) {
  const [ref, width] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const fmt = formatVal || (kind === 'pct' ? formatPct : kind === 'bytes' ? formatBytes : kind === 'pps' ? formatPps : formatBps);

  // visible = (series index, data) pairs so colors stay stable when toggling
  const visible = useMemo(
    () => series.map((s, i) => ({ s, i })).filter(({ s }) => !hidden.has(s.label)),
    [series, hidden],
  );

  const padL = 54, padR = 12, padT = 12, padB = 24;
  const plotW = Math.max(10, width - padL - padR);
  const plotH = Math.max(10, height - padT - padB);
  const n = series[0]?.points.length || 0;
  const xs = series[0]?.points.map(p => p.t) || [];
  const t0 = xs[0] ?? 0, t1 = xs[n - 1] ?? 1;

  const { top: yTop, ticks: yTicks } = useMemo(() => {
    let m = 0;
    if (stacked) {
      for (let k = 0; k < n; k++) { let sum = 0; for (const { s } of visible) sum += s.points[k]?.v || 0; if (sum > m) m = sum; }
    } else {
      for (const { s } of visible) for (const p of s.points) if (p.v > m) m = p.v;
    }
    return niceScale(m, yMax);
  }, [visible, stacked, yMax, n]);

  const sx = useCallback((k: number) => padL + (n <= 1 ? 0 : (k / (n - 1)) * plotW), [n, plotW]);
  const sy = useCallback((v: number) => padT + plotH - (v / yTop) * plotH, [plotH, yTop]);

  // cumulative tops/bottoms for stacked areas, in visible order
  const cum = useMemo(() => {
    if (!stacked) return null;
    const base = new Array(n).fill(0);
    return visible.map(({ s }) => {
      const topArr = s.points.map((p, k) => base[k] + p.v);
      const botArr = base.slice();
      for (let k = 0; k < n; k++) base[k] = topArr[k];
      return { top: topArr, bot: botArr };
    });
  }, [visible, stacked, n]);

  const linePath = (pts: Point[]) => pts.map((p, k) => (k ? 'L' : 'M') + sx(k) + ' ' + sy(p.v)).join(' ');
  const areaPath = (pts: Point[], vi: number) => {
    if (stacked && cum) {
      const c = cum[vi];
      const up = c.top.map((v, k) => (k ? 'L' : 'M') + sx(k) + ' ' + sy(v)).join(' ');
      const dn = c.bot.map((_, k) => 'L' + sx(n - 1 - k) + ' ' + sy(c.bot[n - 1 - k])).join(' ');
      return up + ' ' + dn + ' Z';
    }
    const up = pts.map((p, k) => (k ? 'L' : 'M') + sx(k) + ' ' + sy(p.v)).join(' ');
    return up + ` L ${sx(n - 1)} ${padT + plotH} L ${sx(0)} ${padT + plotH} Z`;
  };

  const xTicks = useMemo(() => timeTicks(t0, t1), [t0, t1]);
  const tickX = (t: number) => padL + (t1 <= t0 ? 0 : ((t - t0) / (t1 - t0)) * plotW);

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let i = Math.round(((e.clientX - rect.left) / rect.width) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHover(i);
  };

  const toggle = (label: string) => setHidden(prev => {
    const next = new Set(prev);
    if (next.has(label)) next.delete(label);
    else if (next.size < series.length - 1) next.add(label);   // keep at least one visible
    return next;
  });

  const hoverRows = hover != null
    ? visible
        .map(({ s, i }) => ({ label: s.label, color: colors[i % colors.length], v: s.points[hover]?.v ?? 0 }))
        .sort((a, b) => b.v - a.v)
        .map(r => ({ label: r.label, color: r.color, val: fmt(r.v) }))
    : [];

  return (
    <div ref={ref} className="w-full select-none">
      <svg width={width} height={height} className="overflow-visible noc-chart-enter">
        <defs>
          {colors.map(c => (
            <linearGradient key={c} id={gradId(c)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity={stacked ? 0.26 : 0.16} />
              <stop offset="100%" stopColor={c} stopOpacity={0.01} />
            </linearGradient>
          ))}
        </defs>

        {/* grid + y labels at round values */}
        {showGrid && yTicks.map((gv, i) => (
          <g key={i}>
            <line x1={padL} y1={sy(gv)} x2={padL + plotW} y2={sy(gv)} stroke={THEME.grid} strokeWidth="1" />
            <text x={padL - 8} y={sy(gv) + 3} textAnchor="end" fontSize="10" fill={THEME.textFaint} fontFamily="var(--font-mono), monospace">{formatAxis(gv, kind)}</text>
          </g>
        ))}

        {/* x ticks snapped to round times */}
        {n > 1 && xTicks.map(t => (
          <g key={t}>
            <line x1={tickX(t)} y1={padT + plotH} x2={tickX(t)} y2={padT + plotH + 4} stroke={THEME.border} strokeWidth="1" />
            <text x={tickX(t)} y={height - 6} textAnchor="middle" fontSize="10" fill={THEME.textFaint} fontFamily="var(--font-mono), monospace">
              {formatTimeTick(t, t1 - t0)}
            </text>
          </g>
        ))}

        {/* series — stacked draws back-to-front */}
        {(stacked ? visible.map((_, vi) => vi).reverse() : visible.map((_, vi) => vi)).map(vi => {
          const { s, i } = visible[vi];
          const c = colors[i % colors.length];
          return (
            <g key={s.label}>
              {variant === 'area' && <path d={areaPath(s.points, vi)} fill={`url(#${gradId(c)})`} stroke="none" />}
              <path
                d={stacked && cum ? cum[vi].top.map((v, k) => (k ? 'L' : 'M') + sx(k) + ' ' + sy(v)).join(' ') : linePath(s.points)}
                fill="none" stroke={c} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}

        {/* crosshair */}
        {hover != null && (
          <g pointerEvents="none">
            <line x1={sx(hover)} y1={padT} x2={sx(hover)} y2={padT + plotH} stroke={THEME.textFaint} strokeWidth="1" strokeDasharray="3 3" opacity="0.7" />
            {visible.map(({ s, i }, vi) => {
              const v = stacked && cum ? cum[vi].top[hover] : s.points[hover]?.v ?? 0;
              return <circle key={s.label} cx={sx(hover)} cy={sy(v)} r="3.5" fill={THEME.bg} stroke={colors[i % colors.length]} strokeWidth="1.8" />;
            })}
          </g>
        )}

        <rect x={padL} y={padT} width={plotW} height={plotH} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      </svg>

      {hover != null && hoverRows.length > 0 && (
        <ChartTooltip x={sx(hover)} width={width} t={xs[hover]} rows={hoverRows} />
      )}

      {showLegend && <LegendStatTable series={series} colors={colors} fmt={fmt} hidden={hidden} onToggle={toggle} />}
    </div>
  );
}

/* ── Legend: per-series Min / Mean / Max / Total, click to toggle ──────── */
function LegendStatTable({ series, colors, fmt, hidden, onToggle }: { series: Series[]; colors: string[]; fmt: (v: number) => string; hidden: Set<string>; onToggle: (label: string) => void }) {
  return (
    <div className="mt-2 overflow-x-auto noc-scroll">
      <table className="w-full text-[11px] tabular-nums border-collapse">
        <thead>
          <tr className="text-ink-faint">
            <th className="text-left font-medium py-1 pr-3">Name</th>
            <th className="text-right font-medium py-1 px-3">Min</th>
            <th className="text-right font-medium py-1 px-3">Mean</th>
            <th className="text-right font-medium py-1 px-3">Max</th>
            <th className="text-right font-medium py-1 pl-3">Total</th>
          </tr>
        </thead>
        <tbody>
          {series.map((s, i) => {
            const vs = s.points.map(p => p.v);
            const min = vs.length ? Math.min(...vs) : 0;
            const max = vs.length ? Math.max(...vs) : 0;
            const sum = vs.reduce((a, b) => a + b, 0);
            const mean = vs.length ? sum / vs.length : 0;
            const off = hidden.has(s.label);
            return (
              <tr key={s.label} onClick={() => onToggle(s.label)}
                className={`border-t border-edge cursor-pointer transition-opacity duration-150 hover:bg-raised/50 ${off ? 'opacity-35' : ''}`}
                title={off ? 'Show series' : 'Hide series'}>
                <td className="py-1 pr-3 text-ink-dim">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: colors[i % colors.length] }} />
                    <span className={off ? 'line-through' : ''}>{s.label}</span>
                  </span>
                </td>
                <td className="py-1 px-3 text-right text-ink-faint font-mono">{fmt(min)}</td>
                <td className="py-1 px-3 text-right text-ink-faint font-mono">{fmt(mean)}</td>
                <td className="py-1 px-3 text-right text-ink-faint font-mono">{fmt(max)}</td>
                <td className="py-1 pl-3 text-right text-ink-dim font-mono">{fmt(sum)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChartTooltip({ x, width, t, rows }: { x: number; width: number; t: number; rows: { label: string; color: string; val: string }[] }) {
  const flip = x > width * 0.6;
  return (
    <div className="relative" style={{ height: 0 }}>
      <div className="absolute z-20 -translate-y-full pointer-events-none rounded-md border border-edge-strong bg-[#0e1015]/95 backdrop-blur-sm px-3 py-2 shadow-2xl shadow-black/50"
        style={{ left: flip ? undefined : x + 10, right: flip ? (width - x + 10) : undefined, bottom: 10, minWidth: 160, maxWidth: 320 }}>
        <div className="text-[10px] uppercase tracking-wider text-ink-faint mb-1.5 font-mono border-b border-edge pb-1">{formatClockSec(t)}</div>
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between gap-4 text-[11px] py-0.5">
            <span className="flex items-center gap-1.5 text-ink-dim min-w-0"><span className="w-2 h-2 rounded-[2px] shrink-0" style={{ background: r.color }} /><span className="truncate">{r.label}</span></span>
            <span className="font-mono text-ink shrink-0">{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── BarList ───────────────────────────────────────────────────────────── */
interface BarListProps { rows: TopRow[]; kind?: string; max?: number; colorFn?: (r: TopRow, i: number) => string; limit?: number; onSelect?: (r: TopRow) => void; }
export function BarList({ rows, kind = 'bps', max, colorFn, limit = 8, onSelect }: BarListProps) {
  const data = rows.slice(0, limit);
  const top = max || Math.max(...data.map(r => r.bps), 1);
  const fmt = kind === 'pps' ? formatPps : kind === 'bytes' ? formatBytes : formatBps;
  return (
    <div className="flex flex-col gap-2.5">
      {data.map((r, i) => {
        const c = colorFn ? colorFn(r, i) : CAT[i % CAT.length];
        return (
          <div key={r.key} onClick={onSelect ? () => onSelect(r) : undefined}
            className={onSelect ? 'group cursor-pointer rounded -mx-1.5 px-1.5 py-1 hover:bg-raised/60 transition-colors duration-150' : ''}
            title={onSelect ? 'Drill into live flows' : undefined}>
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="flex items-center gap-2 min-w-0 pr-2">
                <span className="font-mono text-[10px] text-ink-faint w-4 shrink-0 text-right">{i + 1}</span>
                <span className={`truncate ${onSelect ? 'text-ink-dim group-hover:text-accent transition-colors duration-150' : 'text-ink-dim'}`}>{r.label}</span>
              </span>
              <span className="font-mono text-ink tabular-nums shrink-0">{fmt(r.bps)}</span>
            </div>
            <div className="ml-6 h-[5px] rounded-full bg-raised overflow-hidden">
              <div className="h-full rounded-full noc-bar-grow transition-[width] duration-700 ease-out"
                style={{ width: Math.max(2, (r.bps / top) * 100) + '%', background: c, animationDelay: `${i * 45}ms` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Sparkline ─────────────────────────────────────────────────────────── */
interface SparklineProps { points: Point[]; color?: string; height?: number; width?: number; fill?: boolean; strokeW?: number; }
export function Sparkline({ points, color = THEME.inbound, height = 32, width = 120, fill = true, strokeW = 1.3 }: SparklineProps) {
  if (!points || points.length < 2) return <svg width={width} height={height} />;
  const vs = points.map(p => p.v);
  const min = Math.min(...vs), max = Math.max(...vs) || 1;
  const n = points.length;
  const sx = (i: number) => (i / (n - 1)) * width;
  const sy = (v: number) => height - 2 - ((v - min) / (max - min || 1)) * (height - 4);
  const line = points.map((p, i) => (i ? 'L' : 'M') + sx(i).toFixed(1) + ' ' + sy(p.v).toFixed(1)).join(' ');
  const id = gradId(color) + 's';
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.18" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {fill && <path d={`${line} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${id})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeW} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/* ── Donut ─────────────────────────────────────────────────────────────── */
interface DonutProps { rows: TopRow[]; size?: number; thickness?: number; colors?: string[]; centerLabel?: string; centerValue?: string; }
export function Donut({ rows, size = 180, thickness = 20, colors = CAT, centerLabel, centerValue }: DonutProps) {
  const [hover, setHover] = useState<number | null>(null);
  const total = rows.reduce((a, b) => a + b.bps, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const gap = rows.length > 1 ? 1.5 : 0;   // px gap between segments
  let offset = 0;
  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} className="shrink-0 -rotate-90 noc-chart-enter">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={THEME.border} strokeWidth={thickness} opacity="0.6" />
        {rows.map((row, i) => {
          const frac = row.bps / total;
          const dash = Math.max(0, frac * c - gap);
          const seg = (
            <circle key={row.key} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={colors[i % colors.length]} strokeWidth={hover === i ? thickness + 3 : thickness}
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset - gap / 2} strokeLinecap="butt"
              opacity={hover == null || hover === i ? 1 : 0.35}
              style={{ transition: 'opacity 150ms ease, stroke-width 150ms ease' }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          );
          offset += frac * c;
          return seg;
        })}
        {centerValue && <text x={size / 2} y={size / 2 - 2} textAnchor="middle" transform={`rotate(90 ${size / 2} ${size / 2})`} fontSize="19" fontFamily="var(--font-mono), monospace" fontWeight="600" fill={THEME.text}>{hover != null ? rows[hover].pct.toFixed(0) + '%' : centerValue}</text>}
        {centerLabel && <text x={size / 2} y={size / 2 + 16} textAnchor="middle" transform={`rotate(90 ${size / 2} ${size / 2})`} fontSize="10" fill={THEME.textFaint}>{hover != null ? rows[hover].label : centerLabel}</text>}
      </svg>
      <div className="flex flex-col gap-1.5 min-w-0">
        {rows.map((row, i) => (
          <div key={row.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            className={`flex items-center justify-between gap-3 text-[12px] cursor-default transition-opacity duration-150 ${hover != null && hover !== i ? 'opacity-40' : ''}`}>
            <span className="flex items-center gap-2 text-ink-dim truncate"><span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: colors[i % colors.length] }} />{row.label}</span>
            <span className="font-mono text-ink-faint tabular-nums shrink-0">{row.pct.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Histogram ─────────────────────────────────────────────────────────── */
interface HistogramProps { points: Point[]; height?: number; color?: string; kind?: string; }
export function Histogram({ points, height = 90, color = THEME.info, kind = 'count' }: HistogramProps) {
  const [ref, width] = useMeasure();
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;
  const max = Math.max(...points.map(p => p.v), 1);
  const padB = 16, plotH = height - padB;
  const gap = 2;
  const bw = Math.max(1, (width - (n - 1) * gap) / n);
  const fmt = kind === 'bps' ? formatBps : formatNum;
  return (
    <div ref={ref} className="w-full relative">
      <svg width={width} height={height} className="noc-chart-enter">
        <line x1={0} y1={plotH + 0.5} x2={width} y2={plotH + 0.5} stroke={THEME.border} strokeWidth="1" />
        {points.map((p, i) => {
          const h = Math.max(1, (p.v / max) * (plotH - 4));
          const x = i * (bw + gap);
          return <rect key={i} x={x} y={plotH - h} width={bw} height={h} rx="1.5" fill={color}
            opacity={hover === i ? 1 : 0.5} style={{ transition: 'opacity 120ms ease' }}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />;
        })}
        {[0, Math.floor(n / 2), n - 1].map(i => (
          <text key={i} x={i * (bw + gap) + bw / 2} y={height - 3} textAnchor="middle" fontSize="9" fill={THEME.textFaint} fontFamily="var(--font-mono), monospace">{formatClock(points[i]?.t ?? 0)}</text>
        ))}
      </svg>
      {hover != null && (
        <div className="absolute -top-1 -translate-y-full pointer-events-none rounded-md border border-edge-strong bg-[#0e1015]/95 px-2.5 py-1.5 text-[10px] font-mono text-ink shadow-xl shadow-black/40"
          style={{ left: Math.min(width - 110, hover * (bw + gap)) }}>
          {formatClockSec(points[hover].t)} · {fmt(points[hover].v)}
        </div>
      )}
    </div>
  );
}

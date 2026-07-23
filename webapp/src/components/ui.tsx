'use client';
import React, { useState, useMemo } from 'react';
import { THEME, RANGES, type RangeKey } from '@/lib/theme';
import type { Kpi } from '@/lib/types';
import { Icon } from './icons';
import { Sparkline } from './charts';
import type { Series } from '@/lib/types';

/* ── Panel ─────────────────────────────────────────────────────────────── */
interface PanelProps { title?: string; subtitle?: string; icon?: React.ComponentType<{ size?: number; className?: string }>; right?: React.ReactNode; children: React.ReactNode; className?: string; bodyClass?: string; dense?: boolean; }
export function Panel({ title, subtitle, icon: Ico, right, children, className = '', bodyClass = '', dense = false }: PanelProps) {
  return (
    <section className={`rounded-lg border border-edge bg-surface flex flex-col transition-colors duration-200 hover:border-edge-strong ${className}`}>
      {(title || right) && (
        <header className={`flex items-center justify-between gap-3 border-b border-edge ${dense ? 'px-3 py-2' : 'px-4 py-2.5'}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {Ico && <Ico size={15} className="shrink-0 text-ink-faint" />}
            <div className="min-w-0">
              <h3 className="text-[13px] font-medium text-ink truncate leading-tight">{title}</h3>
              {subtitle && <p className="text-[11px] text-ink-faint truncate leading-tight mt-px">{subtitle}</p>}
            </div>
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </header>
      )}
      <div className={`${dense ? 'p-3' : 'p-4'} flex-1 min-h-0 ${bodyClass}`}>{children}</div>
    </section>
  );
}

/* ── StatusBadge ───────────────────────────────────────────────────────── */
type StateKey = 'ok' | 'warn' | 'crit' | 'high' | 'med' | 'low' | 'up' | 'down';
const STATE_CFG: Record<StateKey, { c: string; label: string }> = {
  ok:   { c: '#73bf69', label: 'OK'   },
  warn: { c: '#fade2a', label: 'WARN' },
  crit: { c: '#f2495c', label: 'CRIT' },
  high: { c: '#f2495c', label: 'HIGH' },
  med:  { c: '#fade2a', label: 'MED'  },
  low:  { c: '#5794f2', label: 'LOW'  },
  up:   { c: '#73bf69', label: 'UP'   },
  down: { c: '#f2495c', label: 'DOWN' },
};
export function StatusBadge({ state = 'ok', label, size = 'md' }: { state?: StateKey; label?: string; size?: 'sm' | 'md' }) {
  const cfg = STATE_CFG[state] || STATE_CFG.ok;
  const sm = size === 'sm';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded font-mono font-medium uppercase tracking-wider ${sm ? 'text-[9.5px] px-1.5 py-0.5' : 'text-[10.5px] px-2 py-0.5'}`}
      style={{ color: cfg.c, background: cfg.c + '14', border: `1px solid ${cfg.c}30` }}>
      <span className="inline-block rounded-full" style={{ background: cfg.c, width: sm ? 5 : 6, height: sm ? 5 : 6 }} />{label || cfg.label}
    </span>
  );
}

/* ── KpiCard ───────────────────────────────────────────────────────────── */
export function KpiCard({ kpi, spark, sparkColor }: { kpi: Kpi; spark?: Series; sparkColor?: string }) {
  const { label, value, unit, delta, state } = kpi;
  const accent = state === 'crit' ? THEME.crit : state === 'warn' ? THEME.warn : state === 'ok' ? THEME.ok : THEME.textDim;
  const valueColor = state === 'crit' ? THEME.crit : state === 'warn' ? THEME.warn : THEME.text;
  const up = (delta || 0) > 0, down = (delta || 0) < 0;
  const DeltaIco = up ? Icon.ArrowUp : Icon.ArrowDown;
  return (
    <div className="relative rounded-lg border border-edge bg-surface p-4 overflow-hidden transition-colors duration-200 hover:border-edge-strong">
      <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${accent}90, transparent 70%)` }} />
      <div className="flex items-start justify-between">
        <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink-faint">{label}</span>
      </div>
      <div className="mt-2.5 flex items-end gap-1.5">
        <span className={`font-mono leading-none font-semibold tabular-nums ${String(value).length > 11 ? 'text-[19px]' : 'text-[27px]'}`} style={{ color: valueColor }}>{value}</span>
        {unit && <span className="text-[11px] text-ink-faint mb-0.5">{unit}</span>}
      </div>
      <div className="mt-2.5 flex items-center justify-between">
        {delta != null && delta !== 0 ? (
          <span className="inline-flex items-center gap-0.5 text-[11px] font-mono" style={{ color: up ? THEME.ok : down ? THEME.crit : THEME.textDim }}>
            <DeltaIco size={12} />{Math.abs(delta)}%
          </span>
        ) : <span className="text-[11px] text-ink-faint/60">—</span>}
        {spark && <Sparkline points={spark.points} color={sparkColor || accent} width={84} height={26} />}
      </div>
    </div>
  );
}

/* ── DemoBadge ─────────────────────────────────────────────────────────── */
/** Marks a panel whose data is still sample/mock data (source not live yet). */
export function DemoBadge({ title = 'Sample data — live source not connected yet' }: { title?: string }) {
  return (
    <span title={title}
      className="inline-flex items-center gap-1 rounded font-mono font-medium uppercase tracking-wider text-[9.5px] px-1.5 py-0.5"
      style={{ color: '#fade2a', border: '1px dashed rgba(250,222,42,0.4)', background: 'rgba(250,222,42,0.06)' }}>
      <Icon.Alert size={10} />Demo
    </span>
  );
}

/* ── EmptyState ────────────────────────────────────────────────────────── */
export function EmptyState({ icon: Ico, title = 'No data', message = 'No events in this range yet.' }: { icon?: React.ComponentType<{ size?: number; className?: string }>; title?: string; message?: string }) {
  const I = Ico || Icon.Activity;
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="w-11 h-11 rounded-lg border border-edge bg-raised/60 flex items-center justify-center mb-3"><I size={20} className="text-ink-faint" /></div>
      <p className="text-[13px] font-medium text-ink-dim">{title}</p>
      <p className="text-[12px] text-ink-faint mt-1 max-w-[280px] leading-relaxed">{message}</p>
    </div>
  );
}

/* ── DataTable ─────────────────────────────────────────────────────────── */
export interface ColDef<T> { key: string; label: string; width?: number; align?: 'right'; mono?: boolean; sortable?: boolean; sortAccessor?: (r: T) => string | number; render?: (r: T) => React.ReactNode; }
interface DataTableProps<T> { columns: ColDef<T>[]; rows: T[]; rowKey?: (r: T) => string | number; maxHeight?: number; initialSort?: { key: string; dir: 'asc' | 'desc' }; dense?: boolean; onRowClick?: (r: T) => void; }
export function DataTable<T>({ columns, rows, rowKey, maxHeight = 520, initialSort, dense = false, onRowClick }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string | null; dir: 'asc' | 'desc' }>(initialSort || { key: null, dir: 'desc' });
  const sorted = useMemo(() => {
    if (!sort.key) return rows;
    const col = columns.find(c => c.key === sort.key);
    const acc = col?.sortAccessor || ((r: T) => (r as Record<string, unknown>)[sort.key!] as string | number);
    const arr = [...rows].sort((a, b) => { const av = acc(a), bv = acc(b); return typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv)); });
    return sort.dir === 'desc' ? arr.reverse() : arr;
  }, [rows, sort, columns]);
  const toggle = (key: string) => setSort(s => s.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' });
  return (
    <div className="rounded-lg border border-edge overflow-hidden">
      <div className="overflow-auto noc-scroll" style={{ maxHeight }}>
        <table className="w-full border-collapse text-[12px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-raised border-b border-edge">
              {columns.map(col => (
                <th key={col.key} onClick={() => col.sortable !== false && toggle(col.key)}
                  aria-sort={sort.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={`text-left font-semibold uppercase tracking-[0.08em] text-[10px] text-ink-faint ${dense ? 'px-2.5 py-2' : 'px-3 py-2.5'} ${col.align === 'right' ? 'text-right' : ''} ${col.sortable !== false ? 'cursor-pointer hover:text-ink transition-colors duration-150 select-none' : ''}`}
                  style={{ width: col.width }}>
                  <span className={`inline-flex items-center gap-1 ${col.align === 'right' ? 'flex-row-reverse' : ''}`}>
                    {col.label}
                    {sort.key === col.key && <Icon.Chevron size={11} className={`text-accent ${sort.dir === 'asc' ? 'rotate-180' : ''}`} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={rowKey ? rowKey(r) : i} onClick={() => onRowClick?.(r)}
                className={`border-b border-edge/60 last:border-b-0 ${onRowClick ? 'cursor-pointer' : ''} hover:bg-raised/60 transition-colors duration-100`}>
                {columns.map(col => (
                  <td key={col.key} className={`${dense ? 'px-2.5 py-1.5' : 'px-3 py-2'} ${col.align === 'right' ? 'text-right' : ''} ${col.mono ? 'font-mono tabular-nums' : ''} text-ink-dim align-middle`}>
                    {col.render ? col.render(r) : String((r as Record<string, unknown>)[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <EmptyState icon={Icon.Forensics} title="No matches" message="No events in this range yet." />}
      </div>
    </div>
  );
}

/* ── TimeRangePicker ───────────────────────────────────────────────────── */
export function TimeRangePicker({ value, onChange }: { value: RangeKey; onChange: (k: RangeKey) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-edge bg-surface p-0.5">
      <Icon.Clock size={14} className="text-ink-faint ml-1.5 mr-1" />
      {RANGES.map(r => (
        <button key={r.key} onClick={() => onChange(r.key as RangeKey)}
          className={`px-2.5 py-1 rounded-md text-[12px] font-medium transition-all duration-150 ${value === r.key ? 'bg-accent-soft text-accent shadow-[inset_0_0_0_1px_rgba(77,159,255,0.3)]' : 'text-ink-faint hover:text-ink hover:bg-raised'}`}>
          {r.label}
        </button>
      ))}
    </div>
  );
}

/* ── Select ────────────────────────────────────────────────────────────── */
export function Select({ value, onChange, options, icon: Ico, label }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; icon?: React.ComponentType<{ size?: number; className?: string }>; label?: string }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-edge bg-surface pl-2.5 pr-1.5 py-1.5 cursor-pointer transition-colors duration-150 hover:border-edge-strong">
      {Ico && <Ico size={14} className="text-ink-faint" />}
      {label && <span className="text-[11px] text-ink-faint">{label}</span>}
      <div className="relative flex items-center">
        <select value={value} onChange={e => onChange(e.target.value)}
          className="appearance-none bg-transparent text-[12px] text-ink pr-5 focus:outline-none cursor-pointer font-mono">
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Icon.Chevron size={12} className="text-ink-faint absolute right-0 pointer-events-none" />
      </div>
    </label>
  );
}

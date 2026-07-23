const KB = 1e3, MB = 1e6, GB = 1e9, TB = 1e12;

export function formatBps(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a >= TB) return (v / TB).toFixed(2) + ' Tbps';
  if (a >= GB) return (v / GB).toFixed(a >= 100 * GB ? 0 : 1) + ' Gbps';
  if (a >= MB) return (v / MB).toFixed(a >= 100 * MB ? 0 : 1) + ' Mbps';
  if (a >= KB) return (v / KB).toFixed(0) + ' Kbps';
  return v.toFixed(0) + ' bps';
}
export function formatPps(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(1) + ' Gpps';
  if (a >= 1e6) return (v / 1e6).toFixed(1) + ' Mpps';
  if (a >= 1e3) return (v / 1e3).toFixed(0) + ' Kpps';
  return v.toFixed(0) + ' pps';
}
export function formatBytes(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1024**4) return (v / 1024**4).toFixed(2) + ' TB';
  if (a >= 1024**3) return (v / 1024**3).toFixed(2) + ' GB';
  if (a >= 1024**2) return (v / 1024**2).toFixed(1) + ' MB';
  if (a >= 1024) return (v / 1024).toFixed(1) + ' KB';
  return v.toFixed(0) + ' B';
}
export function formatPct(v: number | null | undefined): string {
  return (v == null || isNaN(v)) ? '—' : v.toFixed(v >= 100 ? 0 : 1) + '%';
}
export function formatNum(v: number | null | undefined): string {
  return (v == null || isNaN(v)) ? '—' : Math.round(v).toLocaleString('en-US');
}
export function formatAxis(v: number, kind: string): string {
  if (kind === 'pct') return Math.round(v) + '%';
  if (kind === 'count') return formatNum(v);
  const a = Math.abs(v);
  if (kind === 'pps') {
    if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M';
    if (a >= 1e3) return Math.round(v / 1e3) + 'K';
    return Math.round(v).toString();
  }
  if (kind === 'bytes') {
    if (a >= 1024**3) return (v / 1024**3).toFixed(1) + 'G';
    if (a >= 1024**2) return Math.round(v / 1024**2) + 'M';
    if (a >= 1024) return Math.round(v / 1024) + 'K';
    return Math.round(v).toString();
  }
  if (a >= TB) return (v / TB).toFixed(1) + 'T';
  if (a >= GB) return Math.round(v / GB) + 'G';
  if (a >= MB) return Math.round(v / MB) + 'M';
  if (a >= KB) return Math.round(v / KB) + 'K';
  return Math.round(v).toString();
}
export function formatClock(tSec: number): string {
  return new Date(tSec * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
export function formatClockSec(tSec: number): string {
  return new Date(tSec * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
export function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}
export function formatDurationSince(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  if (h > 0) return h + 'h ' + m + 'm';
  if (m > 0) return m + 'm ' + ss + 's';
  return ss + 's';
}

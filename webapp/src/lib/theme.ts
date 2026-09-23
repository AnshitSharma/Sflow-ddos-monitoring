export const THEME = {
  // chrome — deep blue-black NOC console (mirrors the CSS tokens in globals.css)
  bg:        '#0b0d11',
  panel:     '#12151b',
  panelAlt:  '#181c24',
  border:    '#1f242e',
  borderSoft:'#1a1f28',
  text:      '#e2e6ed',
  textDim:   '#98a1b3',
  textFaint: '#5b6477',
  grid:      'rgba(226,230,237,0.05)',
  accent:    '#4d9fff',
  // series / severity — Grafana classic palette (kept for operator familiarity)
  inbound:   '#5794f2',
  outbound:  '#ff9830',
  crit:      '#f2495c',
  warn:      '#fade2a',
  ok:        '#73bf69',
  info:      '#5794f2',
  violet:    '#b877d9',
  pink:      '#f48fb1',
  teal:      '#4ec9b0',
};

export const CAT = ['#5794f2','#73bf69','#ff9830','#fade2a','#b877d9','#f2495c','#4ec9b0','#f48fb1'];

export const RANGES = [
  { key: '10m', label: '10m', spanSec: 600,       stepSec: 10,      points: 60 },
  { key: '1h',  label: '1h',  spanSec: 3600,      stepSec: 60,      points: 60 },
  { key: '24h', label: '24h', spanSec: 86400,     stepSec: 900,     points: 96 },
  { key: '7d',  label: '7d',  spanSec: 7*86400,   stepSec: 3600*2,  points: 84 },
  { key: '30d', label: '30d', spanSec: 30*86400,  stepSec: 3600*3,  points: 240 },
] as const;
export type RangeKey = '10m' | '1h' | '24h' | '7d' | '30d';
export type RangeConfig = (typeof RANGES)[number];

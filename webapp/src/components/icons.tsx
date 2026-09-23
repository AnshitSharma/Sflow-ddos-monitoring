'use client';
import React from 'react';

interface SvgProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  sw?: number;
}

const Svg = ({ children, size = 18, fill = 'none', sw = 2, ...p }: SvgProps) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24"
    fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" {...p}>
    {children}
  </svg>
);

export const Icon = {
  Overview:   (p: SvgProps) => <Svg {...p}><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></Svg>,
  Interfaces: (p: SvgProps) => <Svg {...p}><path d="M3 12h4l3 8 4-16 3 8h4"/></Svg>,
  Analytics:  (p: SvgProps) => <Svg {...p}><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></Svg>,
  Ddos:       (p: SvgProps) => <Svg {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></Svg>,
  Forensics:  (p: SvgProps) => <Svg {...p}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Svg>,
  Server:     (p: SvgProps) => <Svg {...p}><rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/><path d="M7 7.5h.01M7 16.5h.01"/></Svg>,
  Clock:      (p: SvgProps) => <Svg {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Svg>,
  Refresh:    (p: SvgProps) => <Svg {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/></Svg>,
  Chevron:    (p: SvgProps) => <Svg {...p}><path d="m6 9 6 6 6-6"/></Svg>,
  ArrowUp:    (p: SvgProps) => <Svg {...p}><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></Svg>,
  ArrowDown:  (p: SvgProps) => <Svg {...p}><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></Svg>,
  ArrowRight: (p: SvgProps) => <Svg {...p}><path d="M5 12h14M12 5l7 7-7 7"/></Svg>,
  Check:      (p: SvgProps) => <Svg {...p}><path d="M20 6 9 17l-5-5"/></Svg>,
  Alert:      (p: SvgProps) => <Svg {...p}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/></Svg>,
  X:          (p: SvgProps) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12"/></Svg>,
  Zap:        (p: SvgProps) => <Svg {...p}><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></Svg>,
  Globe:      (p: SvgProps) => <Svg {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"/></Svg>,
  Activity:   (p: SvgProps) => <Svg {...p}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Svg>,
  Filter:     (p: SvgProps) => <Svg {...p}><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></Svg>,
  Dot:        (p: SvgProps) => <Svg {...p} fill="currentColor" sw={0}><circle cx="12" cy="12" r="5"/></Svg>,
  Pause:      (p: SvgProps) => <Svg {...p}><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></Svg>,
  Play:       (p: SvgProps) => <Svg {...p}><path d="m6 4 14 8-14 8V4z"/></Svg>,
  Sliders:    (p: SvgProps) => <Svg {...p}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></Svg>,
  LogOut:     (p: SvgProps) => <Svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></Svg>,
  Flow:       (p: SvgProps) => <Svg {...p}><circle cx="5" cy="6" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="M7.2 7.2 10.8 16M16.8 7.2 13.2 16"/></Svg>,
};

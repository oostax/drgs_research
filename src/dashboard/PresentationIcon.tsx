import type { ReactNode } from 'react';
export type PresentationIconName = 'title' | 'smo' | 'sales-model' | 'strategy' | 'academy' | 'tb-tasks' | 'premises' | 'results' | 'next' | 'pause' | 'play';
const shapes: Record<PresentationIconName, ReactNode> = {
  title: <><path d="M14 3H5v18h14V8Z"/><path className="motion-detail" d="M14 3v5h5M8 12h8m-8 4h5"/></>,
  smo: <><path d="m3 8 9-5 9 5H3Zm2 3v6m5-6v6m4-6v6m5-6v6M3 21h18"/><path className="motion-detail" d="M3 18h18"/></>,
  'sales-model': <><path className="motion-detail" d="m3 17 6-6 4 4 8-10m-6 0h6v6"/></>,
  strategy: <><path d="M14 13H6l-3 3V4h14v6"/><path className="motion-detail" d="M10 10h11v11l-3-3h-8Z"/></>,
  academy: <><path d="m2 9 10-5 10 5-10 5Z"/><path className="motion-detail" d="M6 12v5q6 5 12 0v-5m4-3v8"/></>,
  'tb-tasks': <><path d="M8 5H5v16h14V5h-3M8 3h8v4H8Z"/><path className="motion-detail" d="m8 12 1 1 2-2m2 1h3m-8 5h8"/></>,
  premises: <><circle cx="12" cy="12" r="8"/><circle className="motion-detail" cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3"/></>,
  results: <><path d="M4 20h16"/><path className="motion-detail" d="M6 16v-5m6 5V5m6 11V8"/></>,
  next: <><path d="M5 21V3m1 1h13l-3 5 3 5H6"/><path className="motion-detail" d="M8 8h5"/></>,
  pause: <><path d="M8 5v14m8-14v14"/></>,
  play: <path d="m7 4 13 8-13 8Z"/>,
};
export function PresentationIcon({ name, size = 21 }: { name: PresentationIconName; size?: number }) {
  return <svg className={`presentation-icon icon-${name}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{shapes[name]}</svg>;
}

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useReducedMotion } from './Motion';
import './SupplementalGlyph.css';

// Matching SVG commands interpolate continuously; each icon keeps its own story.
const poses = {
  appeals: [
    ['M6 4 L22 4 Q26 4 26 8 L26 20 Q26 24 22 24 L10 24 L4 29 L4 8 Q4 4 6 4 Z',
      'M6 7 L26 7 Q28 7 28 9 L28 23 Q28 25 26 25 L6 25 L4 25 L4 9 Q4 7 6 7 Z'],
    ['M9 10 L21 10', 'M4 9 L16 18'],
    ['M9 16 L18 16', 'M16 18 L28 9'],
  ],
  payroll: [
    ['M6 8 L26 8 Q28 8 28 11 L28 24 Q28 27 25 27 L6 27 Q3 27 3 24 L3 11 Q3 8 6 8 Z',
      'M6 5 L26 5 Q28 5 28 8 L28 24 Q28 27 25 27 L6 27 Q3 27 3 24 L3 8 Q3 5 6 5 Z'],
    ['M6 8 L6 4 L22 4', 'M3 12 L16 12 L28 12'],
    ['M23 17 L25 17', 'M20 22 L24 22'],
  ],
};

export function SupplementalGlyph({ kind }: { kind: 'appeals' | 'payroll' }) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  useEffect(() => {
    if (!ref.current) return;
    if (!window.IntersectionObserver) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const label = kind === 'appeals' ? 'обращений' : 'ФОТ';
  return <button ref={ref} type="button" className={`supplemental-glyph supplemental-glyph-${kind}`}
    data-motion={!reduced && visible && pageVisible && !paused ? 'running' : 'paused'}
    disabled={reduced} aria-pressed={!paused} aria-label={`${paused ? 'Включить' : 'Приостановить'} анимацию иконки ${label}`}
    title={paused ? 'Включить анимацию' : 'Приостановить анимацию'} onClick={() => setPaused(p => !p)}>
    <svg width="25" height="28" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {poses[kind].map(([rest, alternate], i) => <path key={i} d={rest} style={{ '--glyph-rest': `path('${rest}')`, '--glyph-alternate': `path('${alternate}')` } as CSSProperties} />)}
    </svg>
  </button>;
}

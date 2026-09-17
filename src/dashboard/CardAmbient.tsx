import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "./Motion";
import "./CardAmbient.css";

/** Decorative corner paper, unrelated to chart values. Observe the whole card,
 * so a visible lower corner keeps moving after its heading leaves the viewport. */
export function CardAmbient({ kind }: { kind: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  useEffect(() => {
    const card = ref.current?.parentElement;
    if (!card) return;
    if (!window.IntersectionObserver) { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(card);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return <div ref={ref} className={`card-ambient ambient-${kind}`} data-running={!reduced && visible && pageVisible} aria-hidden="true">
    {["top", "bottom"].map(corner => <svg key={corner} className={`ambient-corner ambient-${corner}`} viewBox="0 0 240 140" fill="none" focusable="false">
      {kind === "meetings" ? <g className="ambient-ripples">{[0, 1, 2, 3].map(i => <circle key={i} className="ambient-ripple" cx="190" cy="28" r={18 + i * 23} style={{ "--phase": `${-i * 2.5}s` } as CSSProperties} />)}</g>
        : kind === "process" ? [0, 1, 2, 3, 4].map(i => <g key={i} transform={`translate(0 ${i * 18})`}><path className="ambient-contour" d="M0 35 C60 5 80 65 140 35 S210 5 240 35" style={{ "--phase": `${-i * 1.6}s` } as CSSProperties} /></g>)
        : Array.from({ length: 7 }, (_, row) => <g key={row} transform={`translate(8 ${10 + row * 19})`}>
          <g className="ambient-row" style={{ "--phase": `${-(row * .65)}s` } as CSSProperties}>
            {Array.from({ length: 12 }, (_, col) => <rect key={col} className="ambient-dot" x={col * 20} y="0" width="2.6" height="2.6" rx="1.3" style={{ "--phase": `${-(row + col) * .4}s` } as CSSProperties} />)}
          </g>
        </g>)}
    </svg>)}
  </div>;
}

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { Context } from "./types";
import { Icon } from "./Icons";
import { usePresentationHeight } from "./PresentationFrame";
import { adjacentPresentation } from "./presentationNavigation";
import { usePresentationInput } from "./usePresentationInput";
import "./WelcomePage.css";

/** Decorative SVG, not a video or canvas: sharp at every size, with no network assets. */
function WelcomeSculpture() {
  const id = useId().replace(/:/g, "");
  const paint = (name: string) => `url(#${id}-${name})`;
  return <svg className="welcome-sculpture" viewBox="0 0 720 720" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-emerald`} x1="148" y1="104" x2="428" y2="625" gradientUnits="userSpaceOnUse">
        <stop stopColor="#b7ff6d"/><stop offset=".24" stopColor="#37eb91"/><stop offset=".56" stopColor="#00ad75"/><stop offset="1" stopColor="#005d49"/>
      </linearGradient>
      <linearGradient id={`${id}-jade`} x1="100" y1="110" x2="474" y2="583" gradientUnits="userSpaceOnUse">
        <stop stopColor="#42e9ba"/><stop offset=".47" stopColor="#079b7e"/><stop offset="1" stopColor="#03523f"/>
      </linearGradient>
      <linearGradient id={`${id}-glass`} x1="164" y1="94" x2="432" y2="630" gradientUnits="userSpaceOnUse">
        <stop stopColor="#e2ff8d" stopOpacity=".9"/><stop offset=".45" stopColor="#80f1b0" stopOpacity=".32"/><stop offset="1" stopColor="#21ba9c" stopOpacity=".75"/>
      </linearGradient>
      <linearGradient id={`${id}-edge`} x1="174" y1="105" x2="481" y2="575" gradientUnits="userSpaceOnUse">
        <stop stopColor="white" stopOpacity=".92"/><stop offset=".55" stopColor="#dcffdc" stopOpacity=".48"/><stop offset="1" stopColor="#22ad7c" stopOpacity=".65"/>
      </linearGradient>
      <radialGradient id={`${id}-orb`} cx=".32" cy=".25" r=".8">
        <stop stopColor="#f8ffd0"/><stop offset=".34" stopColor="#c0f86c"/><stop offset=".72" stopColor="#64ce46"/><stop offset="1" stopColor="#119964"/>
      </radialGradient>
      <linearGradient id={`${id}-autumn`} x1="0" y1="0" x2="64" y2="78" gradientUnits="userSpaceOnUse">
        <stop stopColor="#f6e7a1"/><stop offset=".47" stopColor="#d7bb68"/><stop offset="1" stopColor="#86aa4e"/>
      </linearGradient>
      <radialGradient id={`${id}-shadow`}><stop stopColor="#075b40" stopOpacity=".24"/><stop offset="1" stopColor="#075b40" stopOpacity="0"/></radialGradient>
    </defs>
    <circle cx="364" cy="356" r="278" stroke="#12875d" strokeOpacity=".12"/>
    <circle cx="364" cy="356" r="225" stroke="#12875d" strokeOpacity=".1" strokeDasharray="2 12"/>
    <path d="M70 356h46m496 0h46M364 64v34m0 516v34" stroke="#168c65" strokeOpacity=".25"/>
    <g className="welcome-orbit">
      <circle cx="641" cy="356" r="5" fill="#129f73"/>
      <circle cx="364" cy="78" r="3" fill="#65c080"/>
      <circle cx="91" cy="403" r="3" fill="#129f73" fillOpacity=".4"/>
    </g>
    <ellipse className="welcome-ground" cx="372" cy="648" rx="240" ry="34" fill={paint("shadow")}/>
    <g transform="translate(135 -24) scale(.9)">
      <g className="welcome-ribbon welcome-ribbon-back">
        <path d="M146 109h108l245 251-245 251H146l245-251Z" fill={paint("glass")} stroke={paint("edge")} strokeWidth="1.5"/>
        <path d="m254 109 19 15 245 251-245 251-19-15 245-251Z" fill="#279d71" fillOpacity=".22"/>
      </g>
    </g>
    <g transform="translate(40 -7)">
      <g className="welcome-ribbon welcome-ribbon-main">
        <path d="M146 109h108l245 251-245 251H146l245-251Z" fill={paint("emerald")}/>
        <path d="m254 109 22 17 245 251-245 251-22-17 245-251Z" fill="#006c50"/>
        <path d="m146 611 22 17h108l-22-17Z" fill="#034f3d"/>
        <path d="M148 110h105l245 250-245 250H148" stroke={paint("edge")} strokeWidth="2"/>
        <path className="welcome-light-trace" d="m149 112 243 248-243 248" stroke="#efffcc" strokeWidth="3" strokeLinecap="round"/>
        <path d="m169 128 227 231-227 233" stroke="white" strokeOpacity=".15" strokeWidth="18"/>
      </g>
    </g>
    <g transform="translate(-52 62) scale(.83)">
      <g className="welcome-ribbon welcome-ribbon-front">
        <path d="M146 109h108l245 251-245 251H146l245-251Z" fill={paint("jade")}/>
        <path d="m254 109 23 17 245 251-245 251-23-17 245-251Z" fill="#004e40"/>
        <path d="m146 611 23 17h108l-23-17Z" fill="#0d6246"/>
        <path d="M148 110h105l245 250-245 250H148" stroke={paint("edge")} strokeWidth="2"/>
        <path className="welcome-light-trace welcome-light-trace-second" d="m149 112 243 248-243 248" stroke="#93ffe1" strokeWidth="2" strokeLinecap="round"/>
      </g>
    </g>
    <g className="welcome-orb">
      <circle cx="578" cy="163" r="40" fill={paint("orb")}/>
      <ellipse cx="566" cy="145" rx="16" ry="9" transform="rotate(-30 566 145)" fill="white" fillOpacity=".36"/>
      <circle cx="578" cy="163" r="39" stroke="white" strokeOpacity=".55"/>
    </g>
    <g transform="translate(136 552) rotate(-24)">
      <g className="welcome-leaf">
        <path d="M0 72C-8 34 11 7 58 0c13 43-5 71-58 72Z" fill={paint("autumn")} stroke="#f3e7be"/>
        <path d="M-5 80 46 15M9 61l27-4M21 42l-2-19" stroke="#738f40" strokeOpacity=".6" strokeWidth="1.4"/>
      </g>
    </g>
    <path d="m614 507 0 16m-8-8h16M180 117v12m-6-6h12" stroke="#1d9e76" strokeOpacity=".5" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

export function WelcomePage({ c, change }: { c: Context; change: (patch: Partial<Context>) => void }) {
  const root = useRef<HTMLElement>(null);
  const [ready, setReady] = useState(!document.fonts);
  const [hidden, setHidden] = useState(document.hidden);
  usePresentationHeight(root);
  useLayoutEffect(() => {
    let disposed = false;
    if (document.fonts) {
      // Reveal text only at final font metrics; no scale-fitting or typewriter reflow.
      void Promise.all([400, 500, 600, 700].map(weight =>
        document.fonts.load(`${weight} 16px "Golos Text"`, "Государственный сектор Осенняя квартальная встреча КИБ").catch(() => []),
      )).then(() => document.fonts.ready).then(() => { if (!disposed) setReady(true); });
    }
    return () => { disposed = true; };
  }, []);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  const destination = adjacentPresentation(c, 1);
  const next = () => { if (destination) change(destination.patch); };
  const gestures = usePresentationInput({ previous: () => {}, next });
  return <section ref={root} className="welcome-page" aria-label="Приветствие" data-ready={ready} data-motion-paused={hidden || undefined} {...gestures}>
    <div className="welcome-panel">
      <div className="welcome-glow" aria-hidden="true"/>
      <div className="welcome-copy">
        <h1 className="welcome-heading" aria-label="Государственный сектор">
          <span className="welcome-title-line">Государственный</span>
          <span className="welcome-title-line welcome-title-accent">сектор</span>
        </h1>
        <div className="welcome-event">
          <span className="welcome-event-mark" aria-hidden="true"/>
          <h2 className="welcome-event-title">Осенняя квартальная встреча <em>КИБ</em></h2>
        </div>
        <p className="welcome-speaker"><span aria-hidden="true"/>М.Л. Чачин</p>
      </div>
      <div className="welcome-art"><WelcomeSculpture/></div>
      <footer className="welcome-footer">
        <div className="welcome-signature"><span className="welcome-year">2026</span><span className="welcome-department">ДРГС</span></div>
        {destination && <button className="welcome-next" onClick={next} aria-label={`Далее: ${destination.label}`}>
          <span>К материалам встречи</span><span className="welcome-next-icon"><Icon name="arrow" size={22}/></span>
        </button>}
      </footer>
    </div>
  </section>;
}

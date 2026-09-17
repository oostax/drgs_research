import { type ReactNode, type RefObject, useLayoutEffect, useRef } from "react";
import "./PresentationStability.css";

const fontSpecs = [400, 500, 600, 700].map(weight => `${weight} 16px "Golos Text"`);
let pendingFonts: Promise<void> | undefined;
let fontsSettled = false;

/** Load every slide weight before revealing a layout measured with its final font metrics. */
function presentationFonts(): Promise<void> | undefined {
  if (!document.fonts || fontsSettled) return;
  if (fontSpecs.every(font => document.fonts.check(font, "Модель продаж"))) return;
  return pendingFonts ??= Promise.all(fontSpecs.map(font =>
    document.fonts.load(font, "Модель продаж").catch(() => []),
  )).then(() => document.fonts.ready).then(() => { fontsSettled = true; });
}

function syncPresentationHeight(element: HTMLElement | null) {
  if (!element || (window.visualViewport && window.visualViewport.scale > 1.01)) return;
  const header = document.querySelector<HTMLElement>(".pulse-header");
  const height = window.visualViewport?.height ?? window.innerHeight;
  const value = `${Math.max(120, height - (header?.offsetHeight ?? 0))}px`;
  if (element.style.getPropertyValue("--deck-height") !== value) element.style.setProperty("--deck-height", value);
}

/** Use the real header height, including wrapping, orientation and browser toolbar changes. */
export function usePresentationHeight(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const header = document.querySelector<HTMLElement>(".pulse-header");
    const update = () => syncPresentationHeight(element);
    update();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    if (header) observer?.observe(header);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [ref]);
}

/** Complete fitting before paint; only a real viewport change may refit a visible slide. */
export function PresentationFrame({ children, className = "", hidden, slide }: {
  children: ReactNode; className?: string; hidden?: boolean; slide: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const outer = frame.current, inner = content.current;
    if (!outer || !inner) return;
    let disposed = false, fontsReady = false;
    let lastWidth = -1, lastHeight = -1;
    const fit = () => {
      if (disposed || !fontsReady) return;
      // Child layout effects run first. Resolve header + deck geometry here too, not
      // one paint later in the parent's effect or its ResizeObserver notification.
      syncPresentationHeight(outer.closest<HTMLElement>(".sales-deck"));
      const width = outer.clientWidth, height = outer.clientHeight;
      if (!width || !height || (width === lastWidth && height === lastHeight)) return;
      const measure = (scale: number) => {
        inner.style.width = `${width / scale}px`;
        inner.style.setProperty("--slide-available-height", `${height / scale}px`);
        return inner.offsetHeight * scale;
      };
      let scale = 1;
      if (measure(1) > height + .5) {
        let low = .15, high = 1;
        for (let attempt = 0; attempt < 12; attempt++) {
          const candidate = (low + high) / 2;
          if (measure(candidate) <= height + .5) low = candidate;
          else high = candidate;
        }
        scale = low;
      }
      measure(scale);
      inner.style.setProperty("--slide-scale", String(scale));
      lastWidth = width;
      lastHeight = height;
      inner.style.visibility = "visible";
      outer.dataset.fitReady = "true";
    };
    const reveal = () => { if (!disposed) { fontsReady = true; fit(); } };
    const fonts = presentationFonts();
    if (fonts) void fonts.then(reveal); else reveal();
    // Never observe the element we resize: that fed our own measurement writes
    // back into layout and could visibly refit the slide throughout its entrance.
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    observer?.observe(outer);
    window.addEventListener("resize", fit);
    return () => { disposed = true; observer?.disconnect(); window.removeEventListener("resize", fit); };
  }, []);
  return <div ref={frame} className={`deck-stage ${className}`} aria-hidden={hidden || undefined} inert={hidden || undefined} data-slide={slide} data-fit-ready="false">
    <div ref={content} className="deck-fit-content">{children}</div>
  </div>;
}

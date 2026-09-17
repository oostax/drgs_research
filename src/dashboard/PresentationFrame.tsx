import { type ReactNode, type RefObject, useLayoutEffect, useRef } from "react";

/** Use the real header height, including wrapping, orientation and browser toolbar changes. */
export function usePresentationHeight(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const header = document.querySelector<HTMLElement>(".pulse-header");
    const update = () => {
      if (window.visualViewport && window.visualViewport.scale > 1.01) return;
      const height = window.visualViewport?.height ?? window.innerHeight;
      element.style.setProperty("--deck-height", `${Math.max(120, height - (header?.offsetHeight ?? 0))}px`);
    };
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

/** Reflow at the available width, then contain the entire slide without cropping. */
export function PresentationFrame({ children, className = "", hidden, slide }: {
  children: ReactNode; className?: string; hidden?: boolean; slide: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const outer = frame.current, inner = content.current;
    if (!outer || !inner) return;
    let disposed = false;
    const fit = () => {
      if (disposed || !outer.clientWidth || !outer.clientHeight) return;
      const width = outer.clientWidth, height = outer.clientHeight;
      const measure = (scale: number) => {
        inner.style.width = `${width / scale}px`;
        inner.style.setProperty("--slide-available-height", `${height / scale}px`);
        return inner.offsetHeight * scale;
      };
      // Keep the full width when fitting: expanding the layout first avoids a tiny,
      // narrow column with unused margins on phones. Search for the largest legible scale.
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
      inner.style.visibility = "visible";
    };
    fit();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    observer?.observe(outer);
    observer?.observe(inner);
    document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => { disposed = true; observer?.disconnect(); window.removeEventListener("resize", fit); };
  }, []);
  return <div ref={frame} className={`deck-stage ${className}`} aria-hidden={hidden || undefined} inert={hidden || undefined} data-slide={slide}>
    <div ref={content} className="deck-fit-content">{children}</div>
  </div>;
}

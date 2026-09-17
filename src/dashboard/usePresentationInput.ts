import { type TouchEvent, useEffect, useRef } from "react";

const interactive = "a, button, input, select, textarea, summary, [contenteditable]:not([contenteditable='false']), [role='slider'], [role='tab'], [role='combobox'], [role='dialog']";
export type SwipeStart = { x: number; y: number; at: number; width: number };
export function swipeDirection(start: SwipeStart, x: number, y: number, at: number): -1 | 0 | 1 {
  const dx = x - start.x, dy = y - start.y;
  const threshold = Math.min(90, Math.max(44, start.width * .12));
  if (at - start.at > 1100 || Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.5) return 0;
  return dx < 0 ? 1 : -1;
}

export function usePresentationInput({ previous, next, first, last, keyboard = true }: {
  previous: () => void; next: () => void; first?: () => void; last?: () => void; keyboard?: boolean;
}) {
  const callbacks = useRef({ previous, next, first, last });
  callbacks.current = { previous, next, first, last };
  const start = useRef<SwipeStart | null>(null);
  useEffect(() => {
    if (!keyboard) return;
    const key = (event: KeyboardEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat) return;
      if (target?.closest(interactive) && !target.closest(".deck-controls")) return;
      const action = event.key === "ArrowRight" || event.key === "PageDown" ? callbacks.current.next
        : event.key === "ArrowLeft" || event.key === "PageUp" ? callbacks.current.previous
        : event.key === "Home" ? callbacks.current.first : event.key === "End" ? callbacks.current.last : undefined;
      if (action) { event.preventDefault(); action(); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [keyboard]);
  return {
    onTouchStart(event: TouchEvent<HTMLElement>) {
      start.current = null;
      if (event.touches.length !== 1 || (window.visualViewport?.scale ?? 1) > 1.01) return;
      if (event.target instanceof Element && event.target.closest(interactive)) return;
      const touch = event.touches[0];
      // Leave system edge-back gestures and pinch zoom to the browser.
      if (touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return;
      start.current = { x: touch.clientX, y: touch.clientY, at: performance.now(), width: event.currentTarget.clientWidth };
    },
    onTouchMove(event: TouchEvent<HTMLElement>) {
      if (!start.current) return;
      if (event.touches.length !== 1) { start.current = null; return; }
      const touch = event.touches[0];
      if (Math.abs(touch.clientY - start.current.y) > 20 && Math.abs(touch.clientY - start.current.y) > Math.abs(touch.clientX - start.current.x)) start.current = null;
    },
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      const origin = start.current;
      start.current = null;
      if (!origin || event.touches.length || event.changedTouches.length !== 1 || window.getSelection()?.toString()) return;
      const touch = event.changedTouches[0];
      const direction = swipeDirection(origin, touch.clientX, touch.clientY, performance.now());
      if (direction === 1) callbacks.current.next();
      if (direction === -1) callbacks.current.previous();
    },
    onTouchCancel() { start.current = null; },
  };
}

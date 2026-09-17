import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useReducedMotion } from "./Motion";

const STEP_MS = 4_000;
const RESUME_MS = 30_000;

/** Local UI playback only. Hover/focus suspend immediately; every departure or
 * interaction restarts the full quiet period. No queued catch-up when hidden. */
export function useWeekPlayback(anchor: RefObject<HTMLElement | null>, advance: () => void, count: number) {
  const reduced = useReducedMotion();
  const [enabled, setEnabled] = useState(true);
  const [running, setRunning] = useState(false);
  const callback = useRef(advance);
  useLayoutEffect(() => { callback.current = advance; }, [advance]);
  useEffect(() => {
    const card = anchor.current?.closest("article");
    if (!card || !enabled || reduced || count < 2) { setRunning(false); return; }
    let hovered = card.matches(":hover");
    let focused = card.contains(document.activeElement) && document.documentElement.dataset.input === "keyboard";
    let visible = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let nextAt = Date.now() + STEP_MS;
    const stop = () => { clearTimeout(timer); timer = undefined; setRunning(false); };
    const schedule = () => {
      stop();
      if (hovered || focused || !visible || document.hidden) return;
      setRunning(true);
      timer = setTimeout(() => {
        callback.current();
        nextAt = Date.now() + STEP_MS;
        schedule();
      }, Math.max(0, nextAt - Date.now()));
    };
    const cooldown = () => { nextAt = Date.now() + RESUME_MS; schedule(); };
    const enter = (e: PointerEvent) => { if (e.pointerType !== "touch") { hovered = true; stop(); } };
    const leave = (e: PointerEvent) => { if (e.pointerType !== "touch") { hovered = false; cooldown(); } };
    const pointer = () => { focused = false; cooldown(); };
    const key = () => { focused = true; stop(); };
    const focus = () => {
      if (document.documentElement.dataset.input === "keyboard" || document.activeElement?.matches(":focus-visible")) { focused = true; stop(); }
    };
    const blur = (e: FocusEvent) => {
      if (!card.contains(e.relatedTarget as Node | null)) { focused = false; cooldown(); }
    };
    const visibility = () => { if (document.hidden) stop(); else cooldown(); };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      const changed = visible !== entry.isIntersecting;
      visible = entry.isIntersecting;
      if (!visible) stop(); else if (changed) cooldown();
    });
    observer?.observe(card);
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointerleave", leave);
    card.addEventListener("pointerdown", pointer);
    card.addEventListener("keydown", key);
    card.addEventListener("focusin", focus);
    card.addEventListener("focusout", blur);
    document.addEventListener("visibilitychange", visibility);
    schedule();
    return () => {
      clearTimeout(timer); observer?.disconnect();
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointerleave", leave);
      card.removeEventListener("pointerdown", pointer);
      card.removeEventListener("keydown", key);
      card.removeEventListener("focusin", focus);
      card.removeEventListener("focusout", blur);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [anchor, count, enabled, reduced]);
  return { enabled, running, reduced, toggle: () => setEnabled(v => !v) };
}

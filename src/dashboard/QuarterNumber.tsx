import { useLayoutEffect, useRef } from "react";
import NumberFlow, { continuous, useIsSupported } from "@number-flow/react";
import { useReducedMotion } from "./Motion";

const timing = { duration: 280, easing: "cubic-bezier(0.23, 1, 0.32, 1)" };
const plugins = [continuous];

/** Quarter and filter value changes roll. Missing values never become invented zeroes.
 * NumberFlow retargets in-flight digit transforms; assistive technology gets
 * the final value rather than announcements of intermediate frames. */
export function QuarterNumber({ value, text, quarter, digits = 0, fixed = false, signed = false, suffix = "" }: {
  value: number | null | undefined;
  text: string;
  quarter: number;
  digits?: number;
  fixed?: boolean;
  signed?: boolean;
  suffix?: string;
}) {
  const supported = useIsSupported();
  const reduced = useReducedMotion();
  const canAnimate = supported && !reduced;
  const previous = useRef({ value, quarter });
  const animated = canAnimate && document.documentElement.dataset.input !== "keyboard"
    && previous.current.value != null
    && (previous.current.quarter !== quarter || previous.current.value !== value);
  useLayoutEffect(() => { previous.current = { value, quarter }; }, [value, quarter]);
  if (value == null || !canAnimate) return <>{text}</>;
  return <span className="quarter-number" aria-label={text}>
    <NumberFlow value={value} locales="ru-RU" aria-hidden="true" animated={animated}
      format={{ maximumFractionDigits: digits, minimumFractionDigits: fixed ? digits : 0, signDisplay: signed ? "exceptZero" : "auto" }}
      suffix={suffix} plugins={plugins} transformTiming={timing} spinTiming={timing}
      opacityTiming={{ duration: 160, easing: timing.easing }} />
  </span>;
}

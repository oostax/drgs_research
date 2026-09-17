import { useEffect, useState } from "react";

export function useInputModality() {
  useEffect(() => {
    const keyboard = () => { document.documentElement.dataset.input = "keyboard"; };
    const pointer = () => { document.documentElement.dataset.input = "pointer"; };
    window.addEventListener("keydown", keyboard, true);
    window.addEventListener("pointerdown", pointer, true);
    return () => {
      window.removeEventListener("keydown", keyboard, true);
      window.removeEventListener("pointerdown", pointer, true);
    };
  }, []);
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return;
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return reduced;
}

const contours: Record<string, [string, string]> = {
  sales: [
    "M3 18C6 18 7 11 10 11C13 11 14 15 17 10C19 7 20 5 22 4",
    "M3 18C6 18 7 15 10 14C13 13 14 8 17 8C19 8 20 5 22 4",
  ],
  complex: [
    "M3 7L12 2L21 7L12 12Z M3 12L12 17L21 12 M3 17L12 22L21 17",
    "M3 8L12 4L21 8L12 12Z M3 12L12 16L21 12 M3 16L12 20L21 16",
  ],
  meetings: [
    "M3 20C3 11 15 11 15 20 M6 7C6 3 12 3 12 7C12 11 6 11 6 7 M18 5C23 5 23 11 18 11 M18 15C21 15 22 17 22 20",
    "M3 20C3 13 15 13 15 20 M6 8C6 4 12 4 12 8C12 12 6 12 6 8 M18 6C23 6 23 12 18 12 M18 16C21 16 22 18 22 20",
  ],
  process: [
    "M2 13C5 13 5 6 8 6C11 6 11 19 14 19C17 19 17 10 20 10C21 10 22 11 23 11",
    "M2 13C5 13 5 10 8 10C11 10 11 15 14 15C17 15 17 7 20 7C21 7 22 9 23 9",
  ],
  appeals: [
    "M4 5C4 3 20 3 20 5L20 16C20 19 11 18 8 18L4 21Z M8 9L16 9 M8 13L13 13",
    "M4 6C4 4 20 4 20 6L20 15C20 18 11 17 8 17L4 21Z M8 10L15 10 M8 14L16 14",
  ],
  payroll: [
    "M4 5L20 5Q22 5 22 8L22 18Q22 20 20 20L4 20Q2 20 2 18L2 8Q2 5 4 5 M2 10L22 10 M16 15L18 15",
    "M4 6L20 6Q22 6 22 9L22 17Q22 19 20 19L4 19Q2 19 2 17L2 9Q2 6 4 6 M2 11L22 11 M15 15L19 15",
  ],
  brand: [
    "M2 15C5 3 10 4 12 14C14 24 20 24 23 8",
    "M2 15C5 11 10 7 12 13C14 19 20 21 23 8",
  ],
};

/** A short contour morph confirms arrival or changed context; never moves its box. */
export function MetricGlyph({
  name,
  revision = "",
  size = 24,
}: {
  name: string;
  revision?: string;
  size?: number;
}) {
  const reduced = useReducedMotion();
  const [rest, alternate] = contours[name] || contours.process;
  return (
    <svg
      key={`${name}-${revision}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="morph-glyph"
    >
      <path d={rest}>
        {!reduced && document.documentElement.dataset.input !== "keyboard" && (
          <animate
            attributeName="d"
            values={`${rest};${alternate};${rest}`}
            dur="1.25s"
            repeatCount="1"
            calcMode="spline"
            keyTimes="0;.45;1"
            keySplines=".22 1 .36 1;.22 1 .36 1"
          />
        )}
      </path>
    </svg>
  );
}

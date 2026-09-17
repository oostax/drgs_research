import { useEffect, useId, useRef, useState } from "react";
import {
  delta,
  format,
  groupNames,
  metricNames,
  quarters,
  statusText,
} from "./model";
import type { Group, Metric, Stat } from "./types";
export function AnimatedNumber({
  stat,
  metric,
  large = false,
}: {
  stat: Stat;
  metric: Metric;
  large?: boolean;
}) {
  const [n, setN] = useState(stat.value);
  const previous = useRef(stat.value);
  useEffect(() => {
    if (
      stat.value == null ||
      previous.current == null ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.dataset.input === "keyboard"
    ) {
      setN(stat.value);
      previous.current = stat.value;
      return;
    }
    const startValue = previous.current,
      end = stat.value,
      start = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const p = Math.min(1, (time - start) / 240);
      previous.current = startValue + (end - startValue) * (1 - (1 - p) ** 3);
      setN(previous.current);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [stat.value]);
  return (
    <span
      className={`${large ? "number-large" : "number"} ${stat.value == null ? "muted-number" : ""}`}
      title={stat.reason}
    >
      {format(stat.value == null ? null : n, metric)}
    </span>
  );
}
export function Delta({
  current,
  previous,
  metric,
}: {
  current: Stat;
  previous: Stat;
  metric: Metric;
}) {
  const d = delta(current, previous, metric);
  return d ? (
    <span className={`delta ${d.tone}`}>{d.text}</span>
  ) : (
    <span className="delta absent">—</span>
  );
}
export function QuarterChart({
  series,
  metric,
  onQuarter,
  selectedQuarter = 3,
  compact = false,
}: {
  series: { group: Group; values: Stat[] }[];
  metric: Metric;
  onQuarter?: (q: number) => void;
  selectedQuarter?: number;
  compact?: boolean;
}) {
  const hatchId = useId().replace(/:/g, "");
  const [active, setActive] = useState(selectedQuarter - 1);
  useEffect(() => setActive(selectedQuarter - 1), [selectedQuarter]);
  const score = metric === "process" || metric === "leads";
  const complex = metric === "complex" || metric === "complexShare";
  const plotted = (v: Stat) =>
    metric === "complex"
      ? v.value != null && v.denominator
        ? (v.value / v.denominator) * 100
        : null
      : (v.value ?? (metric === "meetings" ? (v.observed ?? null) : null));
  const numbers = series.flatMap((s) => s.values.map((v) => plotted(v) ?? 0));
  const peak = Math.max(...numbers, 1);
  const max = score
    ? 3
    : complex
      ? Math.min(100, Math.max(5, Math.ceil((peak * 1.12) / 5) * 5))
      : peak * 1.15;
  const min = score ? 1 : 0;
  const y = (n: number) => 133 - ((n - min) / (max - min)) * 112;
  const xs = [90, 246, 402];
  const colors = {
    pilot: complex ? "#7053a5" : "#176449",
    nonpilot: "#586c83",
  };
  const hasObserved =
    metric === "meetings" &&
    series.some((s) => s.values.some((v) => v.observed != null));
  const axis = (v: number) =>
    score
      ? String(v)
      : complex
        ? Math.round(v) + "%"
        : v >= 1000
          ? new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(
              v / 1000,
            ) + " тыс."
          : format(Math.round(v));
  return (
    <div
      className={"quarter-chart chart-v2 " + (complex ? "chart-complex " : "") + (compact ? "chart-compact" : "")}
      onPointerLeave={() => setActive(selectedQuarter - 1)}
    >
      {!compact && <div className="chart-heading">
        <span>
          {score
            ? "Оценка по шкале 1–3"
            : complex
              ? "Доля в портфеле без ФОТ"
              : "Динамика по кварталам"}
        </span>
        <span className="chart-unit">
          {complex ? "%" : score ? "баллы" : "количество"}
        </span>
      </div>}
      <div className="chart-legend">
        {series.map((s) => (
          <span key={s.group}>
            <i style={{ background: colors[s.group] }} />
            {groupNames[s.group]}
          </span>
        ))}
      </div>
      <svg
        viewBox="0 0 480 156"
        preserveAspectRatio="none"
        className="plot-svg"
        role="img"
        aria-label={
          metricNames[metric] +
          ": " +
          series
            .map(
              (s) =>
                groupNames[s.group] +
                ": " +
                s.values
                  .map(
                    (v) =>
                      format(v.value ?? v.observed, metric) +
                      (v.observed != null ? " — итог на сверке" : ""),
                  )
                  .join(", "),
            )
            .join("; ")
        }
      >
        <defs>
          <pattern
            id={hatchId}
            width="6"
            height="6"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(40)"
          >
            <line y2="6" stroke="white" strokeWidth="1.5" opacity=".45" />
          </pattern>
        </defs>
        <rect
          x="24"
          y="6"
          width="132"
          height="139"
          rx="12"
          className="chart-period-focus"
          style={{ transform: "translateX(" + active * 156 + "px)" }}
        />
        {[min, (max + min) / 2, max].map((tick, i) => (
          <g key={i}>
            <line
              x1="22"
              x2="472"
              y1={y(tick)}
              y2={y(tick)}
              className={i ? "gridline" : "baseline"}
            />
            {i > 0 && (
              <text x="26" y={y(tick) - 5} className="plot-axis">
                {axis(tick)}
              </text>
            )}
          </g>
        ))}
        {series.map((s, si) =>
          score ? (
            <g key={s.group}>
              {[0, 1].map((i) =>
                s.values[i].value != null && s.values[i + 1].value != null ? (
                  <path
                    key={i}
                    d={
                      "M" +
                      xs[i] +
                      " " +
                      y(s.values[i].value!) +
                      "L" +
                      xs[i + 1] +
                      " " +
                      y(s.values[i + 1].value!)
                    }
                    fill="none"
                    stroke={colors[s.group]}
                    strokeWidth="3"
                    className="plot-line"
                  />
                ) : null,
              )}
              {s.values.map((v, i) =>
                v.value != null ? (
                  <g key={i}>
                    <circle
                      cx={xs[i]}
                      cy={y(v.value)}
                      r="10"
                      fill={colors[s.group]}
                      opacity=".1"
                      className="plot-point"
                    />
                    <circle
                      cx={xs[i]}
                      cy={y(v.value)}
                      r="5"
                      fill={colors[s.group]}
                      stroke="white"
                      strokeWidth="2"
                      className="plot-point"
                    />
                  </g>
                ) : null,
              )}
            </g>
          ) : (
            <g key={s.group}>
              {s.values.map((v, i) => {
                const n = plotted(v);
                const x =
                  xs[i] + (series.length === 1 ? -17 : si === 0 ? -37 : 4);
                if (n == null)
                  return (
                    <text
                      key={i}
                      x={x + 16}
                      y="116"
                      textAnchor="middle"
                      className="plot-missing"
                    >
                      —
                    </text>
                  );
                const h = n === 0 ? 0 : Math.max(1, 133 - y(n));
                return (
                  <g key={i}>
                    <rect
                      x={x}
                      y={y(n)}
                      width="33"
                      height={h}
                      rx="6"
                      fill={colors[s.group]}
                      className="plot-bar"
                      style={
                        {
                          opacity: active === i ? 1 : 0.82,
                          y: y(n),
                          height: h,
                        } as React.CSSProperties
                      }
                    />
                    {v.observed != null && (
                      <rect
                        x={x}
                        y={y(n)}
                        width="33"
                        height={h}
                        rx="6"
                        fill={"url(#" + hatchId + ")"}
                        pointerEvents="none"
                        style={{ y: y(n), height: h } as React.CSSProperties}
                        className="plot-bar"
                      />
                    )}
                  </g>
                );
              })}
            </g>
          ),
        )}
      </svg>
      <div className="quarter-grid">
        {quarters.map((q, i) => (
          <button
            className={
              "quarter-column " + (i === active ? "is-highlighted" : "")
            }
            key={q}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(selectedQuarter - 1)}
            onClick={() => onQuarter?.(i + 1)}
            aria-label={metricNames[metric] + ": открыть " + q}
          >
            <span className="quarter-label">
              {compact ? q.replace("квартал", "кв.") : q}
              {i === 2 && <i aria-hidden="true" className="partial-marker" />}
            </span>
            {series.map((s) => {
              const v = s.values[i],
                n = plotted(v);
              const d =
                i > 0 && !complex ? delta(v, s.values[i - 1], metric) : null;
              return (
                <span key={s.group} className={"quarter-cell text-" + s.group}>
                  <span className="quarter-value">
                    <i
                      className="series-key"
                      style={{ background: colors[s.group] }}
                    />
                    {v.value == null ? (
                      metric === "meetings" && v.observed != null ? (
                        format(v.observed) + "*"
                      ) : (
                        <span className="unknown">{statusText(v)}</span>
                      )
                    ) : (
                      format(v.value, metric)
                    )}
                  </span>
                  {metric === "complex" && n != null && (
                    <span className="quarter-secondary">
                      {format(n, "complexShare")}
                    </span>
                  )}
                  {!complex && !compact && (
                    <span className={"quarter-change " + (d?.tone || "")}>
                      {d
                        ? d.text
                        : i === 0 && v.value != null
                          ? "База сравнения"
                          : "—"}
                    </span>
                  )}
                </span>
              );
            })}
          </button>
        ))}
      </div>
      {hasObserved && (
        <p className="chart-evidence-note">
          * По имеющимся строкам. Полный итог требует сверки.
        </p>
      )}
    </div>
  );
}

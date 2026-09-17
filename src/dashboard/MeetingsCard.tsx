import { CardAmbient } from "./CardAmbient";
import { NumberFlowGroup } from "@number-flow/react";
import { useEffect, useRef, useState } from "react";
import type { Context, Manifest, Stat } from "./types";
import { contextUrl, delta, format, quarters, selectedGroups, statusText, value, view } from "./model";
import { perManager, formatPerManager } from "./funnelModel";
import { Icon } from "./Icons";
import { useReducedMotion } from "./Motion";
import { QuarterNumber } from "./QuarterNumber";
import "./MeetingsCard.css";

// Fikri “Branch Sales Statics”: cohort totals above thin, unfilled straight
// lines and a quiet horizontal scale. Only actual quarterly points are drawn.
// Coverage has a separate 0–100% scale; it is never a second count-chart axis.
const count = (stat: Stat) => stat.value ?? stat.observed ?? null;
const partial = (stat: Stat) => stat.value == null && stat.observed != null;

// Decorative meeting story, never a claim about the underlying meeting status.
export function MeetingsGlyph() {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const ref = useRef<HTMLButtonElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const moving = !reduced && !paused && visible && pageVisible;
  useEffect(() => {
    if (!window.IntersectionObserver || !ref.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (moving) svgRef.current?.unpauseAnimations?.();
    else svgRef.current?.pauseAnimations?.();
  }, [moving]);
  // Open the bottom of each circular head into a bubble; the shoulder contour
  // joins those same endpoints as its tail. Neither stroke crosses the other.
  const head = (cx: number) => {
    const k = 4 * (4 / 3 * Math.tan(Math.PI / 8));
    return `M${cx} 13C${cx-k} 13 ${cx-4} ${9+k} ${cx-4} 9C${cx-4} ${9-k} ${cx-k} 5 ${cx} 5C${cx+k} 5 ${cx+4} ${9-k} ${cx+4} 9C${cx+4} ${9+k} ${cx+k} 13 ${cx} 13`;
  };
  const people = [
    head(9),
    "M2 27C2 21 4 18 9 18C14 18 16 21 16 27",
    head(23),
    "M16 27C16 21 18 18 23 18C28 18 30 21 30 27",
  ];
  const dialogue = [
    "M6 17C2 17 2 15 2 10C2 5 4 3 10 3C16 3 18 5 18 10C18 15 16 17 12 17",
    "M6 17C6 18 6 20 6 22C8 20 10 18 12 17",
    "M20 25C16 25 14 23 14 18C14 13 16 11 22 11C28 11 30 13 30 18C30 23 30 25 26 25",
    "M20 25C22 26 24 28 26 30C26 28 26 26 26 25",
  ];
  return <button ref={ref} className="meetings-glyph" type="button"
    data-motion={moving ? "running" : "paused"}
    data-reduced={reduced} disabled={reduced} aria-pressed={!paused}
    aria-label={`${paused ? "Включить" : "Приостановить"} анимацию иконки встреч`}
    onClick={() => setPaused(p => !p)}>
    <svg ref={svgRef} width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {people.map((path, i) => <path key={i} className="meetings-morph-path" d={path} fill={i % 2 === 0 ? "white" : "none"}>
        {!reduced && <animate attributeName="d"
          values={`${path};${path};${dialogue[i]};${dialogue[i]};${path};${path}`}
          keyTimes="0;.25;.4;.75;.9;1" dur="6s" repeatCount="indefinite" calcMode="spline"
          keySplines=".77 0 .175 1;.77 0 .175 1;.77 0 .175 1;.77 0 .175 1;.77 0 .175 1" />}
      </path>)}
    </svg>
  </button>;
}

export function MeetingsCard({ data, c, change }: {
  data: Manifest; c: Context; change: (patch: Partial<Context>) => void;
}) {
  const groups = selectedGroups(data, c);
  const series = groups.map(group => ({ group,
    managers: view(data, c, group).kmCount,
    periods: [1, 2, 3].map(q => value(data, c, group, "meetings", q)),
    coverage: value(data, c, group, "coverage"),
  }));
  const peak = Math.max(1, ...series.flatMap(s => s.periods.map(p => count(p) ?? 0)));
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const ceiling = Math.ceil(peak / magnitude) * magnitude;
  const x = (index: number) => 52 + index * 145;
  const y = (n: number) => 140 - n / ceiling * 120;
  const hasPartial = series.some(s => s.periods.some(partial));
  const coveragePending = series.some(s => s.coverage.value == null);
  const target = (metric: "meetings" | "coverage") => ({ ...c, page: "analysis" as const, metric });
  const open = (event: React.MouseEvent<HTMLAnchorElement>, metric: "meetings" | "coverage") => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); change({ page: "analysis", metric });
  };
  return <article className="metric-card metric-meetings sales-card meetings-card" aria-labelledby="meetings-title">
    <CardAmbient kind={"meetings"} />
    <header className="sales-heading">
      <MeetingsGlyph />
      <div className="funnel-heading-copy">
        <h2 id="meetings-title">Встречи и покрытие</h2>
        <p>Старшая и младшая роль</p>
      </div>
      <a className="sales-open" href={contextUrl(target("meetings"))} aria-label="Открыть анализ встреч" onClick={e => open(e, "meetings")}><Icon name="arrow" size={21} /></a>
    </header>
    <div className="sales-period"><div className="sales-period-label"><strong>{quarters[c.quarter - 1]}</strong><span>{c.quarter > 1 ? `к ${["I", "II"][c.quarter - 2]} кварталу` : "Начало периода"}</span></div></div>
    <NumberFlowGroup key={`${c.branch}:${c.role}:${c.group}:${c.scope}`}>
      <div className="sales-summary" data-groups={groups.length} aria-live="polite" aria-atomic="true">
        <div className="sales-totals" data-groups={groups.length}>
          {series.map(s => {
            const current = s.periods[c.quarter - 1];
            const primary = perManager(count(current), s.managers);
            const diff = c.quarter > 1 ? delta(current, s.periods[c.quarter - 2], "meetings") : null;
            return <section className={`sales-total sales-${s.group}`} key={s.group} aria-label={s.group === "pilot" ? "Пилот" : "Непилот"}>
              <span className="sales-group"><i />{s.group === "pilot" ? "Пилот" : "Непилот"}</span>
              <strong className="sales-number"><QuarterNumber value={primary} text={formatPerManager(primary)} quarter={c.quarter} digits={1} />{partial(current) && <sup>*</sup>}</strong>
              <span className="funnel-unit">встреч на 1 КМ</span>
              <div className="funnel-absolute"><strong>{format(count(current))}</strong> встреч <span>· {s.managers == null ? "нет штата" : `${format(s.managers)} КМ`}</span></div>
              <div className="sales-change">{diff ? <span className={`sales-delta ${diff.tone}`}><QuarterNumber value={diff.value} text={diff.text} quarter={c.quarter} digits={diff.digits} signed suffix={diff.suffix} /></span>
                : <span className={current.status === "unverified" ? "meetings-status" : "sales-unavailable"}>{current.status !== "ready" ? statusText(current) : c.quarter === 1 ? "Первый квартал" : "Нет базы сравнения"}</span>}</div>
            </section>;
          })}
        </div>
      </div>
    </NumberFlowGroup>
    <div className="meetings-trend" aria-label="Количество встреч по кварталам">
      <p className="meetings-trend-label">Количество встреч по кварталам</p>
      <svg className="meetings-line-chart" viewBox="0 0 390 160" role="img" aria-label={series.map(s => `${s.group === "pilot" ? "Пилот" : "Непилот"}: ${s.periods.map((p, i) => `${quarters[i]} — ${format(count(p))}`).join(", ")}`).join(". ")}>
        {[ceiling, ceiling / 2, 0].map(tick => <g key={tick} className="meetings-guide">
          <line x1="40" x2="360" y1={y(tick)} y2={y(tick)} />
          <text x="31" y={y(tick) + 4} textAnchor="end">{tick >= 1000 ? `${format(tick / 1000)}к` : format(tick)}</text>
        </g>)}
        {series.map(s => <g key={s.group} className={`meetings-line-series sales-${s.group}`}>
          <path className="meetings-line" d={s.periods.map((stat, i) => {
            const n = count(stat);
            return n == null ? "" : `${i === 0 || count(s.periods[i - 1]) == null ? "M" : "L"}${x(i)},${y(n)}`;
          }).join(" ")} />
          {s.periods.map((stat, i) => {
            const n = count(stat);
            return n == null ? null : <g className={`meetings-point ${c.quarter === i + 1 ? "is-selected" : ""}`} key={i}>
              <circle cx={x(i)} cy={y(n)} r={c.quarter === i + 1 ? 4 : 2.5} />
              <text x={x(i)} y={y(n) + (s.group === "pilot" && groups.length > 1 ? 19 : -12)} textAnchor="middle">{format(n)}</text>
            </g>;
          })}
        </g>)}
      </svg>
    </div>
        <section className="meetings-coverage" aria-label="Покрытие клиентской базы">
          <a className="coverage-heading" href={contextUrl(target("coverage"))} onClick={e => open(e, "coverage")} aria-label="Открыть анализ покрытия">
            <h3>Покрытие <span>с 1 апреля</span></h3><Icon name="arrow" size={16} />
          </a>
          <div className="sales-totals" data-groups={groups.length}>
            {series.map(s => <div className={`coverage-value sales-${s.group}`} key={s.group} aria-label={`Покрытие: ${s.group === "pilot" ? "Пилот" : "Непилот"}`}>
              <div className="coverage-label"><span>{s.group === "pilot" ? "Пилот" : "Непилот"}</span>{s.coverage.value != null && <strong>{format(s.coverage.value, "coverage")}</strong>}</div>
              {s.coverage.value != null ? <><span className="coverage-track" role="meter" aria-label={`Покрытие ${s.group === "pilot" ? "пилота" : "непилота"}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={s.coverage.value}><span style={{ width: `${Math.min(100, Math.max(0, s.coverage.value))}%` }} /></span>{s.coverage.numerator != null && s.coverage.denominator != null && <span>{format(s.coverage.numerator)} из {format(s.coverage.denominator)} клиентов</span>}</>
                : <strong className="coverage-pending">{statusText(s.coverage)}</strong>}
            </div>)}
          </div>
        </section>
    <div className="meetings-quarter-tabs" role="group" aria-label="Квартал встреч">
      {[1, 2, 3].map(q => <button type="button" key={q} aria-label={`Выбрать ${quarters[q - 1]}`} aria-pressed={c.quarter === q} onClick={() => change({ quarter: q })}>
        {["I", "II", "III"][q - 1]} кв.
      </button>)}
    </div>
    {(hasPartial || coveragePending) && <footer className="sales-notes meetings-notes">
      {hasPartial && <span>* По имеющимся строкам. Итоги и динамика — на сверке.</span>}
      {coveragePending && <span>Покрытие ожидает сверки клиентской базы.</span>}
    </footer>}
  </article>;
}

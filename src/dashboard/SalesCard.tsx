import { CardAmbient } from "./CardAmbient";
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { Context, Manifest } from "./types";
import { contextUrl, delta, format, quarters, selectedGroups, statusText, value, view } from "./model";
import { Icon } from "./Icons";
import { useReducedMotion } from "./Motion";
import { NumberFlowGroup } from "@number-flow/react";
import { QuarterNumber } from "./QuarterNumber";
import { WeeklySales } from "./WeeklySales";
import { funnelStat, perManager, formatPerManager, stageKeys, funnelStages, type FunnelStage } from "./funnelModel";
import "./SalesCard.css";

/* Sales card: the user's grouped-bar reference, adapted to real counts, not
   invented percentages. Equal pilot/comparison prominence, large black totals,
   emerald/indigo data, three selectable quarters, one analysis destination.
   Motion: fixed geometry, interruptible selection; the icon morphs its own paths.
   This is one of six metrics; eligibility and source uncertainty remain intact. */
export function SalesGlyph({ complex = false }: { complex?: boolean }) {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const ref = useRef<HTMLButtonElement>(null);
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
  const moving = !reduced && !paused && visible && pageVisible;
  // Three legible poses, with a hold between each morph. Every path keeps its
  // command topology, so the vectors interpolate rather than swap silhouettes.
  const rest = complex
    ? ["M4 8L16 2L28 8L16 14Z", "M4 15L16 9L28 15L16 21Z", "M4 22L16 16L28 22L16 28Z"]
    : ["M5 24C5 20 5 17 5 14", "M16 24C16 19 16 13 16 8", "M27 24C27 18 27 10 27 3"];
  const unfold = complex
    ? ["M10 6L16 3L22 6L16 9Z", "M2 20L8 17L14 20L8 23Z", "M18 20L24 17L30 20L24 23Z"]
    : ["M4 24C7 24 8 16 12 16", "M12 16C16 16 16 20 20 13", "M20 13C23 9 25 6 28 4"];
  const resolve = complex
    ? ["M4 9L16 3L28 9L16 15Z", "M4 9L16 15L16 29L4 23Z", "M16 15L28 9L28 23L16 29Z"]
    : ["M7 25C12 20 19 13 25 7", "M14 7C18 7 22 7 25 7", "M25 7C25 11 25 14 25 18"];
  const label = complex ? "сложных продуктов" : "продаж";
  return <button ref={ref} type="button" className="sales-glyph" data-motion={moving ? "running" : "paused"} onClick={() => setPaused(!paused)} disabled={reduced}
    aria-label={`${paused ? "Включить" : "Приостановить"} анимацию ${complex ? "иконки и колец" : "иконки и графика"} ${label}`}
    aria-pressed={!paused} title={paused ? "Включить анимацию" : "Приостановить анимацию"}>
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth={complex ? "2.2" : "3"} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {rest.map((path, i) => <path key={i} d={path}>{moving && <animate attributeName="d"
        values={`${path};${path};${unfold[i]};${unfold[i]};${resolve[i]};${resolve[i]};${path};${path}`}
        keyTimes="0;.1;.24;.36;.52;.66;.82;1" dur="4s" repeatCount="indefinite" calcMode="spline"
        keySplines=".77 0 .175 1;.77 0 .175 1;.77 0 .175 1;.77 0 .175 1;.77 0 .175 1;.77 0 .175 1;.77 0 .175 1" />}</path>)}
    </svg>
  </button>;
}

export function SalesCard({ data, c, change, metric = "sales", funnel = false }: { data: Manifest; c: Context; change: (patch: Partial<Context>) => void; metric?: "sales" | "complex"; funnel?: boolean }) {
  const ringId = useId();
  const [stage, setStage] = useState<FunnelStage>("both");
  const [mode, setMode] = useState<"quarters" | "weeks">("quarters");
  const reduced = useReducedMotion();
  const transition = useRef<ViewTransition | null>(null);
  const transitionRequest = useRef(0);
  const switchMode = (next: "quarters" | "weeks") => {
    const request = ++transitionRequest.current;
    transition.current?.skipTransition();
    if (reduced || document.documentElement.dataset.input === "keyboard" || !document.startViewTransition) {
      setMode(next); return;
    }
    document.documentElement.classList.add("sales-mode-transition");
    const active = document.startViewTransition(() => {
      // A later click owns the final state even if snapshot capture was pending.
      if (request === transitionRequest.current) flushSync(() => setMode(next));
    });
    transition.current = active;
    active.ready.catch(() => {}); // A rapid second click legitimately skips it.
    const finish = () => {
      if (transition.current !== active) return;
      transition.current = null;
      document.documentElement.classList.remove("sales-mode-transition");
    };
    void active.finished.then(finish, finish);
  };
  useEffect(() => () => {
    ++transitionRequest.current;
    transition.current?.skipTransition();
    document.documentElement.classList.remove("sales-mode-transition");
  }, []);
  const complex = metric === "complex";
  const normalized = funnel || complex;
  const weekly = !complex && mode === "weeks";
  const title = complex ? "Сложные продукты" : funnel ? "Воронка сделок" : "Количество продаж";
  const analysisLabel = complex ? "Открыть анализ сложных продуктов" : funnel ? "Открыть анализ всех предложений" : "Открыть анализ продаж";
  const gs = selectedGroups(data, c);
  const selected = c.quarter;
  const series = gs.map(group => ({ group, managers: view(data, complex && group === "pilot" ? { ...c, role: "senior" } : c, group).kmCount, periods: view(data, c, group).periods, values: [1, 2, 3].map(q => funnel ? funnelStat(view(data, c, group).periods[q - 1], stage) : value(data, c, group, metric, q)), shares: complex ? [1, 2, 3].map(q => value(data, c, group, "complexShare", q)) : [] }));
  const peak = Math.max(1, ...series.flatMap(s => s.values.map(v => (funnel ? perManager(v.value, s.managers) : v.value) ?? 0)));
  const missing = series.filter(s => s.values.some(v => v.value == null));
  const target = { ...c, page: "analysis" as const, metric };
  // A new slice starts at its real values; only changing the quarter rolls them.
  const sliceKey = `${c.role}:${c.branch}:${c.group}:${c.scope}:${metric}:${funnel ? stage : ""}`;
  return <article className={`metric-card metric-${metric} sales-card ${funnel ? "funnel-card" : ""} ${complex ? "complex-card" : ""}`} aria-labelledby={`${metric}-title`}>
    <CardAmbient kind={metric} />
    <header className="sales-heading">
      <SalesGlyph complex={complex} />
      {normalized ? <div className="funnel-heading-copy">
        <h2 id={`${metric}-title`}>{title}</h2>
        <p>{complex ? "Старшая роль" : "Старшая и младшая роль"}</p>
      </div> : <h2 id={`${metric}-title`}>{title}</h2>}
      <a className="sales-open" href={contextUrl(target)} aria-label={analysisLabel} title={analysisLabel} onClick={e => {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) {
          e.preventDefault(); change({ page: "analysis", metric });
        }
      }}><Icon name="arrow" size={21} /></a>
    </header>
    {funnel && <div className="funnel-stages" role="group" aria-label="Стадии воронки">
      {([['both', 'Обе стадии'], ['realization', 'Реализация'], ['activation', 'Активация']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={stage === key} onClick={() => setStage(key)}>{label}</button>)}
    </div>}
    <div className="sales-period">
      <div className="sales-period-label"><strong>{quarters[selected - 1]}</strong><span aria-hidden={weekly || undefined}>{selected > 1 ? `к ${["I", "II"][selected - 2]} кварталу` : "Начало периода"}</span></div>
      {!complex && <div className="sales-mode" role="group" aria-label="Периодичность графика продаж">
        <span className="sales-mode-indicator" aria-hidden="true" style={{ transform: `translateX(${weekly ? 100 : 0}%)` }} />
        <button type="button" aria-pressed={!weekly} onClick={() => switchMode("quarters")}>Кварталы</button>
        <button type="button" aria-pressed={weekly} onClick={() => switchMode("weeks")}>Недели</button>
      </div>}
    </div>
    {weekly ? <WeeklySales key={`${sliceKey}:${selected}`} data={data} c={c} change={change} funnelStage={funnel ? stage : undefined} /> : <>
    <NumberFlowGroup key={sliceKey}>
    <div className="sales-summary" data-groups={gs.length} aria-live="polite" aria-atomic="true">
    <div className="sales-totals" data-groups={gs.length}>
      {series.map(s => {
        const current = s.values[selected - 1];
        const primary = normalized ? perManager(current.value, s.managers) : current.value;
        const diff = selected > 1 ? delta(current, s.values[selected - 2], metric) : null;
        return <section className={`sales-total sales-${s.group}`} key={s.group} aria-label={s.group === "pilot" ? "Пилот" : "Непилот"}>
          <span className="sales-group"><i />{s.group === "pilot" ? "Пилот" : "Непилот"}</span>
          <strong className={`sales-number ${current.value == null ? "sales-number-missing" : ""}`}><QuarterNumber value={primary} text={normalized ? formatPerManager(primary) : format(primary)} quarter={selected} digits={normalized ? 1 : 0} /></strong>
          {normalized && <><span className="funnel-unit">{complex ? "сложных продуктов на 1 КМ" : "сделок на 1 КМ"}</span><div className="funnel-absolute"><strong>{format(current.value)}</strong> {complex ? "предложений" : "сделок"} <span>· {s.managers == null ? "нет штата" : `${format(s.managers)} КМ`}</span></div></>}
          <div className="sales-change">{diff ? <span className={`sales-delta ${diff.tone}`}><QuarterNumber value={diff.value} text={diff.text} quarter={selected} digits={diff.digits} signed suffix={diff.suffix} /></span> : <span className="sales-unavailable">{current.value == null ? statusText(current) : selected > 1 ? "Нет базы сравнения" : "Первый квартал"}</span>}</div>
        </section>;
      })}
    </div>
    </div>
    </NumberFlowGroup>
    {complex ? <section className="complex-rings" aria-label="Доля в портфеле без ФОТ">
      <h3>Доля в портфеле без ФОТ</h3>
      <div className="complex-rings-body">
      <div className="complex-ring-values">
        {series.map(s => {
          const share = s.shares[selected - 1];
          const diff = selected > 1 ? delta(share, s.shares[selected - 2], "complexShare") : null;
          return <div className={`complex-share sales-${s.group}`} key={s.group} aria-label={s.group === "pilot" ? "Доля пилота" : "Доля непилота"}>
            <span className="complex-ring-name"><i />{s.group === "pilot" ? "Пилот" : "Непилот"}</span>
            <strong><QuarterNumber value={share.value} text={format(share.value, "complexShare")} quarter={selected} digits={1} suffix="%" /></strong>
            {diff && <span className={`sales-delta ${diff.tone}`}><QuarterNumber value={diff.value} text={diff.text} quarter={selected} digits={diff.digits} signed suffix={diff.suffix} /></span>}
          </div>;
        })}
      </div>
      <svg className="complex-ring-chart" viewBox="0 0 200 200" role="img" aria-label={series.map(s => `${s.group === "pilot" ? "Пилот" : "Непилот"}: ${format(s.shares[selected - 1].value, "complexShare")}`).join(". ")}>
        <defs>
          <linearGradient id={`${ringId}-light`}>
            <stop offset="0" stopColor="white" stopOpacity="0" />
            <stop offset=".5" stopColor="white" stopOpacity=".6" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </linearGradient>
          <mask id={`${ringId}-arcs`} maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
            {series.map((s, i) => {
              const share = s.shares[selected - 1].value;
              return share != null && share > 0 ? <circle key={s.group} className="complex-ring-mask" cx="100" cy="100" r={82 - i * 25} fill="none" stroke="white" strokeWidth="12" strokeLinecap="round" pathLength="100" strokeDasharray="100 100" strokeDashoffset={100 - Math.min(100, share)} transform="rotate(-90 100 100)" /> : null;
            })}
          </mask>
        </defs>
        {series.map((s, i) => {
          const share = s.shares[selected - 1].value;
          const radius = 82 - i * 25;
          const percent = Math.max(0, Math.min(100, share ?? 0));
          return <g key={s.group} className={`sales-${s.group}`}>
            {percent < 100 && <circle className="complex-ring-track" cx="100" cy="100" r={radius} fill="none" strokeWidth="12" pathLength="100" strokeDasharray={percent > 0 ? `${Math.max(0, 100 - percent - 7)} 100` : undefined} strokeDashoffset={percent > 0 ? -percent - 3.5 : 0} transform="rotate(-90 100 100)" />}
            {share != null && percent > 0 && <circle className="complex-ring-fill" cx="100" cy="100" r={radius} fill="none" strokeWidth="12" pathLength="100" strokeDasharray="100 100" strokeDashoffset={100 - percent} transform="rotate(-90 100 100)" />}
          </g>;
        })}
        <g mask={`url(#${ringId}-arcs)`} aria-hidden="true" pointerEvents="none">
          <rect className="complex-ring-sheen" x="0" y="-30" width="80" height="260" fill={`url(#${ringId}-light)`} />
        </g>
      </svg>
      </div>
      <nav className="complex-ring-quarters weekly-quarters" aria-label="Квартал сложных продуктов">
        {[1, 2, 3].map(q => <button type="button" key={q} aria-label={`Выбрать ${quarters[q - 1]}`} aria-pressed={selected === q} onClick={() => change({ quarter: q })}>{["I", "II", "III"][q - 1]} кв.</button>)}
      </nav>
    </section> : <>
    {funnel && <div className="funnel-chart-heading"><span>Сделок на 1 КМ</span><div className="funnel-legend">{stageKeys(stage).map(key => <span key={key}><i className={`funnel-key-${key}`} />{key === 'realization' ? 'Реализация' : 'Активация'}</span>)}</div></div>}
    <div className="sales-plot" aria-label={funnel ? "Сделки на 1 КМ по кварталам" : "Продажи по кварталам. Нажмите квартал для сравнения"}>
      {[1, 2, 3].map(q => <button type="button" className={`sales-quarter ${selected === q ? "is-selected" : ""}`} key={q}
        aria-pressed={selected === q} aria-label={`Выбрать ${quarters[q - 1]}`} onClick={() => change({ quarter: q })}>
        <span className="sales-bars">
          {series.map(s => {
            const stat = s.values[q - 1];
            const chartValue = funnel ? perManager(stat.value, s.managers) : stat.value;
            const height = chartValue == null ? 0 : chartValue / peak * 100;
            return <span className={`sales-bar-column sales-${s.group}`} key={s.group}>
              <span className={`sales-track ${chartValue == null ? "is-missing" : ""}`}>
                {funnel ? chartValue != null && stageKeys(stage).map((key, index) => {
                  const count = funnelStat(s.periods[q - 1], key).value;
                  const h = (perManager(count, s.managers) ?? 0) / peak * 100;
                  const bottom = index ? (perManager(funnelStat(s.periods[q - 1], 'realization').value, s.managers) ?? 0) / peak * 100 : 0;
                  return <span key={key} className={`sales-fill funnel-fill funnel-${key}`} style={{height: `${h}%`, bottom: `${bottom}%`}} title={`${funnelStages[key]}: ${format(count)}`} />;
                }) : stat.value != null && <span className="sales-fill" style={{clipPath: `inset(${100 - height}% 0 0 round 10px 10px 0 0)`}} />}
              </span>
              <span className="sales-bar-caption">
              <span className="sales-bar-value" aria-label={`${s.group === "pilot" ? "Пилот" : "Непилот"}: ${chartValue == null ? statusText(stat) : funnel ? `${formatPerManager(chartValue)} сделок на КМ` : format(stat.value)}`}>
                {chartValue == null ? "—" : funnel ? formatPerManager(chartValue) : format(stat.value)}
              </span>
              {complex && <span className="complex-bar-share" aria-label={`Доля ${s.group === "pilot" ? "пилота" : "непилота"}: ${s.shares[q - 1].value == null ? statusText(s.shares[q - 1]) : format(s.shares[q - 1].value, "complexShare")}`}>{format(s.shares[q - 1].value, "complexShare")}</span>}
              </span>
            </span>;
          })}
        </span>
        <span className="sales-quarter-label">{["I", "II", "III"][q - 1]} кв.</span>
      </button>)}
    </div></>}
    {missing.length > 0 && <footer className="sales-notes">
      {missing.map(s => <span key={s.group}>{s.group === "pilot" ? "Пилот" : "Непилот"}: {s.values.map((v, i) => v.value == null ? ["I", "II", "III"][i] : null).filter(Boolean).join(", ")} кв. — на сверке</span>)}
    </footer>}
    </>}
  </article>;
}

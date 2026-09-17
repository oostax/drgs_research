import { CardAmbient } from "./CardAmbient";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { NumberFlowGroup } from "@number-flow/react";
import type { Context, Group, Manifest, Stat } from "./types";
import { contextUrl, delta, format, quarters, selectedGroups, value, view } from "./model";
import { Icon } from "./Icons";
import { QuarterNumber } from "./QuarterNumber";
import { useReducedMotion } from "./Motion";
import "./MoodCard.css";

// Local extension of the established dashboard, not a new visual identity.
// Fikri Heatmaps Chart / Top 5 US Cities (node 1929-4436): compact coloured
// matrix, quiet row labels, period labels below. Four source questions replace
// cities, quarters/weeks replace seasons; no interpolated or fabricated scores.
// Totals compare both cohorts; selecting a column retargets numbers and colour.
const questions = [
  { short: "Рабочая неделя", full: "Как прошла Ваша неделя?" },
  { short: "Модель продаж", full: "Ощущаете ли Вы положительные изменения от внедрения новой Модели продаж?" },
  { short: "Время с клиентами", full: "Появилось ли у вас больше времени на работу с клиентами?" },
  { short: "Полезность лидов", full: "Насколько полезными для вашей работы были лиды, которые вы получали в рабочем месте?" },
];
const empty: Stat = { value: null, status: "missing", sample: 0, responses: 0 };
const score = (n: number | null | undefined) => n == null ? "—" : format(n, "process");
const dateLabel = (date: string) => date.slice(8, 10) + "." + date.slice(5, 7);
const palettes = {
  pilot: ["#eef8f3", "#c7edda", "#90dcb9", "#3dbb87", "#00855e"],
  nonpilot: ["#f3f0fc", "#e0d9f9", "#bcaff0", "#9581e5", "#5746d8"],
};

export function MoodGlyph() {
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(!document.hidden);
  const button = useRef<HTMLButtonElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const moving = !reduced && !paused && visible && pageVisible;
  useEffect(() => {
    if (!window.IntersectionObserver || !button.current) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    observer.observe(button.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (moving) svg.current?.unpauseAnimations?.(); else svg.current?.pauseAnimations?.();
  }, [moving]);
  return <button ref={button} type="button" className="sales-glyph mood-glyph" data-motion={moving ? "running" : "paused"}
    disabled={reduced} aria-pressed={!paused} onClick={() => setPaused(p => !p)}
    aria-label={`${paused ? "Включить" : "Приостановить"} анимацию иконки удовлетворённости`}>
    <svg ref={svg} width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <circle cx="16" cy="16" r="12" />
      <path d="M11 12h.01M21 12h.01" strokeWidth="3.4" />
      <path d="M10 20C13 24 19 24 22 20">
        {!reduced && <animate attributeName="d" values="M10 20C13 24 19 24 22 20;M10 20C13 24 19 24 22 20;M10 21C14 21 18 21 22 21;M10 21C14 21 18 21 22 21;M10 20C13 24 19 24 22 20" keyTimes="0;.3;.45;.65;1" dur="6s" repeatCount="indefinite" calcMode="spline" keySplines=".77 0 .175 1;.77 0 .175 1;.77 0 .175 1;.77 0 .175 1" />}
      </path>
    </svg>
  </button>;
}

type Column = { id: string; label: string; full: string; questions: (number | null)[]; responses: number };
function Heatmap({ group, columns, selected, weekly, select }: {
  group: Group; columns: Column[]; selected: string; weekly: boolean; select: (id: string) => void;
}) {
  return <div className="mood-matrix-scroll" tabIndex={weekly ? 0 : undefined} aria-label={`Оценки по вопросам: ${group === "pilot" ? "пилот" : "непилот"}`}>
    <div className={`mood-matrix ${weekly ? "is-weekly" : ""}`} style={{ "--mood-columns": columns.length } as CSSProperties}>
      {questions.map((question, qi) => <div className={`mood-matrix-row ${qi === 3 ? "is-campaign" : ""}`} key={question.short}>
        <span className="mood-row-label" title={question.full}>{question.short}</span>
        <div className="mood-cells">{columns.map(column => {
          const n = column.questions[qi] ?? null;
          const level = n == null ? -1 : Math.min(4, Math.max(0, Math.round((n - 1) * 2)));
          const label = `${question.full} ${column.full}: ${n == null ? "нет анкет" : `${score(n)} из 3, анкет ${column.responses}`}`;
          return <button type="button" key={column.id} className="mood-cell" data-empty={n == null} data-level={level}
            style={n == null ? undefined : { backgroundColor: palettes[group][level] }}
            aria-label={label} title={label} aria-pressed={column.id === selected} onClick={() => select(column.id)}>
            {weekly ? <span className="mood-cell-dot" /> : score(n)}
          </button>;
        })}</div>
      </div>)}
      <div className="mood-matrix-row mood-matrix-axis"><span />
        <div className="mood-cells">{columns.map(column => <span key={column.id} data-selected={column.id === selected}>{column.label}</span>)}</div>
      </div>
    </div>
  </div>;
}

export function MoodCard({ data, c, change }: { data: Manifest; c: Context; change: (patch: Partial<Context>) => void }) {
  const groups = selectedGroups(data, c);
  const [mode, setMode] = useState<"quarters" | "weeks">("quarters");
  const [weekId, setWeekId] = useState<string | null>(null);
  const periods = groups.map(group => ({ group, periods: view(data, c, group).periods }));
  const weeks = periods[0]?.periods[c.quarter - 1].survey?.weeks ?? [];
  const latest = [...weeks].reverse().find(w => periods.some(p => p.periods[c.quarter - 1].survey?.weeks.find(v => v.id === w.id)?.responses));
  const currentWeek = weeks.find(w => w.id === weekId) ?? latest ?? weeks[weeks.length - 1];
  const weekIndex = weeks.findIndex(w => w.id === currentWeek?.id);
  const revision = mode === "quarters" ? c.quarter : c.quarter * 100 + weekIndex + 10;
  const weekly = mode === "weeks";
  const current = (group: Group, metric: "process" | "leads") => weekly
    ? view(data, c, group).periods[c.quarter - 1].survey?.weeks.find(w => w.id === currentWeek?.id)?.[metric] ?? empty
    : value(data, c, group, metric, c.quarter);
  const previous = (group: Group, metric: "process" | "leads") => weekly
    ? view(data, c, group).periods[c.quarter - 1].survey?.weeks[weekIndex - 1]?.[metric] ?? empty
    : c.quarter > 1 ? value(data, c, group, metric, c.quarter - 1) : empty;
  const selectMode = (next: "quarters" | "weeks") => { setMode(next); };
  const open = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); change({ page: "analysis", metric: "process" });
  };
  return <article className="metric-card metric-process sales-card mood-card" aria-labelledby="title-process">
    <CardAmbient kind={"process"} />
    <header className="sales-heading"><MoodGlyph />
      <div className="funnel-heading-copy">
        <h2 id="title-process">Удовлетворённость</h2>
        <p>Все роли</p>
      </div>
      <a className="sales-open" href={contextUrl({ ...c, page: "analysis", metric: "process" })} onClick={open} aria-label="Открыть анализ: Удовлетворённость"><Icon name="arrow" size={21} /></a>
    </header>
    <div className="mood-toolbar">
      <div className="sales-period-label"><strong>{weekly && currentWeek ? `${dateLabel(currentWeek.start)}–${dateLabel(currentWeek.end)}` : quarters[c.quarter - 1]}</strong>
        <span>{weekly ? "К предыдущей неделе опроса" : c.quarter > 1 ? `к ${["I", "II"][c.quarter - 2]} кварталу` : "Начало периода"}</span></div>
      <div className="sales-mode" role="group" aria-label="Периодичность удовлетворённости">
        <span className="sales-mode-indicator" aria-hidden="true" style={{ transform: `translateX(${weekly ? "100%" : "0"})` }} />
        <button type="button" aria-pressed={!weekly} onClick={() => selectMode("quarters")}>Кварталы</button>
        <button type="button" aria-pressed={weekly} onClick={() => selectMode("weeks")}>Недели</button>
      </div>
    </div>
    <NumberFlowGroup>
      <div className="mood-scores" data-groups={groups.length}>
        {(["process", "leads"] as const).filter(metric => metric !== "process" || groups.includes("pilot")).map(metric => <section className="mood-score-panel" key={metric} aria-label={metric === "process" ? "Процесс" : "Кампании продаж"}>
          <div className="mood-score-title"><h3>{metric === "process" ? "Процесс" : "Кампании продаж"}</h3><span>{metric === "process" ? "Среднее 3 вопросов" : "Полезность лидов · 1 вопрос"}</span></div>
          <div className="sales-totals" data-groups={metric === "process" ? 1 : groups.length}>{groups.filter(group => metric !== "process" || group === "pilot").map(group => {
            const stat = current(group, metric), diff = delta(stat, previous(group, metric), metric);
            return <div className={`sales-total sales-${group}`} key={group}>
              <span className="sales-group"><i />{group === "pilot" ? "Пилот" : "Непилот"}</span>
              <strong className="sales-number"><QuarterNumber value={stat.value} text={score(stat.value)} quarter={revision} digits={1} /><small> / 3</small></strong>
              <div className="sales-change">{diff ? <span className={`sales-delta ${diff.tone}`}><QuarterNumber value={diff.value} text={diff.text.replace(/ балла$/, "")} quarter={revision} digits={1} signed /></span> : <span className="sales-unavailable">{stat.value == null ? "Нет анкет" : "Нет базы сравнения"}</span>}</div>
            </div>;
          })}</div>
        </section>)}
      </div>
    </NumberFlowGroup>
    <div className="mood-chart-heading"><h3>Оценки по вопросам</h3>
      <div className="mood-scale" aria-label="Шкала от 1 до 3"><span>1</span>{palettes.pilot.map(color => <i key={color} style={{ backgroundColor: color }} />)}<span>3</span><span className="mood-no-data-key" /> <span>Нет анкет</span></div>
      {weekly && weeks.length > 0 && <div className="mood-week-arrows"><button type="button" aria-label="Предыдущая неделя опроса" disabled={weekIndex <= 0} onClick={() => setWeekId(weeks[weekIndex - 1].id)}><Icon name="chevron" size={16} /></button><button type="button" aria-label="Следующая неделя опроса" disabled={weekIndex >= weeks.length - 1} onClick={() => setWeekId(weeks[weekIndex + 1].id)}><Icon name="chevron" size={16} /></button></div>}
    </div>
    <div className="mood-heatmaps" key={mode} data-groups={groups.length}>{periods.map(({ group, periods: groupPeriods }) => {
      const stat = current(group, "process");
      const columns: Column[] = weekly ? (groupPeriods[c.quarter - 1].survey?.weeks ?? []).map(w => ({ ...w, label: dateLabel(w.start), full: `${dateLabel(w.start)}–${dateLabel(w.end)}` }))
        : groupPeriods.map(p => ({ id: String(p.quarter), label: ["I кв.", "II кв.", "III кв."][p.quarter - 1], full: quarters[p.quarter - 1], questions: p.survey?.questions ?? [null, null, null, null], responses: p.process.responses ?? 0 }));
      return <section className={`mood-heatmap sales-${group}`} key={group} aria-label={`Тепловая карта: ${group === "pilot" ? "Пилот" : "Непилот"}`}>
        <header><span className="sales-group"><i />{group === "pilot" ? "Пилот" : "Непилот"}</span><span>{stat.sample ?? 0} ответивших · {stat.responses ?? 0} анкет{stat.sample != null && stat.sample > 0 && stat.sample < 5 ? " · малая выборка" : ""}</span></header>
        <Heatmap group={group} columns={columns} weekly={weekly} selected={weekly ? currentWeek?.id ?? "" : String(c.quarter)} select={id => weekly ? setWeekId(id) : change({ quarter: Number(id) })} />
      </section>;
    })}</div>
    <footer className="mood-footer">{weekly && <span>по дате создания анкеты</span>}
      <div className="mood-quarter-tabs" role="group" aria-label="Квартал удовлетворённости">{[1, 2, 3].map(q => <button type="button" key={q} aria-pressed={c.quarter === q} onClick={() => { setWeekId(null); change({ quarter: q }); }}>{["I", "II", "III"][q - 1]} кв.</button>)}</div>
    </footer>
  </article>;
}

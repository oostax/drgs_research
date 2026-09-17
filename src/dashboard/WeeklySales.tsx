import { useRef, useState } from "react";
import { NumberFlowGroup } from "@number-flow/react";
import { QuarterNumber } from "./QuarterNumber";
import { Icon } from "./Icons";
import { useWeekPlayback } from "./useWeekPlayback";
import { format, quarters, selectedGroups, statusText, view } from "./model";
import type { Context, Manifest } from "./types";
import { funnelStat, funnelWeeks, perManager, formatPerManager, type FunnelStage } from "./funnelModel";
import "./WeeklySales.css";

const names = { pilot: "Пилот", nonpilot: "Непилот" };
const extraNames = { before: "До квартала", undated: "Без даты", after: "После среза" };
const shortDate = (date: string) => date.slice(8, 10) + "." + date.slice(5, 7);

/** Same snapshot and cohort as the quarter total. The date dimension is explicit:
 * these are last stage dates, never newly sold offers or a reconstructed history.
 * Two small multiples follow the supplied neutral-bar reference. Each has an
 * explicit own count scale; nonpilot is never drawn as a negative quantity. */
export function WeeklySales({ data, c, change, funnelStage }: {
  data: Manifest; c: Context; change: (patch: Partial<Context>) => void; funnelStage?: FunnelStage;
}) {
  const series = selectedGroups(data, c).map(group => {
    const p = view(data, c, group).periods[c.quarter - 1];
    return { group, managers: view(data, c, group).kmCount, stat: funnelStage ? funnelStat(p, funnelStage) : p.sales, distribution: funnelStage ? funnelWeeks(p, funnelStage) : p.salesWeeks };
  });
  const weeks = series.find(s => s.distribution)?.distribution?.weeks ?? [];
  const [selection, setSelection] = useState<string | null>(null);
  const selected = selection ?? [...weeks].reverse().find(w => !w.partial)?.id ?? weeks.at(-1)?.id ?? null;
  const index = weeks.findIndex(w => w.id === selected);
  const selectedWeek = weeks[index];
  const dateLabel = selectedWeek
    ? `${shortDate(selectedWeek.start)}–${shortDate(selectedWeek.end)}${selectedWeek.partial ? " · неполная неделя" : ""}`
    : extraNames[selected as keyof typeof extraNames] ?? "Нет дат для разбивки";
  const count = (s: typeof series[number], id: string | null) => {
    if (!s.distribution || s.stat.value == null) return null;
    if (id && id in extraNames) return s.distribution[id as keyof typeof extraNames];
    return s.distribution.weeks.find(w => w.id === id)?.count ?? null;
  };
  const revision = selectedWeek ? index : weeks.length + Object.keys(extraNames).indexOf(selected ?? "");
  const choose = (i: number) => setSelection(weeks[Math.max(0, Math.min(weeks.length - 1, i))].id);
  const anchor = useRef<HTMLDivElement>(null);
  const playback = useWeekPlayback(anchor, () => choose((index + 1) % weeks.length), weeks.length);
  return <>
    <NumberFlowGroup>
      <div ref={anchor} className="sales-summary weekly-summary" aria-live={playback.running ? "off" : "polite"} aria-atomic="true">
        <div className="sales-totals" data-groups={series.length}>
          {series.map(s => <section className={`sales-total sales-${s.group}`} key={s.group} aria-label={names[s.group]}>
            <span className="sales-group"><i />{names[s.group]}</span>
            <strong className="sales-number"><QuarterNumber value={funnelStage ? perManager(count(s, selected), s.managers) : count(s, selected)} text={funnelStage ? formatPerManager(perManager(count(s, selected), s.managers)) : format(count(s, selected))} quarter={revision} digits={funnelStage ? 1 : 0} /></strong>
            {funnelStage && <><span className="funnel-unit">сделок на 1 КМ</span><div className="funnel-absolute"><strong>{format(count(s, selected))}</strong> сделок <span>· {s.managers == null ? "нет штата" : `${format(s.managers)} КМ`}</span></div></>}
            {!s.distribution && <span className="sales-unavailable">{s.stat.value == null ? statusText(s.stat) : "Нет дат для разбивки"}</span>}
          </section>)}
        </div>
        <div className="weekly-context">
          <strong>{dateLabel}</strong>
          {weeks.length > 0 && <div className="weekly-stepper" role="group" aria-label="Переключить неделю">
            <button type="button" aria-label="Предыдущая неделя" disabled={index === 0} onClick={() => choose(index < 0 ? weeks.length - 1 : index - 1)}><Icon name="chevron" size={16} /></button>
            <button type="button" aria-label={playback.enabled ? "Приостановить автопереключение недель" : "Включить автопереключение недель"} aria-pressed={playback.enabled} disabled={playback.reduced} onClick={playback.toggle}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">{playback.enabled ? <><rect x="4" y="3" width="3" height="10" rx="1" /><rect x="9" y="3" width="3" height="10" rx="1" /></> : <path d="M5 3.5a.5.5 0 0 1 .76-.43l7 4.5a.5.5 0 0 1 0 .86l-7 4.5A.5.5 0 0 1 5 12.5Z" />}</svg>
            </button>
            <button type="button" aria-label="Следующая неделя" disabled={index === weeks.length - 1} onClick={() => choose(index < 0 ? 0 : index + 1)}><Icon name="chevron" size={16} /></button>
          </div>}
        </div>
      </div>
    </NumberFlowGroup>
    {funnelStage && <div className="funnel-chart-heading"><span>Количество сделок по неделям</span></div>}
    <div className="sales-plot weekly-plot" aria-label="Предложения по неделям последней смены стадии">
      {weeks.length > 0 ? <div className="weekly-charts" data-groups={series.length}>{series.map(s => {
        const values=s.distribution?.weeks ?? [];
        const peak=Math.max(1,...values.map(w=>w.count));
        const full=values.filter(w=>!w.partial);
        const average=full.length ? full.reduce((sum,w)=>sum+w.count,0)/full.length : null;
        const current=count(s,selected);
        const anchor=Math.max(0,index);
        const ratio=current == null ? 0 : Math.min(current/peak,1);
        return <section className={`weekly-chart sales-${s.group}`} key={s.group} aria-label={`Недельный график: ${names[s.group]}`}>
        <span className="sr-only">0–{format(peak)}</span>
        <div className="weekly-chart-frame">
        {average != null && <div className="weekly-average" style={{bottom:`${average/peak*100}%`}} aria-label={`Среднее полных недель: ${format(average)}`}><span>ср. {format(average)}</span></div>}
        <span className="weekly-indicator" aria-hidden="true" style={{width:`${100/weeks.length}%`,transform:`translateX(${anchor*100}%)`,opacity:index<0 || current==null ? 0 : 1}}>
          <span className="weekly-value-pin" style={{transform:`translateY(${-ratio*128}px)`}}>{format(current)}</span>
        </span>
        <div className="weekly-columns" role="group" aria-label={`Выбор недели: ${names[s.group]}`}
          style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
          {weeks.map((week, i) => <button key={week.id} type="button" className={`weekly-column ${selected === week.id ? "is-selected" : ""}`}
            aria-pressed={selected === week.id} tabIndex={index === i || (index < 0 && i === 0) ? 0 : -1}
            aria-label={`${shortDate(week.start)}–${shortDate(week.end)}${week.partial ? ", неполная неделя" : ""}. ${names[s.group]}: ${format(count(s, week.id))}`}
            onClick={() => setSelection(week.id)} onKeyDown={e => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
              e.preventDefault();
              const next = e.key === "Home" ? 0 : e.key === "End" ? weeks.length - 1 : Math.max(0, Math.min(weeks.length - 1, i + (e.key === "ArrowRight" ? 1 : -1)));
              choose(next);
              const buttons = e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("button");
              buttons?.[next].focus();
            }}>
            {(() => {
              const n = count(s, week.id);
              return <span className={`weekly-track ${n == null ? "is-missing" : ""}`}>
                {n != null && <span className="weekly-fill" style={{ height: `${n / peak*100}%` }} />}
                {n === 0 && <span className="weekly-zero" />}
              </span>;
            })()}
            <span className="weekly-tick" />
          </button>)}
        </div>
        </div>
        <div className="weekly-axis"><span>{shortDate(weeks[0].start)}</span><span>{shortDate(weeks.at(-1)!.end)}</span></div>
        </section>;
      })}</div> : <p className="weekly-empty">Недельная разбивка для этого среза недоступна.</p>}
    </div>
    <footer className="sales-notes weekly-notes">
      <span className="weekly-method">По последней смене стадии · не новые продажи</span>
      <div className="weekly-quarters" role="group" aria-label="Квартал недельной разбивки">
        {[1, 2, 3].map(q => <button key={q} type="button" aria-label={quarters[q - 1]} aria-pressed={c.quarter === q} onClick={() => change({ quarter: q })}>{["I", "II", "III"][q - 1]} кв.</button>)}
      </div>
      {weeks.length > 0 && <div className="weekly-extras" aria-label="Предложения вне недель квартала">
        {(Object.keys(extraNames) as (keyof typeof extraNames)[]).filter(key => key !== "before" && series.some(s => (s.distribution?.[key] ?? 0) > 0)).map(key =>
          <button type="button" key={key} aria-pressed={selected === key} onClick={() => setSelection(key)}>
            {extraNames[key]} <span>{series.map(s => `${names[s.group]} ${format(count(s, key))}`).join(" · ")}</span>
          </button>)}
      </div>}
    </footer>
  </>;
}

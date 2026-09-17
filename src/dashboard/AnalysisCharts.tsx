import { useState } from "react";
import type { Context, Group, Manifest, Stat } from "./types";
import { format, groupNames, selectedGroups, view } from "./model";
import { branchComparisons } from "./analysisModel";
import { Icon } from "./Icons";
import { Select } from "./Select";
import { AnalysisInsights } from "./AnalysisInsights";
import { ShareAnalysis } from "./ShareAnalysis";

const colors = { pilot: "#00855e", nonpilot: "#5746d8" };
const percentage = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n) + "%";
const ready = (s: Stat) => s.status === "ready" ? s.value : null;

// Fikri Chart Library / Donut Chart / Sales: narrow separated arcs,
// white percentage markers, a central total and a value-led side legend.
function StageDonut({ items, total }: { items: { name: string; count: number; color: string }[]; total: number }) {
  let angle = -120;
  const point = (degrees: number, radius: number) => {
    const radians = degrees * Math.PI / 180;
    return [160 + radius * Math.cos(radians), 160 + radius * Math.sin(radians)];
  };
  return <div className="analysis-donut">
    <svg viewBox="0 0 320 320" aria-hidden="true">
      {!total && <circle cx="160" cy="160" r="118" fill="none" stroke="#eceef2" strokeWidth="24" />}
      {items.filter(item => item.count > 0 && total > 0).map(item => {
        const sweep = item.count / total * 360;
        // Keep even the smallest real stage visible, without inflating its share.
        const gap = items.filter(i => i.count > 0).length > 1 ? Math.min(2, sweep * .15) : .001;
        const start = point(angle + gap / 2, 118);
        const end = point(angle + sweep - gap / 2, 118);
        const small = sweep < 12;
        const marker = point(angle + sweep / 2, small ? 157 : 128);
        const connector = point(angle + sweep / 2, 130);
        angle += sweep;
        return <g key={item.name}>
          <path d={`M ${start.join(" ")} A 118 118 0 ${sweep - gap > 180 ? 1 : 0} 1 ${end.join(" ")}`} fill="none" stroke={item.color} strokeWidth="24" strokeLinecap="butt" />
          {small && <line x1={connector[0]} y1={connector[1]} x2={marker[0]} y2={marker[1]} stroke={item.color} strokeWidth="1.5" />}
          <circle cx={marker[0]} cy={marker[1]} r="23" fill="white" className="analysis-donut-marker" />
          <text x={marker[0]} y={marker[1]} dy=".35em" textAnchor="middle">{percentage(item.count / total * 100)}</text>
        </g>;
      })}
    </svg>
    <div className="analysis-donut-total"><span>Всего</span><strong>{total ? format(total) : "—"}</strong><span>предложений</span></div>
  </div>;
}

function Legend({ groups }: { groups: Group[] }) {
  return <div className="analysis-legend">{groups.map(g => <span key={g}><i style={{ background: colors[g] }} />{groupNames[g]}</span>)}</div>;
}

function PairBars({ values, max, percent = false }: { values: { group: Group; n: number | null; label: string }[]; max: number; percent?: boolean }) {
  return <div className="analysis-pair">{values.map(v => <div className="analysis-pair-row" key={v.group}>
    <div className="analysis-bar-track" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, (v.n ?? 0) / max * 100))}%`, background: colors[v.group] }} /></div>
    <span className="analysis-bar-number" style={{ color: colors[v.group] }} title={`${groupNames[v.group]}: ${v.label}`}><span className="visually-hidden">{groupNames[v.group]}: </span>{v.n == null ? "—" : percent ? percentage(v.n) : v.label}</span>
  </div>)}</div>;
}

export function AnalysisCharts({ data, c, change, detail }: { data: Manifest; c: Context; change: (patch: Partial<Context>) => void; detail: (tab: string, search?: string) => void }) {
  const [ranking, setRanking] = useState("growth");
  const [composition, setComposition] = useState("products");
  const groups = selectedGroups(data, c);
  const offers = ["sales", "complex", "complexShare"].includes(c.metric);
  const complex = c.metric !== "sales";
  const isChange = ranking !== "volume" && c.quarter > 1 && c.metric !== "coverage";
  const branchRows = branchComparisons(data, c);
  const score = (row: typeof branchRows[number]) => {
    const ns = row.series.map(s => isChange ? s.difference : ready(s.stat)).filter(n => n != null);
    return ns.length ? (isChange ? ranking === "growth" ? Math.max(...ns) : Math.min(...ns) : Math.max(...ns)) : null;
  };
  const leaders = branchRows.filter(r => score(r) != null && (!isChange || (ranking === "growth" ? score(r)! > 0 : score(r)! < 0)))
    .sort((a, b) => ranking === "decline" && isChange ? score(a)! - score(b)! : score(b)! - score(a)!).slice(0, 5);
  const max = Math.max(1, ...leaders.flatMap(r => r.series.map(s => Math.abs((isChange ? s.difference : ready(s.stat)) ?? 0))));
  const missingBranches = branchRows.reduce((n, r) => n + r.series.filter(s => (isChange ? s.difference : ready(s.stat)) == null).length, 0);
  const productLists = groups.map(group => ({ group, list: view(data, c, group).periods[c.quarter - 1][complex ? "complexProducts" : "products"] }));
  const productNames = [...new Set(productLists.flatMap(g => g.list.map(p => p.name)))].sort((a, b) => {
    const sum = (name: string) => productLists.reduce((n, g) => n + (g.list.find(p => p.name === name)?.count ?? 0), 0);
    return sum(b) - sum(a);
  }).slice(0, 5);
  const productRows = productNames.map(name => ({ name, values: productLists.map(g => {
    const total = g.list.reduce((n, p) => n + p.count, 0);
    const count = g.list.find(p => p.name === name)?.count ?? 0;
    return { group: g.group, n: c.metric === "complex" ? count : total ? count / total * 100 : null, label: c.metric === "complex" ? format(count) : `${format(count)} предложений · ${total ? percentage(count / total * 100) : "нет данных"}` };
  }) }));
  const productMax = Math.max(1, ...productRows.flatMap(r => r.values.map(v => v.n ?? 0)));
  const stages = ["Выявление потребности", "Обсуждение условий", "Реализация сделки", "Активация продукта"];
  const stageColors = ["#00bfdc", "#6155ed", "#ff0754", "#ffc400"];
  const stageColor = (name: string) => stageColors[stages.indexOf(name)] ?? "#7c828d";
  return <div className="analysis-chart-grid">
    <article className="analysis-card" aria-labelledby="branch-chart-title">
      <header className="analysis-card-heading"><Icon name="analysis" size={27} /><h2 id="branch-chart-title">{c.metric === "complexShare" ? isChange ? "Где меняется доля" : "Доля по ГОСБ" : isChange ? "Где меняется результат" : "Сравнение ГОСБ"}</h2><button className="analysis-open" aria-label="Открыть таблицу ГОСБ" onClick={() => detail("branches")}><Icon name="arrow" size={18} /></button></header>
      <div className="analysis-chart-controls"><span>{c.branch === "all" ? "Первые 5 ГОСБ" : "Выбранное отделение"}</span><Select label="Сортировка графика" value={isChange ? ranking : "volume"} onChange={setRanking} options={[{ value: "volume", label: "По значению" }, ...(c.quarter > 1 && c.metric !== "coverage" ? [{ value: "growth", label: "По приросту" }, { value: "decline", label: "По снижению" }] : [])]} /></div>
      <Legend groups={groups} />
      <div className="analysis-bar-chart">
        {leaders.map(r => <div className="analysis-chart-item" key={r.branch.id}>
          <button className="analysis-chart-label" onClick={() => change({ branch: r.branch.id })} title={`Выбрать ГОСБ: ${r.branch.name}`}>{r.branch.name}<Icon name="chevron" size={12} /></button>
          {isChange ? <div className="analysis-changes">{r.series.map(s => <div className="analysis-change-row" key={s.group}>
            <span className="analysis-change-track" aria-hidden="true"><i style={{ background: colors[s.group], width: `${Math.abs(s.difference ?? 0) / max * 50}%`, left: s.difference != null && s.difference < 0 ? `${50 - Math.abs(s.difference) / max * 50}%` : "50%" }} /></span>
            <strong style={{ color: colors[s.group] }} title={groupNames[s.group]}><span className="visually-hidden">{groupNames[s.group]}: </span>{s.difference == null ? "—" : `${s.difference > 0 ? "+" : ""}${format(s.difference, c.metric === "complexShare" ? "process" : c.metric) + (["complexShare", "coverage"].includes(c.metric) ? " п. п." : ["process", "leads"].includes(c.metric) ? " б." : "")}`}</strong>
          </div>)}</div> : <PairBars max={max} values={r.series.map(s => ({ group: s.group, n: ready(s.stat), label: format(ready(s.stat), c.metric) }))} />}
        </div>)}
        {!leaders.length && <div className="analysis-chart-empty"><Icon name="analysis" size={30} /><p>{isChange ? "Нет ГОСБ с подтверждённым " + (ranking === "growth" ? "приростом" : "снижением") : "Для этого среза нет подтверждённых значений"}</p><button onClick={() => detail("branches")}>Посмотреть доступность данных</button></div>}
      </div>
      <p className="analysis-card-note">{isChange ? "Абсолютное изменение к предыдущему кварталу. " : "Единый масштаб для обеих групп. Нажмите ГОСБ, чтобы уточнить срез. "}{missingBranches > 0 && `${missingBranches} значений ${isChange ? "без базы сравнения" : "без подтверждённых данных"} не показаны.`}</p>
    </article>
    {offers ? <article className="analysis-card" aria-labelledby="structure-chart-title">
      <header className="analysis-card-heading"><Icon name={"complex"} size={27} /><h2 id="structure-chart-title">{c.metric === "complexShare" ? "За счёт чего меняется доля" : c.metric === "complex" ? "Из чего складывается объём" : "Структура портфеля"}</h2><button className="analysis-open" aria-label="Открыть детализацию структуры" onClick={() => detail(c.metric === "complexShare" ? "products" : offers ? composition : "employees")}><Icon name="arrow" size={18} /></button></header>
      {c.metric === "complexShare" ? <ShareAnalysis data={data} c={c} change={change} /> : <>
        <div className="analysis-chart-controls"><span>{c.metric === "complex" ? "Количество сложных предложений" : "Доля внутри каждой группы"}</span><div className="analysis-switch" role="group" aria-label="Состав портфеля">{[ ["products", "Продукты"], ["stages", "Стадии"]].map(([id, label]) => <button key={id} aria-pressed={composition === id} onClick={() => setComposition(id)}>{label}</button>)}</div></div>
        {composition === "products" ? <><Legend groups={groups} /><div className="analysis-bar-chart">{productRows.map(r => <div className="analysis-chart-item" key={r.name}><button className="analysis-chart-label" onClick={() => detail("products", r.name)} title={r.name}>{r.name}<Icon name="chevron" size={12} /></button><PairBars values={r.values} max={productMax} percent={c.metric !== "complex"} /></div>)}{!productRows.length && <div className="analysis-chart-empty">Продуктовая расшифровка недоступна для выбранного среза</div>}</div><p className="analysis-card-note">5 продуктов с наибольшим числом предложений. {complex ? "Длина столбца показывает количество, единый масштаб для обеих групп. Изменения по продуктам — в разборе ГОСБ ниже." : "Доли рассчитаны от всего выбранного портфеля. Точные количества — в детализации."}</p></> : <div className="analysis-stage-chart">{groups.map(g => {
          const counts = view(data, c, g).periods[c.quarter - 1][complex ? "complexStages" : "stages"];
          const names = [...stages.filter(n => n in counts), ...Object.keys(counts).filter(n => !stages.includes(n))];
          const total = Object.values(counts).reduce((a, b) => a + b, 0);
          return <section key={g} className="analysis-stage-group">
            <h3><i style={{ background: colors[g] }} />{groupNames[g]}</h3>
            <div className="analysis-stage-composition">
              <StageDonut total={total} items={names.map(name => ({ name, count: counts[name], color: stageColor(name) }))} />
              <div className="analysis-stage-legend">{names.map(n => <button key={n} onClick={() => detail("stages", n)}>
                <span className="analysis-stage-name"><i style={{ background: stageColor(n) }} />{n}<Icon name="chevron" size={14} /></span>
                <span className="analysis-stage-values"><b>{format(counts[n])}</b></span>
              </button>)}</div>
            </div>
            {!total && <p className="analysis-card-note">Нет расшифровки по стадиям</p>}
          </section>;
        })}<p className="analysis-card-note">Текущие стадии предложений, а не воронка конверсии. Переходы между стадиями в источнике не зафиксированы.</p></div>}
      </>}
    </article> : <AnalysisInsights data={data} c={c} detail={detail} />}
  </div>;
}

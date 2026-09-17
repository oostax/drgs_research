import { useState } from "react";
import type { Group, Period } from "./types";
import { format } from "./model";

const colors = { pilot: "#00855e", nonpilot: "#5746d8" };

export function productChanges(current: Period, previous: Period, complex: boolean, allowAssigned = false) {
  const metric = complex ? "complex" : "sales";
  const key = complex ? "complexProducts" : "products";
  const complete = (period: Period) => period[metric].status === "ready" && (allowAssigned || !period[metric].assignedOnly) && period[metric].value != null && period[key].reduce((sum, item) => sum + item.count, 0) === period[metric].value;
  if (!complete(current) || !complete(previous)) return null;
  const names = [...new Set([...current[key], ...previous[key]].map(p => p.name))];
  return names.map(name => {
    const before = previous[key].find(p => p.name === name)?.count ?? 0;
    const after = current[key].find(p => p.name === name)?.count ?? 0;
    return { name, before, after, difference: after - before };
  }).sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference) || a.name.localeCompare(b.name, "ru"));
}

export function BranchProductBreakdown({ current, previous, complex, quarter, branch, group, partial }: { current: Period; previous: Period; complex: boolean; quarter: number; branch: string; group: Group; partial: boolean }) {
  const [all, setAll] = useState(false);
  const changes = productChanges(current, previous, complex, true);
  const metric = complex ? "complex" : "sales";
  const assignedPeriods = [previous, current].flatMap((period, i) => period[metric].assignedOnly ? [`${["I", "II", "III"][quarter - 2 + i]} кв.`] : []);
  const limited = assignedPeriods.length > 0;
  const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${format(Math.abs(n))}`;
  if (!changes) return <div className="analysis-product-breakdown" role="region" aria-label={`Разбор изменений: ${branch}`}><h3>{branch} · разбор по продуктам</h3><p>Для точного разбора нужна полная продуктовая расшифровка обоих кварталов. Сейчас она не подтверждена.</p></div>;
  const growing = changes.reduce((sum, item) => sum + Math.max(0, item.difference), 0);
  const declining = changes.reduce((sum, item) => sum + Math.min(0, item.difference), 0);
  const maximum = Math.max(1, ...changes.map(item => Math.abs(item.difference)));
  const shown = all ? changes : changes.slice(0, 6);
  const remaining = changes.slice(shown.length).reduce((sum, item) => sum + item.difference, 0);
  return <div className="analysis-product-breakdown" role="region" aria-label={`Разбор изменений: ${branch}`}>
    <div className="analysis-breakdown-heading"><div><h3>{limited ? "Сравнение доступных предложений" : "Что изменилось в портфеле"}</h3><p>{branch} · {group === "pilot" ? "Пилот" : "Непилот"} · {complex ? "сложные продукты" : "все выбранные продукты"}</p></div><span className="analysis-breakdown-net">{signed(growing + declining)} <small>предложений к {["I", "II"][quarter - 2]} кв.</small></span></div>
    {limited && <p className="analysis-breakdown-note">{assignedPeriods.join(" и ")}: учтены только предложения с известным ГОСБ. Ниже — разница доступных значений по продуктам; она не подтверждает изменение полного портфеля ГОСБ.</p>}
    <p className="analysis-breakdown-equation">Рост по продуктам <b className="up">{signed(growing)}</b><span> · </span>Снижение <b className="down">{signed(declining)}</b><span> · </span>Итог <b>{signed(growing + declining)}</b></p>
    <div className="analysis-driver-head"><span>Продукт</span><span>{["I", "II"][quarter - 2]} кв.</span><span>{["II", "III"][quarter - 2]} кв.{partial ? "*" : ""}</span><span>Вклад в изменение, шт.</span></div>
    {shown.map(item => <div className="analysis-driver-row" key={item.name}>
      <span>{item.name}</span><span>{format(item.before)}</span><strong>{format(item.after)}</strong>
      <div className="analysis-driver-change"><div className="analysis-driver-track" aria-hidden="true"><i style={{ width: `${Math.abs(item.difference) / maximum * 50}%`, left: item.difference < 0 ? `${50 - Math.abs(item.difference) / maximum * 50}%` : "50%", background: item.difference < 0 ? "#bf4634" : "#00855e" }} /></div><b className={item.difference < 0 ? "down" : item.difference > 0 ? "up" : ""}>{signed(item.difference)}</b></div>
    </div>)}
    {changes.length > 6 && <button className="analysis-breakdown-more" onClick={() => setAll(!all)}>{all ? "Свернуть список" : `Ещё ${changes.length - shown.length} продуктов · суммарно ${signed(remaining)}`}</button>}
    <p className="analysis-breakdown-note">Изменение числа предложений по продуктам между квартальными срезами.{partial ? " * Текущий квартал неполный." : ""}</p>
  </div>;
}

export function DetailShareBar({ count, total, group, points = false }: { count: number; total: number; group: Group; points?: boolean }) {
  const percent = total > 0 ? count / total * 100 : null;
  return <div className="detail-share">
    <div className="detail-share-track" aria-hidden="true"><span style={{ width: `${percent ?? 0}%`, background: colors[group] }} /></div>
    <span>{percent == null ? "—" : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(percent)}${points ? " п. п." : "%"}`}</span>
  </div>;
}

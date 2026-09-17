import type { Context, Manifest, Stat } from "./types";
import { format, groupNames, selectedGroups, statusText, view } from "./model";

const number = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n);
const points = (n: number) => `${n > 0 ? "+" : ""}${number(n)} п. п.`;

export function shareBasis(stat: Stat) {
  const { numerator, denominator } = stat;
  return stat.status === "ready" && stat.value != null && numerator != null && denominator != null &&
    Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0 && numerator >= 0 && numerator <= denominator
    ? { complex: numerator, total: denominator, share: numerator / denominator * 100 } : null;
}

/** Ordered arithmetic bridge: change numerator first, then denominator. */
export function shareEffects(current: Stat, previous?: Stat) {
  if (!previous || current.assignedOnly || previous.assignedOnly) return null;
  const after = shareBasis(current), before = shareBasis(previous);
  if (!after || !before) return null;
  const numerator = (after.complex - before.complex) / before.total * 100;
  const denominator = after.complex / after.total * 100 - after.complex / before.total * 100;
  return { before, after, numerator, denominator, total: after.share - before.share };
}

export function ShareAnalysis({ data, c, change }: { data: Manifest; c: Context; change: (patch: Partial<Context>) => void }) {
  return <div className="analysis-share-composition">
    <p className="analysis-chart-subtitle">Сложные предложения / весь портфель без ФОТ</p>
    <div className="analysis-legend"><span><i style={{ background: "#6155ed" }} />Сложные</span><span><i style={{ background: "#e3e5ec" }} />Остальные</span></div>
    {selectedGroups(data, c).map(group => {
      const periods = view(data, c, group).periods;
      const effects = shareEffects(periods[c.quarter - 1].complexShare, periods[c.quarter - 2]?.complexShare);
      return <section className="analysis-share-group" key={group} aria-label={`Состав портфеля: ${groupNames[group]}`}>
        <h3><span className={`group-tag ${group}`}>{groupNames[group]}</span>{effects && <span className="analysis-share-delta">{points(effects.total)} <small>к {["I", "II"][c.quarter - 2]} кв.</small></span>}</h3>
        <div className="analysis-share-periods">{periods.slice(0, c.quarter).map((period, index) => {
          const basis = shareBasis(period.complexShare);
          return <button key={period.quarter} className="analysis-share-period" aria-pressed={index + 1 === c.quarter} onClick={() => change({ quarter: index + 1 })} aria-label={`Состав портфеля, ${["I", "II", "III"][index]} квартал: ${basis ? `${number(basis.share)}%, ${format(basis.complex)} из ${format(basis.total)}` : statusText(period.complexShare)}`}>
            <span>{["I", "II", "III"][index]} кв.{data.periods[index].partial ? "*" : ""}</span>
            <span className="analysis-share-period-data"><span className="analysis-share-track" aria-hidden="true">{basis && <i style={{ width: `${basis.share}%` }} />}</span><span className="analysis-share-base">{basis ? <><b>{format(basis.complex)}</b> из {format(basis.total)} предложений</> : statusText(period.complexShare)}</span></span>
            <strong>{basis ? `${number(basis.share)}%` : "—"}</strong>
          </button>;
        })}</div>
        {effects ? <div className="analysis-share-effects">
          <h4>Что изменило долю</h4>
          {[
            { label: "Число сложных", before: effects.before.complex, after: effects.after.complex, effect: effects.numerator },
            { label: "Размер всего портфеля", before: effects.before.total, after: effects.after.total, effect: effects.denominator },
          ].map(row => <div className="analysis-share-effect" key={row.label}><div><span>{row.label}</span><small>{format(row.before)} → {format(row.after)}</small></div><b className={row.effect > 0 ? "up" : row.effect < 0 ? "down" : ""}>{points(row.effect)}</b></div>)}
        </div> : <p className="analysis-card-note">{c.quarter === 1 ? "Первый квартал — база для последующих сравнений." : "Для разбора изменения нужна полная база обоих кварталов."}</p>}
      </section>;
    })}
    <details className="analysis-share-method"><summary>Как посчитан вклад</summary><p>Сначала меняем число сложных предложений при прежнем размере портфеля, затем учитываем новый размер всего портфеля. Сумма двух вкладов равна изменению доли; возможна разница округления. Это арифметическое разложение, а не оценка причин. Для пилота используется портфель старшей роли.</p></details>
    {data.periods.slice(0, c.quarter).some(p => p.partial) && <p className="analysis-card-note">* III квартал по {data.periods[2].through.slice(0, 5)}. Сравнение квартальных срезов, текущий квартал неполный.</p>}
  </div>;
}

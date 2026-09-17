import type { Context, Manifest } from './types';
import { format, groupNames, selectedGroups, view, value } from './model';
import { Icon } from './Icons';

const forms = new Intl.PluralRules('ru');
const questionnaires = (n: number) => `${n} ${{ one: 'анкета', few: 'анкеты', many: 'анкет', other: 'анкеты' }[forms.select(n) as 'one' | 'few' | 'many' | 'other']}`;
const colors = { pilot: '#00855e', nonpilot: '#5746d8' };
export function AnalysisInsights({ data, c, detail }: { data: Manifest; c: Context; detail: (tab: string, search?: string) => void }) {
  const groups = selectedGroups(data, c);
  const title = c.metric === 'coverage' ? 'Клиенты без встреч' : c.metric === 'meetings' ? 'Полнота данных по сотрудникам' : c.metric === 'leads' ? 'Полезность лидов по неделям' : 'Как меняются оценки процесса';
  return <article className="analysis-card" aria-label={title}>
    <header className="analysis-card-heading"><Icon name={c.metric === 'coverage' || c.metric === 'meetings' ? 'meetings' : 'process'} size={27} /><h2>{title}</h2></header>
    {c.metric === 'coverage' ? <>
      <p className="analysis-chart-subtitle">Закреплённые клиенты без встреч с 1 апреля</p>
      <div className="analysis-insight-groups">{groups.map(group => {
        const stat = value(data, c, group, 'coverage');
        const remaining = stat.status === 'ready' && stat.numerator != null && stat.denominator != null ? stat.denominator - stat.numerator : null;
        return <section key={group}><h3><i style={{ background: colors[group] }} />{groupNames[group]}</h3><strong className="analysis-insight-number">{format(remaining)}<small> клиентов</small></strong>{remaining != null && stat.denominator! > 0 && <div className="analysis-bar-track" aria-hidden="true"><span style={{ width: `${remaining / stat.denominator! * 100}%`, background: colors[group] }} /></div>}<p>{remaining == null ? stat.reason || 'Недостаточно данных о закреплённой базе.' : 'Остаток закреплённой базы, с которым ещё не было встречи.'}</p></section>;
      })}</div><button className="analysis-insight-action" onClick={() => detail(groups.includes('pilot') ? 'employees' : 'branches')}>Разобрать покрытие<Icon name="arrow" size={16} /></button>
    </> : c.metric === 'meetings' ? <>
      <p className="analysis-chart-subtitle">Кому не хватает строк в источнике встреч</p>
      <div className="analysis-insight-groups">{groups.map(group => {
        const slice = view(data, c, group), stat = value(data, c, group, 'meetings');
        const missing = slice.missingMeetingStaff.length, staff = slice.staffCount;
        return <section key={group}><h3><i style={{ background: colors[group] }} />{groupNames[group]}</h3>{staff != null ? <><div className="analysis-insight-pair"><div><strong>{format(Math.max(0, staff - missing))}</strong><span>Есть в выгрузке</span></div><div><strong>{format(missing)}</strong><span>Нет строк</span></div></div><div className="analysis-bar-track" aria-hidden="true"><span style={{ width: `${staff ? Math.max(0, staff - missing) / staff * 100 : 0}%`, background: colors[group] }} /></div></> : <p>В реестре нет состава сотрудников непилота: полноту по людям оценить нельзя.</p>}{stat.reason && <p>{stat.reason}</p>}</section>;
      })}</div>{groups.includes('pilot') && <button className="analysis-insight-action" onClick={() => detail('employees')}>Проверить сотрудников<Icon name="arrow" size={16} /></button>}
      <p className="analysis-card-note">Наличие строки не означает наличие встреч. Пропуски не равны нулю.</p>
    </> : c.metric === 'leads' ? <>
      <p className="analysis-chart-subtitle">Оценка четвёртого вопроса · шкала 1–3</p>
      <div className="analysis-weekly-scores">{groups.map(group => {
        const weeks = view(data, c, group).periods[c.quarter - 1].survey?.weeks ?? [];
        return <section key={group}><h3><i style={{ background: colors[group] }} />{groupNames[group]}</h3>{weeks.filter(w => w.leads.value != null).map(w => <div className="analysis-score-week" key={w.id}><span>{w.start.slice(8, 10)}.{w.start.slice(5, 7)}–{w.end.slice(8, 10)}.{w.end.slice(5, 7)}</span><div className="analysis-bar-track" aria-hidden="true"><span style={{ width: `${w.leads.value! / 3 * 100}%`, background: colors[group] }} /></div><strong>{format(w.leads.value, 'leads')}</strong><small>{questionnaires(w.responses)}</small></div>)}{!weeks.some(w => w.leads.value != null) && <p>В этом квартале нет недель с ответами.</p>}</section>;
      })}</div><p className="analysis-card-note">Недели без ответов пропущены. Значения отражают состав ответивших в каждую неделю.</p>
    </> : <>
      <p className="analysis-chart-subtitle">Изменение трёх составляющих к предыдущему кварталу · баллы</p>
      <div className="analysis-insight-groups">{groups.map(group => {
        const periods = view(data, c, group).periods;
        return <section key={group}><h3><i style={{ background: colors[group] }} />{groupNames[group]}</h3>{['Рабочая неделя', 'Модель продаж', 'Время с клиентами'].map((name, i) => {
          const now = periods[c.quarter - 1].survey?.questions[i], before = periods[c.quarter - 2]?.survey?.questions[i];
          const diff = now == null || before == null ? null : now - before;
          return <div className="analysis-question-change" key={name}><span>{name}</span><strong className={diff == null ? '' : diff > 0 ? 'up' : diff < 0 ? 'down' : ''}>{diff == null ? '—' : `${diff > 0 ? '+' : ''}${format(diff, 'process')}`}</strong><small>{now == null ? 'Нет ответов' : before == null ? `Сейчас ${format(now, 'process')} · нет базы сравнения` : `${format(before, 'process')} → ${format(now, 'process')}`}</small></div>; })}<p>{value(data, c, group, 'process').sample ?? 0} ответивших · {value(data, c, group, 'process').responses ?? 0} анкет</p></section>;
      })}</div><p className="analysis-card-note">Полезность лидов анализируется отдельно — в одноимённом показателе.</p>
    </>}
  </article>;
}

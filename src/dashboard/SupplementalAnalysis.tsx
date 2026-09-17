import { useRef, useState, type ReactNode } from 'react';
import type { Context, Manifest } from './types';
import type { Supplemental, SupplementalMetric, SupplementalStat } from './supplementalModel';
import { appealMonths, appealMonthlyStats, displayedValue, supplementalFormat, supplementalSeries } from './supplementalModel';
import { downloadCsv } from './analysisModel';
import { Icon } from './Icons';
import { Select } from './Select';
import './SupplementalAnalysis.css';

type Row = { id: string; name: string; branch?: string; group: string; groupLabel: string; before: SupplementalStat; now: SupplementalStat; difference: number | null; percent: number | null };
const colors: Record<string, string> = { pilot: '#00855e', nonpilot: '#5746d8', other: '#737987' };
const number = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
const signed = (n: number) => `${n > 0 ? '+' : ''}${number(n)}`;

export function supplementalAnalysisRows(data: Supplemental, manifest: Manifest, c: Context): Row[] {
  const metric = c.metric as SupplementalMetric;
  const beforeIndex = metric === 'appeals' ? (c.appealBaseMonth ?? 7) - 1 : 0;
  const nowIndex = metric === 'appeals' ? (c.appealMonth ?? 8) - 1 : 2;
  const series = metric === 'appeals'
    ? data.appeals.banks.filter(b => (c.branch === 'all' || b.name === data.appeals.branchToTerbank[c.branch]) && (c.group === 'both' || b.group === c.group)).map(b => ({ id: b.name, name: b.name, group: b.group, groupLabel: b.group === 'pilot' ? 'ТБ с пилотом' : b.group === 'nonpilot' ? 'Остальные ТБ' : 'Вне групп', stats: appealMonthlyStats(b.months) }))
    : manifest.branches.filter(b => c.branch === 'all' || c.branch === b.id).flatMap(b => supplementalSeries(data, { ...c, branch: b.id }, metric).map(s => ({ ...s, id: `${b.id}:${s.id}`, name: b.name, branch: b.id, group: s.id, groupLabel: s.id === 'pilot' ? 'Пилот' : 'Непилот' })));
  return series.map(s => {
    const before = s.stats[beforeIndex], now = s.stats[nowIndex];
    const a = displayedValue(before), b = displayedValue(now);
    return { ...s, before, now, difference: a == null || b == null ? null : b - a, percent: a == null || b == null || a <= 0 ? null : (b / a - 1) * 100 };
  });
}

export function SupplementalPeriods({ c, change }: { c: Context; change: (patch: Partial<Context>) => void }) {
  if (c.metric !== 'appeals') return null;
  return <div className="analysis-month-pair">{(['appealMonth', 'appealBaseMonth'] as const).map((key, index) => <div key={key}><span className="appeal-period-label">{index ? 'Сравнить с' : 'Период'}</span><div className="appeal-months" role="group" aria-label={index ? 'Сравнить с' : 'Период обращений'}>{appealMonths.map((name, i) => <button key={name} type="button" aria-label={name} aria-pressed={(c[key] ?? (index ? 7 : 8)) === i + 1} onClick={() => change({ [key]: i + 1 })}>{['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг'][i]}</button>)}</div></div>)}</div>;
}

export function SupplementalAnalysis({ data, manifest, c, change, notes }: { data: Supplemental; manifest: Manifest; c: Context; change: (patch: Partial<Context>) => void; notes: ReactNode }) {
  const [search, setSearch] = useState(''), [sort, setSort] = useState('change'), [movement, setMovement] = useState('all'), [page, setPage] = useState(0), [rowGroup, setRowGroup] = useState('all');
  const tableRef = useRef<HTMLElement>(null);
  const metric = c.metric as SupplementalMetric, appeals = metric === 'appeals';
  const rows = supplementalAnalysisRows(data, manifest, c);
  const beforeLabel = appeals ? appealMonths[(c.appealBaseMonth ?? 7) - 1] : 'Март';
  const nowLabel = appeals ? appealMonths[(c.appealMonth ?? 8) - 1] : 'Июль';
  const unit = metric === 'payroll' ? 'млрд ₽' : metric === 'recipients' ? 'чел.' : 'шт.';
  const amount = (n: number | null) => n == null ? '—' : metric === 'payroll' ? (n / 1e11).toLocaleString('ru-RU', { maximumFractionDigits: 1 }) : number(n);
  const difference = (n: number | null) => n == null ? '—' : `${n > 0 ? '+' : ''}${amount(n)}`;
  const ranked = rows.filter(r => r.difference != null).sort((a, b) => Math.abs(b.difference!) - Math.abs(a.difference!));
  const leaders = ranked.slice(0, 5), peak = Math.max(1, ...leaders.map(r => Math.abs(r.difference!)));
  const matches = (r: Row) => movement === 'all' || (movement === 'missing' ? r.difference == null : r.difference != null && (movement === 'growth' ? r.difference > 0 : movement === 'decline' ? r.difference < 0 : r.difference === 0));
  const filtered = rows.filter(r => (rowGroup === 'all' || r.group === rowGroup) && `${r.name} ${r.branch ?? ''} ${r.groupLabel}`.toLowerCase().includes(search.trim().toLowerCase()) && matches(r)).sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name, 'ru');
    const av = sort === 'value' ? displayedValue(a.now) : sort === 'percent' ? a.percent : a.difference == null ? null : Math.abs(a.difference);
    const bv = sort === 'value' ? displayedValue(b.now) : sort === 'percent' ? b.percent : b.difference == null ? null : Math.abs(b.difference);
    return av == null ? bv == null ? 0 : 1 : bv == null ? -1 : bv - av;
  });
  const lastPage = Math.max(0, Math.ceil(filtered.length / 10) - 1), currentPage = Math.min(page, lastPage);
  const visible = filtered.slice(currentPage * 10, currentPage * 10 + 10);
  const drill = (r: Row) => { setSearch(r.branch ?? r.name); setRowGroup('all'); setMovement('all'); setPage(0); tableRef.current?.scrollIntoView({ behavior: 'instant', block: 'start' }); };
  const chooseMovement = (next: string) => { setMovement(next); setPage(0); };
  function exportRows() {
    downloadCsv(`анализ-${metric}.csv`, [[appeals ? 'Тербанк' : 'ГОСБ', 'Номер ГОСБ', 'Группа', beforeLabel, nowLabel, 'Абсолютное изменение', 'Изменение, %', 'Статус'], ...filtered.map(r => [r.name, r.branch ?? '', r.groupLabel, supplementalFormat(displayedValue(r.before), metric), supplementalFormat(displayedValue(r.now), metric), supplementalFormat(r.difference, metric), r.percent, r.now.status === 'unverified' || r.before.status === 'unverified' ? 'По заполненным данным' : r.difference == null ? 'Нет пары данных' : 'Подтверждено'])]);
  }
  return <div className="supplemental-analysis">
    <div className="analysis-chart-grid">
      <article className="analysis-card" aria-label="Территории с наибольшими изменениями">
        <header className="analysis-card-heading"><Icon name="analysis" size={27} /><h2>{appeals ? 'Где меняются обращения' : metric === 'payroll' ? 'Где меняется объём ФОТ' : 'Где меняется число получателей'}</h2></header>
        <div className="analysis-chart-controls"><span>5 наибольших изменений · {unit}</span><span>{beforeLabel} → {nowLabel.toLowerCase()}</span></div>
        <div className="monthly-ranking">{leaders.map(r => <div key={r.id}>
          <button className="analysis-chart-label" onClick={() => drill(r)}>{r.name}<Icon name="chevron" size={14} /></button>
          <div className="monthly-ranking-meta"><span style={{ color: colors[r.group] }}>{r.groupLabel}</span><strong>{difference(r.difference)}</strong></div>
          <div className="monthly-change-track" aria-hidden="true"><i style={{ background: colors[r.group], width: `${Math.abs(r.difference!) / peak * 50}%`, left: `${r.difference! < 0 ? 50 - Math.abs(r.difference!) / peak * 50 : 50}%` }} /></div>
        </div>)}</div>
        {!leaders.length && <p className="analysis-chart-empty">Нет пары периодов для сравнения. Доступные значения — в таблице.</p>}
        <p className="analysis-card-note">Снижение — влево, рост — вправо. Нажмите территорию для разбора.</p>
      </article>
      <article className="analysis-card" aria-label="Распределение направлений изменений">
        <header className="analysis-card-heading"><Icon name="coverage" size={27} /><h2>Насколько широко меняется результат</h2></header>
        <p className="analysis-chart-subtitle">Количество {appeals ? 'тербанков' : 'ГОСБ'} по направлению изменения</p>
        <div className="monthly-balance">{['pilot', 'nonpilot', 'other'].filter(group => rows.some(r => r.group === group)).map(group => {
          const groupRows = rows.filter(r => r.group === group);
          const counts = [groupRows.filter(r => r.difference != null && r.difference > 0).length, groupRows.filter(r => r.difference != null && r.difference < 0).length, groupRows.filter(r => r.difference === 0).length, groupRows.filter(r => r.difference == null).length];
          return <section key={group}><h3><i style={{ background: colors[group] }} />{groupRows[0].groupLabel}</h3><div className="monthly-balance-track" aria-hidden="true">{counts.map((count, i) => <span key={i} className={`balance-${i}`} style={{ width: `${count / groupRows.length * 100}%` }} />)}</div><div className="monthly-balance-legend">{['Рост', 'Снижение', 'Без изменения', 'Нет пары данных'].map((label, i) => <button key={label} onClick={() => { setRowGroup(group); chooseMovement(['growth', 'decline', 'flat', 'missing'][i]); tableRef.current?.scrollIntoView({ behavior: 'instant' }); }}><i className={`balance-${i}`} /><span>{label}</span><strong>{counts[i]}</strong></button>)}</div></section>;
        })}</div>
        {!rows.length && <p className="analysis-chart-empty">Нет данных для выбранных фильтров.</p>}
        <p className="analysis-card-note">Показывает распространённость изменения, а не его величину.</p>
      </article>
    </div>
    <section className="analysis-detail analysis-monthly-table" ref={tableRef} aria-label="Детализация данных">
      <header className="analysis-detail-heading"><div><h2>{appeals ? 'Детализация по тербанкам' : 'Детализация по ГОСБ'}</h2><p>{beforeLabel} и {nowLabel.toLowerCase()} · {unit}</p></div><button className="analysis-export" onClick={exportRows} disabled={!filtered.length}><Icon name="download" size={16} />Скачать CSV</button></header>
      <div className="analysis-table-tools monthly-table-tools"><label className="search"><Icon name="search" size={17} /><input aria-label={appeals ? 'Найти тербанк' : 'Найти ГОСБ'} placeholder={appeals ? 'Найти тербанк' : 'Название или номер ГОСБ'} value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></label><Select label="Сортировка таблицы" value={sort} onChange={v => { setSort(v); setPage(0); }} options={[{ value: 'change', label: 'По изменению' }, { value: 'percent', label: 'По приросту, %' }, { value: 'value', label: 'По значению' }, { value: 'name', label: 'По названию' }]} /></div>
      <div className="analysis-detail-context"><div className="analysis-movement" role="group" aria-label="Направление изменений">{[['all', 'Все'], ['growth', 'Рост'], ['decline', 'Снижение'], ['flat', 'Без изменения'], ['missing', 'Нет пары данных']].map(([id, label]) => <button key={id} aria-pressed={movement === id} onClick={() => { setRowGroup('all'); chooseMovement(id); }}>{label}</button>)}</div><span>{filtered.length} строк{rowGroup !== 'all' ? ` · ${rows.find(r => r.group === rowGroup)?.groupLabel}` : ''}</span>{rowGroup !== 'all' && <button className="analysis-clear" onClick={() => setRowGroup('all')}>Все выбранные группы</button>}{search && <button className="analysis-clear" onClick={() => { setSearch(''); setPage(0); }}>Сбросить поиск</button>}</div>
      <div className="table-scroll" tabIndex={0} aria-label="Сравнение месячных значений"><table><thead><tr><th scope="col">{appeals ? 'Тербанк / группа' : 'ГОСБ'}</th><th scope="col">Группа</th><th scope="col">{beforeLabel}</th><th scope="col" className="analysis-selected-column">{nowLabel}</th><th scope="col">Изменение, {unit}</th><th scope="col">Изменение, %</th></tr></thead><tbody>{visible.map(r => <tr key={r.id}><td><button className="branch-link" onClick={() => r.branch ? change({ branch: r.branch }) : drill(r)}>{r.name}</button>{r.branch && <small className="cell-note">№{r.branch}</small>}</td><td><span className={`group-tag ${r.group}`}>{r.groupLabel}</span></td>{[r.before, r.now].map((stat, i) => <td key={i} className={i ? 'numeric analysis-selected-column' : 'numeric'} title={`${supplementalFormat(displayedValue(stat), metric)}${stat.status === 'unverified' ? ' · По заполненным данным' : ''}`}>{amount(displayedValue(stat))}</td>)}<td className="numeric">{difference(r.difference)}</td><td><span className={`monthly-percent ${r.percent == null || r.percent === 0 ? '' : r.percent > 0 ? 'up' : 'down'}`}>{r.percent == null ? '—' : `${signed(r.percent)}%`}</span></td></tr>)}</tbody></table>{!visible.length && <p className="analysis-chart-empty">Нет строк для выбранных условий. Измените поиск или направление.</p>}</div>
      <div className="pagination"><span>{filtered.length ? `${currentPage * 10 + 1}–${Math.min((currentPage + 1) * 10, filtered.length)} из ${filtered.length}` : '0 строк'}</span><button disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Назад</button><button disabled={currentPage >= lastPage} onClick={() => setPage(currentPage + 1)}>Далее</button></div>
    </section>
    <details className="analysis-source-notes"><summary>Источники и правила</summary><p>«—» — нет данных или базы сравнения. {metric !== 'appeals' && 'Месячные суммы приведены по заполненным данным; состав клиентов с известными значениями может различаться.'}</p>{notes}</details>
  </div>;
}

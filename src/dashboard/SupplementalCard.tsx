import { useEffect, useState } from 'react';
import type { Context, Manifest } from './types';
import { contextUrl } from './model';
import { Icon } from './Icons';
import { SupplementalGlyph } from './SupplementalGlyph';
import { appealMonthlyStats, appealMonths, appealMonthDative, displayedValue, julyMarchChange, supplementalChange, supplementalFormat, supplementalSeries, validateSupplemental } from './supplementalModel';
import type { Supplemental, SupplementalMetric, SupplementalSeries } from './supplementalModel';
import { SupplementalAnalysis } from './SupplementalAnalysis';
import './SupplementalCard.css';
import './SalesCard.css';

type Change = (patch: Partial<Context>) => void;
export function useSupplemental(manifest: Manifest | null) {
  const [data, setData] = useState<Supplemental | null>(null);
  const [error, setError] = useState('');
  const [attempt, retry] = useState(0);
  useEffect(() => {
    if (!manifest) return;
    const controller = new AbortController();
    setError(''); setData(null);
    fetch('/dashboard/supplemental.json', { signal: controller.signal }).then(r => {
      if (!r.ok) throw new Error('Не удалось загрузить обращения и ФОТ. Проверьте доступность источников.');
      return r.json();
    }).then(raw => validateSupplemental(raw, manifest)).then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [manifest, attempt]);
  return { data, error, retry: () => retry(n => n + 1) };
}
export type SupplementalLoad = ReturnType<typeof useSupplemental>;
function SourceState({ load }: { load: SupplementalLoad }) {
  return <div className="supplemental-state" role="status"><p>{load.error || 'Загрузка обращений и ФОТ…'}</p>{load.error && <button onClick={load.retry}>Повторить загрузку</button>}</div>;
}

/** Venue Visitor, Fikri Bar Graph 1929:4832: category labels above rounded
 * horizontal bars, light vertical guides, absolute zero-based scale. */
function FikriAppealRanking({ data, c }: { data: Supplemental; c: Context }) {
  const monthIndex = (c.appealMonth ?? 8) - 1;
  const banks = data.appeals.banks.filter(b => b.group !== 'other' && (c.group === 'both' || b.group === c.group) && (c.branch === 'all' || b.name === data.appeals.branchToTerbank[c.branch]));
  const ranked = [...banks].sort((a,b)=>b.months[monthIndex]-a.months[monthIndex]);
  const shown = ranked.slice(0,5), peak = Math.max(1,...shown.map(b=>b.months[monthIndex]));
  return <section className="fikri-ranking" aria-label="Рейтинг тербанков по обращениям">
    <div className="supplemental-chart-caption"><h3>{banks.length > 5 ? 'Пять ТБ с наибольшим числом обращений' : 'Обращения по тербанкам'}</h3><span>шт.</span></div>
    <div className="fikri-ranking-rows">{shown.map(b=><div key={b.name} className={`fikri-ranking-row cohort-${b.group}`}>
      <div><span>{b.name.replace(/ банк$/i,'')}</span><strong>{b.months[monthIndex].toLocaleString('ru-RU')}</strong></div>
      <div className="fikri-ranking-track"><span style={{width:`${b.months[monthIndex]/peak*100}%`}} /></div>
    </div>)}</div>
    <div className="fikri-ranking-axis" aria-hidden="true"><span>0</span><span>{Math.round(peak/2).toLocaleString('ru-RU')}</span><span>{peak.toLocaleString('ru-RU')}</span></div>
    {banks.length>5 && <p>Показано 5 из {banks.length} ТБ. Полный список — в анализе.</p>}
  </section>;
}

/** Signed differences on one symmetric scale; totals remain in the summary above. */
function PayrollChanges({ series, metric }: { series: SupplementalSeries[]; metric: SupplementalMetric }) {
  const changes = series.map(s => {
    const march = displayedValue(s.stats[0]), july = displayedValue(s.stats[2]);
    return march == null || july == null ? null : july - march;
  });
  const peak = Math.max(1, ...changes.map(value => Math.abs(value ?? 0)));
  return <section className="payroll-changes" aria-label="Абсолютное изменение с марта">
    <div className="supplemental-chart-caption"><h3>Изменение с марта</h3><span>Июль − март</span></div>
    <div className="payroll-change-axis" aria-hidden="true"><span>← Снижение</span><span>0</span><span>Рост →</span></div>
    <div className="payroll-change-rows">{series.map((s, i) => {
      const value = changes[i];
      const label = value == null ? 'Нет пары данных' : value === 0 ? 'Без изменения' : `${value > 0 ? '+' : '−'}${supplementalFormat(Math.abs(value), metric, true)}${metric === 'recipients' ? ' чел.' : ''}`;
      return <div className={`payroll-change-row cohort-${s.id}`} key={s.id}>
        <div className="payroll-change-label"><span><i />{s.id === 'pilot' ? 'Пилот' : 'Непилот'}</span><strong title={value == null ? undefined : `${value > 0 ? '+' : ''}${supplementalFormat(value, metric)}`}>{label}</strong></div>
        <div className="payroll-change-track" aria-hidden="true">
          {value != null && value !== 0 && <span className="payroll-change-bar" style={{ width: `${Math.abs(value) / peak * 50}%`, left: `${value < 0 ? 50 - Math.abs(value) / peak * 50 : 50}%` }} />}
          {value === 0 && <span className="payroll-change-zero" />}
        </div>
      </div>;
    })}</div>
  </section>;
}

export function SupplementalCard({ load, c, change, kind, detail = false }: { load: SupplementalLoad; c: Context; change: Change; kind: 'appeals' | 'payroll'; detail?: boolean }) {
  const [mode, setMode] = useState<'payroll' | 'recipients'>('payroll');
  const metric: SupplementalMetric = kind === 'appeals' ? 'appeals' : detail && c.metric === 'recipients' ? 'recipients' : detail ? 'payroll' : mode;
  const title = kind === 'appeals' ? 'Обращения клиентов' : 'ФОТ и получатели';
  const data = load.data;
  const series = data ? supplementalSeries(data, c, metric, metric === 'appeals') : [];
  const appealMonth = c.appealMonth ?? 8, appealBaseMonth = c.appealBaseMonth ?? 7;
  const comparisonLabel = metric === 'appeals' ? `к ${appealMonthDative[appealBaseMonth - 1]}` : 'к марту';
  const target = { ...c, page: 'analysis' as const, metric };
  const bank = data?.appeals.branchToTerbank[c.branch];
  return <article className="metric-card supplemental-card" aria-label={title}>
    <header className="supplemental-heading"><SupplementalGlyph kind={kind} /><div className="funnel-heading-copy"><h2>{title}</h2><p>{kind === 'appeals' ? 'Все роли' : 'Младшая роль'}</p></div>{!detail && <a className="supplemental-open" aria-label={`Открыть анализ: ${title}`} href={contextUrl(target)} onClick={e => { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) { e.preventDefault(); change({ page: 'analysis', metric }); } }}><Icon name="arrow" size={20} /></a>}</header>
    {kind === 'payroll' && <div className="supplemental-mode" role="group" aria-label="Показатель ФОТ">{(['payroll', 'recipients'] as const).map(m => <button key={m} aria-pressed={metric === m} onClick={() => detail ? change({ metric: m }) : setMode(m)}>{m === 'payroll' ? 'Объём, ₽' : 'Получатели, шт.'}</button>)}</div>}
    {!data ? <SourceState load={load} /> : <>
      {metric === 'appeals' ? <div className="supplemental-month-controls">
        <span className="appeal-period-label">Период</span>
        <div className="appeal-months" role="group" aria-label="Период обращений">
          {appealMonths.map((label, i) => <button key={label} type="button" aria-label={label} aria-pressed={appealMonth === i + 1} onClick={() => {
            // Follow the previous month only while that comparison is active.
            // January has no December source: retain the explicit existing base.
            change({ appealMonth: i + 1, ...(i > 0 && appealBaseMonth === appealMonth - 1 ? { appealBaseMonth: i } : {}) });
          }}>{['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг'][i]}</button>)}
        </div>
        <div className="appeal-comparison">
          <span className="appeal-period-label">Сравнить с</span>
          {appealMonth > 1 && (appealBaseMonth === appealMonth - 1
            ? <span className="appeal-comparison-hint">Предыдущий месяц</span>
            : <button className="appeal-previous" type="button" onClick={() => change({ appealBaseMonth: appealMonth - 1 })}>К предыдущему</button>)}
        </div>
        <div className="appeal-months" role="group" aria-label="Сравнить с">
          {appealMonths.map((label, i) => <button key={label} type="button" aria-label={label} aria-pressed={appealBaseMonth === i + 1} onClick={() => change({ appealBaseMonth: i + 1 })}>{['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг'][i]}</button>)}
        </div>
      </div> : <div className="supplemental-period"><div><strong>Июль</strong><span className="supplemental-period-comparison">к марту</span></div></div>}
      {series.length ? <>
        <div className="supplemental-totals" aria-live="polite">{series.map(s => {
          const stat = s.stats[metric === 'appeals' ? appealMonth - 1 : 2], previous = s.stats[metric === 'appeals' ? appealBaseMonth - 1 : 0];
          const difference = metric === 'appeals' ? supplementalChange(stat, previous, true) : julyMarchChange(s.stats);
          const cleanPayroll = kind === 'payroll' && !detail;
          const formatted = supplementalFormat(displayedValue(stat), metric, true);
          return <section className={`supplemental-total cohort-${s.id}`} key={s.id}>
            <span className={`supplemental-cohort${kind === 'appeals' || cleanPayroll ? ' sales-group' : ''}`} title={s.label}><i />{cleanPayroll ? s.id === 'pilot' ? 'Пилот' : 'Непилот' : s.label}</span>
            {metric === 'appeals' && <span className="appeal-current-month">{appealMonths[appealMonth - 1]}</span>}
            {metric !== 'appeals' ? <>
              <strong className={`sales-number sales-delta payroll-primary-change ${difference?.startsWith('-') ? 'down' : difference?.startsWith('+') ? 'up' : 'neutral'}`} aria-label={difference ? `${difference} ${comparisonLabel}` : 'Изменение не рассчитано'}>{difference ?? '—'}</strong>
              <dl className="payroll-period-values" aria-label={`${s.label}: ${metric === 'payroll' ? 'ФОТ' : 'получатели'} по месяцам`}>
                <div><dt>Июль</dt><dd>{formatted}</dd></div>
                <div><dt>Март</dt><dd>{supplementalFormat(displayedValue(previous), metric, true)}</dd></div>
              </dl>
            </> : <strong className="sales-number" title={`${supplementalFormat(displayedValue(stat), metric)}${stat.status === 'unverified' ? ' · По заполненным данным' : ''}`}>{formatted}</strong>}
            {metric === 'appeals' && <div className="appeal-base-value" role="group" aria-label={`${s.label}: база сравнения, ${appealMonths[appealBaseMonth - 1]}`}>
              <span>{appealMonths[appealBaseMonth - 1]}</span>
              <strong>{supplementalFormat(displayedValue(previous), metric)}</strong>
            </div>}
            {difference ? metric === 'appeals' && <div className="sales-change"><span className={`sales-delta ${difference.startsWith('-') ? 'down' : difference.startsWith('+') ? 'up' : 'neutral'}`} aria-label={`${difference} ${comparisonLabel}`}>{difference}</span></div> : (!cleanPayroll || displayedValue(stat) == null || metric === 'recipients') && <span className="supplemental-quality">{displayedValue(stat) == null ? 'Нет данных, не ноль' : metric === 'recipients' ? 'Нет базы сравнения с мартом' : stat.status === 'unverified' ? 'По заполненным данным' : 'Нет базы сравнения с мартом'}</span>}
            {detail && difference && stat.status === 'unverified' && <span className="supplemental-quality">По заполненным данным</span>}
            {!cleanPayroll && stat.incompleteClients != null && stat.incompleteClients > 0 && <small>Заполнено {stat.knownClients?.toLocaleString('ru-RU')} из {stat.clients?.toLocaleString('ru-RU')} клиентов</small>}
          </section>;
        })}</div>
        {metric === 'appeals' ? <FikriAppealRanking {...{data,c}} /> : <PayrollChanges series={series} metric={metric} />}
      </> : <p className="supplemental-state">Нет данных для этого сочетания группы и ГОСБ. Тербанк выбранного ГОСБ может относиться к другой группе.</p>}
      {detail && <div className="supplemental-notes">
        {kind === 'appeals' ? <><p>{c.branch === 'all' ? 'Группы — тербанки с пилотом и остальные ТБ, не состав сотрудников.' : `${bank || 'Тербанк не сопоставлен'} · данные всего ТБ, не отдельного ГОСБ.`}</p><p>Роли и фильтр «Продукты» не разделены в листе d и не меняют эти значения.</p></> : <><p>{metric === 'recipients' ? 'Сравниваются месячные срезы июля и марта, не квартальные итоги.' : 'Сравниваются объёмы ФОТ за июль и март. Оба периода — полные месяцы. Пропуски не заменяются нулями.'}</p><p>Пилот — младшая роль. Фильтр «Продукты» к фактическому ФОТ не применяется.</p></>}
      </div>}
    </>}
  </article>;
}

function SourceNotes({ data, c, metric }: { data: Supplemental; c: Context; metric: SupplementalMetric }) {
  return <div className="supplemental-source-body">{metric === 'appeals' ? <>
    <p>«обращения 2025-2026_свод.xlsx», d!A5:J19. Количество обращений за выбранный месяц сравнивается с месяцем в поле «Сравнить с»: (период / база − 1) × 100%. Квартальный фильтр не применяется. Год — контекст дашборда {data.year}, в листе d он не указан.</p>
    <p>Пилотные ТБ: Волго-Вятский, Поволжский, Северо-Западный, Сибирский.</p>
    <p>ЦА и не определён ТБ: {c.branch === 'all' ? data.appeals.banks.filter(b => b.group === 'other').reduce((sum, b) => sum + b.months[(c.appealMonth ?? 8) - 1], 0).toLocaleString('ru-RU') : 'не относятся к выбранному ГОСБ'} — отдельно от двух групп.</p>
  </> : <>
    <p>{metric === 'payroll' ? '«Объем ФОТ (март, июль).xlsx». Март — столбец L «ФОТ за март», июль — M «ФОТ за июль». Накопительные столбцы N и O не используются в месячном сравнении. Расчёт в копейках, отображение в рублях.' : '«Получатели ФОТ (март, июль).xlsx». Сравнение среза июля со срезом марта.'}</p>
    <p>ГОСБ 9055 → 9500 и 9056 → 9600. Клиенты сопоставлены по ГОСБ и ИНН; исходные суммы сохранены.</p>
    <p>Пилот — подтверждённые сотрудники реестра. Остальные клиенты, включая записи без определённого сотрудника, входят в непилот. Отдельной третьей группы нет.</p>
    <p>{metric === 'recipients' ? 'Изменение получателей = (июль / март − 1) × 100%. Используются заполненные данные. При отсутствии значения или нулевой базе процент не рассчитывается.' : 'Изменение ФОТ = (июль / март − 1) × 100%. Используются заполненные месячные суммы. При отсутствии значения или нулевой базе процент не рассчитывается; пропуски не восполняются.'}</p>
  </>}</div>;
}

export function SupplementalDetail({ load, data, c, change }: { load: SupplementalLoad; data: Manifest; c: Context; change: Change }) {
  if (!load.data) return <SourceState load={load} />;
  const metric = c.metric as SupplementalMetric;
  return <SupplementalAnalysis key={`${c.metric}:${c.branch}:${c.group}:${c.role}:${c.appealMonth}:${c.appealBaseMonth}`} data={load.data} manifest={data} c={c} change={change} notes={<SourceNotes data={load.data} c={c} metric={metric} />} />;
}

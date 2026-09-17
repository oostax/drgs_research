import { useEffect, useMemo, useState } from "react";
import rawData from "./data/generated/analytics.json";
import type {
  AnalyticsViewKey,
  AnalyticsDataset,
  ComparisonKey,
  ComparisonSummary,
  ManagerScope,
  ManagerPerformance,
  MoodSurvey,
  ProductScope,
  RegistryRecord,
} from "./types";
import { decimal, fmt, pct, pctPlain } from "./lib/format";
import { normalizeManager, registryRecordInView } from "./lib/filters";
import {
  ComplexDealIcon,
  FormatIcon,
  ProductIcon,
  PulseIcon,
  StageIcon,
  TrendIcon,
  TriggerIcon,
} from "./components/Icons";

const data = rawData as unknown as AnalyticsDataset;
const pilotManagerKeys = new Set(data.pilotManagers.map(normalizeManager));
const pairOptions: { key: ComparisonKey; label: string }[] = [
  { key: "Q1-Q2", label: "Q1 → Q2" },
  { key: "Q2-Q3", label: "Q2 → Q3" },
  { key: "Q1-Q3", label: "Q1 → Q3" },
];
const periodLabel = {
  Q1: "Первый квартал",
  Q2: "Второй квартал",
  Q3: "Третий квартал на 23 августа",
};
const signed = (value: number) => `${value > 0 ? "+" : ""}${fmt(value)}`;
const share = (value: number, denominator: number) =>
  pctPlain(denominator ? (value / denominator) * 100 : 0);
const expandLabel = (value: string) =>
  value
    .replace(/\bФОТ\b/g, "фонд оплаты труда")
    .replace(/\bЖКХ\b/g, "жилищно-коммунальное хозяйство")
    .replace(/\bТКМ\b/g, "территориальный клиентский менеджер")
    .replace(/\bКМ\b/g, "клиентский менеджер")
    .replace(/\bПС\b/g, "продуктовый специалист");
const reliabilityText = {
  Высокая: "не менее 100 сохранившихся предложений",
  Средняя: "от 30 до 99 сохранившихся предложений",
  Ограниченная: "менее 30 сохранившихся предложений",
};
const managerScopeOptions: { key: ManagerScope; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "pilot", label: "Пилот" },
  { key: "nonPilot", label: "Не пилот" },
];
const productScopeOptions: { key: ProductScope; label: string }[] = [
  { key: "withoutFot", label: "Без ФОТ" },
  { key: "withFot", label: "С ФОТ" },
];
type DriverView = "complexDeals" | "products" | "formats" | "stages" | "triggers";

function SegmentedSwitch<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="filter-group">
      <span>{label}</span>
      <div role="group" aria-label={label}>
        {options.map((option) => (
          <button
            type="button"
            key={option.key}
            aria-pressed={value === option.key}
            className={value === option.key ? "is-active" : ""}
            onClick={() => onChange(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PeriodSwitch({
  value,
  onChange,
}: {
  value: ComparisonKey;
  onChange: (value: ComparisonKey) => void;
}) {
  return (
    <div className="period-switch-wrap">
      <span className="period-switch-label">Период сравнения</span>
      <div
        className="period-switch"
        role="group"
        aria-label="Сравниваемые периоды"
      >
        {pairOptions.map((item) => (
          <button
            key={item.key}
            aria-pressed={value === item.key}
            className={value === item.key ? "is-active" : ""}
            onClick={() => onChange(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AnalysisControls({
  pair,
  managerScope,
  productScope,
  managerCount,
  onPairChange,
  onManagerScopeChange,
  onProductScopeChange,
}: {
  pair: ComparisonKey;
  managerScope: ManagerScope;
  productScope: ProductScope;
  managerCount: number;
  onPairChange: (value: ComparisonKey) => void;
  onManagerScopeChange: (value: ManagerScope) => void;
  onProductScopeChange: (value: ProductScope) => void;
}) {
  const managerContext =
    managerScope === "pilot"
      ? "участники пилота"
      : managerScope === "nonPilot"
        ? "КМ вне пилота"
        : "все КМ";
  return (
    <section className="analysis-controls" aria-label="Настройка аналитического среза">
      <div className="controls-context" aria-live="polite">
        <h2>Настройка среза</h2>
        <p>
          <b>{fmt(managerCount)} КМ</b> · {managerContext} ·{" "}
          {productScope === "withoutFot"
            ? "все продукты без ФОТ"
            : "все продукты, включая ФОТ"}
        </p>
      </div>
      <PeriodSwitch value={pair} onChange={onPairChange} />
      <SegmentedSwitch
        label="Состав КМ"
        value={managerScope}
        options={managerScopeOptions}
        onChange={onManagerScopeChange}
      />
      <SegmentedSwitch
        label="Продукты"
        value={productScope}
        options={productScopeOptions}
        onChange={onProductScopeChange}
      />
    </section>
  );
}

function TurnoverFlow({
  before,
  retained,
  gone,
  added,
  after,
  progressRate,
  progressed,
  leadConversion,
  leadToDeal,
}: {
  before: number;
  retained: number;
  gone: number;
  added: number;
  after: number;
  progressRate: number;
  progressed: number;
  leadConversion: number;
  leadToDeal: number;
}) {
  const retention = before ? (retained / before) * 100 : 0;
  return (
    <figure className="turnover-flow" aria-label="Состав изменения портфеля">
      <figcaption>
        <b>Как изменился портфель</b>
        <span>{fmt(retained)} предложений можно сравнить напрямую</span>
      </figcaption>
      <div className="flow-equation">
        <div className="flow-endpoint">
          <span>Было</span>
          <b>{fmt(before)}</b>
        </div>
        <i className="flow-arrow" aria-hidden="true" />
        <div className="flow-core">
          <header>
            <span>Сохранилось между срезами</span>
            <b>{fmt(retained)} · {pctPlain(retention)}</b>
          </header>
          <div className="retention-track" aria-hidden="true">
            <i style={{ width: `${Math.min(100, retention)}%` }} />
          </div>
          <div className="flow-branches">
            <div className="is-gone">
              <span>Выбыло</span>
              <b>−{fmt(gone)}</b>
              <small>{share(gone, before)} исходной базы</small>
            </div>
            <div className="is-new">
              <span>Добавлено</span>
              <b>+{fmt(added)}</b>
              <small>{share(added, after)} целевой базы</small>
            </div>
          </div>
          <div className="flow-signals">
            <p>
              <span>Продвинулись по стадии</span>
              <b>{fmt(progressed)} · {pctPlain(progressRate * 100)}</b>
            </p>
            <p>
              <span>Лиды перешли в сделки</span>
              <b>{fmt(leadToDeal)} · {pctPlain(leadConversion * 100)}</b>
            </p>
          </div>
        </div>
        <i className="flow-arrow" aria-hidden="true" />
        <div className="flow-endpoint is-target">
          <span>Стало</span>
          <b>{fmt(after)}</b>
          <small>{signed(after - before)} к исходному срезу</small>
        </div>
      </div>
    </figure>
  );
}

function CompactDiagnostics({
  comparison,
  target,
}: {
  comparison: ComparisonSummary;
  target: AnalyticsDataset["views"][AnalyticsViewKey]["snapshots"]["Q1"];
}) {
  const fields = [
    ["ID сделки", target.quality.dealId],
    ["Триггер", target.quality.trigger],
    ["Потенциал", target.quality.potential],
    ["Комментарий КМ", target.quality.notes],
  ] as const;
  const correlation = comparison.meetingRelation.correlationWithProgressed;
  const correlationPosition = Math.max(0, Math.min(100, (correlation + 1) * 50));

  return (
    <section className="compact-diagnostics" aria-label="Качество данных и связь с активностью">
      <header>
        <h2>Качество данных</h2>
        <p>{periodLabel[comparison.target]} · заполненность ключевых полей</p>
      </header>
      <div className="quality-compact">
        {fields.map(([label, metric]) => (
          <article key={label}>
            <span>{label}</span>
            <b>{pctPlain(metric.coverage * 100)}</b>
            <i aria-hidden="true"><span style={{ width: `${metric.coverage * 100}%` }} /></i>
            <small>{fmt(metric.filled)} записей</small>
          </article>
        ))}
      </div>
      <aside>
        <span>Встречи ↔ продвижение</span>
        {comparison.meetingRelation.matchedManagers > 2 ? (
          <>
            <b>{decimal(correlation)}</b>
            <i className="correlation-scale" aria-label={`Коэффициент связи ${decimal(correlation)}`}>
              <span style={{ left: `${correlationPosition}%` }} />
            </i>
            <small>{comparison.meetingRelation.matchedManagers} КМ сопоставлено · связь не доказывает влияние</small>
          </>
        ) : (
          <strong>Нет достаточного сопоставления встреч</strong>
        )}
      </aside>
    </section>
  );
}

function MoodSurveySection({ survey }: { survey: MoodSurvey }) {
  const maxWaveResponses = Math.max(1, ...survey.waves.map((wave) => wave.responses));
  const highScores = survey.questions.reduce(
    (sum, question) => sum + question.distribution["3"],
    0,
  );
  const answeredScores = survey.questions.reduce(
    (sum, question) => sum + question.answered,
    0,
  );

  return (
    <section className="mood-section" aria-labelledby="mood-title">
      <header className="mood-heading">
        <div>
          <span>Пульс команды · август 2026</span>
          <h2 id="mood-title">Настроение КМ</h2>
        </div>
        <strong>Отдельный срез · фильтры КМ и ФОТ не применяются</strong>
      </header>

      <div className="mood-layout">
        <div className="mood-distribution">
          <header>
            <b>Распределение оценок</b>
            <div className="mood-legend" aria-label="Шкала оценок">
              <span><i className="score-low" />1</span>
              <span><i className="score-mid" />2</span>
              <span><i className="score-high" />3</span>
            </div>
          </header>
          {survey.questions.map((question) => (
            <article className="mood-question" key={question.id}>
              <div>
                <b>{question.label}</b>
                <small>{fmt(question.answered)} ответов</small>
              </div>
              <div
                className="mood-likert"
                role="img"
                aria-label={`${question.label}: средняя оценка ${decimal(question.mean)} из 3`}
              >
                {(["1", "2", "3"] as const).map((score) => {
                  const count = question.distribution[score];
                  const portion = question.answered ? (count / question.answered) * 100 : 0;
                  return (
                    <span
                      key={score}
                      className={`score-${score === "1" ? "low" : score === "2" ? "mid" : "high"}`}
                      style={{ width: `${portion}%` }}
                      title={`Оценка ${score}: ${fmt(count)} (${pctPlain(portion)})`}
                    >
                      {portion >= 12 ? `${Math.round(portion)}%` : ""}
                    </span>
                  );
                })}
              </div>
              <strong>{decimal(question.mean)}<small>/3</small></strong>
            </article>
          ))}
        </div>

        <aside className="mood-summary">
          <div className="mood-score">
            <span>Средняя оценка</span>
            <b>{decimal(survey.overallMean)}<small>/3</small></b>
            <p>{pctPlain(answeredScores ? (highScores / answeredScores) * 100 : 0)} максимальных оценок</p>
          </div>
          <div
            className="mood-response-ring"
            style={{ background: `conic-gradient(#c7f54a ${survey.responseRate * 360}deg, rgba(255,255,255,.14) 0)` }}
            aria-label={`Отклик ${pctPlain(survey.responseRate * 100)}`}
          >
            <span><b>{pctPlain(survey.responseRate * 100)}</b><small>отклик</small></span>
          </div>
          <dl>
            <div><dt>Ответов</dt><dd>{fmt(survey.responseRows)}</dd></div>
            <div><dt>Полностью</dt><dd>{fmt(survey.completed)}</dd></div>
            <div><dt>Уникальных КМ</dt><dd>{fmt(survey.uniqueRespondents)}</dd></div>
            <div><dt>Приглашений</dt><dd>{fmt(survey.invitations)}</dd></div>
          </dl>
          <div className="mood-waves">
            <span>Ответы по неделям</span>
            <ol>
              {survey.waves.map((wave) => (
                <li key={wave.week}>
                  <b>{wave.responses}</b>
                  <i aria-hidden="true"><span style={{ height: `${(wave.responses / maxWaveResponses) * 100}%` }} /></i>
                  <small>{new Date(`${wave.week}T00:00:00`).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })}</small>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
      <footer>
        <b>Ограничение связи:</b> {survey.linkageNote}
      </footer>
    </section>
  );
}

function ManagerScatter({
  rows,
  selected,
  onSelect,
}: {
  rows: ManagerPerformance[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  const visible = [...rows].sort(
    (a, b) => b.progressRate - a.progressRate || b.delta - a.delta,
  );
  const movementBands = [
    {
      key: "decline",
      label: "Портфель снизился",
      shortLabel: "Снизился",
      test: (row: ManagerPerformance) => row.delta < 0,
    },
    {
      key: "steady",
      label: "Без изменений",
      shortLabel: "Без изменений",
      test: (row: ManagerPerformance) => row.delta === 0,
    },
    {
      key: "growth",
      label: "Портфель вырос",
      shortLabel: "Вырос",
      test: (row: ManagerPerformance) => row.delta > 0,
    },
  ] as const;
  const progressBands = [
    {
      key: "high",
      label: "10% и выше",
      test: (row: ManagerPerformance) => row.progressRate >= 0.1,
    },
    {
      key: "medium",
      label: "от 3 до 10%",
      test: (row: ManagerPerformance) =>
        row.progressRate >= 0.03 && row.progressRate < 0.1,
    },
    {
      key: "low",
      label: "до 3%",
      test: (row: ManagerPerformance) =>
        row.progressRate > 0 && row.progressRate < 0.03,
    },
    {
      key: "zero",
      label: "нет продвижения",
      test: (row: ManagerPerformance) => row.progressRate === 0,
    },
  ] as const;
  const movementCount = (band: (typeof movementBands)[number]) =>
    visible.filter(band.test).length;
  const growthRows = visible.filter((row) => row.delta > 0);
  const declineRows = visible.filter((row) => row.delta < 0);
  const progressedRows = visible.filter((row) => row.progressRate > 0);
  const noProgressRows = visible.filter((row) => row.progressRate === 0);
  const complexDealRows = visible.filter((row) => row.complexDealAfter > 0);
  const complexManagerShare = visible.length
    ? (complexDealRows.length / visible.length) * 100
    : 0;
  const ratioMetrics = [
    { label: "Портфель вырос", value: growthRows.length, total: visible.length, tone: "growth" },
    { label: "Портфель снизился", value: declineRows.length, total: visible.length, tone: "decline" },
    { label: "Есть продвижение", value: progressedRows.length, total: visible.length, tone: "progress" },
    { label: "Нет продвижения", value: noProgressRows.length, total: visible.length, tone: "neutral" },
    {
      label: "Продвижение при росте",
      value: growthRows.filter((row) => row.progressRate > 0).length,
      total: growthRows.length,
      tone: "growth",
    },
    {
      label: "Продвижение при снижении",
      value: declineRows.filter((row) => row.progressRate > 0).length,
      total: declineRows.length,
      tone: "decline",
    },
  ] as const;
  return (
    <div className="scatter-wrap">
      <header className="scatter-header">
        <div>
          <span>Карта клиентских менеджеров</span>
          <b>Количество предложений и доля продвижения</b>
        </div>
        <small>{fmt(visible.length)} КМ на карте</small>
      </header>
      <div className="complex-manager-share" aria-label="Доля КМ со сложными сделками">
        <ComplexDealIcon />
        <span><b>{pctPlain(complexManagerShare)} КМ</b> работают со сложными сделками</span>
        <small>{fmt(complexDealRows.length)} из {fmt(visible.length)} КМ</small>
        <i aria-hidden="true"><em style={{ width: `${complexManagerShare}%` }} /></i>
      </div>
      <div className="scatter-legend">
        <span>
          <i className="normal-point" />
          Доля зависших не более 20%
        </span>
        <span>
          <i className="risk-point" />
          Доля зависших более 20%
        </span>
        <span>
          <i className="selected-point" />
          Выбранный КМ
        </span>
        <span>
          <i className="complex-point" />
          Работает со сложными сделками
        </span>
      </div>
      <div
        className={`manager-matrix ${visible.length > 180 ? "is-dense" : ""}`}
        aria-label="Матрица движения и продвижения клиентских менеджеров"
      >
        <div className="matrix-corner">Доля продвижения</div>
        {movementBands.map((movement) => (
          <div key={movement.key} className={`matrix-column-title ${movement.key}`}>
            <b>{movement.label}</b>
            <span>{fmt(movementCount(movement))} КМ</span>
          </div>
        ))}
        {progressBands.flatMap((progress) => [
          <div key={`${progress.key}-label`} className="matrix-row-title">
            <b>{progress.label}</b>
          </div>,
          ...movementBands.map((movement) => {
            const cellRows = visible.filter(
              (row) => progress.test(row) && movement.test(row),
            );
            return (
              <div
                key={`${progress.key}-${movement.key}`}
                className="matrix-cell"
                data-progress-band={progress.key}
                data-movement={movement.key}
              >
                <small>{cellRows.length || "—"}</small>
                <div className="manager-orbs">
                  {cellRows.map((row) => {
                    const isSelected = selected === row.name;
                    const exactProgress = share(row.progressed, row.retained);
                    return (
                      <button
                        key={row.name}
                        type="button"
                        className={`data-point manager-orb ${row.stuckRate > 0.2 ? "is-risk" : ""} ${row.complexDealAfter > 0 ? "has-complex-deals" : ""} ${isSelected ? "is-selected" : ""}`}
                        aria-label={`${row.name}: изменение ${signed(row.delta)}, продвижение ${exactProgress}, сложных сделок ${fmt(row.complexDealAfter)}`}
                        title={`${row.name}\nИзменение: ${signed(row.delta)}\nПродвижение: ${exactProgress}\nСложные сделки: ${fmt(row.complexDealAfter)}`}
                        onClick={() => onSelect(row.name)}
                      >
                        <span
                          style={{
                            background: `conic-gradient(#c8f15a ${Math.min(100, row.progressRate * 100)}%, #d6e2ea 0)`,
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }),
        ])}
      </div>
      <div className="manager-ratios" aria-label="Числовые доли по матрице КМ">
        {ratioMetrics.map((metric) => {
          const percentage = metric.total ? (metric.value / metric.total) * 100 : 0;
          return (
            <article className={metric.tone} key={metric.label}>
              <span>{metric.label}</span>
              <b>{pctPlain(percentage)}</b>
              <small>{fmt(metric.value)} из {fmt(metric.total)} КМ</small>
              <i aria-hidden="true"><em style={{ width: `${percentage}%` }} /></i>
            </article>
          );
        })}
      </div>
      <p className="matrix-note">
        Каждая точка — один КМ. Кольцо показывает долю продвижения; точные
        значения доступны при наведении и после выбора.
      </p>
    </div>
  );
}

function ManagerDetail({
  manager,
  onEvidence,
}: {
  manager: ManagerPerformance;
  onEvidence: (filter: string) => void;
}) {
  const meeting = manager.meetings;
  return (
    <aside className="manager-detail">
      <span>Выбранный клиентский менеджер</span>
      <h3>{manager.name}</h3>
      <div className={`pilot-status ${manager.isPilot ? "is-pilot" : "is-nonpilot"}`}>
        <i />
        {manager.isPilot ? "Участник пилота" : "Не участвует в пилоте"}
      </div>
      {manager.complexDealAfter > 0 ? (
        <div className="complex-manager-status">
          <ComplexDealIcon />
          <span>
            <b>Работает со сложными сделками</b>
            {fmt(manager.complexDealBefore)} → {fmt(manager.complexDealAfter)} · {signed(manager.complexDealDelta)} · продвижение {share(manager.complexDealProgressed, manager.complexDealRetained)}
          </span>
        </div>
      ) : null}
      <div className="reliability">
        <i />
        {manager.reliability} надёжность ·{" "}
        {reliabilityText[manager.reliability]}
      </div>
      <div className="manager-kpis">
        <div>
          <b>
            {fmt(manager.before)} → {fmt(manager.after)}
          </b>
          <span>
            {signed(manager.delta)} · {share(manager.delta, manager.before)}
          </span>
          <small>продажи в работе</small>
        </div>
        <div>
          <b>{share(manager.progressed, manager.retained)}</b>
          <span>
            {fmt(manager.progressed)} из {fmt(manager.retained)}
          </span>
          <small>продвинулись по стадии</small>
        </div>
        <div>
          <b>{share(manager.stoppedOver90, manager.after)}</b>
          <span>
            {fmt(manager.stoppedOver90)} из {fmt(manager.after)}
          </span>
          <small>на стадии более 90 дней</small>
        </div>
      </div>
      <div className="manager-flow">
        <p>
          <span>Новые</span>
          <b>{fmt(manager.newCount)}</b>
        </p>
        <p>
          <span>Выбыли</span>
          <b>{fmt(manager.goneCount)}</b>
        </p>
        <p>
          <span>Лиды</span>
          <b>{fmt(manager.leads)}</b>
        </p>
        <p>
          <span>Сделки в работе</span>
          <b>{fmt(manager.activeDeals)}</b>
        </p>
        <p>
          <span>Завершённые</span>
          <b>{fmt(manager.completedDeals)}</b>
        </p>
        <p>
          <span>Медиана стадии</span>
          <b>{fmt(manager.stageDaysMedian)} дней</b>
        </p>
      </div>
      <div className="manager-products">
        <h4>Основные продукты</h4>
        {manager.topProducts.map(([name, count]) => (
          <p key={name}>
            <span>{expandLabel(name)}</span>
            <b>
              {fmt(count)} · {share(count, manager.after)}
            </b>
          </p>
        ))}
      </div>
      <div className="meeting-context">
        <h4>Июльская активность</h4>
        {manager.isPilot && meeting ? (
          <p>
            {fmt(meeting.meetings)} встреч · покрытие{" "}
            {pctPlain(meeting.coverage * 100)} · {fmt(meeting.clients)} клиентов
            в базе
          </p>
        ) : manager.isPilot ? (
          <p>
            Участник пилота найден, но показатели июльской активности
            недоступны.
          </p>
        ) : (
          <p>КМ не участвует в пилоте; июльская активность не применяется.</p>
        )}
      </div>
      <button onClick={() => onEvidence(manager.name)}>
        Открыть предложения сотрудника
      </button>
    </aside>
  );
}

function ContributionRows({
  title,
  rows,
  total,
  complexProducts,
  isComplexView = false,
  onComplexEvidence,
}: {
  title: string;
  rows: { name: string; before: number; after: number; delta: number }[];
  total: number;
  complexProducts: Set<string>;
  isComplexView?: boolean;
  onComplexEvidence?: () => void;
}) {
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.delta)));
  return (
    <article className="contribution-panel" role="tabpanel" id="driver-panel">
      <header className="contribution-panel-head">
        <div>
          <h3>{title}</h3>
        </div>
        <div>
          {isComplexView && onComplexEvidence ? (
            <button type="button" onClick={onComplexEvidence}>Показать сделки</button>
          ) : null}
          <small>{fmt(rows.length)} из {fmt(rows.length)}</small>
        </div>
      </header>
      <div className="contribution-columns" aria-hidden="true">
        <span>Категория</span>
        <span>Было</span>
        <span>Стало</span>
        <span>Изменение</span>
        <span>Сила вклада</span>
      </div>
      <div className="contribution-list">
        {rows.map((row) => {
          const isComplex = isComplexView || complexProducts.has(row.name);
          return (
          <div className={`contribution-row ${isComplex ? "is-complex" : ""}`} key={row.name} role="row">
            <b title={expandLabel(row.name)}>
              {expandLabel(row.name)}
              {isComplex && !isComplexView ? <mark>сложная сделка</mark> : null}
            </b>
            <span>{fmt(row.before)}</span>
            <span>{fmt(row.after)}</span>
            <strong className={row.delta >= 0 ? "positive" : "negative"}>
              {signed(row.delta)} · {share(row.delta, total)}
            </strong>
            <i aria-hidden="true">
              <em
                className={row.delta >= 0 ? "positive-bar" : "negative-bar"}
                style={{ width: `${(Math.abs(row.delta) / max) * 100}%` }}
              />
            </i>
          </div>
          );
        })}
      </div>
    </article>
  );
}

function EvidencePanel({
  open,
  filter,
  url,
  managerScope,
  productScope,
  onClose,
}: {
  open: boolean;
  filter: string;
  url: string;
  managerScope: ManagerScope;
  productScope: ProductScope;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<RegistryRecord[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open || rows) return;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw Error("Реестр недоступен");
        return response.json();
      })
      .then(setRows)
      .catch((errorValue) => setError(errorValue.message));
  }, [open, rows, url]);
  useEffect(() => {
    setRows(null);
    setError("");
  }, [url]);
  if (!open) return null;
  const needle = filter.toLocaleLowerCase("ru");
  const filterTitle = filter === "movement" ? "Движение портфеля" : filter === "stale" ? "Зависшие предложения" : filter === "complexDeals" ? "Сложные сделки" : filter;
  const scopedRows = (rows || []).filter((row) =>
    registryRecordInView(
      row,
      managerScope,
      productScope,
      pilotManagerKeys,
      data.fotProduct,
    ),
  );
  const matched = scopedRows
    .filter((row) =>
      filter === "movement"
        ? row.change !== "Сохранилось без смены стадии"
        : filter === "stale"
          ? row.stageDays > 90
          : filter === "complexDeals"
            ? row.isComplexDeal
          : [
              row.manager,
              row.product,
              row.beforeManager,
              row.afterManager,
              row.beforeProduct,
              row.afterProduct,
              row.change,
            ].some((value) =>
              value.toLocaleLowerCase("ru").includes(needle),
            ),
    );
  const filtered = matched.slice(0, 30);
  return (
    <section className="evidence-panel" aria-label="Подтверждающие записи">
      <header>
        <div>
          <span>Фактические записи</span>
          <h2>{filterTitle}</h2>
        </div>
        <button onClick={onClose}>Закрыть</button>
      </header>
      {error ? (
        <p>{error}</p>
      ) : !rows ? (
        <p>Загружается полный реестр…</p>
      ) : (
        <>
          <p>
            Показаны первые {fmt(filtered.length)} из {fmt(matched.length)}
            подходящих записей. Состав КМ и режим ФОТ применены к полному
            реестру.
          </p>
          <div>
            {filtered.map((row) => (
              <article key={row.offerId} className={row.isComplexDeal ? "is-complex-deal" : ""}>
                <span className={`evidence-change evidence-${row.change.includes("Новое") || row.change.includes("вклад") ? "new" : row.change.includes("Выбыло") || row.change.includes("Выбыл") ? "gone" : "other"}`}>
                  {row.change}
                </span>
                {row.isComplexDeal ? <span className="complex-evidence-mark">Сложная сделка</span> : null}
                <b>{row.client || "Клиент не указан"}</b>
                <span>{row.product}</span>
                <span>{row.manager}</span>
                <strong>
                  {row.beforeStage || "Не было"} →{" "}
                  {row.afterStage || "Нет в срезе"}
                </strong>
                <small>Идентификатор предложения: {row.offerId}</small>
                {row.comment ? <p>{row.comment}</p> : null}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

export default function App() {
  const [pair, setPair] = useState<ComparisonKey>("Q1-Q2");
  const [managerScope, setManagerScope] = useState<ManagerScope>("all");
  const [productScope, setProductScope] =
    useState<ProductScope>("withoutFot");
  const [driverView, setDriverView] = useState<DriverView>("complexDeals");
  const [selectedName, setSelectedName] = useState("");
  const [managerSearch, setManagerSearch] = useState("");
  const [evidence, setEvidence] = useState("");
  const viewKey = `${managerScope}:${productScope}` as AnalyticsViewKey;
  const view = data.views[viewKey];
  const comparison = view.comparisons[pair];
  const base = view.snapshots[comparison.base];
  const target = view.snapshots[comparison.target];
  const complexProducts = useMemo(
    () => new Set(data.complexDealGroups.flatMap((group) => group.products)),
    [],
  );
  const resetSelection = () => {
    setSelectedName("");
    setManagerSearch("");
    setEvidence("");
  };
  const managers = useMemo(
    () =>
      [...comparison.managerPerformance].sort((a, b) =>
        a.name.localeCompare(b.name, "ru"),
      ),
    [comparison],
  );
  const managerMatches = useMemo(
    () => managers.filter((row) => row.name.toLocaleLowerCase("ru").includes(managerSearch.toLocaleLowerCase("ru"))),
    [managers, managerSearch],
  );
  const selected = selectedName
    ? managers.find((row) => row.name === selectedName)
    : undefined;
  const managerHighlights = useMemo(() => {
    const ranked = comparison.managerPerformance;
    return {
      growth: [...ranked].sort((a, b) => b.delta - a.delta).slice(0, 3),
      decline: [...ranked].sort((a, b) => a.delta - b.delta).slice(0, 3),
      progress: [...ranked]
        .filter((row) => row.retained >= 30)
        .sort((a, b) => b.progressRate - a.progressRate)
        .slice(0, 3),
    };
  }, [comparison]);
  const driver = [...comparison.productContributions].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
  )[0];
  const driverName = driver?.name || "Нет данных в выбранном срезе";
  const driverDelta = driver?.delta || 0;
  const otherProductsDelta = comparison.net - driverDelta;
  const driverNetShare = comparison.net
    ? Math.abs((driverDelta / comparison.net) * 100)
    : 0;
  const driverDominates =
    comparison.net !== 0 &&
    Math.sign(driverDelta) === Math.sign(comparison.net) &&
    Math.abs(driverDelta) >= Math.abs(comparison.net) * 0.7;
  const executiveTitle =
    comparison.net === 0
      ? "Общий итог стабилен, но внутри портфеля есть движение"
      : comparison.net > 0
        ? driverDominates
          ? "Рост почти целиком определяет один продукт"
          : "Рост распределён между несколькими продуктами"
        : driverDominates
          ? "Сокращение почти целиком определяет один продукт"
          : "Сокращение распределено между несколькими продуктами";
  const executiveQuestion = driverDominates
    ? `Устойчив ли результат без продукта «${expandLabel(driverName)}»?`
    : comparison.net === 0
      ? "Какие разнонаправленные движения взаимно компенсировались?"
      : "Какие продуктовые изменения формируют результат и сохранятся в следующем срезе?";
  const driverViews = [
    {
      key: "complexDeals" as const,
      label: "Сложные сделки",
      rows: comparison.complexDealMovement.groupContributions,
      icon: <ComplexDealIcon />,
    },
    {
      key: "products" as const,
      label: "Продукты",
      rows: comparison.productContributions,
      icon: <ProductIcon />,
    },
    {
      key: "formats" as const,
      label: "Форматы",
      rows: comparison.formatContributions,
      icon: <FormatIcon />,
    },
    {
      key: "stages" as const,
      label: "Стадии",
      rows: comparison.stageContributions,
      icon: <StageIcon />,
    },
    {
      key: "triggers" as const,
      label: "Триггеры",
      rows: comparison.triggerContributions,
      icon: <TriggerIcon />,
    },
  ];
  const activeDriver =
    driverViews.find((item) => item.key === driverView) ?? driverViews[0];
  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top">
          <PulseIcon />
          <span>
            <b>Пульс предложений</b>
            <small>как работали раньше и как работают сейчас</small>
          </span>
        </a>
        <div className="fact-badge">
          <i />
          <span>
            <b>Только фактические данные</b>
            <small>единица расчёта — уникальное продуктовое предложение</small>
          </span>
        </div>
      </header>
      <AnalysisControls
        pair={pair}
        managerScope={managerScope}
        productScope={productScope}
        managerCount={comparison.managerPerformance.length}
        onPairChange={(value) => {
          setPair(value);
          resetSelection();
        }}
        onManagerScopeChange={(value) => {
          setManagerScope(value);
          resetSelection();
        }}
        onProductScopeChange={(value) => {
          setProductScope(value);
          resetSelection();
        }}
      />
      <section className="comparison-hero" id="top">
        <div className="hero-heading">
          <span>Главное сравнение</span>
          <h1>
            Уникальные предложения:
            <br />
            <em>было → стало</em>
          </h1>
          <p className="unit-note"><b>Что считаем:</b> одна строка = одно уникальное продуктовое предложение (`offerId`). Клиенты и сделки могут встречаться в нескольких строках.</p>
          {target.partial ? (
            <p className="partial-warning">
              Третий квартал — неполный срез на 23 августа. Абсолютные значения
              не являются итогом квартала.
            </p>
          ) : null}
        </div>
        <div className="before-after">
          <div>
            <span>{periodLabel[comparison.base]}</span>
            <b>{fmt(comparison.baseTotal)}</b>
            <small>100% исходного портфеля · {fmt(comparison.baseTotal)} предложений</small>
          </div>
          <TrendIcon
            className={
              comparison.net > 0
                ? "trend-positive"
                : comparison.net < 0
                  ? "trend-negative"
                  : "trend-neutral"
            }
          />
          <div>
            <span>{periodLabel[comparison.target]}</span>
            <b>{fmt(comparison.targetTotal)}</b>
            <small>
              {share(comparison.targetTotal, comparison.baseTotal)} от исходного портфеля · {fmt(comparison.targetTotal)} предложений
            </small>
          </div>
          <footer>
            <strong className={comparison.net >= 0 ? "positive" : "negative"}>
              {signed(comparison.net)}
            </strong>
            <span>
              {share(comparison.net, comparison.baseTotal)} относительно
              исходного периода
            </span>
          </footer>
          <section className="hero-complex-summary" aria-label="Сложные сделки в главном сравнении">
            <span className="hero-complex-title">
              <ComplexDealIcon />
              <b>Сложные сделки</b>
              <small>30% веса оценки</small>
            </span>
            <span className="hero-complex-flow">
              <b>{fmt(comparison.complexDealMovement.baseCount)} → {fmt(comparison.complexDealMovement.targetCount)}</b>
              <small>количество</small>
            </span>
            <span className={comparison.complexDealMovement.net >= 0 ? "positive" : "negative"}>
              <b>{signed(comparison.complexDealMovement.net)}</b>
              <small>{share(comparison.complexDealMovement.net, comparison.complexDealMovement.baseCount)} к базе</small>
            </span>
            <span>
              <b>{pctPlain(comparison.complexDealMovement.baseShare * 100)} → {pctPlain(comparison.complexDealMovement.targetShare * 100)}</b>
              <small>доля портфеля · {pct(comparison.complexDealMovement.shareDeltaPp * 100).replace("%", " п. п.")}</small>
            </span>
          </section>
        </div>
        <section
          className="comparison-diagnostics"
          aria-label="Контроль изменений в сохранённой базе"
        >
          <header>
            <b>Контроль изменений</b>
            <span>среди {fmt(comparison.retainedCount)} сохранившихся предложений</span>
          </header>
          <dl>
            {[
              ["Сменили продукт", comparison.changedProduct],
              ["Передали другому КМ", comparison.changedManager],
              ["Сменился руководитель", comparison.changedLeader],
              ["Без смены стадии >90 дней", comparison.funnelMovement.stoppedOver90],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt>{label}</dt>
                <dd>{fmt(Number(value))}</dd>
                <small>{share(Number(value), comparison.retainedCount)} сохранившихся предложений</small>
              </div>
            ))}
          </dl>
        </section>
        <TurnoverFlow
          before={comparison.baseTotal}
          retained={comparison.retainedCount}
          gone={comparison.goneCount}
          added={comparison.newCount}
          after={comparison.targetTotal}
          progressRate={comparison.normalizedMovement.progressRate}
          progressed={comparison.normalizedMovement.progressed}
          leadConversion={
            comparison.funnelMovement.leadConversionBase
              ? comparison.funnelMovement.leadToDeal /
                comparison.funnelMovement.leadConversionBase
              : 0
          }
          leadToDeal={comparison.funnelMovement.leadToDeal}
        />
      </section>

      <section className="executive-summary" aria-label="Резюме для руководителя">
        <div className="summary-verdict">
          <h2>{executiveTitle}</h2>
          <p>
            Главный вклад — <b>{expandLabel(driverName)}</b>: {signed(driverDelta)}.
            Остальной портфель: {signed(otherProductsDelta)}.
          </p>
        </div>
        <div className="summary-evidence">
          <div className="driver-share">
            <span>Доля главного драйвера в чистом изменении</span>
            <b>{pctPlain(driverNetShare)}</b>
            <i aria-hidden="true">
              <span style={{ width: `${Math.min(100, driverNetShare)}%` }} />
            </i>
          </div>
          <dl>
            <div>
              <dt>Главный продукт</dt>
              <dd>{signed(driverDelta)}</dd>
              <small>{share(driverDelta, comparison.baseTotal)} исходной базы</small>
            </div>
            <div>
              <dt>Остальные продукты</dt>
              <dd>{signed(otherProductsDelta)}</dd>
              <small>{otherProductsDelta * comparison.net >= 0 ? "усиливают" : "компенсируют"} итог</small>
            </div>
            <div>
              <dt>Скорость за 30 дней</dt>
              <dd>{pctPlain(comparison.normalizedMovement.ratePer30Days * 100)}</dd>
              <small>{comparison.target === "Q3" ? "Q3 — неполный срез" : "полный квартальный срез"}</small>
            </div>
          </dl>
        </div>
        <footer>
          <span>Вопрос для проверки</span>
          <b>{executiveQuestion}</b>
        </footer>
      </section>

      <CompactDiagnostics comparison={comparison} target={target} />

      <MoodSurveySection survey={data.moodSurvey} />

      <section className="manager-zone" id="managers">
        <div className="section-title">
          <span>Главный рабочий разрез</span>
          <h2>Клиентские менеджеры: раньше / сейчас</h2>
          <p>
            Размер портфеля не является оценкой эффективности. Продвижение
            рассчитано по сохранившимся предложениям.
          </p>
        </div>
        {managers.length ? (
          <>
        <div className="manager-tools">
          <label className="manager-picker">
            <span>Выбрать клиентского менеджера</span>
            <select value={selected?.name || ""} onChange={(event) => { setSelectedName(event.target.value); setManagerSearch(event.target.value); }}>
              <option value="">Выберите КМ</option>
              {managers.map((manager) => <option key={manager.name} value={manager.name}>{manager.name}{manager.isPilot ? " · пилот" : ""}{manager.complexDealAfter > 0 ? ` · сложные ${fmt(manager.complexDealAfter)}` : ""}</option>)}
            </select>
          </label>
          <label className="manager-search">
            <span>Быстрый поиск · {managerMatches.length} совпадений</span>
            <input list="manager-search-results" value={managerSearch} onChange={(event) => { const value = event.target.value; setManagerSearch(value); const match = managers.find((row) => row.name === value); if (match) setSelectedName(match.name); else if (!value) setSelectedName(""); }} placeholder="Фамилия или имя" aria-label="Поиск менеджера" />
            <datalist id="manager-search-results">
              {managerMatches.slice(0, 12).map((manager) => <option key={manager.name} value={manager.name} />)}
            </datalist>
            {managerSearch ? <button className="clear-manager-search" type="button" onClick={() => { setManagerSearch(""); setSelectedName(""); }}>Очистить</button> : null}
          </label>
        </div>
        <div className="manager-ranking-context">
          <b>Рейтинги по текущему глобальному срезу</b>
          <span>Выбор одного КМ открывает карточку, но не меняет состав рейтинга</span>
        </div>
        <div
          className="manager-highlights"
          aria-label="Рейтинги клиентских менеджеров по сигналам"
        >
          {(
            [
              ["Наибольший прирост", managerHighlights.growth, "growth"],
              ["Наибольшее сокращение", managerHighlights.decline, "decline"],
              [
                "Продвижение · база от 30",
                managerHighlights.progress,
                "progress",
              ],
            ] as const
          ).map(([title, rows, tone]) => (
            <article className={`manager-highlight ${tone}`} key={title}>
              <h3>{title}</h3>
              {rows.map((row, index) => (
                <button
                  key={row.name}
                  onClick={() => setSelectedName(row.name)}
                >
                  <span>
                    <i>{index + 1}</i>
                    <span className="manager-rank-name">
                      {row.name}
                      {row.complexDealAfter > 0 ? <small><ComplexDealIcon /> сложные {fmt(row.complexDealAfter)}</small> : null}
                    </span>
                  </span>
                  <b>
                    {tone === "progress"
                      ? share(row.progressed, row.retained)
                      : signed(row.delta)}
                  </b>
                </button>
              ))}
            </article>
          ))}
        </div>
        <div className="manager-visual">
          <ManagerScatter
            rows={managers}
            selected={selected?.name || ""}
            onSelect={setSelectedName}
          />
          {selected ? (
            <ManagerDetail manager={selected} onEvidence={setEvidence} />
          ) : (
            <aside className="manager-selection-empty" aria-live="polite">
              <span>Карточка клиентского менеджера</span>
              <h3>Выберите КМ на карте или в списке</h3>
              <p>
                Здесь появятся статус участия в пилоте, движение портфеля и
                июльская активность — только для участников пилота.
              </p>
            </aside>
          )}
        </div>
          </>
        ) : (
          <div className="manager-empty" role="status">
            <h3>В выбранном срезе нет клиентских менеджеров</h3>
            <p>Измените состав КМ или включите продукты с ФОТ.</p>
          </div>
        )}
        {/* Полный список заменён на компактные рейтинги и интерактивную карту. */}
        {false && (
          <div
            className="manager-table"
            role="table"
            aria-label="Сравнение клиентских менеджеров"
          >
            <div className="manager-row manager-head" role="row">
              <span>Клиентский менеджер</span>
              <span>Было → стало</span>
              <span>Изменение</span>
              <span>Новые / выбыли</span>
              <span>Продвинулись</span>
              <span>Зависли</span>
            </div>
            {managers.slice(0, 14).map((manager) => (
              <button
                className={`manager-row ${selected?.name === manager.name ? "is-selected" : ""}`}
                key={manager.name}
                onClick={() => setSelectedName(manager.name)}
              >
                <b>
                  {manager.name}
                  <small>{manager.reliability} надёжность</small>
                </b>
                <span>
                  {fmt(manager.before)} → {fmt(manager.after)}
                </span>
                <strong>
                  {signed(manager.delta)} ·{" "}
                  {share(manager.delta, manager.before)}
                </strong>
                <span>
                  +{fmt(manager.newCount)} / −{fmt(manager.goneCount)}
                </span>
                <span>
                  {fmt(manager.progressed)} ·{" "}
                  {share(manager.progressed, manager.retained)}
                </span>
                <span>
                  {fmt(manager.stoppedOver90)} ·{" "}
                  {share(manager.stoppedOver90, manager.after)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="drivers-section">
        <div className="drivers-heading">
          <div>
            <span>Проводник изменений</span>
            <h2>Разрезы результата</h2>
          </div>
          <small>Все категории в выбранном разрезе</small>
        </div>
        <section className="complex-deal-spotlight" aria-label="Сложные сделки">
          <header>
            <span><ComplexDealIcon /></span>
            <div>
              <h3>Сложные сделки</h3>
              <small>коммерческие кредиты · лизинг · факторинг · непокрытые аккредитивы · КОРы</small>
            </div>
            <strong>30% веса оценки</strong>
          </header>
          <div className="complex-deal-metrics">
            <article>
              <span>Количество</span>
              <b>{fmt(comparison.complexDealMovement.baseCount)} → {fmt(comparison.complexDealMovement.targetCount)}</b>
              <small className={comparison.complexDealMovement.net >= 0 ? "positive" : "negative"}>{signed(comparison.complexDealMovement.net)}</small>
            </article>
            <article>
              <span>Доля портфеля</span>
              <b>{pctPlain(comparison.complexDealMovement.baseShare * 100)} → {pctPlain(comparison.complexDealMovement.targetShare * 100)}</b>
              <small>{pct(comparison.complexDealMovement.shareDeltaPp * 100).replace("%", " п. п.")}</small>
            </article>
            <article>
              <span>Вошли / вышли</span>
              <b>+{fmt(comparison.complexDealMovement.enteredCount)} / −{fmt(comparison.complexDealMovement.exitedCount)}</b>
              <small>между выбранными срезами</small>
            </article>
            <article>
              <span>Продвинулись</span>
              <b>{pctPlain(comparison.complexDealMovement.progressRate * 100)}</b>
              <small>{fmt(comparison.complexDealMovement.progressed)} из {fmt(comparison.complexDealMovement.retainedCount)} сохранённых</small>
            </article>
          </div>
          <footer>
            <div>
              {comparison.complexDealMovement.groupContributions.map((row) => (
                <span key={row.name} className={row.after ? "" : "is-empty"}>
                  {row.name} <b>{fmt(row.after)}</b>
                </span>
              ))}
            </div>
            {driverView !== "complexDeals" ? (
              <button type="button" onClick={() => setDriverView("complexDeals")}>Открыть разрез</button>
            ) : null}
          </footer>
        </section>
        <div className="driver-grid">
          <nav className="driver-tabs" role="tablist" aria-label="Разрез изменения">
            {driverViews.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={driverView === item.key}
                aria-controls="driver-panel"
                className={`${driverView === item.key ? "is-active" : ""} ${item.key === "complexDeals" ? "is-complex-tab" : ""}`.trim()}
                onClick={() => setDriverView(item.key)}
              >
                <span aria-hidden="true">{item.icon}</span>
                <b>{item.label}</b>
                <small>{fmt(item.rows.length)}</small>
              </button>
            ))}
          </nav>
          <ContributionRows
            key={driverView}
            title={driverView === "complexDeals" ? "Динамика по группам" : activeDriver.label}
            rows={activeDriver.rows}
            total={comparison.baseTotal}
            complexProducts={complexProducts}
            isComplexView={driverView === "complexDeals"}
            onComplexEvidence={() => setEvidence("complexDeals")}
          />
        </div>
      </section>

      <section className="duration-section">
        <div>
          <span>Скорость и возраст</span>
          <h2>Распределение длительности стадии</h2>
          <p>
            Медиана характеризует основную массу, 90-й процентиль — наиболее
            длительные десять процентов предложений.
          </p>
        </div>
        <div className="duration-comparison">
          <article>
            <span>Медиана дней на стадии</span>
            <b>
              {fmt(base.distribution.stageDaysMedian)} →{" "}
              {fmt(target.distribution.stageDaysMedian)}
            </b>
            <small>
              {signed(
                target.distribution.stageDaysMedian -
                  base.distribution.stageDaysMedian,
              )}{" "}
              дней
            </small>
          </article>
          <article>
            <span>90-й процентиль</span>
            <b>
              {fmt(base.distribution.stageDaysP90)} →{" "}
              {fmt(target.distribution.stageDaysP90)}
            </b>
            <small>
              {signed(
                target.distribution.stageDaysP90 -
                  base.distribution.stageDaysP90,
              )}{" "}
              дней
            </small>
          </article>
          <article>
            <span>Движение за 30 дней</span>
            <b>{pctPlain(comparison.normalizedMovement.ratePer30Days * 100)}</b>
            <small>
              {fmt(comparison.normalizedMovement.progressed)} из{" "}
              {fmt(comparison.retainedCount)} за{" "}
              {comparison.normalizedMovement.days} дней
            </small>
          </article>
        </div>
      </section>

      <details className="method-inline">
        <summary>Источники, значения полей и ограничения расчёта</summary>
        <div>
          <p>
            <b>Идентификаторы:</b> сопоставление выполняется по идентификатору
            продуктового предложения; пустой идентификатор сделки запись не
            исключает.
          </p>
          <p>
            <b>Лиды:</b> «Выявление потребности» и «Обсуждение условий».{" "}
            <b>Сделки:</b> «Реализация сделки» и «Активация продукта».
          </p>
          <p>
            <b>Сумма и операционный доход:</b> поля источника, не подтверждённая
            выручка или прибыль.
          </p>
          <p>
            <b>Тексты:</b> заметки, суть, потенциал, метки и хештеги
            используются только как контекст; заполненность заметок низкая.
          </p>
          <p>
            <b>Встречи:</b> присоединяются только по точному имени клиентского
            менеджера после нормализации пробелов и регистра; связь не
            доказывает влияние.
          </p>
          <p>
            <b>Пилот и ФОТ:</b> пилот определяется июльским списком из 64 КМ.
            Режим «Без ФОТ» исключает только продукт «Зарплатные проекты
            (объём ФОТ)».
          </p>
          {data.provenance.map((source) => (
            <p key={source.id}>
              <b>{source.file}</b> · {fmt(source.rows)} строк · срез{" "}
              {source.asOf}
            </p>
          ))}
        </div>
      </details>
      <EvidencePanel
        open={Boolean(evidence)}
        filter={evidence}
        url={comparison.registryUrl}
        managerScope={managerScope}
        productScope={productScope}
        onClose={() => setEvidence("")}
      />
      <footer className="page-footer">
        <span>
          Расчёт выполнен локально:{" "}
          {new Date(data.generatedAt).toLocaleString("ru-RU")}
        </span>
        <span>Без моковых и синтетических данных</span>
      </footer>
    </main>
  );
}

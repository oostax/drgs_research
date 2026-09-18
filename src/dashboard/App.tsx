import { AcademyPage } from "./AcademyPage";
import { SmoCreditDashboard } from "./SmoCreditDashboard";
import { StrategyDashboard } from "./StrategyDashboard";
import { normalizeSmoView } from "./smoNavigation";
import { CardAmbient } from "./CardAmbient";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { Context, Evidence, Group, Manifest, Metric, Stat } from "./types";
import {
  availableMetrics,
  contextUrl,
  defaults,
  delta,
  filterEvidence,
  format,
  groupNames,
  loadEvidence,
  metricNames,
  normalizeMetricContext,
  parseContext,
  quarters,
  roleNames,
  selectedGroups,
  statusText,
  value,
  view,
} from "./model";
import { Icon } from "./Icons";
import { AnimatedNumber, Delta, QuarterChart } from "./Charts";
import { MapPage } from "./MapPage";
import { DashboardHeader } from "./DashboardHeader";
import { Select } from "./Select";
import { MetricGlyph, useInputModality } from "./Motion";
import { SalesCard } from "./SalesCard";
import { MeetingsCard } from "./MeetingsCard";
import { MoodCard } from "./MoodCard";
import "./OverviewControls.css";
import { AnalysisCharts } from "./AnalysisCharts";
import { BranchProductBreakdown, DetailShareBar } from "./DetailCharts";
import { employeePortfolios, EmployeePortfolioTable } from "./EmployeeDetails";
import { downloadCsv } from "./analysisModel";
import "./Analysis.css";
import { SupplementalPeriods } from "./SupplementalAnalysis";
import { SupplementalCard, SupplementalDetail, useSupplemental } from './SupplementalCard';
import type { SupplementalLoad } from './SupplementalCard';
import { isSupplemental, type Supplemental } from './supplementalModel';
import { WelcomePage } from "./WelcomePage";
import { SalesModelDeck } from './SalesModelDeck';
import { NextStepsSlide } from './NextStepsSlide';
import { TbTasksPage } from './TbTasksPage';
import { adjacentPresentation, presentationSections } from './presentationNavigation';

type Change = (patch: Partial<Context>) => void;
const mainMetrics: Metric[] = [
  "sales",
  "complex",
  "meetings",
];
const metadata: Record<
  string,
  { title: string; subtitle: string; role: string; icon: string }
> = {
  sales: {
    title: "Количество сделок",
    subtitle: "Продуктовые предложения · все стадии",
    role: "Старшая и младшая роли",
    icon: "sales",
  },
  complex: {
    title: "Сложные продукты",
    subtitle: "Предложения и доля в портфеле без ФОТ",
    role: "Старшая и руководитель",
    icon: "complex",
  },
  meetings: {
    title: "Встречи и покрытие",
    subtitle: "Квартальная активность и клиентская база",
    role: "Старшая и младшая роли",
    icon: "meetings",
  },
  process: {
    title: "Удовлетворённость",
    subtitle: "Процесс и полезность лидов · шкала 1–3",
    role: "Все роли",
    icon: "process",
  },
  appeals: {
    title: "Обращения клиентов",
    subtitle: "Количество обращений за квартал",
    role: "Все роли",
    icon: "appeals",
  },
  payroll: {
    title: "ФОТ и получатели",
    subtitle: "Фактический объём и число получателей",
    role: "Младшая роль",
    icon: "payroll",
  },
};

function Link({
  c,
  patch,
  change,
  children,
  className,
  label,
}: {
  c: Context;
  patch: Partial<Context>;
  change: Change;
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <a
      href={contextUrl({ ...c, ...patch })}
      className={className}
      aria-label={label}
      onClick={(e) => {
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
          e.preventDefault();
          change(patch);
        }
      }}
    >
      {children}
    </a>
  );
}
function Reason({ stat }: { stat: Stat }) {
  return stat.reason ? (
    <span className={`reason ${stat.status}`}>
      <Icon name={stat.status === "unverified" ? "info" : "clock"} size={13} />
      {stat.reason}
    </span>
  ) : null;
}

function Filters({
  data,
  c,
  change,
  supplementalData,
}: {
  data: Manifest;
  c: Context;
  change: Change;
  supplementalData?: Supplemental | null;
}) {
  const supplementalAnalysis = c.page === 'analysis' && isSupplemental(c.metric);
  const offerAnalysis = c.page !== "analysis" || ["sales", "complex", "complexShare"].includes(c.metric);
  const appealsAnalysis = supplementalAnalysis && c.metric === 'appeals';
  const terbankOptions = appealsAnalysis && supplementalData ? supplementalData.appeals.banks.filter(b => b.group !== 'other').flatMap(b => {
    const branch = Object.entries(supplementalData.appeals.branchToTerbank).find(([, name]) => name === b.name)?.[0];
    return branch ? [{ value: branch, label: b.name }] : [];
  }) : null;
  const selectedTerbank = c.branch === 'all' ? 'all' : terbankOptions?.find(o => o.label === supplementalData?.appeals.branchToTerbank[c.branch])?.value ?? c.branch;
  const count = [
    c.branch !== "all",
    !supplementalAnalysis && c.role !== "all",
    c.group !== "both",
    offerAnalysis && c.scope !== "without",
  ].filter(Boolean).length;
  return (
    <section className={`filters filter-bar ${!offerAnalysis ? "analysis-relevant-filters" : ""} ${c.page === "overview" ? "filter-bar-compact" : ""}`} aria-label="Параметры анализа">
      {c.page === "map" && <div className="filter-bar-heading">
        <h2>Параметры анализа</h2>
        <span>Применяются ко всем показателям</span>
      </div>}
      <div className="filter-fields">
        <Select
          label="Группа"
          value={c.group}
          onChange={(group) =>
            change({ group: group as Context["group"], branch: "all" })
          }
          options={[
            { value: "both", label: appealsAnalysis ? "Все тербанки" : "Пилот и непилот" },
            { value: "pilot", label: appealsAnalysis ? "ТБ с пилотом" : "Пилот" },
            { value: "nonpilot", label: appealsAnalysis ? "Остальные ТБ" : "Непилот · все роли" },
          ]}
        />
        {terbankOptions ? <Select label="Тербанк" value={selectedTerbank} searchable onChange={branch => change({ branch })} options={[{ value: 'all', label: 'Все тербанки' }, ...terbankOptions]} /> : <>        <Select
          label="ГОСБ"
          value={c.branch}
          searchable
          onChange={(branch) => change({ branch })}
          options={[
            { value: "all", label: "Все ГОСБ" },
            ...data.branches
              .filter(
                (b) => appealsAnalysis || c.group !== "pilot" || b.pilot,
              )
              .sort((a, b) => a.name.localeCompare(b.name, "ru"))
              .map((b) => ({
                value: b.id,
                label: b.name + " · №" + b.id,
                detail: b.pilot ? "Есть участники пилота" : "Нет участников пилота",
              })),
          ]}
        />
</>}
        {!supplementalAnalysis ? <>        <Select
          label="Роль пилота"
          disabled={appealsAnalysis || !selectedGroups(data, c).includes("pilot")}
          value={c.role}
          onChange={(role) => change({ role: role as Context["role"], ...(role !== "all" ? { group: "pilot" as const } : {}) })}
          options={Object.entries(roleNames).map(([value, label]) => ({
            value,
            label,
          }))}
        />
</> : <div className="analysis-filter-scope"><span>Состав данных</span><strong>{appealsAnalysis ? 'Тербанки целиком' : c.group === 'nonpilot' ? 'Непилот · все роли' : c.group === 'pilot' ? 'Пилот · младшая роль' : 'Пилот · младшая; непилот · все роли'}</strong></div>}
        {offerAnalysis && <>        <Select
          label="Продукты"
          disabled={supplementalAnalysis}
          value={c.scope}
          onChange={(scope) => change({ scope: scope as Context["scope"] })}
          options={[
            { value: "without", label: "Без ФОТ" },
            { value: "with", label: "С ФОТ" },
          ]}
        />
</>}
        <button
          className="filter-reset"
          aria-label="Сбросить фильтры"
          disabled={!count}
          onClick={() =>
            change({
              branch: "all",
              role: "all",
              group: "both",
              scope: "without",
            })
          }
        >
          <Icon name="reset" size={17} />
          <span>Сбросить{count ? " · " + count : ""}</span>
        </button>
      </div>
      {c.page === "map" && <p className="filter-note">
        <Icon name="info" size={15} />
        Роль применяется к пилоту. Непилот сравнивается по всем ролям.
      </p>}
    </section>
  );
}
function MetricCard({
  data,
  c,
  metric,
  change,
}: {
  data: Manifest;
  c: Context;
  metric: Metric;
  change: Change;
}) {
  if (metric === "process") return <MoodCard {...{ data, c, change }} />;
  const meta = metadata[metric],
    gs = selectedGroups(data, c),
    primary = gs[0],
    series = gs.map((group) => ({
      group,
      values: [1, 2, 3].map((q) => value(data, c, group, metric, q)),
    }));
  const current = value(data, c, primary, metric, 3),
    previous = value(data, c, primary, metric, 2);
  const waiting =
    (metric === "appeals" || metric === "payroll") &&
    series.every((s) => s.values.every((v) => v.value == null));
  const observed = metric === "meetings" && current.observed != null;
  return (
    <article
      className={`metric-card metric-${metric} ${waiting ? "metric-waiting" : ""}`}
      aria-labelledby={`title-${metric}`}
    >
      <CardAmbient kind={metric} />
      <div className="card-heading">
        <span className="metric-icon">
          <MetricGlyph
            name={meta.icon}
            revision={c.role + c.branch + c.group + c.scope}
          />
        </span>
        <h2 id={`title-${metric}`}>{meta.title}</h2>
        <Link
          c={c}
          change={change}
          patch={{ page: "analysis", metric }}
          className="card-open"
          label={`Открыть анализ: ${meta.title}`}
        >
          <Icon name="arrow" size={18} />
        </Link>
      </div>
      <p className="card-subtitle">{meta.subtitle}</p>
      {current.status !== "ready" && !waiting && !observed && <div className="card-status-row">
        <span className="status-badge neutral">
          {statusText(current)}
        </span>
      </div>}
      {waiting ? (
        <>
          <div className="waiting-state">
            <div className="waiting-mark">
              <Icon name={meta.icon} size={28} />
            </div>
            <div>
              <strong>Ожидаются данные</strong>
              <p>
                {metric === "payroll"
                  ? "Объём ФОТ и получатели появятся после подключения источника."
                  : "Квартальные значения появятся после подключения источника."}
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="metric-headline">
            <div className="headline-number">
              {observed ? (
                <span className="number-large observed">
                  {format(current.observed)}
                  <sup>*</sup>
                </span>
              ) : (
                <AnimatedNumber stat={current} metric={metric} large />
              )}
              {["process", "leads"].includes(metric) && (
                <span className="unit">/ 3</span>
              )}
            </div>
            <div className="headline-meta">
              <span>{groupNames[primary]} · III квартал</span>
              {delta(current, previous, metric) ? <>
                <Delta current={current} previous={previous} metric={metric} />
                <span className="delta-caption">ко II кварталу</span>
              </> : <span className="delta-caption">{current.status === "ready" ? "Нет базы сравнения" : statusText(current)}</span>}
            </div>
          </div>
          {metric === "complex" && (
            <div className="share-inline">
              <span className="share-number">
                {format(
                  value(data, c, primary, "complexShare", 3).value,
                  "complexShare",
                )}
              </span>
              <span>портфеля без ФОТ</span>
              <Delta
                current={value(data, c, primary, "complexShare", 3)}
                previous={value(data, c, primary, "complexShare", 2)}
                metric="complexShare"
              />
            </div>
          )}
          <QuarterChart
            compact
            series={series}
            metric={metric}
            onQuarter={(quarter) =>
              change({ page: "analysis", metric, quarter })
            }
          />
          {metric === "meetings" && (
            <button
              className="submetric"
              onClick={() => change({ page: "analysis", metric: "coverage" })}
            >
              <span>
                <Icon name="map" size={15} />
                Покрытие с 01.04
              </span>
              <b>
                {value(data, c, primary, "coverage").value != null
                  ? format(
                      value(data, c, primary, "coverage").value,
                      "coverage",
                    )
                  : "На сверке"}
              </b>
              <Icon name="chevron" size={14} />
            </button>
          )}
        </>
      )}
    </article>
  );
}
function Overview({
  data,
  c,
  change,
  supplemental,
}: {
  data: Manifest;
  c: Context;
  change: Change;
  supplemental: SupplementalLoad;
}) {
  const allowed = availableMetrics(c, data);
  const visibleMain = mainMetrics.filter((metric) => allowed.includes(metric));
  return (
    <>
      <div className="overview-controls">
      <section className="overview-heading">
        <h1>Результаты пилота</h1>
        <div className="overview-period">
          <span>{data.year} · I–III кварталы</span>
          <span className="status-badge warning">
            <Icon name="clock" size={15} />
            III квартал неполный · по{" "}
            {new Intl.DateTimeFormat("ru-RU", {
              day: "numeric",
              month: "long",
            }).format(new Date(data.asOf + "T12:00:00"))}
          </span>
        </div>
      </section>
      <Filters data={data} c={c} change={change} />
      </div>
      {visibleMain.length > 0 && <section className="metrics-grid" data-count={visibleMain.length} aria-label="Основные показатели">
        {visibleMain.map((metric) => (
          metric === "sales" || metric === "complex" ? <SalesCard key={metric} {...{ data, c, change, metric }} funnel={metric === "sales"} /> : metric === "meetings" ? <MeetingsCard key={metric} {...{ data, c, change }} /> : <MetricCard key={metric} {...{ data, c, change, metric }} />
        ))}
      </section>}
      <section className={`overview-details ${visibleMain.length ? "" : "overview-details-first"}`} aria-label="Обратная связь">
        <MoodCard data={data} c={c} change={change} />
      </section>
      <section className="supplemental-grid" aria-label="Обращения клиентов и ФОТ">
        {(["appeals", "payroll"] as const).filter((metric) => allowed.includes(metric)).map((kind) => <SupplementalCard key={kind} load={supplemental} {...{ c, change, kind }} />)}
      </section>
    </>
  );
}

function AnalysisHeader({ data, c, change, supplementalData }: { data: Manifest; c: Context; change: Change; supplementalData?: Supplemental | null }) {
  return (
      <section className="analysis-filter-card" aria-label="Настройка анализа">
        <header className="analysis-title-row">
          <h1>Анализ</h1>
          <div className="analysis-primary-controls">
            <Select label="Показатель" value={c.metric} onChange={metric => change({ metric: metric as Metric })} options={availableMetrics(c, data).map(value => ({ value, label: metricNames[value] }))} />
            <div className="analysis-period-control">
              {isSupplemental(c.metric) ? <span className="analysis-fixed-period">{c.metric === 'appeals' ? 'Месячные данные' : 'Март → июль'}</span> : c.metric === "coverage" ? <span className="analysis-fixed-period">II–III кв. · с 01.04</span> : <div className="analysis-switch" role="group" aria-label="Квартал">{quarters.map((q, i) => <button key={q} aria-label={q} aria-pressed={c.quarter === i + 1} onClick={() => change({ quarter: i + 1 })}>{["I", "II", "III"][i]} кв.</button>)}</div>}
            </div>
          </div>
          <span className="analysis-period-note" data-fixed={isSupplemental(c.metric) || c.metric === "coverage" || undefined}><Icon name="clock" size={15} />{data.year}{!isSupplemental(c.metric) && c.metric !== "coverage" && ` · ${data.periods[c.quarter - 1].partial ? `по ${data.periods[c.quarter - 1].through.slice(0, 5)} · неполный` : quarters[c.quarter - 1]}`}</span>
        </header>
        <SupplementalPeriods c={c} change={change} />
        <Filters data={data} c={c} change={change} supplementalData={supplementalData} />
      </section>
  );
}

function Analysis({
  data,
  c,
  change,
}: {
  data: Manifest;
  c: Context;
  change: Change;
}) {
  const [tab, setTab] = useState("branches"),
    [sort, setSort] = useState("value"),
    [movement, setMovement] = useState("all"),
    [expandedBranch, setExpandedBranch] = useState<string | null>(null),
    [productScope, setProductScope] = useState("all"),
    [employeeActivity, setEmployeeActivity] = useState("all"),
    [pageSize, setPageSize] = useState(10),
    [retry, setRetry] = useState(0),
    [recordFilter, setRecordFilter] = useState<{ field: "product" | "stage" | "employeeId"; value: string; label: string } | null>(null),
    [search, setSearch] = useState(""),
    [rows, setRows] = useState<Evidence[] | null>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState(0),
    [chosen, setChosen] = useState<Evidence | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const activeDetailTab = tab === "records" ? recordFilter?.field === "product" ? "products" : recordFilter?.field === "stage" ? "stages" : recordFilter?.field === "employeeId" ? "employees" : "branches" : tab;
  useEffect(() => {
    if (tab === "records" && !recordFilter) setTab("branches");
  }, [tab, recordFilter]);
  const gs = selectedGroups(data, c),
    branch = data.branches.find((b) => b.id === c.branch);
  useEffect(() => {
    setRecordFilter(null);
    setSearch("");
    setMovement("all");
    setProductScope("all");
    setEmployeeActivity("all");
    if (!selectedGroups(data, c).includes("pilot")) setTab(t => t === "employees" ? "branches" : t);
    if (!["sales", "complex", "complexShare"].includes(c.metric)) setTab(t => ["products", "stages"].includes(t) ? "branches" : t);
  }, [c.metric, c.branch, c.role, c.group, c.scope]);
  const detailKey = JSON.stringify([c, search, tab, sort, movement, pageSize, productScope, employeeActivity, recordFilter]);
  const previousDetailKey = useRef(detailKey);
  useEffect(() => {
    if (previousDetailKey.current === detailKey) return;
    previousDetailKey.current = detailKey;
    setPage(0);
    setChosen(null);
    setExpandedBranch(null);
  }, [detailKey]);
  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError("");
    if (tab === "records" || tab === "employees")
      loadEvidence(c.metric, c.quarter)
        .then((r) => {
          if (!cancelled) setRows(r);
        })
        .catch((e) => {
          if (!cancelled) setError(String(e.message));
        });
    return () => {
      cancelled = true;
    };
  }, [tab, c.metric, c.quarter, retry]);
  const filtered = useMemo(
    () => filterEvidence(rows || [], c, search).filter(r => !recordFilter || r[recordFilter.field] === recordFilter.value),
    [rows, c, search, recordFilter],
  );
  const complexMetric = ["complex", "complexShare"].includes(c.metric);
  const detailBase = (group: Group) => {
    const period = view(data, c, group).periods[c.quarter - 1];
    return c.metric === "complexShare" ? period.complexShare.status === "ready" ? period.complexShare.denominator ?? 0 : 0 : period[complexMetric ? "complexProducts" : "products"].reduce((sum, product) => sum + product.count, 0);
  };
  const stages = gs.flatMap((g) =>
    Object.entries(
      view(data, c, g).periods[c.quarter - 1][
        complexMetric ? "complexStages" : "stages"
      ],
    ).map(([name, count]) => ({ group: g, name, count })),
  );
  const products = gs
    .flatMap((g) =>
      view(data, c, g).periods[c.quarter - 1][
        complexMetric ? "complexProducts" : "products"
      ].map((p) => ({ ...p, group: g })),
    )
    .filter(
      (p) =>
        !search ||
        p.name.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")),
    );
  const comparable = c.quarter > 1 && c.metric !== "coverage";
  const branchRows = data.branches
    .filter(
      (b) =>
        (c.group !== "pilot" || b.pilot) &&
        (c.branch === "all" || b.id === c.branch) &&
        (!search ||
          (b.name + " " + b.id)
            .toLocaleLowerCase("ru")
            .includes(search.toLocaleLowerCase("ru"))),
    )
    .flatMap((b) => selectedGroups(data, { ...c, branch: b.id }).map((group) => ({
      branch: b,
      group,
      stat: value(data, { ...c, branch: b.id }, group, c.metric),
      periods: [1, 2, 3].map(q => value(data, { ...c, branch: b.id }, group, c.metric, q)),
    })))
    .sort((a, b) => {
      if (sort === "name") return a.branch.name.localeCompare(b.branch.name, "ru");
      const metricValue = (r: typeof a) => sort === "change" && c.quarter > 1 && c.metric !== "coverage"
        ? delta(r.stat, value(data, { ...c, branch: r.branch.id }, r.group, c.metric, c.quarter - 1), c.metric)?.value ?? null
        : r.stat.value;
      return (metricValue(b) ?? -Infinity) - (metricValue(a) ?? -Infinity);
    });
  const movementOf = (row: typeof branchRows[number]) => {
    if (!comparable) return "unknown";
    const current = row.stat, previous = row.periods[c.quarter - 2];
    if (current.status !== "ready" || previous.status !== "ready" || current.assignedOnly || previous.assignedOnly || current.value == null || previous.value == null) return "unknown";
    return current.value > previous.value ? "up" : current.value < previous.value ? "down" : "flat";
  };
  const ranked = branchRows.filter(row => !comparable || movement === "all" || movementOf(row) === movement);
  const canExplain = comparable && ["sales", "complex"].includes(c.metric);
  const sortedProducts = products.filter(p => productScope === "all" || p.complex).sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "ru") : b.count - a.count);
  const visibleStages = stages.filter(s => !search || s.name.toLocaleLowerCase("ru").includes(search.toLocaleLowerCase("ru")));
  const relevantEmployees = data.staff
    .filter(
      (p) =>
        (c.branch === "all" || p.branch === c.branch) &&
        (c.role === "all" || p.role === c.role) &&
        (!search ||
          p.name
            .toLocaleLowerCase("ru")
            .includes(search.toLocaleLowerCase("ru"))),
    )
    .filter((p) =>
      c.metric === "complex" || c.metric === "complexShare"
        ? p.role === "senior"
        : ["sales", "meetings", "coverage"].includes(c.metric)
          ? p.role !== "akm"
          : true,
    );
  const employeeRecords = useMemo(() => {
    const map = new Map<string, Evidence[]>();
    for (const r of filtered) {
      const list = map.get(r.employeeId) || [];
      list.push(r);
      map.set(r.employeeId, list);
    }
    return map;
  }, [filtered]);
  const employeeDenominators = useMemo(() => {
    const map = new Map<string, number>();
    if (c.metric === "complexShare")
      for (const r of filterEvidence(rows || [], {
        ...c,
        metric: "sales",
        role: "senior",
        scope: "without",
      }))
        map.set(r.employeeId, (map.get(r.employeeId) || 0) + 1);
    return map;
  }, [rows, c]);
  const offerEmployees = ["sales", "complex", "complexShare"].includes(c.metric);
  const portfolios = useMemo(() => employeePortfolios(filterEvidence(rows || [], { ...c, metric: "sales", scope: c.metric === "sales" ? c.scope : "without" })), [rows, c]);
  const allEmployeeValues = relevantEmployees
    .map((p) => {
      const rs = employeeRecords.get(p.id) || [];
      let n: number | null = null;
      if (c.metric === "sales" || c.metric === "complex") n = rs.length;
      if (c.metric === "complexShare")
        n = employeeDenominators.get(p.id)
          ? (rs.length / employeeDenominators.get(p.id)!) * 100
          : null;
      if (c.metric === "meetings")
        n = rs.length
          ? rs.reduce((s, r) => s + (r.values?.[c.quarter - 1] || 0), 0)
          : null;
      if (c.metric === "coverage") {
        const base = new Set(rs.map((r) => r.inn).filter(Boolean)),
          met = new Set(
            rs
              .filter((r) => r.values?.slice(1).some((v) => v > 0))
              .map((r) => r.inn)
              .filter(Boolean),
          );
        n = base.size ? (met.size / base.size) * 100 : null;
      }
      if (c.metric === "process" || c.metric === "leads") {
        const scores = rs.filter((r) => r.scores);
        n = scores.length
          ? scores.reduce(
              (s, r) =>
                s +
                (c.metric === "process"
                  ? r.scores!.slice(0, 3).reduce((s, v) => s + v, 0) / 3
                  : r.scores![3]),
              0,
            ) / scores.length
          : null;
      }
      return { p, n, rs, portfolio: portfolios.get(p.id) };
    })
    .sort((a, b) => sort === "name" ? a.p.name.localeCompare(b.p.name, "ru") : sort === "complexMix" && offerEmployees
      ? (b.portfolio && !b.portfolio.unknown ? b.portfolio.complex / b.portfolio.total : -1) - (a.portfolio && !a.portfolio.unknown ? a.portfolio.complex / a.portfolio.total : -1)
      : (b.n ?? -1) - (a.n ?? -1));
  const employeeValues = allEmployeeValues.filter(row => !offerEmployees || employeeActivity === "all" || (employeeActivity === "active" ? row.rs.length > 0 : row.rs.length === 0));
  function exportRows() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `реестр-${c.metric}-${c.quarter}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function showDetail(next: string, needle = "") {
    setTab(next); setSearch(needle); setRecordFilter(null); setMovement("all"); setProductScope("all");
    detailRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
  }
  function exportTable() {
    const rows: (string | number | null)[][] = tab === "branches"
      ? [["ГОСБ", "Номер", "Группа", "Показатель", ...(c.metric === "coverage" ? ["Накопительно · II–III кварталы"] : quarters)], ...ranked.map(r => [r.branch.name, r.branch.id, groupNames[r.group], metricNames[c.metric], ...(c.metric === "coverage" ? [c.quarter] : [1, 2, 3]).map(q => { const s = value(data, { ...c, branch: r.branch.id }, r.group, c.metric, q); return s.value == null ? statusText(s) : s.assignedOnly ? `${s.value} · по известным привязкам` : s.value; })])]
      : tab === "products" ? [["Продукт", "Группа", "Предложения", ...(c.metric === "complexShare" ? ["Вклад в общую долю, п. п."] : [])], ...sortedProducts.map(p => [p.name, groupNames[p.group], p.count, ...(c.metric === "complexShare" ? [detailBase(p.group) > 0 ? p.count / detailBase(p.group) * 100 : null] : [])])]
      : tab === "stages" ? [["Стадия", "Группа", "Предложения", ...(c.metric === "complexShare" ? ["Вклад в общую долю, п. п."] : [])], ...visibleStages.map(s => [s.name, groupNames[s.group], s.count, ...(c.metric === "complexShare" ? [detailBase(s.group) > 0 ? s.count / detailBase(s.group) * 100 : null] : [])])]
      : offerEmployees ? [["Сотрудник", "Роль", "ГОСБ", metricNames[c.metric], "Портфель, предложений", "Сложные, предложений", "Доля сложных в личном портфеле, %", "Клиенты по ИНН", "Продукты"], ...employeeValues.map(({ p, n, portfolio }) => [p.name, roleNames[p.role], p.branch, n, portfolio?.total ?? 0, portfolio?.complex ?? 0, portfolio && !portfolio.unknown ? portfolio.complex / portfolio.total * 100 : null, portfolio?.clients ?? 0, portfolio?.products ?? 0])]
      : [["Сотрудник", "Роль", "ГОСБ", metricNames[c.metric], "Записей"], ...employeeValues.map(({ p, n, rs }) => [p.name, roleNames[p.role], p.branch, n, rs.length])];
    downloadCsv(`анализ-${tab}-${c.metric}-${c.quarter}.csv`, [["Год", data.year, "ГОСБ", branch?.name || "Все ГОСБ", "Роль пилота", roleNames[c.role], "Продукты", c.scope === "without" ? "Без ФОТ" : "С ФОТ"], ...rows]);
  }
  return (
    <>
      <AnalysisHeader data={data} c={c} change={change} />
      <AnalysisCharts key={c.metric} data={data} c={c} change={change} detail={showDetail} />
      {["sales", "complex", "complexShare"].includes(c.metric) && (
        <div className="inline-method">
          <Icon name="info" size={16} />
          {c.metric === "sales"
            ? "Уникальные ID предложений во всех стадиях. Повтор между срезами не является новой продажей."
            : "Количество сложных предложений относится к старшей роли пилота. Знаменатель доли — весь её портфель без ФОТ. КОРы ожидают подтверждённого соответствия продуктам."}
        </div>
      )}
      {c.metric === "coverage" && (
        <div className="inline-method">
          <Icon name="info" size={16} />
          Уникальные ИНН со встречами во II–III кварталах / уникальные ИНН
          закреплённой базы. Квартальный переключатель не меняет накопительный
          период.
        </div>
      )}
      <section className="detail-panel analysis-detail" ref={detailRef} aria-label="Детализация данных">
        <header className="analysis-detail-heading"><div><h2>Детализация</h2><p>{metricNames[c.metric]} · {branch?.name || "Все ГОСБ"} · {c.metric === "coverage" ? "С 01.04 · накопительно" : quarters[c.quarter - 1]}</p></div>
          {tab !== "records" && <button className="analysis-export" onClick={exportTable} disabled={tab === "employees" && (!rows || !!error || !gs.includes("pilot"))}><Icon name="download" size={16} />Скачать CSV</button>}
        </header>
        <div className="detail-toolbar">
          <div className="tabs" role="tablist" aria-label="Разрез анализа">
            {[
              ["branches", "ГОСБ"],
              ...(["sales", "complex", "complexShare"].includes(c.metric)
                ? [
                    ["products", "Продукты"],
                    ["stages", "Стадии"],
                  ]
                : []),
              ...(gs.includes("pilot") ? [["employees", "Сотрудники пилота"]] : []),
            ].map(([id, label]) => (
              <button
                key={id}
                role="tab"
                id={`analysis-tab-${id}`}
                aria-controls="analysis-tab-panel"
                tabIndex={activeDetailTab === id ? 0 : -1}
                onKeyDown={event => {
                  const buttons = Array.from(event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
                  const index = buttons.indexOf(event.currentTarget);
                  const target = event.key === "ArrowRight" ? (index + 1) % buttons.length : event.key === "ArrowLeft" ? (index + buttons.length - 1) % buttons.length : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : null;
                  if (target != null) { event.preventDefault(); buttons[target].click(); buttons[target].focus(); }
                }}
                aria-selected={activeDetailTab === id}
                onClick={() => { setTab(id); setSearch(""); setRecordFilter(null); }}
              >
                {label}
              </button>
            ))}
          </div>

        </div>
        <div className="analysis-table-tools">
          <label className="search">
            <Icon name="search" size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "records"
                  ? "ФИО, ИНН, ID предложения"
                  : tab === "employees" ? "Найти сотрудника" : tab === "branches" ? "Найти ГОСБ или номер" : tab === "products" ? "Найти продукт" : "Найти стадию"
              }
              aria-label="Поиск в детализации"
            />
            {search && (
              <button onClick={() => setSearch("")} aria-label="Очистить поиск">
                <Icon name="close" size={13} />
              </button>
            )}
          </label>
          {tab !== "records" && tab !== "stages" && <Select label="Сортировка таблицы" value={(sort === "change" && (tab !== "branches" || !comparable)) || (sort === "complexMix" && (tab !== "employees" || !offerEmployees)) ? "value" : sort} onChange={setSort} options={[{ value: "value", label: "По значению ↓" }, ...(tab === "branches" && comparable ? [{ value: "change", label: "По динамике ↓" }] : []), ...(tab === "employees" && offerEmployees ? [{ value: "complexMix", label: "По доле сложных ↓" }] : []), { value: "name", label: "По названию" }]} />}
          {tab === "employees" && offerEmployees && gs.includes("pilot") && rows && !error && <div className="analysis-switch analysis-product-filter employee-activity-filter" role="group" aria-label="Предложения сотрудников">{[["all", "Все"], ["active", "С предложениями"], ["empty", "Без предложений"]].map(([id, label]) => <button key={id} aria-pressed={employeeActivity === id} onClick={() => setEmployeeActivity(id)}>{label}{" "}<span>{allEmployeeValues.filter(row => id === "all" || (id === "active" ? row.rs.length > 0 : !row.rs.length)).length}</span></button>)}</div>}
          {tab === "products" && !complexMetric && <div className="analysis-switch analysis-product-filter" role="group" aria-label="Тип продуктов">
            <button aria-pressed={productScope === "all"} onClick={() => setProductScope("all")}>Все продукты <span>{products.length}</span></button>
            <button aria-pressed={productScope === "complex"} onClick={() => setProductScope("complex")}><Icon name="complex" size={17} />Сложные <span>{products.filter(p => p.complex).length}</span></button>
          </div>}
          {tab === "branches" && comparable && <div className="analysis-movement" role="group" aria-label="Фильтр динамики">
            {[["all", "Все"], ["up", "Рост"], ["down", "Снижение"], ["flat", "Без изменений"], ["unknown", "Нет сравнения"]].map(([id, label]) => <button key={id} aria-pressed={movement === id} onClick={() => setMovement(id)}>{label}{" "}<span>{id === "all" ? branchRows.length : branchRows.filter(row => movementOf(row) === id).length}</span></button>)}
          </div>}
        </div>
        <div className="analysis-detail-context">
          <span aria-live="polite">{tab === "branches" ? `${ranked.length} строк · ${c.metric === "coverage" ? "накопительное покрытие" : canExplain ? "нажмите «Разобрать», чтобы увидеть вклад продуктов" : "сравнение кварталов"}` : tab === "products" ? `${sortedProducts.length} строк · ${c.metric === "complexShare" ? "вклад каждого продукта в общую долю, п. п." : complexMetric ? "доля внутри сложных продуктов" : "доля от всего портфеля группы"}` : tab === "stages" ? c.metric === "complexShare" ? "Вклад сложных предложений каждой стадии в общую долю, п. п." : "Текущие стадии · доля от выбранных предложений группы" : tab === "employees" && gs.includes("pilot") && rows && !error ? `${employeeValues.length} сотрудников · выбранный квартал и роль пилота` : "Сотрудники и исходные записи доступны только для пилота"}</span>
          {tab === "records" && recordFilter && <button className="analysis-back" onClick={() => { setTab(recordFilter.field === "product" ? "products" : recordFilter.field === "stage" ? "stages" : "employees"); setRecordFilter(null); setSearch(""); }}><Icon name="chevron" size={14} />{recordFilter.field === "product" ? "К продуктам" : recordFilter.field === "stage" ? "К стадиям" : "К сотрудникам"}</button>}
          {(search || recordFilter) && <button className="analysis-clear" onClick={() => { setSearch(""); setRecordFilter(null); }}><Icon name="close" size={14} />{recordFilter?.label || "Сбросить поиск"}</button>}
        </div>
        {tab === "branches" && gs.includes("nonpilot") && ["sales", "complex", "complexShare"].includes(c.metric) && data.quality.unassignedOffersByQuarter && [1, 2, 3].some(q => data.quality.unassignedOffersByQuarter![String(q)][c.metric === "complex" ? "complex" : c.metric === "complexShare" ? "without" : c.scope] > 0) && <p className="analysis-assignment-note"><Icon name="info" size={17} /><span><b>Без привязки к ГОСБ:</b> {[1, 2, 3].map(q => { const n = data.quality.unassignedOffersByQuarter![String(q)][c.metric === "complex" ? "complex" : c.metric === "complexShare" ? "without" : c.scope]; return n ? `${["I", "II", "III"][q - 1]} кв. — ${format(n)}` : null; }).filter(Boolean).join(" · ")} предложений. Они включены в общий итог непилота. Значения ГОСБ показаны по известным привязкам; динамика с неполной базой не рассчитывается.</span></p>}
        <div role="tabpanel" id="analysis-tab-panel" aria-labelledby={`analysis-tab-${activeDetailTab}`}>
        {tab === "branches" && (
          <><div className="table-scroll" tabIndex={0} aria-label="Сравнение ГОСБ по кварталам">
            <table>
              <thead>
                <tr>
                  <th>ГОСБ</th>
                  <th>Группа</th>
                  {(c.metric === "coverage" ? [c.quarter] : [1, 2, 3]).map(q => <th key={q} className={`numeric ${q === c.quarter ? "analysis-selected-column" : ""}`}>{c.metric === "coverage" ? "Покрытие" : <button onClick={() => change({ quarter: q })} aria-label={`Выбрать ${quarters[q - 1]}`}>{["I", "II", "III"][q - 1]} кв.{data.periods[q - 1].partial ? "*" : ""}</button>}</th>)}
                  <th className="numeric">Изменение{comparable && <small className="analysis-change-caption">к {quarters[c.quarter - 2]}</small>}</th>
                  <th aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {ranked.slice(page * pageSize, (page + 1) * pageSize).map(({ branch: b, group, stat: s }) => (
                  <Fragment key={`${b.id}:${group}`}><tr>
                    <td>
                      <Link
                        c={c}
                        change={change}
                        patch={{ branch: b.id }}
                        className="branch-link"
                      >
                        {b.name}
                        <small>
                          №{b.id} · {b.tb}
                        </small>
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`group-tag ${group}`}
                      >
                        {group === "pilot" ? "Пилот" : "Непилот"}
                      </span>
                    </td>
                    {(c.metric === "coverage" ? [c.quarter] : [1, 2, 3]).map(q => { const stat = value(data, { ...c, branch: b.id }, group, c.metric, q); return <td key={q} className={`numeric ${q === c.quarter ? "analysis-selected-column" : ""}`} title={stat.reason}>{stat.value == null ? <span className="table-status">{statusText(stat)}</span> : format(stat.value, c.metric)}</td>; })}
                    <td className="numeric">
                      {c.quarter > 1 && c.metric !== "coverage" ? (
                        <Delta
                          current={s}
                          previous={value(
                            data,
                            { ...c, branch: b.id },
                            group,
                            c.metric,
                            c.quarter - 1,
                          )}
                          metric={c.metric}
                        />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td><div className="analysis-row-actions">
                      {canExplain && <button className="analysis-explain" aria-expanded={expandedBranch === `${b.id}:${group}`} aria-controls={`breakdown-${b.id}-${group}`} aria-label={`Разобрать изменения: ${b.name} · ${groupNames[group]}`} onClick={() => setExpandedBranch(expandedBranch === `${b.id}:${group}` ? null : `${b.id}:${group}`)}>{expandedBranch === `${b.id}:${group}` ? "Свернуть" : "Разобрать"}<Icon name="chevron" size={14} /></button>}
                      <Link
                        c={c}
                        change={change}
                        patch={{ page: "map", branch: b.id }}
                        className="icon-button"
                        label={`Показать на карте: ${b.name}`}
                      >
                        <Icon name="map" size={17} />
                      </Link>
                    </div></td>
                  </tr>
                  {canExplain && expandedBranch === `${b.id}:${group}` && <tr className="analysis-breakdown-row"><td colSpan={7} id={`breakdown-${b.id}-${group}`}>
                    <BranchProductBreakdown current={view(data, { ...c, branch: b.id }, group).periods[c.quarter - 1]} previous={view(data, { ...c, branch: b.id }, group).periods[c.quarter - 2]} complex={c.metric === "complex"} quarter={c.quarter} branch={b.name} group={group} partial={data.periods[c.quarter - 1].partial} />
                  </td></tr>}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {!ranked.length && <Empty />}
          </div><div className="pagination analysis-detail-pagination">
            <span>{ranked.length ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, ranked.length)} из ${ranked.length}` : "Нет строк"}</span>
            <Select label="Строк на странице" value={String(pageSize)} onChange={n => setPageSize(Number(n))} options={[10, 20, 50].map(n => ({ value: String(n), label: `${n} строк` }))} />
            <span className="analysis-period-footnote">* III кв. по {data.periods[2].through.slice(0, 5)}</span>
            <button disabled={!page} onClick={() => setPage(p => p - 1)}>Назад</button><button disabled={(page + 1) * pageSize >= ranked.length} onClick={() => setPage(p => p + 1)}>Далее</button>
          </div></>
        )}
        {tab === "products" && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Продукт</th>
                  <th>Группа</th>
                  <th>{c.metric === "complexShare" ? "Вклад в общую долю" : complexMetric ? "Доля среди сложных" : "Доля в группе"}</th>
                  <th className="numeric">Предложения</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((p) => (
                  <tr key={p.group + p.name} className={p.complex ? "analysis-complex-product" : ""}>
                    <td>
                      <div className="analysis-product-title"><button className="employee-link" onClick={() => { setTab("records"); setSearch(""); setRecordFilter({ field: "product", value: p.name, label: p.name }); }} disabled={p.group === "nonpilot"}>{p.name}</button>
                        {p.complex && <span className="analysis-complex-badge"><Icon name="complex" size={16} />Сложный</span>}
                      </div>
                    </td>
                    <td><span className={`group-tag ${p.group}`}>{groupNames[p.group]}</span></td>
                    <td>
                      <DetailShareBar count={p.count} total={detailBase(p.group)} group={p.group} points={c.metric === "complexShare"} />
                    </td>
                    <td className="numeric">{format(p.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!sortedProducts.length && (
              <Empty text="Проверенная расшифровка для выбранного контекста недоступна" />
            )}
          </div>
        )}
        {tab === "stages" && (
          <div className="table-scroll" tabIndex={0} aria-label="Детализация стадий">
            <table><thead><tr><th>Стадия</th><th>Группа</th><th>{c.metric === "complexShare" ? "Вклад в общую долю" : complexMetric ? "Доля среди сложных" : "Доля в группе"}</th><th className="numeric">Предложения</th></tr></thead>
              <tbody>{visibleStages.map(s => <tr key={`${s.group}:${s.name}`}>
                <td><button className="employee-link" disabled={s.group === "nonpilot"} onClick={() => { setTab("records"); setSearch(""); setRecordFilter({ field: "stage", value: s.name, label: s.name }); }}>{s.name}</button></td>
                <td><span className={`group-tag ${s.group}`}>{groupNames[s.group]}</span></td>
                <td><DetailShareBar count={s.count} total={c.metric === "complexShare" ? detailBase(s.group) : stages.filter(item => item.group === s.group).reduce((sum, item) => sum + item.count, 0)} group={s.group} points={c.metric === "complexShare"} /></td>
                <td className="numeric">{format(s.count)}</td>
              </tr>)}</tbody>
            </table>
            {!visibleStages.length && <Empty text={search ? "По заданным условиям ничего не найдено" : "Стадии доступны после сверки назначений"} />}
          </div>
        )}
        {(tab === "records" || tab === "employees") &&
          (gs.length === 1 && gs[0] === "nonpilot" ? (
            <Empty text="Для непилота доступна агрегированная аналитика по ГОСБ, продуктам и стадиям" />
          ) : error ? (
            <div role="alert"><Empty text={error} /><button className="analysis-retry" onClick={() => setRetry(n => n + 1)}>Повторить загрузку</button></div>
          ) : rows === null ? (
            <div className="loading-inline">
              <span className="spinner" />
              Загрузка исходного реестра…
            </div>
          ) : tab === "employees" && offerEmployees ? (
            <EmployeePortfolioTable employees={employeeValues} data={data} c={c} open={p => { setSearch(""); setRecordFilter({ field: "employeeId", value: p.id, label: p.name }); setTab("records"); }} />
          ) : tab === "employees" ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Роль</th>
                    <th>ГОСБ</th>
                    <th className="numeric">{metricNames[c.metric]}</th>
                    <th className="numeric">Записей</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeValues.map(({ p, n, rs }) => (
                    <tr key={p.id}>
                      <td>
                        <button
                          className="employee-link"
                          onClick={() => {
                            setSearch("");
                            setRecordFilter({ field: "employeeId", value: p.id, label: p.name });
                            setTab("records");
                          }}
                        >
                          {p.name}
                        </button>
                        <small className="cell-note">Таб. №{p.rawId}</small>
                      </td>
                      <td>{roleNames[p.role]}</td>
                      <td>
                        {data.branches.find((b) => b.id === p.branch)?.name}
                      </td>
                      <td className="numeric">{format(n, c.metric)}</td>
                      <td className="numeric">{rs.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!employeeValues.length && <Empty />}
            </div>
          ) : (
            <>
              <div className="registry-heading">
                <span>Пилот · найдено записей: {format(filtered.length)}</span>
                <button
                  className="text-button"
                  onClick={exportRows}
                  disabled={!filtered.length}
                >
                  <Icon name="download" size={15} />
                  Скачать выборку
                </button>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Источник / строка</th>
                      <th>Сотрудник</th>
                      <th>
                        {rows[0]?.scores ? "Дата анкеты" : "Клиент / ИНН"}
                      </th>
                      <th>
                        {rows[0]?.scores
                          ? "Ответы"
                          : rows[0]?.values
                            ? "I · II · III кварталы"
                            : "Продукт / стадия"}
                      </th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(page * 40, (page + 1) * 40).map((r, i) => (
                      <tr key={`${r.id || r.row}-${i}`}>
                        <td>
                          <span className="source-cell">{r.source}</span>
                          <small className="cell-note">
                            {r.sheet} · строка {r.row}
                            {r.id && !r.scores ? ` · ID ${r.id}` : ""}
                          </small>
                        </td>
                        <td>
                          {r.name}
                          <small className="cell-note">
                            {roleNames[r.role]}
                          </small>
                        </td>
                        <td>
                          {r.scores ? r.date?.slice(0, 10) : r.client}
                          <small className="cell-note">{r.inn}</small>
                        </td>
                        <td>
                          {r.scores
                            ? r.scores.join(" · ")
                            : r.values
                              ? r.values.join(" · ")
                              : r.product}
                          <small className="cell-note">{r.stage}</small>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Открыть запись ${r.row}`}
                            onClick={() => setChosen(r)}
                          >
                            <Icon name="arrow" size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!filtered.length && <Empty />}
              </div>
              <div className="pagination">
                <span>
                  Страница {page + 1} из{" "}
                  {Math.max(1, Math.ceil(filtered.length / 40))}
                </span>
                <button disabled={!page} onClick={() => setPage((p) => p - 1)}>
                  Назад
                </button>
                <button
                  disabled={(page + 1) * 40 >= filtered.length}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Далее
                </button>
              </div>
            </>
          ))}
        </div>
      </section>
      {chosen && <RecordDialog record={chosen} close={() => setChosen(null)} />}
    </>
  );
}
function Empty({
  text = "По заданным условиям ничего не найдено",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <Icon name="search" size={26} />
      <p>{text}</p>
    </div>
  );
}
function RecordDialog({
  record: r,
  close,
}: {
  record: Evidence;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="record-dialog"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-header">
        <h2>Исходная запись</h2>
        <button
          autoFocus
          className="icon-button"
          aria-label="Закрыть запись"
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </div>
      <dl>
        {[
          ["Файл", r.source],
          ["Лист и строка", `${r.sheet} · ${r.row}`],
          ["ID предложения", r.scores ? undefined : r.id],
          ["Сотрудник", r.name],
          ["Табельный номер", r.employeeId],
          ["Роль пилота", roleNames[r.role]],
          ["ГОСБ", r.branch],
          ["Исходное название ГОСБ", r.rawBranch],
          ["Основание сопоставления", r.basis],
          ["ИНН", r.inn],
          ["Исходный ИНН", r.rawInn],
          ["Продукт", r.product],
          ["Стадия", r.stage],
          ["Встречи I · II · III", r.values?.join(" · ")],
          ["Ответы на четыре вопроса", r.scores?.join(" · ")],
        ]
          .filter(([, v]) => v != null)
          .map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
    </dialog>
  );
}
function MethodDialog({ data, supplemental, close }: { data: Manifest; supplemental: SupplementalLoad; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="method-dialog" onCancel={close}>
      <div className="dialog-header">
        <div>
          <h2>Данные и методика</h2>
        </div>
        <button
          autoFocus
          className="icon-button"
          onClick={close}
          aria-label="Закрыть методику"
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="method-body">
        <div className="verification">
          <Icon name="check" />
          {format(data.quality.checks)} контрольных проверок агрегатов выполнено
        </div>
        <h3>Правила интерпретации</h3>
        <p>Полный состав пилота: {data.branches.filter((b) => b.pilot).length} ГОСБ, {data.staff.length} сотрудников. Ролевой фильтр применяется только к пилоту, непилот — все роли.</p>
        <p>
          В пилоте учитываются только сотрудники с ролью в столбце M
          обновлённого штата. Для исторических кварталов применяется
          фиксированный состав пилота. Непилот — все сотрудники вне списка
          пилота, независимо от ГОСБ, включая сотрудников тех же отделений.
        </p>
        <p>
          Сделки — уникальные ID продуктовых предложений во всех стадиях среза.
          ФОТ по умолчанию не входит в портфель. Доля сложных продуктов
          рассчитывается без ФОТ в том же ролевом составе.
        </p>
        <p>
          Встречи устранены от повторов по сотруднику, ИНН и согласованным
          квартальным значениям. Пустые ячейки считаются нулём. Отсутствие
          сотрудника в выгрузке оставляет итог на сверке. ИНН длиной 9 или 11
          цифр дополнен ведущим нулём; исходное значение сохранено.
        </p>
        <p>
          Оценка процесса — среднее первых трёх ответов; полезность лидов —
          четвёртый ответ. Только завершённые анкеты со шкалой 1–3. Повторы по
          внешнему ID и времени создания заменяются последней обновлённой
          записью.
        </p>
        <h3>Ограничения</h3>
        <ul>
          <li>
            III квартал не завершён. Дата 31.08 подтверждается полями нового
            среза сделок. У встреч есть квартальные итоги, отдельной даты среза
            в источнике нет.
          </li>
          <li>
            Неопределённые исторические ГОСБ ограничивают детализацию по
            отделениям, но входят в общий итог непилота при выборе «Все ГОСБ».
          </li>
          <li>
            В выгрузке встреч отсутствуют{" "}
            {data.quality.meetingMissingStaff.length} сотрудника пилота:{" "}
            {data.quality.meetingMissingStaff
              .map((id) => data.staff.find((s) => s.id === id)?.name)
              .join(", ")}
            .
          </li>
          <li>
            В непилоте есть встречи без идентификации сотрудника. Затронутые
            итоги ожидают проверки.
          </li>
          <li>
            Менее 5 ответивших — малая выборка. Наличие оценок не подтверждает
            репрезентативность группы.
          </li>
          <li>Обращения — квартальные суммы листа d по тербанкам; роли не выделены. III квартал содержит июль–август.</li>
          <li>Фактический ФОТ — объёмы за март и июль; получатели — срезы тех же месяцев. Оба показателя сравнивают июль с мартом независимо от квартального фильтра. Неполные клиентские суммы отмечены отдельно; пропуски не равны нулю.</li>
          <li>Обращения и ФОТ доступны в отдельной детализации. На карте ГОСБ они не окрашиваются: обращения имеют уровень ТБ, а ФОТ — неполное покрытие клиентов.</li>
        </ul>
        <h3>Источники</h3>
        {[...data.sources, ...(supplemental.data?.sources || [])].map((s) => (
          <details className="source-item" key={s.file}>
            <summary>
              {s.file}
              <span>
                {format(s.sheets.reduce((n, x) => n + x.rows, 0))} строк
              </span>
            </summary>
            <p>
              Контрольная сумма SHA-256: <code>{s.sha256}</code>
            </p>
            {s.sheets.map((x) => (
              <p key={x.name}>
                {x.name}: {format(x.rows)} строк · {x.columns} столбцов ·{" "}
                {format(x.nonemptyCells)} заполненных ячеек
              </p>
            ))}
          </details>
        ))}
      </div>
    </dialog>
  );
}

export default function App() {
  useInputModality();
  const [data, setData] = useState<Manifest | null>(null),
    [error, setError] = useState(""),
    [c, setC] = useState(() => parseContext(window.location.search)),
    [method, setMethod] = useState(false);
  const supplemental = useSupplemental(data);
  useEffect(() => {
    fetch("/dashboard/manifest.json")
      .then((r) => {
        if (!r.ok) throw new Error("Не удалось загрузить данные");
        return r.json();
      })
      .then((m: Manifest) => {
        setData(m);
        setC(parseContext(window.location.search, m));
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    const back = () =>
      setC(parseContext(window.location.search, data || undefined));
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, [data]);
  const change: Change = (patch) => {
    const sectionDefaults: Partial<Context> = patch.section && patch.smoView === undefined && (patch.section !== c.section || patch.section === "smo")
      ? {
          ...(patch.section === "smo" ? { smoView: "intro" as const } : {}),
          ...(patch.section === "sales-model" ? { modelView: "premises" as const, slide: 1 } : {}),
          ...(patch.section === "academy" ? { academyView: "essence" as const } : {}),
        }
      : {};
    const next = normalizeMetricContext({ ...c, ...sectionDefaults, ...patch }, data || undefined);
    window.history.pushState({}, "", contextUrl(next));
    setC(next);
    if ((patch.page && patch.page !== c.page) || (patch.section && patch.section !== c.section) || (patch.modelView && patch.modelView !== c.modelView) || (patch.smoView && patch.smoView !== c.smoView) || (patch.academyView && patch.academyView !== c.academyView))
      window.scrollTo({ top: 0, behavior: "instant" });
  };
  useEffect(() => {
    const sectionTitle = c.section === "title" ? "Приветствие" : c.section === "smo" ? "Кредитование СМО" : c.section === "strategy" ? "Глубокое понимание клиента" : c.section === "academy" ? "Академия гибридных лидеров" : c.section === "tb-tasks" ? "Задачи ТБ" : c.modelView === "premises" ? "Предпосылки изменений" : c.modelView === "next" ? "Дальнейшие шаги" : c.page === "overview" ? "Результаты пилота" : c.page === "map" ? "Карта ГОСБ" : metricNames[c.metric];
    document.title = `${sectionTitle} · Пульс`;
  }, [c.section, c.modelView, c.page, c.metric]);
  useEffect(() => {
    if (data) window.history.replaceState({}, "", contextUrl(c));
  }, [data, c]);
  if (c.section === "title") return (
    <>
      <a className="skip-link" href="#main">Перейти к содержимому</a>
      <DashboardHeader c={c} change={change} />
      <main id="main" className="app-main section-title"><WelcomePage c={c} change={change} /></main>
    </>
  );
  if (c.section === "smo") return (
    <>
      <a className="skip-link" href="#main">Перейти к содержимому</a>
      <DashboardHeader c={c} change={change} />
      <main id="main" className="app-main section-smo">
        <SmoCreditDashboard view={normalizeSmoView(c.smoView)} onViewChange={(smoView) => change({ smoView })} />
      </main>
    </>
  );
  if (c.section === "strategy") return (
    <>
      <a className="skip-link" href="#main">Перейти к содержимому</a>
      <DashboardHeader c={c} change={change} />
      <main id="main" className="app-main section-strategy">
        <StrategyDashboard />
      </main>
    </>
  );
  if (c.section === "academy") return (
    <>
      <a className="skip-link" href="#main">Перейти к содержимому</a>
      <DashboardHeader c={c} change={change} />
      <main id="main" className="app-main section-academy"><AcademyPage c={c} change={change} /></main>
    </>
  );
  if (error)
    return (
      <div className="app-error">
        <Icon name="info" size={32} />
        <h1>Данные недоступны</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>
          Повторить загрузку
        </button>
      </div>
    );
  if (!data)
    return (
      <div className="app-loading">
        <span className="brand-symbol">
          <MetricGlyph name="brand" revision={c.page} size={27} />
        </span>
        <h1>Результаты пилота</h1>
        <p>
          <span className="spinner" />
          Загрузка проверенных агрегатов
        </p>
      </div>
    );
  return (
    <>
      <a className="skip-link" href="#main">
        Перейти к содержимому
      </a>
      <DashboardHeader c={c} change={change} />
      <main id="main" className={`app-main page-${c.page} section-${c.section} model-${c.modelView}`}>
        {c.section === "tb-tasks" ? (
          <TbTasksPage />
        ) : c.section !== "sales-model" ? (
          <section className="empty-presentation-section" aria-label="Раздел будет наполнен данными"><h1>{presentationSections.find(section => section.id === c.section)?.label}</h1><p>Материалы раздела пока не добавлены.</p></section>
        ) : c.modelView === "premises" ? (
          <SalesModelDeck slide={c.slide} onSlideChange={(slide) => change({ slide })}
            onPreviousSection={() => { const destination = adjacentPresentation(c, -1); if (destination) change(destination.patch); }}
            onNextSection={() => { const destination = adjacentPresentation(c, 1); if (destination) change(destination.patch); }} />
        ) : c.modelView === "next" ? (
          <NextStepsSlide />
        ) : c.page === "overview" ? (
          <Overview {...{ data, c, change, supplemental }} />
        ) : c.page === "analysis" ? (
          isSupplemental(c.metric) ? <>
            <AnalysisHeader {...{ data, c, change }} supplementalData={supplemental.data} />
            <SupplementalDetail load={supplemental} {...{ data, c, change }} />
          </> : <Analysis {...{ data, c, change }} />
        ) : (
          <MapPage {...{ data, c, change }} />
        )}
      </main>
      {c.section === "sales-model" && c.modelView === "results" && c.page !== "overview" && <footer className="app-footer">
        <span>2026 · Результаты пилота</span>
        <span>{isSupplemental(c.metric) ? "Месячные данные" : c.metric === "coverage" ? "С 1 апреля · накопительно" : `${quarters[c.quarter - 1]}${data.periods[c.quarter - 1].partial ? " · неполный период" : ""}`}</span>
        <button onClick={() => setMethod(true)}>
          Источники и правила расчёта <Icon name="arrow" size={13} />
        </button>
      </footer>}
      {method && <MethodDialog data={data} supplemental={supplemental} close={() => setMethod(false)} />}
    </>
  );
}

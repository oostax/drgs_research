import type { Context, Evidence, Group, Manifest, Metric, Role, Stat } from "./types";
export const defaults: Context = {
  section: "sales-model",
  modelView: "results",
  slide: 1,
  page: "overview",
  branch: "all",
  role: "all",
  group: "both",
  scope: "without",
  quarter: 3,
  metric: "sales",
};
export const roleNames = {
  all: "Все роли пилота",
  senior: "Старшая и руководитель",
  junior: "Младшая",
  akm: "АКМ",
};
export const metricNames: Record<Metric, string> = {
  sales: "Количество сделок",
  complex: "Сложные продукты",
  complexShare: "Доля сложных продуктов",
  meetings: "Количество встреч",
  coverage: "Покрытие клиентской базы",
  process: "Удовлетворённость процессом",
  leads: "Полезность лидов",
  appeals: "Обращения клиентов",
  payroll: "Объём ФОТ",
  recipients: "Получатели ФОТ",
};
/** Product eligibility is independent of source availability and comparison data. */
export const metricRoles: Record<Metric, readonly Exclude<Role, "all">[]> = {
  sales: ["senior", "junior"],
  complex: ["senior"],
  complexShare: ["senior"],
  meetings: ["senior", "junior"],
  coverage: ["senior", "junior"],
  process: ["senior", "junior", "akm"],
  leads: ["senior", "junior", "akm"],
  appeals: ["senior", "junior", "akm"],
  payroll: ["junior"],
  recipients: ["junior"],
};
export function metricsForRole(role: Role): Metric[] {
  return (Object.keys(metricNames) as Metric[]).filter(
    (metric) => role === "all" || metricRoles[metric].includes(role),
  );
}
export function availableMetrics(c: Context, data?: Manifest): Metric[] {
  // A nonpilot-only view has no pilot role filter. The map still shows both
  // groups when a branch is selected, so its group selector owns that scope.
  const branch = c.page !== "map" && data?.branches.find((b) => b.id === c.branch);
  const nonpilotOnly = c.group === "nonpilot" || (c.group === "both" && !!branch && !branch.pilot);
  const metrics = metricsForRole(nonpilotOnly ? "all" : c.role);
  // These sources cannot support the map's confirmed GOSB-level colour scale:
  // appeals are TB totals; payroll has incomplete client coverage.
  return c.page === 'map' ? metrics.filter(m => !['appeals', 'payroll', 'recipients'].includes(m)) : metrics;
}
export function normalizeMetricContext(c: Context, data?: Manifest): Context {
  const allowed = availableMetrics(c, data);
  return allowed.includes(c.metric) ? c : { ...c, metric: allowed[0] };
}
export const quarters = ["I квартал", "II квартал", "III квартал"];
export const groups: Group[] = ["pilot", "nonpilot"];
export const groupNames = { pilot: "Пилот", nonpilot: "Непилот · все роли" };
export function parseContext(search: string, data?: Manifest): Context {
  const p = new URLSearchParams(search);
  const valid = <T extends string>(
    key: string,
    allowed: readonly T[],
    fallback: T,
  ) => (allowed.includes(p.get(key) as T) ? (p.get(key) as T) : fallback);
  const branch = p.get("branch") || "all";
  return normalizeMetricContext({
    section: valid("section", ["title", "smo", "sales-model", "strategy", "academy", "tb-tasks"], "sales-model"),
    modelView: valid("modelView", ["premises", "results", "next"], "results"),
    slide: Math.max(1, Math.min(9, Number(p.get("slide") || 1))),
    page: valid("page", ["overview", "analysis", "map"], "overview"),
    branch:
      !data || branch === "all" || data.branches.some((b) => b.id === branch)
        ? branch
        : "all",
    role: valid("role", ["all", "senior", "junior", "akm"], "all"),
    group: valid("group", ["both", "pilot", "nonpilot"], "both"),
    scope: valid("scope", ["with", "without"], "without"),
    quarter: Number(valid("quarter", ["1", "2", "3"], "3")),
    metric: valid("metric", Object.keys(metricNames) as Metric[], "sales"),
    ...(p.has('appealMonth') ? { appealMonth: Number(valid('appealMonth', ['1','2','3','4','5','6','7','8'], '8')) } : {}),
    ...(p.has('appealBaseMonth') ? { appealBaseMonth: Number(valid('appealBaseMonth', ['1','2','3','4','5','6','7','8'], '7')) } : {}),
  }, data);
}
export function contextUrl(c: Context) {
  return (
    "?" +
    new URLSearchParams(
      Object.entries(c).map(([k, v]) => [k, String(v)]),
    ).toString()
  );
}
export function selectedGroups(data: Manifest, c: Context): Group[] {
  const b = data.branches.find((b) => b.id === c.branch);
  if (b && !b.pilot && c.group === "both") return ["nonpilot"];
  return c.group === "both" ? groups : [c.group];
}
export function view(data: Manifest, c: Context, group: Group) {
  const b = data.branches.find((b) => b.id === c.branch);
  const branch = b ? b.id : "all";
  return data.views[
    `${group}:${branch}:${group === "pilot" ? c.role : "all"}:${c.scope}`
  ];
}
export function value(
  data: Manifest,
  c: Context,
  group: Group,
  metric: Metric,
  q = c.quarter,
): Stat {
  const v = view(data, c, group);
  return metric === "coverage" ? v.coverage : v.periods[q - 1][metric];
}
export function format(n: number | null | undefined, metric?: Metric): string {
  if (n == null) return "—";
  const decimals =
    metric === "process" || metric === "leads" || metric === "coverage" || metric === "complexShare"
      ? 1
      : 0;
  return (
    new Intl.NumberFormat("ru-RU", {
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
    }).format(n) +
    (metric === "coverage" || metric === "complexShare"
      ? "%"
      : metric === "payroll"
        ? " ₽"
        : "")
  );
}
export function delta(
  current: Stat,
  previous: Stat,
  metric: Metric,
): { text: string; tone: string; value?: number; digits?: number; suffix?: string } | null {
  if (
    current.status !== "ready" ||
    previous.status !== "ready" ||
    current.assignedOnly || previous.assignedOnly ||
    current.value == null ||
    previous.value == null
  )
    return null;
  const diff = current.value - previous.value;
  const points = ["complexShare", "coverage", "process", "leads"].includes(
    metric,
  );
  if (!points && previous.value === 0)
    return diff === 0
      ? { text: "Без изменений", tone: "neutral" }
      : { text: "Нет базы сравнения", tone: "neutral" };
  const n = points ? diff : (diff / previous.value) * 100;
  return {
    value: n,
    digits: 1,
    suffix: points ? (metric === "process" || metric === "leads" ? " балла" : " п. п.") : "%",
    text: `${n > 0 ? "+" : ""}${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(n)}${points ? (metric === "process" || metric === "leads" ? " балла" : " п. п.") : "%"}`,
    tone: n > 0 ? "up" : n < 0 ? "down" : "neutral",
  };
}
export function statusText(s: Stat) {
  if (s.assignedOnly && s.value == null) return "Нет привязки";
  return s.status === "unverified"
    ? "На сверке"
    : s.status === "notApplicable"
      ? "Не применяется"
      : "Нет данных";
}
export function filterEvidence(rows: Evidence[], c: Context, search = "") {
  const needle = search.toLocaleLowerCase("ru").replace(/ё/g, "е").trim();
  return rows.filter((r) => {
    if (c.branch !== "all" && r.branch !== c.branch) return false;
    if (c.role !== "all" && r.role !== c.role) return false;
    if (c.metric === "complex" || c.metric === "complexShare") {
      if (r.role !== "senior" || !r.complex || r.fot) return false;
    }
    if (
      c.metric === "sales" &&
      (r.role === "akm" || (c.scope === "without" && r.fot))
    )
      return false;
    if (["meetings", "coverage"].includes(c.metric) && r.role === "akm")
      return false;
    if (r.quarter && r.quarter !== c.quarter) return false;
    return (
      !needle ||
      [r.id, r.name, r.inn, r.client, r.product, r.stage, r.source]
        .join(" ")
        .toLocaleLowerCase("ru")
        .replace(/ё/g, "е")
        .includes(needle)
    );
  });
}
const requests = new Map<string, Promise<Evidence[]>>();
export function loadEvidence(metric: Metric, quarter: number) {
  const filename = ["sales", "complex", "complexShare"].includes(metric)
    ? `offers-${quarter}`
    : ["meetings", "coverage"].includes(metric)
      ? "meetings"
      : ["process", "leads"].includes(metric)
        ? "surveys"
        : null;
  if (!filename) return Promise.resolve([]);
  if (!requests.has(filename))
    requests.set(
      filename,
      fetch(`/dashboard/${filename}.json.gz`)
        .then(async (r) => {
          if (!r.ok)
            throw new Error("Не удалось получить реестр. Повторите попытку.");
          const buffer = await r.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
            const stream = new Blob([buffer])
              .stream()
              .pipeThrough(new DecompressionStream("gzip"));
            return JSON.parse(await new Response(stream).text()) as Evidence[];
          }
          return JSON.parse(new TextDecoder().decode(bytes)) as Evidence[];
        })
        .catch((e) => {
          requests.delete(filename);
          throw e;
        }),
    );
  return requests.get(filename)!;
}

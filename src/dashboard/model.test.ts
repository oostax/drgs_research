import { describe, expect, it } from "vitest";
import fs from "node:fs";
import type { Evidence, Manifest, Stat } from "./types";
import {
  contextUrl,
  availableMetrics,
  metricsForRole,
  normalizeMetricContext,
  defaults,
  delta,
  filterEvidence,
  parseContext,
  selectedGroups,
  value,
  view,
} from "./model";
const data = JSON.parse(
  fs.readFileSync("public/dashboard/manifest.json", "utf8"),
) as Manifest;
const ready = (value: number): Stat => ({ value, status: "ready" });
describe("Матрица показателей по ролям", () => {
  it.each([
    ["akm", ["process", "leads", "appeals"]],
    ["senior", ["sales", "complex", "complexShare", "meetings", "coverage", "process", "leads", "appeals"]],
    ["junior", ["sales", "meetings", "coverage", "process", "leads", "appeals", "payroll", "recipients"]],
    ["all", ["sales", "complex", "complexShare", "meetings", "coverage", "process", "leads", "appeals", "payroll", "recipients"]],
  ] as const)("показывает точный набор для %s", (role, expected) => {
    expect(metricsForRole(role)).toEqual(expected);
    expect(availableMetrics({ ...defaults, role }, data)).toEqual(expected);
  });
  it.each(["overview", "analysis", "map"] as const)("исправляет несовместимую прямую ссылку на %s", (page) => {
    const c = parseContext(`?page=${page}&role=akm&metric=sales`, data);
    expect(c.metric).toBe("process");
    expect(parseContext(contextUrl(c), data)).toEqual(c);
  });
  it("сохраняет допустимый показатель и сбрасывает недопустимый при смене роли", () => {
    const c = { ...defaults, role: "akm" as const, metric: "leads" as const };
    expect(normalizeMetricContext(c, data)).toBe(c);
    expect(normalizeMetricContext({ ...c, metric: "complex" }, data).metric).toBe("process");
    expect(normalizeMetricContext({ ...c, role: "junior", metric: "complex" }, data).metric).toBe("sales");
    expect(normalizeMetricContext({ ...c, role: "senior", metric: "payroll" }, data).metric).toBe("sales");
  });
  it("не ограничивает непилот сохранённой ролью пилота", () => {
    expect(availableMetrics({ ...defaults, role: "akm", group: "nonpilot" }, data)).toEqual(metricsForRole("all"));
    const branch = data.branches.find((b) => !b.pilot)!;
    expect(branch).toBeTruthy();
    expect(availableMetrics({ ...defaults, role: "akm", branch: branch.id }, data)).toEqual(metricsForRole("all"));
    expect(availableMetrics({ ...defaults, page: "map", role: "akm", branch: branch.id }, data)).toEqual(["process", "leads"]);
  });
});
describe("Кварталы, группы и контексты", () => {
  it("сохраняет контекст между главной, анализом и картой", () => {
    const c = {
      ...defaults,
      branch: "9500",
      role: "junior" as const,
      scope: "with" as const,
      quarter: 2,
      metric: "meetings" as const,
    };
    for (const page of ["overview", "analysis", "map"] as const) {
      const parsed = parseContext(contextUrl({ ...c, page }), data);
      expect(parsed).toEqual({ ...c, page });
      expect(value(data, parsed, "pilot", "meetings")).toEqual(
        value(data, c, "pilot", "meetings"),
      );
    }
  });
  it("не применяет роль пилота к непилоту", () => {
    for (const role of ["all", "senior", "junior", "akm"] as const)
      expect(value(data, { ...defaults, role }, "nonpilot", "sales")).toEqual(
        value(data, defaults, "nonpilot", "sales"),
      );
  });
  it("включает сотрудников вне списка в непилот даже в пилотном ГОСБ", () => {
    expect(data.views["nonpilot:9500:all:without"].periods[2].sales.value).toBe(64);
    expect(selectedGroups(data, { ...defaults, branch: "9500" })).toEqual([
      "pilot", "nonpilot",
    ]);
    expect(selectedGroups(data, { ...defaults, branch: "9600" })).toEqual([
      "pilot", "nonpilot",
    ]);
    expect(value(data, { ...defaults, branch:"9500", group:"nonpilot" }, "nonpilot", "sales").value).toBe(64);
  });
  it("учитывает все отметки M без исключения Коми по кластеру", () => {
    expect(data.staff).toHaveLength(130);
    expect(data.staff.filter(s=>s.branch==="8617")).toHaveLength(4);
    expect(data.branches.filter(b=>b.pilot)).toHaveLength(23);
  });
  it("показывает известные привязки ГОСБ отдельно от нераспределённых предложений", () => {
    expect([1,2,3].map(q=>value(data, defaults, "nonpilot", "sales", q).value)).toEqual([22237,25843,24954]);
    const known = value(data, {...defaults,branch:"7003"}, "nonpilot", "sales", 1);
    expect(known.status).toBe("ready");
    expect(known.value).toBeGreaterThan(0);
    expect(known.assignedOnly).toBe(true);
    expect(value(data, {...defaults,branch:"9038"}, "nonpilot", "sales", 1)).toMatchObject({ value: null, status: "missing", assignedOnly: true });
    expect(delta(value(data, {...defaults,branch:"7003"}, "nonpilot", "sales", 3), known, "sales")).toBeNull();
    expect(delta(value(data,defaults,"nonpilot","sales",3),value(data,defaults,"nonpilot","sales",2),"sales")?.text).toBe("-3,4%");
  });
  it("сохраняет разные назначения СПб и Ленинградской области", () => {
    expect(data.staff.filter((s) => s.branch === "9500")).toHaveLength(15);
    expect(data.staff.filter((s) => s.branch === "9600")).toHaveLength(8);
  });
  it("не изменяет сложные продукты при добавлении ФОТ", () => {
    for (const b of ["all", "9500", "9600"])
      for (const q of [1, 2, 3])
        expect(
          value(
            data,
            { ...defaults, branch: b, scope: "with" },
            "pilot",
            "complexShare",
            q,
          ),
        ).toEqual(
          value(
            data,
            { ...defaults, branch: b, scope: "without" },
            "pilot",
            "complexShare",
            q,
          ),
        );
  });
  it("считает отсутствие сотрудника нулём встреч по подтвержденному правилу", () => {
    expect(value(data, defaults, "pilot", "meetings").status).toBe(
      "ready",
    );
    expect(value(data, defaults, "pilot", "meetings").value).toBe(6095);
    expect(value(data, defaults, "pilot", "coverage").status).toBe("ready");
    expect(value(data, defaults, "nonpilot", "coverage").status).toBe("ready");
    expect(data.views["nonpilot:all:all:without"].missingMeetingStaff).toEqual([]);
  });
  it("считает квартальные суммы встреч без повторов", () => {
    expect(
      [1, 2, 3].map(
        (q) => value(data, defaults, "pilot", "meetings", q).value,
      ),
    ).toEqual([6380, 7714, 6095]);
  });
  it("сохраняет отсутствующие источники и периоды неизвестными", () => {
    for (const metric of ["payroll", "appeals", "recipients"] as const)
      expect(value(data, defaults, "pilot", metric).value).toBeNull();
    expect(value(data, defaults, "pilot", "process", 1).value).toBeNull();
    expect(value(data, defaults, "nonpilot", "sales", 1).status).toBe(
      "ready",
    );
    expect(value(data, defaults, "nonpilot", "sales", 3).value).toBe(24954);
  });
  it("проверяет суммы портфеля и его детализации по всем контекстам", () => {
    for (const v of Object.values(data.views))
      for (const p of v.periods) {
        if (p.sales.value != null) {
          expect(Object.values(p.stages).reduce((a, b) => a + b, 0)).toBe(
            p.sales.value,
          );
          expect(p.products.reduce((a, b) => a + b.count, 0)).toBe(
            p.sales.value,
          );
        }
        if (p.complex.value != null) {
          expect(p.complexProducts.reduce((a, b) => a + b.count, 0)).toBe(
            p.complex.value,
          );
          expect(
            Object.values(p.complexStages).reduce((a, b) => a + b, 0),
          ).toBe(p.complex.value);
        }
      }
  });
  it("проверяет знаменатель доли в той же старшей роли", () => {
    for (const q of [1, 2, 3]) {
      const s = value(data, defaults, "pilot", "complexShare", q);
      expect(s.denominator).toBe(
        value(data, { ...defaults, role: "senior" }, "pilot", "sales", q).value,
      );
      expect(s.numerator).toBe(
        value(data, defaults, "pilot", "complex", q).value,
      );
    }
  });
  it("ограничивает неизвестные URL-параметры", () => {
    expect(parseContext("?quarter=99&role=chief&branch=bad", data)).toEqual(
      defaults,
    );
  });
});
describe("Безопасная интерпретация динамики", () => {
  it("не делит на ноль", () =>
    expect(delta(ready(10), ready(0), "sales")?.text).toBe(
      "Нет базы сравнения",
    ));
  it("не вычисляет динамику неопределённых итогов", () =>
    expect(
      delta(
        { value: null, status: "unverified", observed: 100 },
        ready(50),
        "meetings",
      ),
    ).toBeNull());
  it("считает изменения оценок в баллах", () =>
    expect(delta(ready(2.7), ready(2.5), "process")?.text).toBe("+0,2 балла"));
});
describe("Реестр пилота", () => {
  const rows = [
    {
      id: "1",
      employeeId: "10",
      name: "Пётр Иванов",
      branch: "9500",
      role: "senior",
      quarter: 3,
      product: "Овердрафт",
      complex: true,
      fot: false,
      source: "test.xlsx",
      sheet: "Лист1",
      row: 2,
    },
    {
      id: "2",
      employeeId: "11",
      name: "Пётр Иванов",
      branch: "9500",
      role: "junior",
      quarter: 3,
      product: "Овердрафт",
      complex: true,
      fot: false,
      source: "test.xlsx",
      sheet: "Лист1",
      row: 3,
    },
  ] as Evidence[];
  it("не включает младшую роль в реестр сложных продуктов", () =>
    expect(
      filterEvidence(rows, { ...defaults, metric: "complex" }),
    ).toHaveLength(1));
  it("нормализует ё при поиске", () =>
    expect(filterEvidence(rows, defaults, "петр")).toHaveLength(2));
  it("сохраняет квартал поиска", () =>
    expect(filterEvidence(rows, { ...defaults, quarter: 2 })).toHaveLength(0));
});

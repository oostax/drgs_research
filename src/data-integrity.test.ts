import { describe, expect, it } from "vitest";
import rawData from "./data/generated/analytics.json";
import type {
  AnalyticsDataset,
  AnalyticsViewKey,
  ComparisonKey,
  ManagerScope,
  SnapshotPeriod,
} from "./types";
import { buildDeepSignals, buildSignals } from "./lib/management";
import { normalizeManager } from "./lib/filters";

const data = rawData as unknown as AnalyticsDataset;
const comparisonKeys: ComparisonKey[] = ["Q1-Q2", "Q2-Q3", "Q1-Q3"];
const snapshotPeriods: SnapshotPeriod[] = ["Q1", "Q2", "Q3"];
const viewKeys = Object.keys(data.views) as AnalyticsViewKey[];

describe("фактический аналитический набор", () => {
  it("формирует шесть представлений и выбирает режим без ФОТ по умолчанию", () => {
    expect(viewKeys).toHaveLength(6);
    expect(data.defaultView).toBe("all:withoutFot");
    expect(data.views[data.defaultView].managerScope).toBe("all");
    expect(data.views[data.defaultView].productScope).toBe("withoutFot");
  });

  it("сверяется с исходными квартальными файлами", () => {
    const full = data.views["all:withFot"].snapshots;
    expect(full.Q1.total).toBe(249026);
    expect(full.Q2.total).toBe(194302);
    expect(full.Q3.total).toBe(203551);
  });

  it("сверяет контрольные итоги без ФОТ", () => {
    const withoutFot = data.views["all:withoutFot"].snapshots;
    expect(withoutFot.Q1.total).toBe(30839);
    expect(withoutFot.Q2.total).toBe(32949);
    expect(withoutFot.Q3.total).toBe(31556);
    for (const snapshot of Object.values(withoutFot)) {
      expect(snapshot.products.some(([name]) => name === data.fotProduct)).toBe(false);
    }
  });

  it("фиксирует 64 уникальных участника пилота", () => {
    expect(data.pilotManagers).toHaveLength(64);
    expect(new Set(data.pilotManagers.map(normalizeManager)).size).toBe(64);
    expect(data.july).toHaveLength(64);
  });

  it("пилот и непилот образуют полную выборку", () => {
    for (const productScope of ["withFot", "withoutFot"] as const) {
      const all = data.views[`all:${productScope}`].snapshots;
      const pilot = data.views[`pilot:${productScope}`].snapshots;
      const nonPilot = data.views[`nonPilot:${productScope}`].snapshots;
      for (const period of snapshotPeriods) {
        expect(pilot[period].total + nonPilot[period].total).toBe(all[period].total);
      }
    }
  });

  it.each(viewKeys)("%s: все три сравнения арифметически сходятся", (viewKey) => {
    const view = data.views[viewKey];
    for (const key of comparisonKeys) {
      const row = view.comparisons[key];
      expect(row.retainedCount + row.newCount).toBe(row.targetTotal);
      expect(row.retainedCount + row.goneCount).toBe(row.baseTotal);
      expect(row.targetTotal - row.baseTotal).toBe(row.net);
      expect(row.productContributions.reduce((sum, item) => sum + item.delta, 0)).toBe(row.net);
      expect(row.stageContributions.reduce((sum, item) => sum + item.delta, 0)).toBe(row.net);
      expect(row.registryCount).toBe(row.baseTotal + row.newCount);
      expect(row.registryUrl).toMatch(/\.json\.gz$/);
      const complex = row.complexDealMovement;
      expect(complex.targetCount - complex.baseCount).toBe(complex.net);
      expect(complex.baseCount - complex.exitedCount + complex.enteredCount).toBe(complex.targetCount);
      expect(complex.productContributions.reduce((sum, item) => sum + item.delta, 0)).toBe(complex.net);
      expect(complex.groupContributions.reduce((sum, item) => sum + item.delta, 0)).toBe(complex.net);
      expect(complex.progressed).toBeLessThanOrEqual(complex.retainedCount);
      expect(row.managerPerformance.reduce((sum, manager) => sum + manager.complexDealBefore, 0)).toBe(complex.baseCount);
      expect(row.managerPerformance.reduce((sum, manager) => sum + manager.complexDealAfter, 0)).toBe(complex.targetCount);
      for (const manager of row.managerPerformance) {
        expect(manager.complexDealAfter - manager.complexDealBefore).toBe(manager.complexDealDelta);
        expect(manager.complexDealProgressed).toBeLessThanOrEqual(manager.complexDealRetained);
      }
    }
  });

  it("считает сложные сделки по пяти бизнес-группам", () => {
    expect(data.complexDealGroups.map((group) => group.name)).toEqual([
      "Коммерческие кредиты",
      "Лизинг",
      "Факторинг",
      "Непокрытые аккредитивы",
      "КОРы",
    ]);
    expect(data.complexDealGroups.find((group) => group.name === "КОРы")?.products).toEqual([]);
    for (const view of Object.values(data.views)) {
      for (const snapshot of Object.values(view.snapshots)) {
        expect(snapshot.complexDeals.groups.reduce((sum, [, count]) => sum + count, 0)).toBe(snapshot.complexDeals.count);
        expect(snapshot.complexDeals.share).toBeCloseTo(snapshot.complexDeals.count / snapshot.total, 5);
      }
      for (const comparison of Object.values(view.comparisons)) {
        expect(comparison.complexDealMovement.baseCount).toBe(view.snapshots[comparison.base].complexDeals.count);
        expect(comparison.complexDealMovement.targetCount).toBe(view.snapshots[comparison.target].complexDeals.count);
      }
    }
  });

  it("каждый источник имеет контрольную сумму и происхождение", () => {
    expect(data.provenance).toHaveLength(5);
    for (const source of data.provenance) {
      expect(source.file).toMatch(/\.(xlsx|csv)$/);
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(source.rows).toBeGreaterThan(0);
    }
  });

  it("сверяет агрегат настроения КМ без ложной связи с ФИО", () => {
    expect(data.moodSurvey.invitations).toBe(951);
    expect(data.moodSurvey.responseRows).toBe(51);
    expect(data.moodSurvey.uniqueRespondents).toBe(37);
    expect(data.moodSurvey.completed).toBe(43);
    expect(data.moodSurvey.questions).toHaveLength(4);
    expect(data.moodSurvey.questions[0].distribution).toEqual({ "1": 3, "2": 7, "3": 41 });
    expect(data.moodSurvey.overallMean).toBeCloseTo(2.5161, 4);
    expect(data.moodSurvey.canMatchManagers).toBe(false);
  });

  it("разделяет лиды, сделки в работе и завершённые сделки", () => {
    for (const view of Object.values(data.views)) {
      for (const snapshot of Object.values(view.snapshots)) {
        expect(snapshot.funnel.leads + snapshot.funnel.activeDeals + snapshot.funnel.completedDeals).toBe(snapshot.total);
        expect(snapshot.funnel.allDeals).toBe(snapshot.funnel.activeDeals + snapshot.funnel.completedDeals);
        if (snapshot.total) {
          expect(snapshot.funnel.leadShare).toBeCloseTo(snapshot.funnel.leads / snapshot.total, 5);
        }
      }
    }
  });

  it("глубокие сигналы строятся из выбранного представления", () => {
    const view = data.views[data.defaultView];
    const row = view.comparisons["Q2-Q3"];
    const signals = buildDeepSignals(view, row);
    expect(signals.some((signal) => signal.id === "quality")).toBe(true);
    expect(signals.some((signal) => signal.id === "concentration")).toBe(true);
    expect(signals.every((signal) => signal.action && signal.explanation)).toBe(true);
  });

  it("метрики КМ содержат статус пилота и полный контекст", () => {
    const managers = data.views["all:withFot"].comparisons["Q1-Q2"].managerPerformance;
    expect(managers.length).toBeGreaterThan(300);
    expect(managers.some((manager) => manager.isPilot)).toBe(true);
    expect(managers.some((manager) => !manager.isPilot)).toBe(true);
    for (const manager of managers.slice(0, 20)) {
      expect(manager.leads + manager.activeDeals + manager.completedDeals).toBe(manager.after);
      expect(manager.topProducts.reduce((sum, [, count]) => sum + count, 0)).toBeLessThanOrEqual(manager.after);
    }
  });

  it("гипотезы явно отделены от фактов", () => {
    const view = data.views[data.defaultView];
    const signals = buildSignals(view, view.comparisons["Q2-Q3"]);
    expect(signals.some((signal) => signal.type === "Факт")).toBe(true);
    expect(signals.some((signal) => signal.type === "Вероятное объяснение")).toBe(true);
    expect(signals.every((signal) => signal.confidence && signal.action)).toBe(true);
  });
});

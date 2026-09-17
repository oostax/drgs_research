// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import App from "./App";
import rawData from "./data/generated/analytics.json";
import type { AnalyticsDataset } from "./types";
import { pctPlain } from "./lib/format";

const data = rawData as unknown as AnalyticsDataset;

afterEach(cleanup);

describe("глобальные фильтры аналитики", () => {
  it("открывается на всех КМ без ФОТ", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Все" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Без ФОТ" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByText(/30\s839/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/315 КМ/).length).toBeGreaterThan(0);
    expect(screen.getByText(/все продукты без ФОТ/)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Сложные продукты" })).toBeNull();
    const diagnostics = screen.getByRole("region", {
      name: "Контроль изменений в сохранённой базе",
    });
    expect(within(diagnostics).getByText(/2\s491/)).toBeTruthy();
    expect(within(diagnostics).queryByText(/2\s110/)).toBeNull();
    const flow = screen.getByLabelText("Состав изменения портфеля");
    expect(within(flow).getByText("Как изменился портфель")).toBeTruthy();
    expect(within(flow).getByText(/18\s631 · 60,4%/)).toBeTruthy();
    expect(within(flow).getByText(/405 · 2,2%/)).toBeTruthy();
    const executive = screen.getByRole("region", { name: "Резюме для руководителя" });
    expect(
      within(executive).getByRole("heading", {
        name: "Рост почти целиком определяет один продукт",
      }),
    ).toBeTruthy();
    expect(within(executive).getByText("95,1%")).toBeTruthy();
    expect(within(executive).getByText("Устойчив ли результат без продукта «Платежи за ЖКХ»?")).toBeTruthy();
  });

  it("пересчитывает всю страницу для пилота и режима с ФОТ", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Пилот" }));
    expect(screen.getAllByText(/64 КМ/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5\s608/).length).toBeGreaterThan(0);
    expect(
      within(
        screen.getByRole("region", {
          name: "Контроль изменений в сохранённой базе",
        }),
      ).getByText("377"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "С ФОТ" }));
    const pilotFull = data.views["pilot:withFot"].comparisons["Q1-Q2"];
    const formattedBaseTotal = new Intl.NumberFormat("ru-RU")
      .format(pilotFull.baseTotal)
      .replaceAll(" ", " ");
    expect(screen.getAllByText(formattedBaseTotal).length).toBeGreaterThan(0);
  });

  it("пересчитывает рейтинги КМ от глобальных фильтров", () => {
    const { container } = render(<App />);
    const highlights = () => container.querySelector(".manager-highlights")?.textContent;
    const allWithoutFot = highlights();

    fireEvent.click(screen.getByRole("button", { name: "Пилот" }));
    const pilotWithoutFot = highlights();
    expect(pilotWithoutFot).not.toBe(allWithoutFot);

    fireEvent.click(screen.getByRole("button", { name: "С ФОТ" }));
    const pilotWithFot = highlights();
    expect(pilotWithFot).not.toBe(pilotWithoutFot);

    fireEvent.click(screen.getByRole("button", { name: "Q2 → Q3" }));
    expect(highlights()).not.toBe(pilotWithFot);
  });

  it("сбрасывает выбранного КМ при смене состава", () => {
    render(<App />);
    expect(screen.getByText("Выберите КМ на карте или в списке")).toBeTruthy();
    const view = data.views["all:withoutFot"].comparisons["Q1-Q2"];
    const nonPilot = view.managerPerformance.find((manager) => !manager.isPilot)!;
    const picker = screen.getByLabelText("Выбрать клиентского менеджера");
    fireEvent.change(picker, { target: { value: nonPilot.name } });
    expect(screen.getByRole("heading", { name: nonPilot.name })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Пилот" }));
    expect(screen.queryByRole("heading", { name: nonPilot.name })).toBeNull();
    expect(screen.getByText("Выберите КМ на карте или в списке")).toBeTruthy();
  });

  it("перестраивает метрику КМ при смене продуктового режима", () => {
    const withoutRows = data.views["all:withoutFot"].comparisons["Q1-Q2"].managerPerformance;
    const withRows = data.views["all:withFot"].comparisons["Q1-Q2"].managerPerformance;
    const candidate = withoutRows.find((row) => {
      const full = withRows.find((item) => item.name === row.name);
      return (
        row.retained >= 30 &&
        Boolean(full && full.retained >= 30) &&
        Boolean(full && (full.delta !== row.delta || full.progressRate !== row.progressRate))
      );
    })!;
    const escapedName = candidate.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    render(<App />);
    const beforePoint = screen.getByRole("button", {
      name: new RegExp(`${escapedName}: изменение`),
    });
    const before = beforePoint.getAttribute("aria-label");

    fireEvent.click(screen.getByRole("button", { name: "С ФОТ" }));
    const afterPoint = screen.getByRole("button", {
      name: new RegExp(`${escapedName}: изменение`),
    });
    const after = afterPoint.getAttribute("aria-label");

    expect(after).not.toBe(before);
  });

  it("очищает поиск, карточку и выделение выбранного КМ", () => {
    render(<App />);
    const manager = data.views["all:withoutFot"].comparisons["Q1-Q2"].managerPerformance[0];
    const picker = screen.getByLabelText("Выбрать клиентского менеджера");
    fireEvent.change(picker, { target: { value: manager.name } });
    expect(screen.getByRole("heading", { name: manager.name })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Очистить" }));

    expect(screen.queryByRole("heading", { name: manager.name })).toBeNull();
    expect((picker as HTMLSelectElement).value).toBe("");
    expect(screen.getByText("Выберите КМ на карте или в списке")).toBeTruthy();
  });

  it("помещает КМ с нулевым продвижением в отдельную строку матрицы", () => {
    const manager = data.views["all:withoutFot"].comparisons["Q1-Q2"].managerPerformance.find(
      (row) => row.retained >= 30 && row.progressRate === 0,
    )!;
    const escapedName = manager.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    render(<App />);
    const point = screen.getByRole("button", {
      name: new RegExp(`${escapedName}: изменение`),
    });

    expect(point.closest("[data-progress-band]")?.getAttribute("data-progress-band")).toBe("zero");
  });

  it("показывает на карте всех КМ выбранного пилотного среза", () => {
    const comparison = data.views["pilot:withoutFot"].comparisons["Q2-Q3"];
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Q2 → Q3" }));
    fireEvent.click(screen.getByRole("button", { name: "Пилот" }));

    expect(comparison.managerPerformance).toHaveLength(64);
    expect(container.querySelectorAll("button.data-point")).toHaveLength(64);
    expect(screen.getByText("64 КМ на карте")).toBeTruthy();
    const complexManagers = comparison.managerPerformance.filter((row) => row.complexDealAfter > 0).length;
    expect(container.querySelectorAll("button.data-point.has-complex-deals")).toHaveLength(complexManagers);
    expect(screen.getByText(`${complexManagers} из 64 КМ`)).toBeTruthy();
    expect(screen.getByText(`${pctPlain((complexManagers / 64) * 100)} КМ`)).toBeTruthy();
    const ratioStrip = container.querySelector<HTMLElement>(".manager-ratios")!;
    const growth = comparison.managerPerformance.filter((row) => row.delta > 0).length;
    const progressed = comparison.managerPerformance.filter((row) => row.progressRate > 0).length;
    expect(ratioStrip.querySelectorAll("article")).toHaveLength(6);
    expect(within(ratioStrip).getByText(`${growth} из 64 КМ`)).toBeTruthy();
    expect(within(ratioStrip).getByText(`${progressed} из 64 КМ`)).toBeTruthy();
  });

  it("показывает полный выбранный разрез без короткого топа", () => {
    const { container } = render(<App />);
    const complexGroups = data.views["all:withoutFot"].comparisons["Q1-Q2"].complexDealMovement.groupContributions;
    expect(container.querySelectorAll("#driver-panel .contribution-row")).toHaveLength(complexGroups.length);

    fireEvent.click(screen.getByRole("tab", { name: /Продукты/ }));
    const products = data.views["all:withoutFot"].comparisons["Q1-Q2"].productContributions;
    expect(container.querySelectorAll("#driver-panel .contribution-row")).toHaveLength(products.length);
    expect(container.querySelectorAll("#driver-panel .contribution-row.is-complex").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("tab", { name: /Форматы/ }));
    const formats = data.views["all:withoutFot"].comparisons["Q1-Q2"].formatContributions;
    expect(container.querySelectorAll("#driver-panel .contribution-row")).toHaveLength(formats.length);
  });

  it("пересчитывает и выделяет сложные сделки в проводнике", () => {
    render(<App />);
    const spotlight = screen.getByRole("region", { name: "Сложные сделки" });
    expect(within(spotlight).getByText(/6\s126 → 5\s147/)).toBeTruthy();
    expect(within(spotlight).getByText("30% веса оценки")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Сложные сделки/ }).getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Пилот" }));
    expect(within(spotlight).getByText(/1\s183 → 933/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Q2 → Q3" }));
    expect(within(spotlight).getByText(/933 → 1\s078/)).toBeTruthy();
  });

  it("показывает настроение как независимый августовский срез", () => {
    render(<App />);
    const mood = screen.getByRole("region", { name: "Настроение КМ" });
    expect(within(mood).getByText("5,4%")).toBeTruthy();
    expect(within(mood).getByText("2,5")).toBeTruthy();
    expect(within(mood).getByText(/фильтры КМ и ФОТ не применяются/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Пилот" }));
    fireEvent.click(screen.getByRole("button", { name: "С ФОТ" }));
    expect(within(mood).getByText("5,4%")).toBeTruthy();
  });
});

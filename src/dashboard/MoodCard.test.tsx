import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import fs from "node:fs";
import { MoodCard, MoodGlyph } from "./MoodCard";
import { defaults } from "./model";
import type { Manifest } from "./types";

const data: Manifest = JSON.parse(fs.readFileSync("public/dashboard/manifest.json", "utf8"));
beforeEach(() => vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Удовлетворённость", () => {
  it("показывает абсолютные оценки обеих групп и четыре исходных вопроса", () => {
    const { container } = render(<MoodCard data={data} c={defaults} change={vi.fn()} />);
    const process = screen.getByRole("region", { name: "Процесс" });
    expect(within(process).getByText("2,7")).toBeTruthy();
    expect(within(process).queryByText("Непилот")).toBeNull();
    expect(Array.from(container.querySelectorAll(".sales-delta"), el => el.textContent)).toEqual(["+0,1", "+0,2", "-0,1"]);
    expect(within(screen.getByRole("region", { name: "Кампании продаж" })).getByText("Непилот")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Кампании продаж" })).toBeTruthy();
    expect(container.querySelectorAll(".mood-cell")).toHaveLength(24);
    expect(container.querySelectorAll(".mood-cell[data-empty=true]")).toHaveLength(8);
    expect(container.querySelector(".quarter-chart")).toBeNull();
    expect(screen.queryByText(/nastroenije/)).toBeNull();
  });
  it("квартальные кнопки меняют контекст, а не переводят на другую страницу", () => {
    const change = vi.fn();
    render(<MoodCard data={data} c={defaults} change={change} />);
    fireEvent.click(within(screen.getByRole("group", { name: "Квартал удовлетворённости" })).getByText("II кв."));
    expect(change).toHaveBeenCalledWith({ quarter: 2 });
  });
  it("первый квартал не превращает отсутствующие анкеты в нулевую оценку", () => {
    const { container } = render(<MoodCard data={data} c={{ ...defaults, quarter: 1 }} change={vi.fn()} />);
    expect(container.querySelectorAll(".sales-number")[0].textContent).toContain("—");
    expect(screen.getAllByText("Нет анкет")).toHaveLength(4);
  });
  it("недели используют настоящие анкеты, пустая неделя остаётся пустой", () => {
    const { container } = render(<MoodCard data={data} c={defaults} change={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Недели", exact: true }));
    expect(container.querySelectorAll(".mood-cell")).toHaveLength(80);
    expect(screen.getByText(/по дате создания анкеты/)).toBeTruthy();
    const weeks = data.views["pilot:all:all:without"].periods[2].survey!.weeks;
    const firstCell = container.querySelector<HTMLButtonElement>(".mood-cell")!;
    fireEvent.click(firstCell);
    const expected = weeks[0].process.value!.toFixed(1).replace(".", ",");
    expect(within(screen.getByRole("region", { name: "Процесс" })).getByText(expected)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Предыдущая неделя опроса" }).hasAttribute("disabled")).toBe(true);
  });
  it("АКМ входят в оценку, фильтр ФОТ не меняет анкеты", () => {
    const { rerender, container } = render(<MoodCard data={data} c={{ ...defaults, role: "akm", group: "pilot" }} change={vi.fn()} />);
    const numbers = Array.from(container.querySelectorAll(".sales-number"), n => n.textContent);
    expect(container.querySelectorAll(".mood-heatmap")).toHaveLength(1);
    rerender(<MoodCard data={data} c={{ ...defaults, role: "akm", group: "pilot", scope: "with" }} change={vi.fn()} />);
    expect(Array.from(container.querySelectorAll(".sales-number"), n => n.textContent)).toEqual(numbers);
  });
  it("иконка статична при reduced motion", () => {
    const { container } = render(<MoodGlyph />);
    expect(container.querySelector("animate")).toBeNull();
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });
});

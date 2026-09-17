import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import fs from "node:fs";
import { MeetingsCard, MeetingsGlyph } from "./MeetingsCard";
import { defaults } from "./model";
import type { Manifest } from "./types";

const data: Manifest = JSON.parse(fs.readFileSync("public/dashboard/manifest.json", "utf8"));
beforeEach(() => vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Встречи и покрытие", () => {
  it("останавливает цикл иконки и учитывает reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { container } = render(<MeetingsGlyph />);
    const button = screen.getByRole("button", { name: "Приостановить анимацию иконки встреч" });
    expect(container.querySelectorAll(".meetings-morph-path")).toHaveLength(4);
    expect(container.querySelectorAll("animate")).toHaveLength(4);
    for (const animation of container.querySelectorAll("animate")) {
      expect(animation.getAttribute("attributeName")).toBe("d");
      const topology = animation.getAttribute("values")!.split(";").map(d => d.replace(/[^A-Za-z]/g, ""));
      expect(new Set(topology).size).toBe(1);
    }
    expect(button.getAttribute("data-motion")).toBe("running");
    fireEvent.click(button);
    expect(button.getAttribute("data-motion")).toBe("paused");
    expect(button.getAttribute("aria-label")).toBe("Включить анимацию иконки встреч");
    fireEvent.click(button);
    expect(button.getAttribute("data-motion")).toBe("running");
  });
  it("оставляет статичную иконку при reduced motion", () => {
    render(<MeetingsGlyph />);
    expect(screen.getByRole("button").getAttribute("data-reduced")).toBe("true");
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });
  it("показывает обе группы, динамику и покрытие без пометок сверки", () => {
    const { container } = render(<MeetingsCard data={data} c={defaults} change={vi.fn()} />);
    expect(within(screen.getByRole("region", { name: "Пилот" })).getByText("6 095")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Непилот" })).getByText("10 613")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Пилот" }).querySelector(".sales-number")?.textContent).toBe("58");
    expect(screen.getByRole("region", { name: "Непилот" }).querySelector(".sales-number")?.textContent).toBe("28,3");
    expect(screen.getByText("· 105 КМ")).toBeTruthy();
    expect(screen.getByText("· 375 КМ")).toBeTruthy();
    expect(container.querySelectorAll(".sales-delta")).toHaveLength(2);
    expect(screen.getByText("-21%")).toBeTruthy();
    expect(screen.getByText("-31,3%")).toBeTruthy();
    expect(container.querySelectorAll(".meetings-point")).toHaveLength(6);
    expect(container.querySelectorAll(".meetings-line")).toHaveLength(2);
    expect(container.querySelectorAll(".sales-bars")).toHaveLength(0);
    expect(screen.getAllByRole("meter")).toHaveLength(2);
    expect(container.querySelector(".meetings-notes")).toBeNull();
    expect(container.querySelectorAll(".coverage-pending")).toHaveLength(0);
    expect(container.querySelectorAll("sup")).toHaveLength(0);
    expect(screen.queryByText("На сверке")).toBeNull();
  });
  it("меняет квартал на месте и сохраняет накопительный период покрытия", () => {
    const change = vi.fn();
    const { rerender } = render(<MeetingsCard data={data} c={defaults} change={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Выбрать II квартал" }));
    expect(change).toHaveBeenCalledWith({ quarter: 2 });
    rerender(<MeetingsCard data={data} c={{ ...defaults, quarter: 2 }} change={change} />);
    expect(within(screen.getByRole("region", { name: "Пилот" })).getByText("7 714")).toBeTruthy();
    expect(screen.getByText("с 1 апреля")).toBeTruthy();
    fireEvent.click(screen.getByRole("link", { name: "Открыть анализ покрытия" }));
    expect(change).toHaveBeenLastCalledWith({ page: "analysis", metric: "coverage" });
  });
  it("показывает подтвержденную динамику и покрытие, когда они есть в источнике", () => {
    const copy = structuredClone(data);
    const view = copy.views["pilot:all:all:without"];
    view.periods[1].meetings = { value: 100, status: "ready" };
    view.periods[2].meetings = { value: 120, status: "ready" };
    view.coverage = { value: 42.5, status: "ready", numerator: 85, denominator: 200 };
    const { container } = render(<MeetingsCard data={copy} c={{ ...defaults, group: "pilot" }} change={vi.fn()} />);
    expect(screen.getByText("+20%")).toBeTruthy();
    expect(screen.getByText("42,5%")).toBeTruthy();
    expect(screen.getByText("85 из 200 клиентов")).toBeTruthy();
    expect(container.querySelectorAll(".meetings-point")).toHaveLength(3);
    expect(screen.queryByRole("region", { name: "Непилот" })).toBeNull();
  });
  it("не подставляет ноль вместо отсутствующих встреч", () => {
    const copy = structuredClone(data);
    copy.views["nonpilot:all:all:without"].periods[2].meetings = { value: null, status: "missing" };
    const { container } = render(<MeetingsCard data={copy} c={{ ...defaults, group: "nonpilot" }} change={vi.fn()} />);
    expect(container.querySelector(".sales-number")?.textContent).toBe("—");
    expect(container.querySelectorAll(".meetings-point")).toHaveLength(2);
  });
  it("различает подтвержденный ноль и неизвестный итог", () => {
    const copy = structuredClone(data);
    copy.views["pilot:all:all:without"].periods[2].meetings = { value: 0, status: "ready" };
    const { container } = render(<MeetingsCard data={copy} c={{ ...defaults, group: "pilot" }} change={vi.fn()} />);
    expect(container.querySelector(".sales-number")?.textContent).toBe("0");
    expect(container.querySelectorAll(".meetings-point")).toHaveLength(3);
    expect(container.querySelector(".meetings-point.is-selected circle")?.getAttribute("cy")).toBe("140");
  });
  it("разрывает линию на неизвестном квартале и сохраняет шкалу покрытия 0–100", () => {
    const copy = structuredClone(data);
    copy.views["pilot:all:all:without"].periods[1].meetings = { value: null, status: "missing" };
    const { container } = render(<MeetingsCard data={copy} c={{ ...defaults, group: "pilot" }} change={vi.fn()} />);
    expect(container.querySelector(".meetings-line")?.getAttribute("d")?.match(/M/g)).toHaveLength(2);
    expect(container.querySelector(".meetings-line")?.getAttribute("d")).not.toContain("L");
    expect(screen.getByRole("meter").getAttribute("aria-valuemax")).toBe("100");
    expect(container.querySelectorAll(".meetings-point.is-selected")).toHaveLength(1);
  });
});

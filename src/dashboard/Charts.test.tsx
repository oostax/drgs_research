import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QuarterChart, AnimatedNumber } from "./Charts";
import { MetricGlyph } from "./Motion";
import type { Stat } from "./types";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete document.documentElement.dataset.input; });
const ready = (value: number): Stat => ({ value, status: "ready" });

describe("Читаемые графики", () => {
  it("в компактной карточке сохраняет все значения без повторной строки динамики", () => {
    render(<QuarterChart compact metric="sales" series={[{ group: "pilot", values: [ready(100), ready(120), ready(150)] }]} />);
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getByText("150")).toBeTruthy();
    expect(screen.queryByText("+25%")).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
  it("показывает числа и динамику всех кварталов без наведения", () => {
    const choose = vi.fn();
    render(<QuarterChart metric="sales" series={[{ group: "pilot", values: [ready(100), ready(120), ready(150)] }]} onQuarter={choose} />);
    expect(screen.getByText("100")).toBeTruthy();
    expect(screen.getByText("120")).toBeTruthy();
    expect(screen.getByText("150")).toBeTruthy();
    expect(screen.getByText("+20%")).toBeTruthy();
    expect(screen.getByText("+25%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Количество сделок: открыть II квартал" }));
    expect(choose).toHaveBeenCalledWith(2);
  });

  it("не выдаёт наблюдаемую часть встреч за подтверждённый итог", () => {
    render(<QuarterChart metric="meetings" series={[{ group: "pilot", values: [ready(100), { value: null, status: "unverified", observed: 120 }, { value: null, status: "missing" }] }]} />);
    expect(screen.getByText("120*")).toBeTruthy();
    expect(screen.getByText("Нет данных")).toBeTruthy();
    expect(screen.getByText(/Полный итог требует сверки/)).toBeTruthy();
    expect(screen.queryByText("+20%")).toBeNull();
  });

  it("показывает и количество, и долю сложных продуктов", () => {
    render(<QuarterChart metric="complex" series={[{ group: "pilot", values: [1, 2, 3].map(() => ({ ...ready(25), denominator: 100 })) }]} />);
    expect(screen.getAllByText("25")).toHaveLength(3);
    expect(screen.getAllByText("25%")).toHaveLength(3);
  });

  it("отключает SVG morph при reduced motion и клавиатурном вводе", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { container, rerender } = render(<MetricGlyph name="sales" />);
    expect(container.querySelector("animate")).toBeNull();
    document.documentElement.dataset.input = "keyboard";
    rerender(<MetricGlyph name="complex" />);
    expect(container.querySelector("animate")).toBeNull();
  });

  it("обновляет числа сразу при reduced motion", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const { rerender } = render(<AnimatedNumber stat={ready(100)} metric="sales" />);
    rerender(<AnimatedNumber stat={ready(200)} metric="sales" />);
    expect(screen.getByText("200")).toBeTruthy();
  });
});

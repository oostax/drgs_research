import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { WelcomePage } from "./WelcomePage";
import { DashboardHeader } from "./DashboardHeader";
import { defaults } from "./model";
import { adjacentPresentation } from "./presentationNavigation";
import App from "./App";
const context = { ...defaults, section: "title" as const };
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  Reflect.deleteProperty(document, "fonts");
  window.history.replaceState({}, "", "/");
});
describe("Приветствие квартальной встречи", () => {
  it("содержит заданный текст, крупный заголовок и одну кнопку продолжения", () => {
    render(<WelcomePage c={context} change={vi.fn()} />);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Осенняя квартальная встреча КИБ");
    expect(screen.getByText("Государственный сектор")).toBeTruthy();
    expect(screen.getByText("М.Л. Чачин")).toBeTruthy();
    expect(screen.getByText("2026")).toBeTruthy();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.queryByText("Все слайды")).toBeNull();
  });
  it("продолжает общую последовательность разделов", () => {
    const change = vi.fn(); render(<WelcomePage c={context} change={change} />);
    fireEvent.click(screen.getByRole("button", { name: "Далее: Кредитование СМО" }));
    expect(change).toHaveBeenCalledWith({ section: "smo", slide: 1 });
    expect(adjacentPresentation({ ...context, section: "smo" }, -1)?.label).toBe("Приветствие");
  });
  it("поддерживает клавиатуру и не переходит назад с приветствия", () => {
    const change = vi.fn(); render(<WelcomePage c={context} change={change} />);
    fireEvent.keyDown(window, { key: "ArrowLeft" }); expect(change).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "ArrowRight" }); expect(change).toHaveBeenCalledOnce();
  });
  it("переименовывает пункт меню без изменения URL и фильтров", () => {
    const change = vi.fn(); render(<DashboardHeader c={{ ...context, branch: "8610" }} change={change} />);
    const link = screen.getByRole("link", { name: "Приветствие" });
    expect(link.getAttribute("href")).toContain("section=title");
    expect(link.getAttribute("href")).toContain("branch=8610");
    expect(link.getAttribute("aria-current")).toBe("page");
    expect(screen.queryByText("Титульный лист")).toBeNull();
  });
  it("всегда открывает первый подпункт модели продаж из главной навигации", () => {
    const change = vi.fn();
    render(<DashboardHeader c={{ ...context, modelView: "results", slide: 7 }} change={change} />);
    fireEvent.click(screen.getByRole("link", { name: "Модель продаж" }));
    expect(change).toHaveBeenCalledWith({ section: "sales-model", modelView: "premises", slide: 1 });
  });
  it("не показывает текст до готовности всех начертаний", async () => {
    let release!: () => void;
    const font = new Promise<void>(r => { release = r; });
    const load = vi.fn(() => font.then(() => []));
    Object.defineProperty(document, "fonts", { configurable: true, value: { load, ready: Promise.resolve() } });
    render(<WelcomePage c={context} change={vi.fn()} />);
    expect(screen.getByRole("region", { name: "Приветствие" }).dataset.ready).toBe("false");
    expect(load).toHaveBeenCalledTimes(4);
    await act(async () => { release(); await font; });
    expect(screen.getByRole("region", { name: "Приветствие" }).dataset.ready).toBe("true");
  });
  it("показывает запасной шрифт, если файлы шрифта недоступны", async () => {
    Object.defineProperty(document, "fonts", { configurable: true, value: { load: () => Promise.reject(new Error("offline")), ready: Promise.resolve() } });
    render(<WelcomePage c={context} change={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("region", { name: "Приветствие" }).dataset.ready).toBe("true");
  });
  it("останавливает декоративное движение в неактивной вкладке", () => {
    render(<WelcomePage c={context} change={vi.fn()} />);
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.getByRole("region", { name: "Приветствие" }).dataset.motionPaused).toBe("true");
  });
  it("доступно независимо от ошибки загрузки аналитических данных", async () => {
    window.history.replaceState({}, "", "/?section=title");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unavailable")));
    render(<App />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Осенняя квартальная встреча КИБ");
    expect(document.title).toBe("Приветствие · Пульс");
    expect(screen.queryByText("Данные недоступны")).toBeNull();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { PresentationFrame } from "./PresentationFrame";

let width = 800, height = 500;
const observers: { callback: ResizeObserverCallback; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
beforeEach(() => {
  width = 800; height = 500; observers.length = 0;
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) { return this.classList.contains("deck-stage") ? width : 0; });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) { return this.classList.contains("deck-stage") ? height : 0; });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(700);
  vi.stubGlobal("ResizeObserver", class {
    observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
    constructor(public callback: ResizeObserverCallback) { observers.push(this); }
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); Reflect.deleteProperty(document, "fonts"); });
const frame = () => document.querySelector<HTMLElement>(".deck-stage")!;
const content = () => document.querySelector<HTMLElement>(".deck-fit-content")!;
const notify = () => act(() => observers[0].callback([], {} as ResizeObserver));
const show = () => render(<PresentationFrame slide={6}><div>Правила закрепления АКМ</div></PresentationFrame>);

describe("Стабильная компоновка до первого показа", () => {
  it("выполняет начальное вписывание синхронно, до показа", () => {
    show();
    expect(frame().dataset.fitReady).toBe("true");
    expect(content().style.visibility).toBe("visible");
    expect(Number(content().style.getPropertyValue("--slide-scale"))).toBeLessThan(1);
  });
  it("наблюдает внешний размер, а не результаты собственного измерения", () => {
    show();
    expect(observers[0].observe).toHaveBeenCalledTimes(1);
    expect(observers[0].observe).toHaveBeenCalledWith(frame());
  });
  it("не пересчитывает видимый слайд при повторном уведомлении тех же размеров", () => {
    show();
    const set = vi.spyOn(content().style, "setProperty");
    notify(); notify();
    expect(set).not.toHaveBeenCalled();
  });
  it("сразу пересчитывает при реальном изменении экрана", () => {
    show();
    const previous = content().style.getPropertyValue("--slide-scale");
    height = 350; width = 600; notify();
    expect(Number(content().style.getPropertyValue("--slide-scale"))).toBeLessThan(Number(previous));
    expect(frame().dataset.fitReady).toBe("true");
  });
  it("отключает наблюдение при уходе со слайда", () => {
    const view = show(); view.unmount();
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
  });
  it("ждёт все четыре начертания даже при оптимистичном fonts.check", async () => {
    let complete!: () => void;
    const loading = new Promise<void>(resolve => { complete = resolve; });
    const load = vi.fn(() => loading.then(() => []));
    Object.defineProperty(document, "fonts", { configurable: true, value: { check: () => true, load, ready: Promise.resolve() } });
    show();
    expect(frame().dataset.fitReady).toBe("false");
    expect(content().style.visibility).not.toBe("visible");
    expect(load).toHaveBeenCalledTimes(4);
    notify();
    expect(frame().dataset.fitReady).toBe("false");
    await act(async () => { complete(); await loading; });
    expect(frame().dataset.fitReady).toBe("true");
    const set = vi.spyOn(content().style, "setProperty");
    notify(); expect(set).not.toHaveBeenCalled();
  });
  it("не раскрывает слайд, пока повторный цикл раскладки шрифтов не завершён", async () => {
    let complete!: () => void;
    const ready = new Promise<void>(resolve => { complete = resolve; });
    const fonts = { status: "loading", ready };
    Object.defineProperty(document, "fonts", { configurable: true, value: fonts });
    show();
    expect(frame().dataset.fitReady).toBe("false");
    expect(content().style.visibility).not.toBe("visible");
    notify();
    expect(frame().dataset.fitReady).toBe("false");
    await act(async () => { fonts.status = "loaded"; complete(); await ready; });
    expect(frame().dataset.fitReady).toBe("true");
    expect(content().style.visibility).toBe("visible");
  });
  it("не меняет удалённый слайд после завершения загрузки шрифтов", async () => {
    let complete!: () => void;
    const ready = new Promise<void>(resolve => { complete = resolve; });
    const fonts = { status: "loading", ready };
    Object.defineProperty(document, "fonts", { configurable: true, value: fonts });
    const view = show();
    const oldFrame = frame();
    view.unmount();
    await act(async () => { fonts.status = "loaded"; complete(); await ready; });
    expect(oldFrame.dataset.fitReady).toBe("false");
  });
});

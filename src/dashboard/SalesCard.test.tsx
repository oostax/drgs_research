import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import fs from "node:fs";
import { SalesCard, SalesGlyph } from "./SalesCard";
import { defaults } from "./model";
import type { Manifest } from "./types";
const data: Manifest = JSON.parse(fs.readFileSync("public/dashboard/manifest.json", "utf8"));
beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
});

describe("Сложные продукты: количество и доля без ФОТ", () => {
  it("показывает обе группы, две динамики и кольца реальных долей", () => {
    const { container } = render(<SalesCard metric="complex" data={data} c={defaults} change={vi.fn()} />);
    expect(within(screen.getByRole("region", { name: "Пилот" })).getByText("1 302")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Непилот" })).getByText("3 945")).toBeTruthy();
    expect(screen.getByText("Старшая роль")).toBeTruthy();
    expect(screen.getByRole("region", {name:"Пилот"}).querySelector(".sales-number")?.textContent).toBe("15,5");
    expect(screen.getByRole("region", {name:"Непилот"}).querySelector(".sales-number")?.textContent).toBe("10,5");
    expect(screen.getByText("· 84 КМ")).toBeTruthy();
    expect(screen.getByText("· 375 КМ")).toBeTruthy();
    expect(screen.getByText("+12,6%")).toBeTruthy();
    expect(screen.getByText("+1,7 п. п.")).toBeTruthy();
    expect(container.querySelector('[aria-label="Доля пилота"] strong')?.textContent).toBe("22,4%");
    expect(container.querySelector('[aria-label="Доля непилота"] strong')?.textContent).toBe("15,8%");
    expect(container.querySelectorAll(".complex-bar-share")).toHaveLength(0);
    const rings = container.querySelectorAll(".complex-ring-fill");
    expect(rings).toHaveLength(2);
    expect(Number(rings[0].getAttribute("stroke-dashoffset"))).toBeCloseTo(100 - data.views["pilot:all:all:without"].periods[2].complexShare.value!, 6);
    expect(Number(rings[1].getAttribute("stroke-dashoffset"))).toBeCloseTo(100 - data.views["nonpilot:all:all:without"].periods[2].complexShare.value!, 6);
    expect(screen.getByRole("img", {name:"Пилот: 22,4%. Непилот: 15,8%"})).toBeTruthy();
    expect(container.querySelector(".sales-notes")).toBeNull();
  });
  it("переключает количество и долю синхронно, сохраняя квартал в ссылке анализа", () => {
    const change = vi.fn();
    const { rerender, container } = render(<SalesCard metric="complex" data={data} c={defaults} change={change} />);
    fireEvent.click(screen.getByRole("button", {name:"Выбрать II квартал"}));
    expect(change).toHaveBeenCalledWith({quarter:2});
    rerender(<SalesCard metric="complex" data={data} c={{...defaults, quarter:2}} change={change} />);
    expect(within(screen.getByRole("region", {name:"Пилот"})).getByText("1 156")).toBeTruthy();
    expect(container.querySelector('[aria-label="Доля пилота"] strong')?.textContent).toBe("20,7%");
    const link = screen.getByRole("link", {name:"Открыть анализ сложных продуктов"});
    const params = new URLSearchParams(link.getAttribute("href")!);
    expect(params.get("metric")).toBe("complex");
    expect(params.get("quarter")).toBe("2");
    fireEvent.click(link);
    expect(change).toHaveBeenLastCalledWith({page:"analysis", metric:"complex"});
  });
  it("не меняет знаменатель доли при глобальном включении ФОТ", () => {
    const { container, rerender } = render(<SalesCard metric="complex" data={data} c={defaults} change={vi.fn()} />);
    const before = container.querySelector(".sales-summary")!.textContent;
    rerender(<SalesCard metric="complex" data={data} c={{...defaults, scope:"with"}} change={vi.fn()} />);
    expect(container.querySelector(".sales-summary")!.textContent).toBe(before);
    expect(container.querySelector('[aria-label="Доля пилота"] strong')?.textContent).toBe("22,4%");
  });
  it("различает нулевые продажи и отсутствующий портфель", () => {
    const copy = structuredClone(data);
    const period = copy.views["pilot:all:all:without"].periods[2];
    period.complex = {value:0, status:"ready", denominator:0};
    period.complexShare = {value:null, status:"missing"};
    const { container } = render(<SalesCard metric="complex" data={copy} c={{...defaults, group:"pilot"}} change={vi.fn()} />);
    expect(container.querySelector(".sales-number")?.textContent).toBe("0");
    expect(container.querySelector(".funnel-absolute strong")?.textContent).toBe("0");
    expect(container.querySelector(".complex-ring-fill")).toBeNull();
    expect(container.querySelector('[aria-label="Доля пилота"] strong')?.textContent).toBe("—");
    expect(screen.queryByText("0%")).toBeNull();
  });
  it("не рисует цветную точку вместо нулевой доли и сохраняет один круг для одной группы", () => {
    const copy = structuredClone(data);
    copy.views["pilot:all:all:without"].periods[2].complexShare = {value:0, status:"ready"};
    const {container} = render(<SalesCard metric="complex" data={copy} c={{...defaults, group:"pilot"}} change={vi.fn()} />);
    expect(container.querySelectorAll(".complex-ring-track")).toHaveLength(1);
    expect(container.querySelectorAll(".complex-ring-fill")).toHaveLength(0);
    expect(screen.getByText("0%")).toBeTruthy();
  });
  it("показывает полное кольцо без серого остатка для доли 100%", () => {
    const copy = structuredClone(data);
    copy.views["pilot:all:all:without"].periods[2].complexShare = {value:100, status:"ready"};
    const {container} = render(<SalesCard metric="complex" data={copy} c={{...defaults, group:"pilot"}} change={vi.fn()} />);
    expect(container.querySelector(".complex-ring-track")).toBeNull();
    expect(container.querySelector(".complex-ring-fill")?.getAttribute("stroke-dashoffset")).toBe("0");
  });
  it("морфит слои и останавливает анимацию по нажатию", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { container } = render(<SalesGlyph complex />);
    const animations = container.querySelectorAll("animate");
    expect(animations).toHaveLength(3);
    expect(animations[0].getAttribute("dur")).toBe("4s");
    expect(new Set(animations[0].getAttribute("values")!.split(";")).size).toBe(3);
    expect(animations[0].getAttribute("values")!.split(";")[0]).not.toBe(animations[0].getAttribute("values")!.split(";")[2]);
    fireEvent.click(screen.getByRole("button", {name:"Приостановить анимацию иконки и колец сложных продуктов"}));
    expect(container.querySelector("animate")).toBeNull();
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("Новая карточка продаж", () => {
  it("последнее быстрое нажатие режима побеждает отложенный захват анимации", async () => {
    vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
    document.documentElement.dataset.input='pointer';
    const callbacks: Array<() => void> = [];
    const skip=vi.fn();
    const original=document.startViewTransition;
    Object.defineProperty(document,'startViewTransition',{configurable:true,value:vi.fn((callback:()=>void)=>{
      callbacks.push(callback);return {ready:Promise.resolve(),finished:new Promise<void>(()=>{}),skipTransition:skip};
    })});
    try {
      const {container}=render(<SalesCard data={data} c={defaults} change={vi.fn()} />);
      fireEvent.click(screen.getByRole('button',{name:'Недели'}));
      fireEvent.click(screen.getByRole('button',{name:'Кварталы'}));
      fireEvent.click(screen.getByRole('button',{name:'Недели'}));
      await act(async()=>{callbacks.forEach(callback=>callback());});
      expect(skip).toHaveBeenCalledTimes(2);
      expect(container.querySelector('.weekly-plot')).toBeTruthy();
      expect(container.querySelector('.sales-quarter')).toBeNull();
    } finally {Object.defineProperty(document,'startViewTransition',{configurable:true,value:original});}
  });
  it("заменяет квартальные столбцы недельными, не выдавая смену стадии за новые продажи", () => {
    const {container} = render(<SalesCard data={data} c={defaults} change={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", {name:"Недели"}));
    expect(container.querySelectorAll('.sales-quarter')).toHaveLength(0);
    expect(screen.getByText("По последней смене стадии · не новые продажи")).toBeTruthy();
    expect(screen.getByText("24.08–30.08")).toBeTruthy();
    expect(within(screen.getByRole("region", {name:"Пилот"})).getByText("306")).toBeTruthy();
    expect(container.querySelectorAll('.sales-delta')).toHaveLength(0);
    expect(container.querySelectorAll('.weekly-column')).toHaveLength(20);
    expect(container.querySelectorAll('.weekly-chart')).toHaveLength(2);
    expect(container.querySelectorAll('.weekly-value-pin')).toHaveLength(2);
    expect(screen.getByLabelText('Среднее полных недель: 225')).toBeTruthy();
    expect(within(screen.getByRole('region',{name:'Недельный график: Пилот'})).getByText('0–306')).toBeTruthy();
    expect(within(screen.getByRole('region',{name:'Недельный график: Непилот'})).getByText('0–1 016')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", {name:"Кварталы"}));
    expect(container.querySelectorAll('.sales-quarter')).toHaveLength(3);
    expect(container.querySelector('.weekly-plot')).toBeNull();
    expect(screen.getByText("+3,6%")).toBeTruthy();
  });
  it("синхронно выбирает обе группы мышью и стрелками, учитывает неполную неделю", () => {
    const {container} = render(<SalesCard data={data} c={defaults} change={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", {name:"Недели"}));
    const buttons = container.querySelectorAll<HTMLButtonElement>('.weekly-column');
    fireEvent.click(buttons[0]);
    expect(within(screen.getByRole("region", {name:"Пилот"})).getByText("80")).toBeTruthy();
    expect(screen.getByText("01.07–05.07 · неполная неделя")).toBeTruthy();
    fireEvent.keyDown(buttons[0], {key:"ArrowRight"});
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(buttons[1]);
    expect(within(screen.getByRole("region", {name:"Пилот"})).getByText("255")).toBeTruthy();
    fireEvent.keyDown(buttons[1], {key:"End"});
    expect(screen.getByText("31.08–31.08 · неполная неделя")).toBeTruthy();
    expect(within(screen.getByRole("region", {name:"Пилот"})).getByText("0")).toBeTruthy();
    expect(within(screen.getByRole("region", {name:"Непилот"})).getByText("0")).toBeTruthy();
    expect(screen.getByRole('button',{name:'Следующая неделя'}).hasAttribute('disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Предыдущая неделя'}));
    expect(screen.getByText('24.08–30.08')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Следующая неделя'}));
    expect(screen.getByText('31.08–31.08 · неполная неделя')).toBeTruthy();
  });
  it("убирает лишние подписи и сбрасывает выбранную неделю при смене среза", () => {
    const change=vi.fn();
    const {rerender,container}=render(<SalesCard data={data} c={defaults} change={change} />);
    fireEvent.click(screen.getByRole("button", {name:"Недели"}));
    expect(screen.queryByRole("button", {name:/До квартала Пилот/})).toBeNull();
    expect(container.querySelector('.weekly-scale')).toBeNull();
    expect(data.views['pilot:all:all:without'].periods[2].salesWeeks!.before).toBe(5489);
    fireEvent.click(container.querySelector('.weekly-column')!);
    fireEvent.click(screen.getByRole('button',{name:'II квартал'}));
    expect(change).toHaveBeenCalledWith({quarter:2});
    rerender(<SalesCard data={data} c={{...defaults,quarter:2,group:'pilot',role:'junior'}} change={change} />);
    expect(screen.getByRole('button',{name:'Недели'}).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('region',{name:'Непилот'})).toBeNull();
    expect(container.querySelectorAll('.weekly-column')).toHaveLength(14);
    const p=data.views['pilot:all:junior:without'].periods[1].salesWeeks!;
    const last=[...p.weeks].reverse().find(w=>!w.partial)!;
    expect(container.querySelector('.sales-number')?.textContent?.replace(/\s/g,'')).toBe(String(last.count));
  });
  it("показывает отсутствие разбивки, а не нули для заблокированного непилота", () => {
    const copy=structuredClone(data);
    const p=copy.views['nonpilot:all:all:without'].periods[2];
    delete p.salesWeeks;p.sales={value:null,status:'unverified'};
    const {container}=render(<SalesCard data={copy} c={{...defaults,group:'nonpilot'}} change={vi.fn()} />);
    fireEvent.click(screen.getByRole('button',{name:'Недели'}));
    expect(container.querySelector('.sales-number')?.textContent).toBe('—');
    expect(container.querySelectorAll('.weekly-fill')).toHaveLength(0);
    expect(screen.getByText('Недельная разбивка для этого среза недоступна.')).toBeTruthy();
  });
  it("не теряет предложения без даты и после даты среза", () => {
    const copy=structuredClone(data);
    const p=copy.views['pilot:all:all:without'].periods[2].salesWeeks!;
    p.undated=7;p.after=3;
    render(<SalesCard data={copy} c={{...defaults,group:'pilot'}} change={vi.fn()} />);
    fireEvent.click(screen.getByRole('button',{name:'Недели'}));
    fireEvent.click(screen.getByRole('button',{name:/Без даты Пилот 7/}));
    expect(within(screen.getByRole('region',{name:'Пилот'})).getByText('7')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:/После среза Пилот 3/}));
    expect(within(screen.getByRole('region',{name:'Пилот'})).getByText('3')).toBeTruthy();
  });
  it("показывает оба итога и все квартальные значения без наведения", () => {
    render(<SalesCard data={data} c={defaults} change={vi.fn()} />);
    expect(within(screen.getByRole("region", {name:"Пилот"})).getByText("7 365")).toBeTruthy();
    expect(within(screen.getByRole("region", {name:"Непилот"})).getByText("24 954")).toBeTruthy();
    expect(screen.getByText("+3,6%")).toBeTruthy();
    expect(screen.getByText("8 602")).toBeTruthy();
    expect(screen.getByText("7 106")).toBeTruthy();
    expect(screen.getByText("22 237")).toBeTruthy();
    expect(screen.getByText("25 843")).toBeTruthy();
    expect(screen.getByText("-3,4%")).toBeTruthy();
    expect(screen.queryByText("Непилот: I, II кв. — на сверке")).toBeNull();
    expect(screen.queryByText("Непилот сравнивается по всем ролям")).toBeNull();
  });
  it("переключает квартал внутри карточки без перехода со страницы", () => {
    const change = vi.fn();
    const { rerender } = render(<SalesCard data={data} c={defaults} change={change} />);
    fireEvent.click(screen.getByRole("button", {name:"Выбрать II квартал"}));
    expect(change).toHaveBeenCalledWith({quarter:2});
    rerender(<SalesCard data={data} c={{...defaults, quarter:2}} change={change} />);
    expect(screen.getByText("-17,4%")).toBeTruthy();
    expect(screen.getByRole("button", {name:"Выбрать II квартал"}).getAttribute("aria-pressed")).toBe("true");
    expect(within(screen.getByRole("region", {name:"Непилот"})).getByText("+16,2%")).toBeTruthy();
  });
  it("переходит в анализ с выбранным кварталом и ролью", () => {
    const change = vi.fn();
    render(<SalesCard data={data} c={{...defaults, quarter:2, role:"junior"}} change={change} />);
    const link = screen.getByRole("link", {name:"Открыть анализ продаж"});
    const params = new URLSearchParams(link.getAttribute("href")!);
    expect(params.get("quarter")).toBe("2");
    expect(params.get("role")).toBe("junior");
    expect(params.get("metric")).toBe("sales");
    fireEvent.click(link);
    expect(change).toHaveBeenCalledWith({page:"analysis", metric:"sales"});
  });
  it("не оставляет скрытую сравнительную серию в режиме только пилота", () => {
    render(<SalesCard data={data} c={{...defaults, group:"pilot"}} change={vi.fn()} />);
    expect(screen.queryByRole("region", {name:"Непилот"})).toBeNull();
    expect(screen.queryByText("24 954")).toBeNull();
  });
  it("не рисует нулевую продажу как отсутствующие данные", () => {
    const copy = structuredClone(data);
    copy.views["pilot:all:all:without"].periods[2].sales = {value:0, status:"ready"};
    render(<SalesCard data={copy} c={{...defaults, group:"pilot"}} change={vi.fn()} />);
    expect(screen.getAllByText("0")).toHaveLength(2);
    expect(screen.getByText("-100%")).toBeTruthy();
  });
  it("морфит реальные SVG-контуры и позволяет остановить движение", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    const { container } = render(<SalesGlyph />);
    const animations = container.querySelectorAll("animate");
    expect(container.innerHTML).toContain('attributeName="d"');
    expect(animations).toHaveLength(3);
    expect(animations[0].getAttribute("dur")).toBe("4s");
    expect(new Set(animations[0].getAttribute("values")!.split(";")).size).toBe(3);
    expect(animations[0].getAttribute("values")!.split(";")[0]).not.toBe(animations[0].getAttribute("values")!.split(";")[2]);
    fireEvent.click(screen.getByRole("button", {name:"Приостановить анимацию иконки и графика продаж"}));
    expect(container.querySelector("animate")).toBeNull();
    expect(container.querySelector(".sales-glyph")?.getAttribute("data-motion")).toBe("paused");
    fireEvent.click(screen.getByRole("button", {name:"Включить анимацию иконки и графика продаж"}));
    expect(container.querySelectorAll("animate")).toHaveLength(3);
    expect(container.querySelector(".sales-glyph")?.getAttribute("data-motion")).toBe("running");
  });
  it("уважает reduced motion", () => {
    const { container } = render(<SalesGlyph />);
    expect(container.querySelector("animate")).toBeNull();
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
    expect(container.querySelector(".sales-glyph")?.getAttribute("data-motion")).toBe("paused");
  });
});

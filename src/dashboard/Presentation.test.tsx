import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, act } from "@testing-library/react";
import { useState } from "react";
import { SalesModelDeck } from "./SalesModelDeck";
import { defaults, parseContext } from "./model";
import { adjacentPresentation, normalizeSlide } from "./presentationNavigation";
import { swipeDirection } from "./usePresentationInput";

afterEach(() => { cleanup(); vi.useRealTimers(); });
function Harness({ start = 1, next = vi.fn() }: { start?: number; next?: () => void }) {
  const [slide, setSlide] = useState(start);
  return <SalesModelDeck slide={slide} onSlideChange={setSlide} onNextSection={next}/>;
}

describe("Нормализация номера и порядок разделов", () => {
  it.each([[NaN,1], [Infinity,1], [-Infinity,1], [-2,1], [0,1], [1.8,1], [6.9,6], [8,8], [15,9]])("номер %s → %s", (input, expected) => {
    expect(normalizeSlide(input)).toBe(expected);
    expect(parseContext(`?slide=${input}`).slide).toBe(expected);
  });
  it("ведёт с последнего слайда к результатам, затем к дальнейшим шагам и стратдиалогу", () => {
    let c = { ...defaults, modelView: "premises" as const, slide: 9 };
    expect(adjacentPresentation(c,1)?.patch).toEqual({ modelView:"results",page:"overview" });
    expect(adjacentPresentation({ ...c,modelView:"results" },1)?.patch).toEqual({modelView:"next"});
    expect(adjacentPresentation({ ...c,modelView:"next" },1)?.patch).toEqual({section:"strategy",slide:1});
  });
  it("назад из результатов возвращает на девятый слайд", () => {
    expect(adjacentPresentation(defaults,-1)?.patch).toEqual({modelView:"premises",slide:9});
  });
  it("переходит между соседними разделами в обе стороны", () => {
    expect(adjacentPresentation({...defaults,section:"smo"},1)?.patch).toEqual({section:"sales-model",slide:1,modelView:"premises"});
    expect(adjacentPresentation({...defaults,section:"strategy"},-1)?.patch).toEqual({section:"sales-model",slide:1,modelView:"next"});
    expect(adjacentPresentation({...defaults,modelView:"next"},-1)?.patch).toEqual({modelView:"results",page:"overview"});
    expect(adjacentPresentation({...defaults,modelView:"premises"},-1)?.patch).toEqual({section:"smo",slide:1});
  });
  it("не зацикливает начало и конец презентации", () => {
    expect(adjacentPresentation({...defaults,section:"title"},-1)).toBeNull();
    expect(adjacentPresentation({...defaults,section:"tb-tasks"},1)).toBeNull();
  });
  it("не перезаписывает фильтры аналитики", () => {
    const c={...defaults,branch:"8610",quarter:2,group:"pilot" as const,role:"senior" as const};
    expect({...c,...adjacentPresentation(c,1)?.patch}).toMatchObject({branch:"8610",quarter:2,group:"pilot",role:"senior"});
  });
});

describe("Плеер без лишних кнопок", () => {
  it("не содержит оглавления, режима увеличения и паузы", () => {
    render(<Harness/>);
    expect(screen.queryByRole("button",{name:/Все слайды|Крупнее|Вписать|Пауза|анимацию|автопереключ/i})).toBeNull();
    fireEvent.keyDown(window,{key:"o"});
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("не переключает слайды автоматически", () => {
    vi.useFakeTimers();render(<Harness/>);
    act(()=>vi.advanceTimersByTime(60000));
    expect(document.querySelector(".deck-stage")?.getAttribute("data-slide")).toBe("1");
  });
  it("удаляет уходящий слайд после повторного рендера родителя", () => {
    vi.useFakeTimers();
    const {rerender}=render(<SalesModelDeck slide={1} onSlideChange={vi.fn()}/>);
    rerender(<SalesModelDeck slide={2} onSlideChange={vi.fn()}/>);
    expect(document.querySelectorAll(".deck-stage")).toHaveLength(2);
    rerender(<SalesModelDeck slide={2} onSlideChange={vi.fn()}/>);
    act(()=>vi.advanceTimersByTime(1500));
    expect(document.querySelectorAll(".deck-stage")).toHaveLength(1);
    expect(document.querySelector(".deck-stage")?.getAttribute("data-slide")).toBe("2");
  });
  it("быстрые клики не возвращают старый слайд", () => {
    vi.useFakeTimers();render(<Harness/>);
    fireEvent.click(screen.getByRole("button",{name:"Следующий слайд"}));
    fireEvent.click(screen.getByRole("button",{name:"Следующий слайд"}));
    fireEvent.click(screen.getByRole("button",{name:"Предыдущий слайд"}));
    act(()=>vi.advanceTimersByTime(1500));
    expect(document.querySelectorAll(".deck-stage")).toHaveLength(1);
    expect(document.querySelector(".deck-stage")?.getAttribute("data-slide")).toBe("2");
  });
  it("следующий раздел доступен после последнего слайда", () => {
    const next=vi.fn();render(<Harness start={9} next={next}/>);
    fireEvent.click(screen.getByRole("button",{name:"К результатам"}));
    expect(next).toHaveBeenCalledTimes(1);
  });
  it("поддерживает стрелки, PageUp/PageDown, Home/End", () => {
    render(<Harness/>);
    fireEvent.keyDown(window,{key:"End"});
    expect(document.querySelector(".deck-stage-enter")?.getAttribute("data-slide")).toBe("9");
    fireEvent.keyDown(window,{key:"PageUp"});
    expect(document.querySelector(".deck-stage-enter")?.getAttribute("data-slide")).toBe("8");
    fireEvent.keyDown(window,{key:"Home"});
    expect(document.querySelector(".deck-stage-enter")?.getAttribute("data-slide")).toBe("1");
    fireEvent.keyDown(window,{key:"ArrowRight"});
    expect(document.querySelector(".deck-stage-enter")?.getAttribute("data-slide")).toBe("2");
  });
  it("не перехватывает клавиши полей, ссылок и сочетаний браузера", () => {
    render(<><input aria-label="Поиск"/><a href="#test">Ссылка</a><Harness/></>);
    fireEvent.keyDown(screen.getByRole("textbox"),{key:"ArrowRight"});
    fireEvent.keyDown(screen.getByRole("link"),{key:"ArrowRight"});
    fireEvent.keyDown(window,{key:"ArrowRight",ctrlKey:true});
    fireEvent.keyDown(window,{key:"ArrowRight",repeat:true});
    expect(document.querySelectorAll(".deck-stage")).toHaveLength(1);
    expect(document.querySelector(".deck-stage")?.getAttribute("data-slide")).toBe("1");
  });
  it("очищает таймер при размонтировании", () => {
    // CSS visibility is covered by the browser suite; timer lifecycle is covered here.
    vi.useFakeTimers();const {unmount}=render(<Harness/>);
    fireEvent.click(screen.getByRole("button",{name:"Следующий слайд"}));
    unmount();act(()=>vi.advanceTimersByTime(1500));
    expect(document.querySelector(".deck-stage")).toBeNull();
  });
});

describe("Свайпы", () => {
  const start={x:200,y:300,at:0,width:390};
  it.each([[90,305,300,1],[310,305,300,-1],[180,300,300,0],[170,430,300,0],[80,300,1500,0]])("жест до (%s,%s) за %s мс → %s", (x,y,at,expected) => {
    expect(swipeDirection(start,x,y,at)).toBe(expected);
  });
  it("горизонтальный touch-жест переключает слайд", () => {
    render(<Harness/>);const stage=document.querySelector(".deck-stage-stack")!;
    fireEvent.touchStart(stage,{touches:[{clientX:220,clientY:300}]});
    fireEvent.touchMove(stage,{touches:[{clientX:130,clientY:305}]});
    fireEvent.touchEnd(stage,{touches:[],changedTouches:[{clientX:100,clientY:305}]});
    expect(document.querySelector(".deck-stage-enter")?.getAttribute("data-slide")).toBe("2");
  });
  it.each(["vertical","multitouch","edge","cancel"])("не переключает: %s", kind => {
    render(<Harness/>);const stage=document.querySelector(".deck-stage-stack")!;
    fireEvent.touchStart(stage,{touches:[{clientX:kind==='edge'?5:220,clientY:300}]});
    if(kind==='vertical') fireEvent.touchMove(stage,{touches:[{clientX:200,clientY:380}]});
    if(kind==='multitouch') fireEvent.touchMove(stage,{touches:[{clientX:180,clientY:300},{clientX:210,clientY:300}]});
    if(kind==='cancel') fireEvent.touchCancel(stage);
    fireEvent.touchEnd(stage,{touches:[],changedTouches:[{clientX:100,clientY:300}]});
    expect(document.querySelectorAll(".deck-stage")).toHaveLength(1);
    expect(document.querySelector(".deck-stage")?.getAttribute("data-slide")).toBe("1");
  });
});

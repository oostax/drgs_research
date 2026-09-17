import { useRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWeekPlayback } from "./useWeekPlayback";

function Harness({ advance, count=10 }: { advance: () => void; count?: number }) {
  const ref=useRef<HTMLDivElement>(null);
  const playback=useWeekPlayback(ref,advance,count);
  return <><article data-testid="card"><div ref={ref} /><button onClick={playback.toggle}>Пауза</button><output>{String(playback.running)}</output></article><button>Снаружи</button></>;
}
const tick=(ms:number)=>act(()=>{vi.advanceTimersByTime(ms);});
const pointer=(type:string,pointerType="mouse")=>{
  const event=new Event(type);Object.defineProperty(event,"pointerType",{value:pointerType});
  act(()=>{screen.getByTestId("card").dispatchEvent(event);});
};
beforeEach(()=>{
  vi.useFakeTimers();
  vi.stubGlobal("matchMedia",()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  vi.spyOn(document,"hidden","get").mockReturnValue(false);
  document.documentElement.dataset.input="pointer";
});
afterEach(()=>{cleanup();vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe("Автопереключение недель",()=>{
  it("шагает раз в 4 секунды и удаляет таймер при размонтировании",()=>{
    const advance=vi.fn();const {unmount}=render(<Harness advance={advance} />);
    tick(3999);expect(advance).not.toHaveBeenCalled();tick(1);expect(advance).toHaveBeenCalledTimes(1);
    tick(4000);expect(advance).toHaveBeenCalledTimes(2);
    unmount();tick(60000);expect(advance).toHaveBeenCalledTimes(2);
  });
  it("останавливается при наведении и ждёт ровно 30 секунд после ухода",()=>{
    const advance=vi.fn();render(<Harness advance={advance} />);
    tick(3000);pointer('pointerenter');tick(60000);expect(advance).not.toHaveBeenCalled();
    pointer('pointerleave');tick(29999);expect(advance).not.toHaveBeenCalled();tick(1);expect(advance).toHaveBeenCalledTimes(1);
    tick(4000);expect(advance).toHaveBeenCalledTimes(2);
  });
  it("повторное наведение начинает новый полный период ожидания",()=>{
    const advance=vi.fn();render(<Harness advance={advance} />);
    pointer('pointerenter');pointer('pointerleave');tick(20000);
    pointer('pointerenter');tick(15000);pointer('pointerleave');tick(29999);
    expect(advance).not.toHaveBeenCalled();tick(1);expect(advance).toHaveBeenCalledTimes(1);
  });
  it("касание откладывает автопереключение на 30 секунд",()=>{
    const advance=vi.fn();render(<Harness advance={advance} />);
    pointer('pointerenter','touch');pointer('pointerdown','touch');tick(29999);
    expect(advance).not.toHaveBeenCalled();tick(1);expect(advance).toHaveBeenCalledTimes(1);
  });
  it("ручная пауза не снимается уходом мыши",()=>{
    const advance=vi.fn();render(<Harness advance={advance} />);
    fireEvent.click(screen.getByText('Пауза'));pointer('pointerleave');tick(120000);
    expect(advance).not.toHaveBeenCalled();
  });
  it("не накапливает шаги в скрытой вкладке",()=>{
    const advance=vi.fn();render(<Harness advance={advance} />);
    vi.spyOn(document,'hidden','get').mockReturnValue(true);fireEvent(document,new Event('visibilitychange'));tick(60000);
    expect(advance).not.toHaveBeenCalled();
    vi.spyOn(document,'hidden','get').mockReturnValue(false);fireEvent(document,new Event('visibilitychange'));tick(29999);
    expect(advance).not.toHaveBeenCalled();tick(1);expect(advance).toHaveBeenCalledTimes(1);
  });
  it("не работает при reduced motion и при единственной неделе",()=>{
    const advance=vi.fn();vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
    const {unmount}=render(<Harness advance={advance} />);tick(60000);expect(advance).not.toHaveBeenCalled();unmount();
    vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
    render(<Harness advance={advance} count={1} />);tick(60000);expect(advance).not.toHaveBeenCalled();
  });
  it("останавливается на клавиатурном фокусе, после выхода ждёт 30 секунд",()=>{
    const advance=vi.fn();render(<Harness advance={advance} />);
    document.documentElement.dataset.input='keyboard';fireEvent.focusIn(screen.getByText('Пауза'));
    tick(60000);expect(advance).not.toHaveBeenCalled();
    fireEvent.focusOut(screen.getByText('Пауза'),{relatedTarget:screen.getByText('Снаружи')});tick(29999);
    expect(advance).not.toHaveBeenCalled();tick(1);expect(advance).toHaveBeenCalledTimes(1);
  });
  it("останавливается за пределами экрана",()=>{
    let observe:IntersectionObserverCallback=()=>{};
    vi.stubGlobal('IntersectionObserver',class { constructor(cb:IntersectionObserverCallback){observe=cb;} observe(){} disconnect(){} });
    const advance=vi.fn();render(<Harness advance={advance} />);
    act(()=>observe([{isIntersecting:false} as IntersectionObserverEntry],{} as IntersectionObserver));tick(60000);expect(advance).not.toHaveBeenCalled();
    act(()=>observe([{isIntersecting:true} as IntersectionObserverEntry],{} as IntersectionObserver));tick(29999);expect(advance).not.toHaveBeenCalled();
    tick(1);expect(advance).toHaveBeenCalledTimes(1);
  });
});

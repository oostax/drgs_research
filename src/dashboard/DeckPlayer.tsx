import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Icon } from './Icons';
import { PresentationIcon } from './PresentationIcon';
import { normalizeSlide, slideTitles, swipeDirection, transitionKind } from './presentationModel';

export type DeckProps = {
  slide: number;
  onSlideChange: (slide: number) => void;
  onNextSection?: () => void;
  onPreviousSection?: () => void;
};
type Transition = { from: number; to: number; kind: string };

/** Measure layout boxes, not animated transforms; resizing never feeds back into content width. */
function useSlideFit(slide: number) {
  const viewport = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const active = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const frame = viewport.current, surface = canvas.current, content = active.current;
    if (!frame || !surface || !content) return;
    let request = 0, disposed = false;
    const measure = () => {
      const available = frame.clientHeight;
      surface.style.setProperty('--deck-available-height', `${available}px`);
      const compact = window.matchMedia('(max-width: 900px)').matches;
      const height = Math.max(content.offsetHeight, 1);
      const scale = compact ? 1 : Math.min(1, frame.clientWidth / Math.max(surface.offsetWidth, 1), available / height);
      surface.style.setProperty('--deck-scale', String(scale));
      surface.style.setProperty('--deck-offset', `${compact ? 0 : Math.max(0, (available - height * scale) / 2)}px`);
    };
    const queue = () => { if (disposed) return; cancelAnimationFrame(request); request = requestAnimationFrame(measure); };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(queue);
    observer?.observe(frame);
    observer?.observe(content);
    window.addEventListener('resize', queue);
    document.fonts?.ready.then(queue);
    frame.scrollTop = 0;
    measure();
    return () => { disposed = true; observer?.disconnect(); cancelAnimationFrame(request); window.removeEventListener('resize', queue); };
  }, [slide]);
  return { viewport, canvas, active };
}

function SlideOverview({ slide, goTo, close }: { slide: number; goTo: (slide: number) => void; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { node?.close(); document.body.style.overflow = overflow; };
  }, []);
  return <dialog ref={dialog} className="deck-overview" aria-labelledby="deck-overview-title" onCancel={close} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <header><h2 id="deck-overview-title">Все слайды</h2><button autoFocus onClick={close} aria-label="Закрыть"><Icon name="close"/></button></header>
    <div>{slideTitles.map((title, index) => <button key={title} onClick={() => { goTo(index + 1); close(); }} aria-current={slide === index + 1 ? 'true' : undefined}><b>{String(index + 1).padStart(2, '0')}</b><span>{title}</span></button>)}</div>
  </dialog>;
}

export function DeckPlayer({ slide: rawSlide, onSlideChange, onNextSection, onPreviousSection, slides }: DeckProps & { slides: ReactNode[] }) {
  const slide = normalizeSlide(rawSlide), total = slideTitles.length;
  const [overview, setOverview] = useState(false);
  const [transition, setTransition] = useState<Transition | null>(null);
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  const [motion, setMotion] = useState(true);
  const [hidden, setHidden] = useState(document.hidden);
  const previousSlide = useRef(slide);
  const overviewTrigger = useRef<HTMLButtonElement>(null);
  const gesture = useRef<{ x: number; y: number; time: number; id: number } | null>(null);
  const { viewport, canvas, active } = useSlideFit(slide);
  const animate = motion && !reduceMotion;
  const goTo = useCallback((next: number) => {
    if (next > total) { onNextSection?.(); return; }
    if (next < 1) { onPreviousSection?.(); return; }
    const target = normalizeSlide(next);
    if (target !== slide) onSlideChange(target);
  }, [slide, total, onSlideChange, onNextSection, onPreviousSection]);
  const closeOverview = useCallback(() => {
    // End native modality before restoring focus; background controls are inert while open.
    overviewTrigger.current?.closest('.sales-deck')?.querySelector<HTMLDialogElement>('dialog[open]')?.close();
    setOverview(false);
    overviewTrigger.current?.focus();
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(media.matches);
    const visibility = () => setHidden(document.hidden);
    media.addEventListener('change', update);
    document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', update); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  useEffect(() => {
    const from = previousSlide.current;
    previousSlide.current = slide;
    if (from === slide || !animate) { setTransition(null); return; }
    setTransition({ from, to: slide, kind: transitionKind(from, slide) });
    // Do not depend on transition state: its render must not cancel this cleanup timer.
    const timer = window.setTimeout(() => setTransition(null), 1450);
    return () => window.clearTimeout(timer);
  }, [slide, animate]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
      if (overview || document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], nav, a, [role="slider"], [role="tab"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'PageDown') { event.preventDefault(); goTo(slide + 1); }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); goTo(slide - 1); }
      if (event.key.toLowerCase() === 'o' && !event.repeat) { event.preventDefault(); setOverview(true); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [slide, goTo, overview]);

  const currentTransition = transition?.to === slide ? transition : null;
  const kind = currentTransition?.kind;
  return <section className="sales-deck" aria-label="Презентация «Модель продаж»" data-slide={slide} data-motion={animate ? 'on' : 'off'} data-hidden={hidden || undefined}>
    <div className="deck-progress" aria-hidden="true"><i style={{ width: `${slide / total * 100}%` }}/></div>
    <p className="presentation-sr-only" aria-live="polite" aria-atomic="true">{slide} из {total}. {slideTitles[slide - 1]}</p>
    <div ref={viewport} className="deck-viewport" tabIndex={0} aria-label="Содержимое слайда. Свайп влево — далее, вправо — назад"
      onPointerDown={event => {
        if (event.pointerType !== 'touch' || !event.isPrimary || overview) { gesture.current = null; return; }
        if ((event.target as Element).closest('button,a,input,select,textarea,[data-no-swipe]')) return;
        // Leave system back/forward edge gestures and pinch zoom to the browser.
        if (event.clientX < 24 || event.clientX > window.innerWidth - 24) return;
        gesture.current = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
      }}
      onPointerCancel={() => { gesture.current = null; }}
      onPointerUp={event => {
        const start = gesture.current;
        gesture.current = null;
        if (!start || event.pointerId !== start.id || overview) return;
        const direction = swipeDirection(event.clientX - start.x, event.clientY - start.y, performance.now() - start.time);
        if (direction && !window.getSelection()?.toString()) goTo(slide + direction);
      }}>
      <div ref={canvas} className="deck-canvas">
        <div className={`deck-stage-stack ${currentTransition ? `is-transitioning is-${slide > currentTransition.from ? 'forward' : 'backward'} is-${kind}` : ''}`}>
          {currentTransition && <div className="deck-stage deck-stage-leave" aria-hidden="true" inert>{slides[currentTransition.from - 1]}</div>}
          <div ref={active} className={`deck-stage deck-stage-active ${currentTransition ? 'deck-stage-enter' : ''}`} key={slide} role="group" aria-roledescription="слайд" aria-label={`${slide} из ${total}. ${slideTitles[slide - 1]}`}>{slides[slide - 1]}</div>
          {kind === 'grid-wipe' && <div className="deck-grid-wipe" aria-hidden="true">{Array.from({ length: 32 }, (_, index) => <i style={{ '--grid-index': index } as CSSProperties} key={index}/>)}</div>}
          {kind === 'pyramid-zoom' && <div className="deck-zoom-flare" aria-hidden="true"/>}
          {kind === 'role-stack' && <div className="deck-role-wipe" aria-hidden="true">{[0, 1, 2, 3].map(index => <i style={{ '--role-band': index } as CSSProperties} key={index}/>)}</div>}
          {kind === 'collaboration' && <div className="deck-collaboration-wipe" aria-hidden="true"><i/><i/><b/></div>}
          {kind === 'radar-scan' && <div className="deck-radar-wipe" aria-hidden="true"><i/><b/></div>}
          {kind === 'standard' && <div className="deck-transition-flash" aria-hidden="true"/>}
        </div>
      </div>
    </div>
    <div className="deck-controls">
      <button className="deck-previous" aria-label={slide === 1 && onPreviousSection ? 'Предыдущий раздел: Кредитование СМО' : 'Предыдущий слайд'} disabled={slide === 1 && !onPreviousSection} onClick={() => goTo(slide - 1)} title="Назад"><Icon name="chevron" size={18}/></button>
      <div className="deck-dots" aria-label="Слайды">{slideTitles.map((title, index) => <button key={title} aria-label={`${index + 1}. ${title}`} title={title} aria-current={slide === index + 1 ? 'step' : undefined} onClick={() => goTo(index + 1)}/>)}</div>
      <button className="deck-next" aria-label={slide === total && onNextSection ? 'Следующий раздел: Результаты' : 'Следующий слайд'} disabled={slide === total && !onNextSection} onClick={() => goTo(slide + 1)} title={slide === total ? 'Перейти к результатам' : 'Далее'}>{slide === total && onNextSection && <span>Результаты</span>}<Icon name="chevron" size={18}/></button>
      <span className="deck-counter">{String(slide).padStart(2, '0')} / {String(total).padStart(2, '0')}</span>
      <button ref={overviewTrigger} className="deck-overview-button" onClick={() => setOverview(true)} aria-haspopup="dialog">Все слайды</button>
      <button className="deck-motion-button" aria-label={motion ? 'Приостановить анимацию' : 'Включить анимацию'} aria-pressed={!motion} onClick={() => setMotion(value => !value)} title={motion ? 'Приостановить анимацию' : 'Включить анимацию'}><PresentationIcon name={motion ? 'pause' : 'play'} size={18}/></button>
    </div>
    {overview && <SlideOverview slide={slide} goTo={goTo} close={closeOverview}/>}
  </section>;
}

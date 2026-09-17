import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import "./SalesModelDeck.css";
import "./PresentationResponsive.css";
import { PresentationFrame, usePresentationHeight } from "./PresentationFrame";
import { useReducedMotion } from "./Motion";
import { usePresentationInput } from "./usePresentationInput";
import { normalizeSlide, slideTitles as titles } from "./presentationNavigation";

type Props = {
  slide: number;
  onSlideChange: (slide: number) => void;
  onPreviousSection?: () => void;
  onNextSection?: () => void;
};

const LineIcon = ({ name }: { name: string }) => <span className="deck-icon"><Icon name={name} size={28} /></span>;
const ChangeLoopIcon = ({ name }: { name: "reset" | "sales" }) => <span className={`deck-icon change-loop-icon is-loop-${name}`} aria-hidden="true"><Icon name={name} size={32}/></span>;

const premiseHeadline = "Предпосылки изменений: зачем нужна новая модель?";

function TypewriterHeading() {
  let index = 0;
  return <h2 className="premise-typewriter" aria-label={premiseHeadline}>
    {premiseHeadline.split(/(\s+)/).map((word, wordIndex) => {
      if (/^\s+$/.test(word)) return word;
      return <span className="premise-typeword" key={`${word}-${wordIndex}`}>{[...word].map((letter) => {
        const delay = index++;
        return <span className="premise-typeletter" style={{ "--type-index": delay } as CSSProperties} key={`${letter}-${delay}`}>{letter}</span>;
      })}</span>;
    })}
    <i aria-hidden="true"/>
  </h2>;
}

const changesHeadline = "Суть изменений и ожидаемые результаты";
const questionHeadline = "Что меняем";

function WordRiseHeading() {
  return <h2 className="changes-word-rise" aria-label={changesHeadline}>
    {changesHeadline.split(/(\s+)/).map((word, index) => (
      /^\s+$/.test(word)
        ? word
        : <span className="changes-word" style={{ "--word-index": index } as CSSProperties} key={`${word}-${index}`}>{word}</span>
    ))}
  </h2>;
}

function QuestionHeading() {
  return <h2 className="question-heading" aria-label={questionHeadline}>
    {questionHeadline.split(/(\s+)/).map((word, index) => (
      /^\s+$/.test(word)
        ? word
        : <span className="question-word" style={{ "--question-word-index": index } as CSSProperties} key={`${word}-${index}`}>{word}</span>
    ))}
  </h2>;
}

function PremiseLoopIcon({ kind }: { kind: string }) {
  const name = kind === "analysis" ? "target" : kind === "complex" ? "meetings" : kind === "appeals" ? "filter" : "handshake";
  return <span className={`premise-loop-icon semantic-${kind}`} aria-hidden="true"><Icon name={name} size={32}/></span>;
}

function ControlOrbitIcon() {
  return <svg className="control-orbit-icon" viewBox="0 0 96 96" aria-hidden="true">
    <circle className="control-orbit-stroke" cx="48" cy="48" r="37"/>
    <path className="control-orbit-line" d="M27 34h42M27 48h42M27 62h42"/>
    <circle className="control-orbit-knob knob-one" cx="42" cy="34" r="5.5"/>
    <circle className="control-orbit-knob knob-two" cx="58" cy="48" r="5.5"/>
    <circle className="control-orbit-knob knob-three" cx="37" cy="62" r="5.5"/>
  </svg>;
}

const slides = [
  <div className="deck-cover" key="cover">
    <div className="cover-copy"><h1>Меняем модель продаж</h1></div>
    <div className="cover-media"><img src="/images/sales-model-road.png" alt="Извилистая дорога среди зелёных холмов и леса"/></div>
  </div>,
  <div className="deck-standard deck-premises" key="premises">
    <div className="premise-ambient" aria-hidden="true"><i/><i/><i/></div>
    <TypewriterHeading/>
    <div className="premise-grid">
      {[
        ["analysis", "Недостаточный фокус", "на значимых высокодоходных клиентах"],
        ["complex", "Низкая доля охвата", "закреплённой клиентской базы"],
        ["appeals", "Много «шума»", "в инструментах"],
        ["sales", "Отвлечение от продаж", "которые должны осуществлять смежные подразделения"],
      ].map(([icon, title, text]) => <article className="premise-item" key={title}><PremiseLoopIcon kind={icon}/><div><h3>{title}</h3><p>{text}</p></div></article>)}
    </div>
  </div>,
  <div className="deck-standard deck-changes" key="changes">
    <WordRiseHeading/>
    <div className="change-columns">
      <section><header><ChangeLoopIcon name="reset"/><h3>Что меняем</h3></header><ol>
        <li>Фокус КМ на значимых клиентах через перезакрепление</li><li>Ролевую модель КМ</li><li>Процессы взаимодействия со смежниками</li><li>Лидогенерацию</li><li>Мотивацию</li>
      </ol></section>
      <div className="change-current" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      <section><header><ChangeLoopIcon name="sales"/><h3>Наши ожидания</h3></header><ol>
        <li>Глубокое понимание потребностей клиентов, больше касаний и рост лояльности</li><li>Рост эффективности КМ через развитие экспертизы по направлениям</li><li>Продажи низкодоходным клиентам ГС без привлечения КМ РГС</li><li>Релевантные предложения разным группам клиентов</li><li>Рост удовлетворённости КМ</li>
      </ol></section>
    </div>
  </div>,
  <div className="deck-question" key="how"><div className="question-orbit" aria-hidden="true"><i className="question-ring ring-one"/><i className="question-ring ring-two"/><i className="question-ring ring-three"/><div className="question-core"><ControlOrbitIcon/></div></div><QuestionHeading/></div>,
  <div className="deck-standard deck-pyramid" key="pyramid">
    <h2>Перезакрепление клиентской базы</h2>
    <div className="pyramid-layout">
      <div className="pyramid-callouts pyramid-callouts-left">
        <article className="pyramid-note note-gkm"><b>ГКМ / СКМ</b><span>Высокодоходные клиенты</span></article>
        <article className="pyramid-note note-akm"><b>АКМ</b><span>Низкодоходные клиенты</span></article>
      </div>
      <div className="client-pyramid" aria-label="Пирамида закрепления клиентов">
        <svg className="pyramid-svg" viewBox="0 -70 600 690" role="img" aria-label="Четыре отдельных объёмных яруса: снизу АКМ, КМ / СКМ, ГКМ / СКМ и РКМ">
          <defs>
            <linearGradient id="pyramid-glass-left" x1="0" y1="0" x2="1" y2=".8"><stop stopColor="#d8f2e4"/><stop offset=".48" stopColor="#79c19e"/><stop offset="1" stopColor="#27825f"/></linearGradient>
            <linearGradient id="pyramid-glass-right" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#39a175"/><stop offset="1" stopColor="#11583d"/></linearGradient>
            <linearGradient id="pyramid-glass-top" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#14724f"/><stop offset="1" stopColor="#8ed1ae"/></linearGradient>
            <radialGradient id="pyramid-shadow"><stop stopColor="#176f4f" stopOpacity=".32"/><stop offset="1" stopColor="#176f4f" stopOpacity="0"/></radialGradient>
          </defs>
          <ellipse className="pyramid-ground-shadow" cx="300" cy="563" rx="274" ry="40" fill="url(#pyramid-shadow)"/>
          {[
            { name: "akm", top: "300,380 90,441 300,511 510,441", left: "90,441 300,511 300,582 32,494", right: "300,511 510,441 568,494 300,582", rim: "32,494 300,582 568,494" },
            { name: "km", top: "300,256 153,302 300,350 447,302", left: "153,302 300,350 300,461 97,393", right: "300,350 447,302 503,393 300,461", rim: "97,393 300,461 503,393" },
            { name: "gkm", top: "300,145 213,172 300,202 387,172", left: "213,172 300,202 300,303 161,257", right: "300,202 387,172 439,257 300,303", rim: "161,257 300,303 439,257" },
            { name: "rkm", left: "300,30 223,132 300,159", right: "300,30 377,132 300,159", rim: "223,132 300,159 377,132" },
          ].map(tier => <g key={tier.name} className={`pyramid-tier tier-${tier.name}`}>
            {tier.top && <polygon className="pyramid-face face-top" points={tier.top}/>}
            <polygon className="pyramid-face face-left" points={tier.left}/>
            <polygon className="pyramid-face face-right" points={tier.right}/>
            <polyline className="pyramid-rim" points={tier.rim}/>
          </g>)}
        </svg>
      </div>
      <div className="pyramid-callouts pyramid-callouts-right">
        <article className="pyramid-note note-rkm"><b>РКМ</b><span>Все клиенты РОИВ (клиенты A1 и B1), бизнес-активные клиенты, влияющие на принятие ключевых решений в отраслях, значимые силовые клиенты</span></article>
        <article className="pyramid-note note-km"><b>КМ / СКМ <small>(младшая роль)</small></b><span>Клиенты-бюджетники.<br/>Потенциал по ФОТ</span></article>
      </div>
    </div>
  </div>,
  <div className="deck-standard deck-table-slide" key="table">
    <h2>Новый порядок закрепления клиентской базы</h2>
    <div className="assignment-roles" role="list" aria-label="Правила закрепления по ролям">
      <article className="assignment-role" role="listitem">
        <header><b className="role-badge">РКМ</b><span className="role-limit">Макс: 30 ИНН</span><em>Решение: ТБ / ГОСБ</em></header>
        <div className="assignment-rule"><b>Закрепляем</b><p>GR и ключевые отраслевики: РОИВ (A1, B1), бизнес-активные и значимые силовые клиенты</p></div>
        <div className="assignment-rule assignment-rule-muted"><b>Не закрепляем</b><p>Низкодоходных</p></div>
      </article>
      <article className="assignment-role" role="listitem">
        <header><b className="role-badge">ГКМ / СКМ</b><span className="role-limit">130–250 ИНН</span></header>
        <div className="assignment-rule"><b>Закрепляем</b><p>Высокодоходные D1 (1 и 2 уровень значимости), потенциал по ФОТ, ОД больше 300 тыс. в год</p></div>
        <div className="assignment-rule assignment-rule-muted"><b>Не закрепляем</b><p>D1, D с ОД меньше 300 тыс., без потенциала ФОТ, без меток значимости</p></div>
      </article>
      <article className="assignment-role" role="listitem">
        <header><b className="role-badge">КМ / СКМ</b><span className="role-limit">250–750 ИНН</span></header>
        <div className="assignment-rule"><b>Закрепляем</b><p>Клиенты-бюджетники (с потенциалом по ФОТ, ОД больше 300 тыс.)</p></div>
        <div className="assignment-rule assignment-rule-muted"><b>Не закрепляем</b><p>—</p></div>
      </article>
      <article className="assignment-role" role="listitem">
        <header><b className="role-badge">АКМ</b></header>
        <div className="assignment-rule"><b>Закрепляем</b><p>Низкодоходные клиенты (ОД меньше 300 тыс.), без потенциала по ФОТ, без меток уровня значимости</p></div>
        <div className="assignment-rule assignment-rule-muted"><b>Не закрепляем</b><p>—</p></div>
      </article>
    </div>
    <p className="table-note"><Icon name="info" size={20}/> По силовым ведомствам территориальные управления могут быть закреплены за РКМ или ГКМ/СКМ, «юбка» — за ГКМ/СКМ/КМ, при этом вся «юбка» должна быть закреплена за одним ГКМ/СКМ/КМ. За АКМ могут быть закреплены только те клиенты силовых холдингов, которые имеют приоритет D и не имеют уровня значимости в соответствии с Контактной политикой.</p>
  </div>,
  <div className="deck-standard adjacent-slide" key="adjacent">
    <div className="adjacent-copy"><h2><span>Работа со</span><span>смежными</span><span>подразделениями</span></h2><p>Повышаем эффективность взаимодействия и качество клиентского сервиса через совместную работу и оптимизацию процессов.</p></div>
    <div className="adjacent-hub" aria-hidden="true"><i className="adjacent-orbit orbit-one"/><i className="adjacent-orbit orbit-two"/><LineIcon name="handshake"/><span className="adjacent-port port-top"/><span className="adjacent-port port-bottom"/></div>
    <div className="adjacent-actions">
      <article className="adjacent-action action-process"><LineIcon name="reset"/><div><b>01</b><h3>Пересмотр процессов<br/>взаимодействия</h3><p>по эквайрингу, ФОТ и ЦКР</p></div></article>
      <article className="adjacent-action action-outflow"><LineIcon name="outflow"/><div><b>02</b><h3>Изменение модели работы<br/>с оттоками ФОТ</h3></div></article>
    </div>
    <p className="adjacent-outcome"><Icon name="sales" size={24}/><span>Согласованные процессы и единые подходы с партнёрами помогают оперативнее решать задачи клиентов и достигать лучших результатов.</span></p>
  </div>,
  <div className="deck-standard campaign-slide" key="campaign">
    <h2>Компании продаж</h2>
    <div className="radar" aria-hidden="true"><i className="radar-ring ring-one"/><i className="radar-ring ring-two"/><i className="radar-ring ring-three"/><span className="radar-axis axis-x"/><span className="radar-axis axis-y"/><b className="radar-sweep"/><em className="radar-target target-one"/><em className="radar-target target-two"/><em className="radar-target target-three"/><strong><Icon name="sales" size={42}/></strong></div>
    <div className="campaign-goals">
      <article className="campaign-goal goal-quality"><LineIcon name="target"/><div><b>Точный сигнал</b><h3>Повышение качества лидогенерации</h3></div></article>
      <article className="campaign-goal goal-offer"><LineIcon name="offer"/><div><b>Точное действие</b><h3>Релевантное предложение для значимых клиентов</h3></div></article>
    </div>
  </div>,
  <div className="deck-pilot" key="pilot">
    <div className="pilot-heading">
      <h2>Проводим пилот</h2>
    </div>
    <div className="pilot-network" role="list" aria-label="Участники пилота">
      {["ВВБ","ПБ","СЗБ","СИБ","СРБ"].map((name,index)=><article key={name} role="listitem" style={{ "--pilot-index": index } as CSSProperties}>
        <span>{name}</span><i aria-hidden="true"/>
      </article>)}
    </div>
    <div className="pilot-scope"><Icon name="hierarchy" size={25}/><span>ГОСБ 1–3 категории</span></div>
  </div>,
];

export function SalesModelDeck({ slide: rawSlide, onSlideChange, onPreviousSection, onNextSection }: Props) {
  const slide = normalizeSlide(rawSlide);
  const total = slides.length;
  const root = useRef<HTMLElement>(null);
  usePresentationHeight(root);
  const reducedMotion = useReducedMotion();
  const [hidden, setHidden] = useState(() => document.hidden);
  const current = useRef(slide);
  const [renderedSlide, setRenderedSlide] = useState(slide);
  const [leavingSlide, setLeavingSlide] = useState<number | null>(null);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const goTo = (next: number) => {
    const target = normalizeSlide(next);
    if (target !== slide) onSlideChange(target);
  };
  const previous = () => slide > 1 ? goTo(slide - 1) : onPreviousSection?.();
  const next = () => slide < total ? goTo(slide + 1) : onNextSection?.();
  const gestures = usePresentationInput({ previous, next, first: () => goTo(1), last: () => goTo(total) });
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (slide === current.current) { if (reducedMotion) setLeavingSlide(null); return; }
    const old = current.current;
    current.current = slide;
    setDirection(slide > old ? "forward" : "backward");
    setLeavingSlide(reducedMotion ? null : old);
    setRenderedSlide(slide);
    // The rendered state must not be a dependency: it used to cancel its own cleanup timer.
    const timer = window.setTimeout(() => setLeavingSlide(null), 1450);
    return () => window.clearTimeout(timer);
  }, [slide, reducedMotion]);

  const isGridWipe = leavingSlide === 2 && renderedSlide === 3;
  const isIrisWipe = leavingSlide === 3 && renderedSlide === 4;
  const isPyramidZoom = leavingSlide === 4 && renderedSlide === 5;
  const isRoleStack = leavingSlide === 5 && renderedSlide === 6;
  const isCollaboration = leavingSlide === 6 && renderedSlide === 7;
  const isRadarScan = leavingSlide === 7 && renderedSlide === 8;
  return <section ref={root} className="sales-deck is-responsive" aria-label="Презентация «Модель продаж»" data-motion-paused={hidden || undefined}>
    <div className="deck-progress" aria-hidden="true"><i style={{ width: `${slide / total * 100}%` }}/></div>
    <div {...gestures} className={`deck-stage-stack ${leavingSlide !== null ? `is-transitioning is-${direction}` : ""} ${isGridWipe ? "is-grid-wipe" : ""} ${isIrisWipe ? "is-iris-wipe" : ""} ${isPyramidZoom ? "is-pyramid-zoom" : ""} ${isRoleStack ? "is-role-stack" : ""} ${isCollaboration ? "is-collaboration" : ""} ${isRadarScan ? "is-radar-scan" : ""}`}>
      {leavingSlide !== null && <PresentationFrame key={`leave-${leavingSlide}`} className="deck-stage-leave" hidden slide={leavingSlide}>{slides[leavingSlide - 1]}</PresentationFrame>}
      <PresentationFrame key={renderedSlide} className={leavingSlide !== null ? "deck-stage-enter" : ""} slide={renderedSlide}>{slides[renderedSlide - 1]}</PresentationFrame>
      {isGridWipe && <div className="deck-grid-wipe" aria-hidden="true">{Array.from({ length: 32 }, (_, index) => <i style={{ "--grid-index": index } as CSSProperties} key={index}/>)}</div>}
      {isPyramidZoom && <div className="deck-zoom-flare" aria-hidden="true"/>}
      {isRoleStack && <div className="deck-role-wipe" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <i style={{ "--role-band": index } as CSSProperties} key={index}/>)}</div>}
      {isCollaboration && <div className="deck-collaboration-wipe" aria-hidden="true"><i/><i/><b/></div>}
      {isRadarScan && <div className="deck-radar-wipe" aria-hidden="true"><i/><b/></div>}
      {leavingSlide !== null && !isGridWipe && !isIrisWipe && !isPyramidZoom && !isRoleStack && !isCollaboration && !isRadarScan && <div className="deck-transition-flash" aria-hidden="true"/>}
    </div>
    <div className="deck-controls" role="group" aria-label="Управление слайдами">
      <button className="deck-previous" aria-label={slide === 1 && onPreviousSection ? "Предыдущий раздел" : "Предыдущий слайд"} title={slide === 1 && onPreviousSection ? "К предыдущему разделу" : "Предыдущий слайд"} disabled={slide === 1 && !onPreviousSection} onClick={previous}><Icon name="chevron" size={20}/></button>
      <div className="deck-dots" aria-label="Слайды">{titles.map((title, index) => <button key={title} aria-label={`${index + 1}. ${title}`} title={title} aria-current={slide === index + 1 ? "step" : undefined} onClick={() => goTo(index + 1)}/>)}</div>
      <span className="deck-counter" aria-live="polite" aria-atomic="true"><span className="sr-only">Слайд </span>{String(slide).padStart(2,"0")} / {String(total).padStart(2,"0")}<span className="sr-only">. {titles[slide - 1]}</span></span>
      <button className="deck-next" aria-label={slide === total && onNextSection ? "К результатам" : "Следующий слайд"} title={slide === total && onNextSection ? "Далее: результаты" : "Следующий слайд"} disabled={slide === total && !onNextSection} onClick={next}><Icon name="chevron" size={20}/></button>
    </div>
  </section>;
}

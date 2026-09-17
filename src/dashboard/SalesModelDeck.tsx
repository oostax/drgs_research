import { type CSSProperties } from "react";
import { DeckPlayer, type DeckProps } from "./DeckPlayer";
import { Icon } from "./Icons";
import "./SalesModelDeck.css";

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
const questionHeadline = "Как меняем?";

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
  const marks = kind === "analysis" ? <><circle className="loop-mark mark-a" cx="16" cy="16" r="10"/><circle className="loop-mark mark-b" cx="16" cy="16" r="4"/><path className="loop-mark mark-c" d="M16 3v5m0 16v5M3 16h5m16 0h5"/></>
    : kind === "complex" ? <><circle className="loop-mark mark-a" cx="16" cy="11" r="4" pathLength="1"/><path className="loop-mark mark-b" pathLength="1" d="M7 27v-3a9 9 0 0 1 18 0v3"/><path className="loop-mark mark-c" pathLength="1" d="M4 7H2v18h2M28 7h2v18h-2"/></>
    : kind === "appeals" ? <><path className="loop-mark mark-a" pathLength="1" d="M6 12h5l7-6v20l-7-6H6Z"/><path className="loop-mark mark-b" d="M22 12a7 7 0 0 1 0 8m4-12a12 12 0 0 1 0 16"/></>
    : <><path className="loop-mark mark-a" pathLength="1" d="M9 27V6m-4 5 4-5 4 5M9 20h6a8 8 0 0 0 8-8V6"/><path className="loop-mark mark-b" pathLength="1" d="m19 10 4-4 4 4"/></>;
  return <span className={`premise-loop-icon is-${kind}`} aria-hidden="true"><svg viewBox="0 0 32 32">{marks}</svg></span>;
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
    <div className="cover-copy"><h1>Модель продаж</h1></div>
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
        <svg className="pyramid-svg" viewBox="0 -36 600 680" role="img" aria-label="Четыре отдельных объёмных яруса: снизу АКМ, КМ / СКМ, ГКМ / СКМ и РКМ">
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
      <article className="adjacent-action action-outflow"><LineIcon name="payroll"/><div><b>02</b><h3>Изменение модели работы<br/>с оттоками ФОТ</h3></div></article>
    </div>
    <p className="adjacent-outcome"><Icon name="sales" size={24}/><span>Согласованные процессы и единые подходы с партнёрами помогают оперативнее решать задачи клиентов и достигать лучших результатов.</span></p>
  </div>,
  <div className="deck-standard campaign-slide" key="campaign">
    <h2>Как меняем кампании продаж</h2>
    <div className="radar" aria-hidden="true"><i className="radar-ring ring-one"/><i className="radar-ring ring-two"/><i className="radar-ring ring-three"/><span className="radar-axis axis-x"/><span className="radar-axis axis-y"/><b className="radar-sweep"/><em className="radar-target target-one"/><em className="radar-target target-two"/><em className="radar-target target-three"/><strong><Icon name="sales" size={42}/></strong></div>
    <div className="campaign-goals">
      <article className="campaign-goal goal-quality"><LineIcon name="target"/><div><b>Точный сигнал</b><h3>Повышение качества лидогенерации</h3></div></article>
      <article className="campaign-goal goal-offer"><LineIcon name="offer"/><div><b>Точное действие</b><h3>Релевантное предложение для значимых клиентов</h3></div></article>
    </div>
  </div>,
  <div className="deck-pilot" key="pilot">
    <div className="pilot-heading">
      <span className="pilot-status"><i/>Пилот в работе</span>
      <h2>Проводится пилот</h2>
    </div>
    <div className="pilot-network" role="list" aria-label="Участники пилота">
      {["ВВБ","ПБ","СЗБ","СИБ","СРБ"].map((name,index)=><article key={name} role="listitem" style={{ "--pilot-index": index } as CSSProperties}>
        <span>{name}</span><i aria-hidden="true"/>
      </article>)}
    </div>
    <div className="pilot-scope"><Icon name="map" size={25}/><span>ГОСБ 1–3 категории</span></div>
  </div>,
];

export function SalesModelDeck(props: DeckProps) {
  return <DeckPlayer {...props} slides={slides}/>;
}

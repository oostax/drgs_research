import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { Context } from "./types";
import { usePresentationHeight } from "./PresentationFrame";
import { adjacentPresentation } from "./presentationNavigation";
import { usePresentationInput } from "./usePresentationInput";
import { normalizeAcademyView } from "./academyNavigation";
import "./AcademyPage.css";

const title = "Мы уже на той проблеме, о которой в банке ещё не говорят";
export const academyBanks = [
  { name: "ЦЧБ", bank: 4, client: 1 },
  { name: "Поволжский", bank: 3, client: 2 },
  { name: "Уральский", bank: 3, client: 1 },
  { name: "Северо-Западный", bank: 3, client: 1 },
  { name: "Московский", bank: 2, client: 1 },
  { name: "Юго-Западный", bank: 2, client: 0 },
  { name: "Среднерусский", bank: 2, client: 0 },
  { name: "Байкальский", bank: 2, client: 0 },
  { name: "Волго-Вятский", bank: 1, client: 0 },
  { name: "Дальневосточный", bank: 1, client: 0 },
  { name: "Сибирский", bank: 0, client: 0 },
];
const statistics = [
  ["29", "участников первого потока: 23 сотрудника банка и 6 первых лиц клиентов"],
  ["10 из 11", "территориальных банков представлены в программе"],
  ["6", "клиентов, у каждого свой проект и свой ИИ-агент в команде"],
  ["6 месяцев", "сентябрь 2026 — февраль 2027, два очных модуля и работа между ними"],
];
const media = {
  cohort: { src: "/academy/cohort.jpg", width: 1400, height: 483, alt: "Участники первого потока, очный модуль №1", caption: "Первый поток, очный модуль №1 — Москва, 7–8 сентября 2026" },
  report: { src: "/academy/report.jpg", width: 827, height: 1170, alt: "Итоговый отчёт Лаборатории нейронаук и поведения человека", caption: "Итоговый исследовательский отчёт по гибридному лидерству, июль 2026" },
};
type MediaKey = keyof typeof media;
let fontsReady = false;
let fontsPromise: Promise<void> | undefined;
function settleFonts() {
  if (!document.fonts || fontsReady) return Promise.resolve();
  return fontsPromise ??= Promise.all([400, 500, 600, 700].map(weight =>
    document.fonts.load(`${weight} 16px "Golos Text"`, "Академия гибридных лидеров").catch(() => []),
  )).then(() => document.fonts.ready).then(() => { fontsReady = true; });
}

function AcademyGlyph({ kind }: { kind: "research" | "practice" | "project" }) {
  return <svg className={`academy-glyph academy-glyph-${kind}`} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "research" ? <><circle cx="10" cy="10" r="6" /><path className="academy-icon-detail" d="m14.5 14.5 6 6M7 10h6M10 7v6" /></> : kind === "practice" ? <><path d="m12 3 9 5-9 5-9-5 9-5ZM6 10v7c4 3 8 3 12 0v-7" /><path className="academy-icon-detail" d="M21 8v8" /></> : <><rect x="3" y="7" width="18" height="14" rx="3" /><path className="academy-icon-detail" d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-8 7 3 3 5-5" /></>}
  </svg>;
}

function MediaDialog({ item, close }: { item: MediaKey; close: () => void }) {
  const image = media[item];
  return <div className="academy-dialog" role="dialog" aria-modal="true" aria-label={image.alt}
    onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div className="academy-dialog-content">
      <button className="academy-dialog-close" onClick={close} aria-label="Закрыть изображение" autoFocus>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
      <img {...{ src: image.src, alt: image.alt, width: image.width, height: image.height }} />
      <p>{image.caption}</p>
    </div>
  </div>;
}

function Essence({ open }: { open: (item: MediaKey) => void }) {
  return <div className="academy-essence">
    <section className="academy-card academy-practices" aria-labelledby="academy-practices-title">
      <div className="academy-block-heading"><p className="academy-label">что мы делаем</p><h2 id="academy-practices-title">Три вещи одновременно, и это не курс по нейросетям</h2></div>
      <div className="academy-practice" style={{ "--order": 0 } as CSSProperties}>
        <span className="academy-icon"><AcademyGlyph kind="research" /></span><h3>Исследуем</h3>
        <p>Совместно с Лабораторией нейронаук Курпатова оцениваем, как меняется качество управленческих решений в связке «человек + ИИ». Оценка строится на поведенческих данных — логах реальной работы, а не на самоотчётах участников.</p>
      </div>
      <div className="academy-practice" style={{ "--order": 1 } as CSSProperties}>
        <span className="academy-icon"><AcademyGlyph kind="practice" /></span><h3>Тренируем</h3>
        <div><p><b>Харды:</b> работа с галлюцинациями, контекстная инженерия, feedback-loops, вайб-кодинг, сборка ИИ-агентов и рабочих процессов, изучение лучших практик применения ИИ в ДРГС.</p><p><b>Софты:</b> работа в радикальной неопределённости, жизнестойкость, вертикальное лидерство.</p></div>
      </div>
      <div className="academy-practice" style={{ "--order": 2 } as CSSProperties}>
        <span className="academy-icon"><AcademyGlyph kind="project" /></span><h3>Реализуем</h3>
        <p>Каждая команда ведёт реальный трансформационный проект клиента: сотрудники банка, первое лицо клиента и ИИ-агент работают как одна команда. Шесть проектов, защита на финальном модуле.</p>
      </div>
    </section>
    <div className="academy-media">
      <figure className="academy-photo academy-card">
        <button onClick={() => open("cohort")} aria-label="Увеличить фото первого потока"><img src={media.cohort.src} alt={media.cohort.alt} width={1400} height={483} /></button>
        <figcaption>{media.cohort.caption}</figcaption>
      </figure>
      <figure className="academy-report academy-card">
        <button onClick={() => open("report")} aria-label="Увеличить обложку исследовательского отчёта">
          <img src={media.report.src} alt={media.report.alt} width={827} height={1170} />
          <span className="academy-report-zoom" aria-hidden="true"><img src={media.report.src} alt="" width={827} height={1170} /></span>
        </button>
        <figcaption><b>Лаборатория нейронаук<br />Андрея Курпатова</b><span>{media.report.caption}</span><small>нажмите — открыть крупнее</small></figcaption>
      </figure>
    </div>
  </div>;
}

function Results() {
  return <div className="academy-results">
    <div className="academy-stats">{statistics.map(([value, label], index) => <article className="academy-stat academy-card" key={label} style={{ "--order": index } as CSSProperties}><strong>{value}</strong><p>{label}</p></article>)}</div>
    <section className="academy-card academy-geography" aria-labelledby="academy-geography-title">
      <div className="academy-block-heading"><p className="academy-label">география первого потока</p><h2 id="academy-geography-title">Люди почти отовсюду, клиенты — из пяти территорий</h2></div>
      <table className="academy-table">
        <thead><tr><th scope="col">Тербанк</th><th scope="col">Банк</th><th scope="col">Клиент</th><th scope="col">Всего</th><th className="academy-bar-cell" aria-label="Состав участников" scope="col" /></tr></thead>
        <tbody>{academyBanks.map((row, index) => <tr key={row.name} className={row.bank + row.client === 0 ? "academy-zero" : undefined} style={{ "--order": index } as CSSProperties}>
          <th scope="row">{row.name}</th><td>{row.bank || "—"}</td><td>{row.client || "—"}</td><td><b>{row.bank + row.client}</b></td>
          <td className="academy-bar-cell"><span className="academy-bar" aria-hidden="true"><i style={{ width: `${row.bank * 20}%` }} /><i style={{ width: `${row.client * 20}%` }} /></span></td>
        </tr>)}</tbody>
        <tfoot><tr><th scope="row">Итого</th><td>23</td><td>6</td><td>29</td><td className="academy-bar-cell" /></tr></tfoot>
      </table>
      <div className="academy-legend"><span><i />сотрудники банка</span><span><i />первые лица клиентов</span></div>
    </section>
  </div>;
}

function Next() {
  return <section className="academy-next" aria-labelledby="academy-next-title">
    <div className="academy-next-ambient" aria-hidden="true"><i /><i /><i /></div>
    <div className="academy-next-copy"><p className="academy-label">Что нужно от вас</p><h2 id="academy-next-title">Из первого потока — в масштаб</h2>
      <p>Планируем масштабировать Академию вместе с территориальными банками: 5–10 клиентских программ в 2027 г.</p>
      <div className="academy-outcome">На выходе: рабочее решение задачи клиента и команда, готовая его внедрять</div>
    </div>
    <div className="academy-next-number"><strong>5–10</strong><p>клиентских программ<br />в 2027 году</p></div>
    <p className="academy-action">Ваш следующий шаг → дать позицию по готовности банка участвовать в 2027 году</p>
  </section>;
}

export function AcademyPage({ c, change }: { c: Context; change: (patch: Partial<Context>) => void }) {
  const root = useRef<HTMLElement>(null);
  const view = normalizeAcademyView(c.academyView);
  const [ready, setReady] = useState(() => fontsReady || !document.fonts);
  const [hidden, setHidden] = useState(() => document.hidden);
  const [zoom, setZoom] = useState<MediaKey | null>(null);
  usePresentationHeight(root);
  useLayoutEffect(() => { let disposed = false; void settleFonts().then(() => { if (!disposed) setReady(true); }); return () => { disposed = true; }; }, []);
  useEffect(() => { const update = () => setHidden(document.hidden); document.addEventListener("visibilitychange", update); return () => document.removeEventListener("visibilitychange", update); }, []);
  useEffect(() => { setZoom(null); }, [view]);
  const go = (direction: -1 | 1) => { const destination = adjacentPresentation(c, direction); if (destination) change(destination.patch); };
  const gestures = usePresentationInput({ previous: () => go(-1), next: () => go(1), keyboard: !zoom });
  return <section ref={root} className="academy-page" data-ready={ready} data-motion-paused={hidden || undefined} aria-label="Академия гибридных лидеров" aria-busy={!ready} {...gestures}>
    {view === "essence" && <header className="academy-hero">
      <div className="academy-hero-ambient" aria-hidden="true"><i /><i /><i /></div>
      <p className="academy-kicker">Академия гибридных лидеров. ДРГС совместно с лабораторией А. Курпатова·</p>
      <h1 aria-label={title}>{title.split(" ").map((word, index) => <Fragment key={index}><span className="academy-title-word" style={{ "--order": index } as CSSProperties} aria-hidden="true">{word}</span>{" "}</Fragment>)}</h1>
      <p className="academy-lead">Уверенность, которую даёт ИИ, — не правота. Машина производит скорость и гладкость решений, человек отвечает за их направление. Гибридное лидерство — навык удерживать эту разницу.</p>
    </header>}
    <div className="academy-view" key={view} data-view={view}>{view === "essence" ? <Essence open={setZoom} /> : view === "results" ? <Results /> : <Next />}</div>
    {zoom && <MediaDialog item={zoom} close={() => setZoom(null)} />}
  </section>;
}

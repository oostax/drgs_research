import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Context } from './types';
import { Icon } from './Icons';
import { contextUrl } from './model';
import { normalizeSmoView, smoViews, type SmoView } from './smoNavigation';
import './SmoCreditDashboard.css';

const SOURCE = '/smo/competitive-presentation.html';
let sourceRequest: Promise<string> | null = null;
function loadSource(): Promise<string> {
  if (!sourceRequest) sourceRequest = fetch(SOURCE).then(async response => {
    if (!response.ok) throw new Error('Исходный HTML ещё не опубликован в проекте.');
    const html = await response.text();
    if (!html.includes('id="payload"')) throw new Error('Вместо исходного дашборда сервер вернул другую страницу.');
    return html;
  }).catch((error: unknown) => { sourceRequest = null; throw error; });
  return sourceRequest;
}

export function SmoIcon({ view }: { view: SmoView }) {
  return <svg className={`smo-icon smo-icon-${view}`} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {view === 'intro' ? <><circle cx="12" cy="12" r="8"/><path className="smo-stroke smo-stroke-1" d="M12 7v10m-5-5h10"/></> : view === 'market' ? <><path d="M3 20h18"/><path className="smo-stroke smo-stroke-1" d="M6 16v-5"/><path className="smo-stroke smo-stroke-2" d="M12 16V7"/><path className="smo-stroke smo-stroke-3" d="M18 16V3"/></> : view === 'structure' ? <><path className="smo-stroke smo-stroke-1" d="M3 7h11m-3-3 3 3-3 3"/><path className="smo-stroke smo-stroke-2" d="M3 17h7m-3-3 3 3-3 3"/><rect className="smo-stroke smo-stroke-3" x="17" y="4" width="4" height="16" rx="2"/></> : <><path className="smo-stroke smo-stroke-1" d="m3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2Z"/><path d="M9 3v15m6-12v15"/><path className="smo-stroke smo-stroke-2" d="m7 12 3 2 6-5"/></>}
  </svg>;
}

export function SmoCreditNavigation({ c, change }: { c: Context; change: (patch: Partial<Context>) => void }) {
  const current = normalizeSmoView(c.smoView);
  return <div className="model-nav-shell smo-nav-shell"><nav className="model-navigation smo-navigation" aria-label="Подразделы кредитования СМО">
    {smoViews.map((item, index) => <a key={item.id} href={contextUrl({ ...c, section: 'smo', smoView: item.id })}
      style={{ '--item-index': index } as CSSProperties} aria-current={current === item.id ? 'page' : undefined}
      onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); change({ section: 'smo', smoView: item.id }); }}>
      <SmoIcon view={item.id}/><span className="model-step-label" data-short={item.short}>{item.label}</span>
    </a>)}
  </nav></div>;
}

function embeddedDocument(original: string, view: SmoView): string {
  // The shipped source is never rewritten. Adapt only the in-memory document.
  const base = `<base href="${window.location.origin}/">`;
  const style = '<link rel="stylesheet" href="/smo/pulse-theme.css">';
  const bridge = '<script src="/smo/pulse-bridge.js"></script>';
  return original.replace(/<head([^>]*)>/i, `<head$1>${base}`)
    .replace(/<\/head>/i, `${style}</head>`)
    .replace(/<body([^>]*)>/i, (_, attributes: string) => `<body${attributes.replace(/\sdata-theme=("[^"]*"|'[^']*')/i, '')} data-theme="light" data-smo-view="${view}" data-smo-embedded="true">`)
    .replace(/<\/body>/i, `${bridge}</body>`);
}

function SmoCover({ onOpen }: { onOpen: () => void }) {
  return <section className="smo-cover" aria-labelledby="smo-cover-title">
    <div className="smo-cover-copy">
      <p className="smo-cover-kicker">Сбер · регионы и муниципалитеты</p>
      <h1 id="smo-cover-title">Кредитование<br />СМО</h1>
      <p className="smo-cover-lead">Рынок, конкуренты и возможности роста в субъектах и муниципальных образованиях</p>
    </div>
    <div className="smo-cover-media"><img src="/images/smo-credit-cover.png" alt="Современный региональный город, набережная и мост" /></div>
    <button className="smo-cover-next" onClick={onOpen} aria-label="К материалам Кредитования СМО"><span>К материалам</span><span className="smo-cover-next-icon"><Icon name="arrow" size={22}/></span></button>
  </section>;
}

export function SmoCreditDashboard({ view, onViewChange }: { view: SmoView; onViewChange: (view: SmoView) => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const viewRef = useRef(view);
  const onViewRef = useRef(onViewChange);
  viewRef.current = view; onViewRef.current = onViewChange;
  const [documentHtml, setDocumentHtml] = useState('');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setError(''); setReady(false);
    loadSource().then(html => { if (active) setDocumentHtml(embeddedDocument(html, viewRef.current === 'intro' ? 'market' : viewRef.current)); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : 'Не удалось загрузить исходный дашборд.'); });
    return () => { active = false; };
  }, [retry]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow || event.data?.type !== 'smo:pulse') return;
      if (event.data.event === 'ready') {
        setReady(true);
        frame.current?.contentWindow?.postMessage({ type: 'pulse:smo', command: 'view', view: viewRef.current }, window.location.origin);
      } else if (event.data.event === 'view' && smoViews.some(item => item.id === event.data.view)) {
        if (viewRef.current !== event.data.view) onViewRef.current(event.data.view as SmoView);
      } else if (event.data.event === 'error') setError('Не удалось открыть содержимое исходного дашборда.');
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage({ type: 'pulse:smo', command: 'view', view: view === 'intro' ? 'market' : view }, window.location.origin);
  }, [view, ready]);
  useEffect(() => {
    if (!documentHtml || ready || error) return;
    const timeout = window.setTimeout(() => setError('Дашборд не завершил загрузку. Повторите открытие или используйте исходный HTML.'), 30000);
    return () => window.clearTimeout(timeout);
  }, [documentHtml, ready, error]);
  return <section className="smo-dashboard" aria-label="Кредитование СМО">
    {view === 'intro' && <div className="smo-cover-overlay"><SmoCover onOpen={() => onViewChange('market')} /></div>}
    <div className="smo-frame-shell" aria-busy={!ready && !error}>
      {!documentHtml && !error && <div className="smo-loading" role="status"><SmoIcon view={view}/><p>Загрузка данных кредитования</p><span>Карта, расчёты и подробные материалы</span></div>}
      {error && <div className="smo-load-error" role="alert"><h2>Материалы пока недоступны</h2><p>{error}</p><button onClick={() => { setDocumentHtml(''); setRetry(value => value + 1); }}>Повторить загрузку</button></div>}
      {documentHtml && <iframe ref={frame} className={`smo-frame is-visible${ready && !error ? ' is-ready' : ''}`} title="Кредитование СМО" srcDoc={documentHtml} sandbox="allow-scripts allow-same-origin allow-downloads allow-modals" />}
    </div>
  </section>;
}

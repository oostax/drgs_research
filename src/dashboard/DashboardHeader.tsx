import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import type { Context, SalesModelView } from './types';
import { contextUrl } from './model';
import { presentationSections, modelViews } from './presentationModel';
import { PresentationIcon } from './PresentationIcon';
import './DashboardHeader.css';

export function DashboardHeader({ c, change }: { c: Context; change: (patch: Partial<Context>) => void }) {
  const [hidden, setHidden] = useState(() => document.hidden);
  const header = useRef<HTMLElement>(null);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  useLayoutEffect(() => {
    const node = header.current;
    if (!node) return;
    const update = () => document.documentElement.style.setProperty('--presentation-header-height', `${node.offsetHeight}px`);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(node);
    window.addEventListener('resize', update);
    update();
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); };
  }, [c.section]);
  const navigate = (event: MouseEvent<HTMLAnchorElement>, patch: Partial<Context>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    change(patch);
  };
  const modelPatch = (modelView: SalesModelView): Partial<Context> => ({ modelView, slide: 1, ...(modelView === 'results' ? { page: 'overview' } : {}) });
  return <header ref={header} className="pulse-header" data-motion-paused={hidden || undefined}>
    <div className="presentation-nav-shell"><nav className="presentation-navigation" aria-label="Разделы презентации">
      {presentationSections.map(section => {
        const patch: Partial<Context> = { section: section.id, ...(section.id === 'sales-model' ? {} : { slide: 1 }) };
        return <a key={section.id} className="presentation-nav-link" aria-label={section.label} aria-current={c.section === section.id ? 'page' : undefined}
          href={contextUrl({ ...c, ...patch })} onClick={event => navigate(event, patch)}>
          <span className="presentation-nav-icon"><PresentationIcon name={section.id}/></span>
          <span className="presentation-nav-label" data-short={section.short}>{section.label}</span>
          <span className="presentation-nav-cue" aria-hidden="true"/>
        </a>;
      })}
    </nav></div>
    {c.section === 'sales-model' && <div className="model-nav-shell"><nav className="model-navigation" aria-label="Разделы модели продаж">
      {modelViews.map((view, index) => <a key={view.id} aria-label={view.label} aria-current={c.modelView === view.id ? 'page' : undefined}
        href={contextUrl({ ...c, ...modelPatch(view.id) })} onClick={event => navigate(event, modelPatch(view.id))}>
        <span className="model-step-number" aria-hidden="true">0{index + 1}</span>
        <PresentationIcon name={view.id} size={19}/>
        <span className="model-step-label" data-short={view.short}>{view.label}</span>
      </a>)}
    </nav></div>}
  </header>;
}

import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
import type { Context, PresentationSection } from "./types";
import { contextUrl } from "./model";
import { SmoCreditNavigation } from "./SmoCreditDashboard";
import "./DashboardHeader.css";
import "./PresentationHeader.css";
import { presentationSections as sections, salesModelViews as modelViews } from "./presentationNavigation";

function LucideLoopIcon({ name }: { name: PresentationSection }) {
  const content = name === "title" ? <>
    <rect className="lucide-part part-1" x="3" y="3" width="7" height="7" rx="1" />
    <rect className="lucide-part part-2" x="14" y="3" width="7" height="7" rx="1" />
    <rect className="lucide-part part-3" x="14" y="14" width="7" height="7" rx="1" />
    <rect className="lucide-part part-4" x="3" y="14" width="7" height="7" rx="1" />
  </> : name === "smo" ? <>
    <path className="lucide-part part-1" d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    <rect className="lucide-part part-2" width="20" height="14" x="2" y="6" rx="2" />
  </> : name === "sales-model" ? <>
    <polyline className="lucide-part part-1" points="22 7 13.5 15.5 8.5 10.5 2 17" />
    <polyline className="lucide-part part-2" points="16 7 22 7 22 13" />
  </> : name === "strategy" ? <>
    <path className="lucide-part part-1" d="M18 21c0-4.4-3.6-8-8-8s-8 3.6-8 8" />
    <path className="lucide-part part-2" d="M18 12c2.2-1.7 2.7-4.8 1-7-.4-.5-.9-1-1.4-1.3" />
    <path className="lucide-part part-3" d="M22 20c0-3.4-2-6.5-4-8" />
    <circle className="lucide-part part-4" cx="10" cy="8" r="5" />
  </> : name === "academy" ? <>
    <path className="lucide-part part-1" d="m2 9 10-5 10 5-10 5Z M6 11v6c4 3 8 3 12 0v-6" /><path className="lucide-part part-2" d="M22 9v8" />
  </> : <>
    <path className="lucide-part part-1" d="M11 6h10M11 12h10M11 18h10" /><path className="lucide-part part-2" d="m3 6 2 2 3-4m-5 8 2 2 3-4m-5 8 2 2 3-4" />
  </>;
  return <svg className={`lucide-loop-icon lucide-loop-${name}`} width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{content}</svg>;
}

export function DashboardHeader({ c, change }: { c: Context; change: (patch: Partial<Context>) => void }) {
  const [hidden, setHidden] = useState(() => document.hidden);
  useEffect(() => {
    const update = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  const navigate = (event: MouseEvent<HTMLAnchorElement>, patch: Partial<Context>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    change(patch);
  };

  return (
    <header className="pulse-header" data-motion-paused={hidden || undefined}>
      <div className="presentation-nav-shell">
        <nav className="presentation-navigation" aria-label="Разделы презентации">
          {sections.map((section) => (
            <a
              key={section.id}
              className="presentation-nav-link"
              aria-label={section.label}
              aria-current={c.section === section.id ? "page" : undefined}
              href={contextUrl({ ...c, section: section.id, ...(section.id === "sales-model" ? { modelView: "premises", slide: 1 } : { slide: 1 }) })}
              onClick={(event) => navigate(event, { section: section.id, ...(section.id === "sales-model" ? { modelView: "premises", slide: 1 } : { slide: 1 }) })}
            >
              <span className="presentation-nav-icon"><LucideLoopIcon name={section.id} /></span>
              <span className="presentation-nav-label" data-short={section.short}>{section.label}</span>
              <span className="presentation-nav-cue" aria-hidden="true" />
            </a>
          ))}
        </nav>
      </div>
      {c.section === "sales-model" && (
        <div className="model-nav-shell">
          <nav className="model-navigation" aria-label="Разделы модели продаж">
            {modelViews.map((view, index) => (
              <a
                key={view.id}
                style={{ "--item-index": index } as CSSProperties}
                aria-label={view.label}
                aria-current={c.modelView === view.id ? "page" : undefined}
                href={contextUrl({ ...c, modelView: view.id, ...(view.id === "premises" ? { slide: 1 } : view.id === "results" ? { page: "overview" as const } : {}) })}
                onClick={(event) => navigate(event, { modelView: view.id, ...(view.id === "premises" ? { slide: 1 } : view.id === "results" ? { page: "overview" as const } : {}) })}
              >
                <span className="model-step-number" aria-hidden="true">{String(index + 1).padStart(2,"0")}</span>
                <span className="model-step-label" data-short={view.short}>{view.label}</span>
              </a>
            ))}
          </nav>
        </div>
      )}
      {c.section === "smo" && <SmoCreditNavigation c={c} change={change} />}
    </header>
  );
}

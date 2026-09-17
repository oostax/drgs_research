import type { CSSProperties, MouseEvent } from "react";
import type { Context } from "./types";
import { contextUrl } from "./model";
import { academyViews, normalizeAcademyView } from "./academyNavigation";

export function AcademyNavigation({ c, change }: { c: Context; change: (patch: Partial<Context>) => void }) {
  const navigate = (event: MouseEvent<HTMLAnchorElement>, patch: Partial<Context>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    change(patch);
  };
  return <div className="model-nav-shell academy-nav-shell">
    <nav className="model-navigation" aria-label="Разделы Академии гибридных лидеров">
      {academyViews.map((view, index) => <a key={view.id}
        style={{ "--item-index": index } as CSSProperties}
        aria-label={view.label}
        aria-current={normalizeAcademyView(c.academyView) === view.id ? "page" : undefined}
        href={contextUrl({ ...c, academyView: view.id })}
        onClick={event => navigate(event, { academyView: view.id })}>
        <span className="model-step-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
        <span className="model-step-label" data-short={view.short}>{view.label}</span>
      </a>)}
    </nav>
  </div>;
}

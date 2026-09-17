"""Apply the SMO integration surgically; do not run tests or rebuild data."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
def replace(path: str, old: str, new: str) -> None:
    file = root / path
    text = file.read_text()
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f'Cannot locate integration point in {path}; original file was not changed')
    file.write_text(text.replace(old, new, 1))

replace('src/dashboard/types.ts', '  modelView: SalesModelView;', '  modelView: SalesModelView;\n  smoView?: import("./smoNavigation").SmoView;')
replace('src/dashboard/model.ts', '    modelView: valid("modelView", ["premises", "results", "next"], "results"),', '    modelView: valid("modelView", ["premises", "results", "next"], "results"),\n    smoView: valid("smoView", ["market", "structure", "risk"], "market"),')
replace('src/dashboard/App.tsx', 'import { CardAmbient } from "./CardAmbient";', 'import { SmoCreditDashboard } from "./SmoCreditDashboard";\nimport { normalizeSmoView } from "./smoNavigation";\nimport { CardAmbient } from "./CardAmbient";')
replace('src/dashboard/App.tsx', '(patch.modelView && patch.modelView !== c.modelView))', '(patch.modelView && patch.modelView !== c.modelView) || (patch.smoView && patch.smoView !== c.smoView))')
replace('src/dashboard/App.tsx', '  if (error)\n', '''  if (c.section === "smo") return (
    <>
      <a className="skip-link" href="#main">Перейти к содержимому</a>
      <DashboardHeader c={c} change={change} />
      <main id="main" className="app-main section-smo">
        <SmoCreditDashboard view={normalizeSmoView(c.smoView)} onViewChange={(smoView) => change({ smoView })} />
      </main>
      <PresentationSectionControls c={c} change={change} />
    </>
  );
  if (error)
''')
replace('src/dashboard/DashboardHeader.tsx', 'import { contextUrl } from "./model";', 'import { contextUrl } from "./model";\nimport { SmoCreditNavigation } from "./SmoCreditDashboard";')
replace('src/dashboard/DashboardHeader.tsx', '    </header>', '      {c.section === "smo" && <SmoCreditNavigation c={c} change={change} />}\n    </header>')
replace('src/dashboard/presentationNavigation.ts', 'import type { Context, PresentationSection, SalesModelView } from "./types";', 'import type { Context, PresentationSection, SalesModelView } from "./types";\nimport { normalizeSmoView, smoViews } from "./smoNavigation";')
replace('src/dashboard/presentationNavigation.ts', '  if (c.section === "sales-model") {', '''  if (c.section === "smo") {
    const index = smoViews.findIndex(item => item.id === normalizeSmoView(c.smoView));
    const destination = smoViews[index + direction];
    if (destination) return { label: destination.label, patch: { smoView: destination.id } };
  }
  if (c.section === "sales-model") {''')
replace('src/dashboard/presentationNavigation.ts', 'patch: { section: section.id, slide: 1,', 'patch: { section: section.id, slide: 1, ...(section.id === "smo" ? { smoView: direction === 1 ? "market" : "risk" } as const : {}),')

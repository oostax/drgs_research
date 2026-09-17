from pathlib import Path
import hashlib

def blob(text):
    b=text.encode()
    return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def apply(path, before, after, transform):
    p=Path(path); old=p.read_text()
    if blob(old)==after: return
    assert blob(old)==before, f'{path}: source changed; refusing to overwrite'
    new=transform(old)
    assert blob(new)==after, f'{path}: integration did not match tested source'
    p.write_text(new)

def app(s):
    s=s.replace("import { SalesModelDeck } from './SalesModelDeck';", "import { SalesModelDeck } from './SalesModelDeck';\nimport { PresentationFlow, PresentationPlaceholder } from './PresentationFlow';\nimport { adjacentSection } from './presentationModel';")
    s=s.replace('if (patch.page && patch.page !== c.page)', 'if ((patch.page && patch.page !== c.page) || (patch.section && patch.section !== c.section) || (patch.modelView && patch.modelView !== c.modelView))')
    s=s.replace('<section className="empty-presentation-section" aria-label="Раздел будет наполнен данными" />','<PresentationPlaceholder c={c} change={change} />')
    s=s.replace('<SalesModelDeck slide={c.slide} onSlideChange={(slide) => change({ slide })} />', '<SalesModelDeck slide={c.slide} onSlideChange={(slide) => change({ slide })}\n            onNextSection={() => { const next = adjacentSection(c, 1); if (next) change(next.patch); }}\n            onPreviousSection={() => { const previous = adjacentSection(c, -1); if (previous) change(previous.patch); }} />')
    s=s.replace('      </main>', '        {c.section === "sales-model" && c.modelView === "results" && <PresentationFlow c={c} change={change}/>}\n      </main>')
    return s

def deck(s):
    s=s.replace('import { type CSSProperties, useEffect, useState } from "react";', 'import { type CSSProperties } from "react";\nimport { DeckPlayer, type DeckProps } from "./DeckPlayer";')
    start=s.index('type Props ='); end=s.index('const LineIcon =')
    s=s[:start]+s[end:]
    start=s.index('function PremiseLoopIcon('); end=s.index('function ControlOrbitIcon(')
    s=s[:start]+'''function PremiseLoopIcon({ kind }: { kind: string }) {
  const marks = kind === "analysis" ? <><circle className="loop-mark mark-a" cx="16" cy="16" r="10"/><circle className="loop-mark mark-b" cx="16" cy="16" r="4"/><path className="loop-mark mark-c" d="M16 3v5m0 16v5M3 16h5m16 0h5"/></>
    : kind === "complex" ? <><circle className="loop-mark mark-a" cx="16" cy="11" r="4" pathLength="1"/><path className="loop-mark mark-b" pathLength="1" d="M7 27v-3a9 9 0 0 1 18 0v3"/><path className="loop-mark mark-c" pathLength="1" d="M4 7H2v18h2M28 7h2v18h-2"/></>
    : kind === "appeals" ? <><path className="loop-mark mark-a" pathLength="1" d="M6 12h5l7-6v20l-7-6H6Z"/><path className="loop-mark mark-b" d="M22 12a7 7 0 0 1 0 8m4-12a12 12 0 0 1 0 16"/></>
    : <><path className="loop-mark mark-a" pathLength="1" d="M9 27V6m-4 5 4-5 4 5M9 20h6a8 8 0 0 0 8-8V6"/><path className="loop-mark mark-b" pathLength="1" d="m19 10 4-4 4 4"/></>;
  return <span className={`premise-loop-icon is-${kind}`} aria-hidden="true"><svg viewBox="0 0 32 32">{marks}</svg></span>;
}

'''+s[end:]
    s=s.replace('viewBox="0 0 600 610"','viewBox="0 -36 600 680"').replace('<ellipse cx="300" cy="563"','<ellipse className="pyramid-ground-shadow" cx="300" cy="563"')
    s=s.replace('<LineIcon name="meetings"/>','<LineIcon name="payroll"/>').replace('<div className="pilot-scope"><Icon name="sales"','<div className="pilot-scope"><Icon name="map"')
    s=s[:s.index('export function SalesModelDeck(')]+'''export function SalesModelDeck(props: DeckProps) {
  return <DeckPlayer {...props} slides={slides}/>;
}
'''
    return s

apply('src/dashboard/App.tsx','bbe4d7f7074de02aa3d038c201db5941b4191389','3402c25caee205924b0885a3560bf2a0367ca0c4',app)
apply('src/dashboard/SalesModelDeck.tsx','2238d3cdc30bda5bba31f19b39e3aa3d7eaebf2a','5ab210eec57e18e41c50e52bd0e26c2ea315bc8d',deck)
apply('src/dashboard/model.ts','3f991dc8a402143165bc518da7fab30019be907c','4f9468382b9428c2589a8c9dba04952fae60753a',lambda s:'import { normalizeSlide } from "./presentationModel";\n'+s.replace('Math.max(1, Math.min(9, Number(p.get("slide") || 1)))','normalizeSlide(p.get("slide"))'))
apply('src/main.tsx','2533165a225c34398905c5a31eb9aa424b196692','2ecb693a4dbf9b2c6dfa560310056fe178c2b813',lambda s:s.replace('import "./dashboard/OverviewPanels.css";','import "./dashboard/OverviewPanels.css";\nimport "./dashboard/Presentation.css";'))

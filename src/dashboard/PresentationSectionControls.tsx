import type { Context } from "./types";
import { Icon } from "./Icons";
import { adjacentPresentation } from "./presentationNavigation";

export function PresentationSectionControls({ c, change }: { c: Context; change: (patch: Partial<Context>) => void }) {
  const previous = adjacentPresentation(c, -1), next = adjacentPresentation(c, 1);
  return <nav className="presentation-section-controls" aria-label="Переход между разделами">
    {previous && <button onClick={() => change(previous.patch)} aria-label={`Назад: ${previous.label}`}><Icon name="chevron" size={18}/><span>{previous.label}</span></button>}
    {next && <button onClick={() => change(next.patch)} aria-label={`Далее: ${next.label}`}><span>{next.label}</span><Icon name="chevron" size={18}/></button>}
  </nav>;
}

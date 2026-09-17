import type { Context } from './types';
import { adjacentSection, flowIndex, presentationFlow } from './presentationModel';
import { Icon } from './Icons';
export function PresentationFlow({ c, change }: { c: Context; change: (patch: Partial<Context>) => void }) {
  const previous = adjacentSection(c, -1), next = adjacentSection(c, 1);
  return <nav className="presentation-flow" aria-label="Переход между разделами">
    <button disabled={!previous} onClick={() => previous && change(previous.patch)} aria-label={previous ? `Назад: ${previous.label}` : 'Начало презентации'}><Icon name="chevron" size={18}/><span>{previous?.label || 'Начало презентации'}</span></button>
    <span>{flowIndex(c) + 1} / {presentationFlow.length}</span>
    <button disabled={!next} onClick={() => next && change(next.patch)} aria-label={next ? `Далее: ${next.label}` : 'Конец презентации'}><span>{next?.label || 'Конец презентации'}</span><Icon name="chevron" size={18}/></button>
  </nav>;
}
export function PresentationPlaceholder({ c, change }: { c: Context; change: (patch: Partial<Context>) => void }) {
  const stop = presentationFlow[flowIndex(c)];
  return <section className="presentation-placeholder" aria-label={stop?.label}>
    <div><span className="eyebrow">Раздел презентации</span><h1>{stop?.label}</h1><p>Материалы раздела пока не добавлены.</p></div>
    <PresentationFlow c={c} change={change}/>
  </section>;
}

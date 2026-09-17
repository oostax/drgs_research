import type { Context, PresentationSection, SalesModelView } from './types';

export const slideTitles = [
  'Модель продаж', 'Предпосылки изменений', 'Суть изменений и ожидаемые результаты',
  'Как меняем', 'Перезакрепление клиентской базы', 'Новый порядок закрепления клиентской базы',
  'Работа со смежными подразделениями', 'Как меняем кампании продаж', 'Проводится пилот',
] as const;
export const presentationSections: { id: PresentationSection; label: string; short?: string }[] = [
  { id: 'title', label: 'Титульный лист', short: 'Титул' },
  { id: 'smo', label: 'Кредитование СМО', short: 'СМО' },
  { id: 'sales-model', label: 'Модель продаж' },
  { id: 'strategy', label: 'Страт. диалог' },
  { id: 'academy', label: 'Академия гибридных лидеров', short: 'Академия' },
  { id: 'tb-tasks', label: 'Задачи ТБ' },
];
export const modelViews: { id: SalesModelView; label: string; short: string }[] = [
  { id: 'premises', label: 'Предпосылки изменений', short: 'Предпосылки' },
  { id: 'results', label: 'Результаты', short: 'Результаты' },
  { id: 'next', label: 'Дальнейшие шаги', short: 'Далее' },
];
type Stop = { section: PresentationSection; modelView?: SalesModelView; label: string };
export const presentationFlow: readonly Stop[] = [
  { section: 'title', label: 'Титульный лист' },
  { section: 'smo', label: 'Кредитование СМО' },
  { section: 'sales-model', modelView: 'premises', label: 'Предпосылки изменений' },
  { section: 'sales-model', modelView: 'results', label: 'Результаты' },
  { section: 'sales-model', modelView: 'next', label: 'Дальнейшие шаги' },
  { section: 'strategy', label: 'Стратегический диалог' },
  { section: 'academy', label: 'Академия гибридных лидеров' },
  { section: 'tb-tasks', label: 'Задачи ТБ' },
];
export function normalizeSlide(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(slideTitles.length, Math.trunc(number))) : 1;
}
export function flowIndex(c: Pick<Context, 'section' | 'modelView'>): number {
  return presentationFlow.findIndex(stop => stop.section === c.section && (!stop.modelView || stop.modelView === c.modelView));
}
export function adjacentSection(c: Context, direction: -1 | 1) {
  const stop = presentationFlow[flowIndex(c) + direction];
  if (!stop) return null;
  // Enter results at its overview, but preserve every analytical filter.
  const patch: Partial<Context> = {
    section: stop.section, page: 'overview',
    ...(stop.modelView ? { modelView: stop.modelView } : {}),
    slide: direction === -1 && stop.modelView === 'premises' ? slideTitles.length : 1,
  };
  return { label: stop.label, patch };
}
export function swipeDirection(dx: number, dy: number, elapsed: number): -1 | 0 | 1 {
  if (elapsed > 900 || Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.6) return 0;
  return dx < 0 ? 1 : -1;
}
export function transitionKind(from: number, to: number): string {
  return ({ '2:3': 'grid-wipe', '3:4': 'iris-wipe', '4:5': 'pyramid-zoom',
    '5:6': 'role-stack', '6:7': 'collaboration', '7:8': 'radar-scan' } as Record<string, string>)[`${from}:${to}`] || 'standard';
}

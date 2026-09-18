export type SmoView = 'intro' | 'market' | 'structure' | 'risk';
export const smoViews: { id: SmoView; label: string; short: string }[] = [
  { id: 'intro', label: 'Кредитование СМО', short: 'Кредитование СМО' },
  { id: 'market', label: 'Рынок и конкуренты', short: 'Рынок' },
  { id: 'structure', label: 'Что выбирают заёмщики', short: 'Заёмщики' },
  { id: 'risk', label: 'Финсостояние регионов', short: 'Финсостояние' },
];
export const normalizeSmoView = (value: unknown): SmoView =>
  value === 'market' || value === 'structure' || value === 'risk' ? value : 'intro';

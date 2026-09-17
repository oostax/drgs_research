import type { Period, Stat } from './types';

export type FunnelStage = 'both' | 'realization' | 'activation';
export const funnelStages = { realization: 'Реализация сделки', activation: 'Активация продукта' };
export const stageKeys = (stage: FunnelStage) => stage === 'both' ? ['realization', 'activation'] as const : [stage];
const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
export function funnelStat(period: Period, stage: FunnelStage): Stat {
  if (period.sales.value == null || period.sales.status !== 'ready') return { ...period.sales, value: null };
  const names = stageKeys(stage).map(key => normalize(funnelStages[key]));
  return { ...period.sales, value: Object.entries(period.stages).reduce((sum, [name, count]) => sum + (names.includes(normalize(name)) ? count : 0), 0) };
}
export const perManager = (count: number | null, staff: number | undefined) => count == null || !staff || staff < 0 ? null : count / staff;
export const formatPerManager = (n: number | null) => n == null ? '—' : new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n);
export function funnelWeeks(period: Period, stage: FunnelStage): Period['salesWeeks'] {
  const series = stageKeys(stage).map(key => period.funnel?.[key]);
  if (series.some(s => !s)) return undefined;
  const first = series[0]!;
  return { ...first, weeks: first.weeks.map(w => ({ ...w, count: series.reduce((sum, s) => sum + (s!.weeks.find(item => item.id === w.id)?.count ?? 0), 0) })), before: series.reduce((n, s) => n + s!.before, 0), after: series.reduce((n, s) => n + s!.after, 0), undated: series.reduce((n, s) => n + s!.undated, 0) };
}

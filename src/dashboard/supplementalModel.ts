import type { Context, Manifest, Metric, Source } from './types';

export type SupplementalMetric = 'appeals' | 'payroll' | 'recipients';
export type SupplementalStat = {
  quarter: number; value: number | null; observed: number | null;
  status: 'ready' | 'missing' | 'unverified'; partial: boolean;
  basis: 'quarterToDate' | 'monthlySnapshot' | 'monthTotal'; months: number[];
  clients?: number; knownClients?: number; incompleteClients?: number;
};
export type Supplemental = {
  version: number; year: number; contextFingerprint: string; sources: Source[];
  appeals: {
    branchToTerbank: Record<string, string>;
    periods: { quarter: number; months: number[]; partial: boolean }[];
    banks: { name: string; row: number; group: 'pilot' | 'nonpilot' | 'other'; periods: number[]; months: number[] }[];
    groups: Record<'pilot' | 'nonpilot' | 'other', number[]>;
    total: number[];
  };
  payroll: { views: Record<string, { volume: SupplementalStat[]; volumeMonthly: SupplementalStat[]; recipients: SupplementalStat[] }> };
};
export type SupplementalSeries = { id: string; label: string; stats: SupplementalStat[] };
export const appealMonths = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август'];
export const appealMonthDative = ['январю', 'февралю', 'марту', 'апрелю', 'маю', 'июню', 'июлю', 'августу'];
export function appealMonthlyStats(values: number[]): SupplementalStat[] {
  return values.map((value, i) => ({ quarter: Math.ceil((i + 1) / 3), value, observed: value, status: 'ready', basis: 'monthTotal', partial: false, months: [i + 1] }));
}
export const isSupplemental = (metric: Metric): metric is SupplementalMetric => ['appeals', 'payroll', 'recipients'].includes(metric);
export const supplementalLabels: Record<string, string> = {
  pilot: 'Пилот · младшая роль', nonpilot: 'Непилот',
};
export function appealStats(data: Supplemental, values: number[]): SupplementalStat[] {
  return data.appeals.periods.map((p, i) => ({ ...p, value: values[i], observed: values[i], status: 'ready', basis: 'quarterToDate' }));
}
export function supplementalSeries(data: Supplemental, c: Context, metric: SupplementalMetric, monthlyAppeals = false): SupplementalSeries[] {
  if (metric === 'appeals') {
    const bank = data.appeals.branchToTerbank[c.branch];
    const selected = c.branch === 'all' ? data.appeals.banks : data.appeals.banks.filter(b => b.name === bank);
    return (['pilot', 'nonpilot'] as const).filter(g => c.group === 'both' || c.group === g).flatMap(g => {
      const banks = selected.filter(b => b.group === g);
      if (!banks.length) return [];
      const stats = monthlyAppeals
        ? appealMonthlyStats(appealMonths.map((_, i) => banks.reduce((n, b) => n + b.months[i], 0)))
        : appealStats(data, [0, 1, 2].map(q => banks.reduce((n, b) => n + b.periods[q], 0)));
      return [{ id: g, label: g === 'pilot' ? 'ТБ с пилотом' : 'Остальные ТБ', stats }];
    });
  }
  return (['pilot', 'nonpilot'] as const).filter(g => (c.group === 'both' || c.group === g) && (g !== 'pilot' || c.role === 'all' || c.role === 'junior')).flatMap(id => {
    const view = data.payroll.views[`${id}:${c.branch}`];
    const stats = view?.[metric === 'payroll' ? 'volumeMonthly' : 'recipients'];
    return stats?.some(stat => (stat.clients ?? 0) > 0) ? [{ id, label: supplementalLabels[id], stats }] : [];
  });
}
export function displayedValue(stat: SupplementalStat) { return stat.value ?? stat.observed; }
export function supplementalFormat(value: number | null, metric: SupplementalMetric, compact = false): string {
  if (value == null) return '—';
  const rubles = metric === 'payroll' ? value / 100 : value;
  const divisor = compact && metric === 'payroll' ? 1e9 : 1;
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: metric === 'payroll' ? 1 : 0 }).format(rubles / divisor) + (metric === 'payroll' ? compact ? ' млрд ₽' : ' ₽' : '');
}
export function supplementalChange(current: SupplementalStat, previous?: SupplementalStat, allowPartial = false, allowObserved = false): string | null {
  // Explicit opt-ins compare the displayed quarter-to-date sums. Never imply
  // a complete/normalized result or substitute zero for missing recipient data.
  if (!previous || (!allowPartial && (current.partial || previous.partial)) || current.basis === 'monthlySnapshot' || previous.basis === 'monthlySnapshot') return null;
  if (!allowObserved && (current.status !== 'ready' || previous.status !== 'ready')) return null;
  const now = allowObserved ? displayedValue(current) : current.value;
  const before = allowObserved ? displayedValue(previous) : previous.value;
  if (now == null || before == null || before === 0) return null;
  const difference = (now - before) / before * 100;
  return `${difference > 0 ? '+' : ''}${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(difference)}%`;
}

/** Explicit July-to-March snapshot comparison, independent of the quarter filter. */
export function julyMarchChange(stats: SupplementalStat[]): string | null {
  const july = stats.find(s => ['monthlySnapshot', 'monthTotal'].includes(s.basis) && s.months.length === 1 && s.months[0] === 7);
  const march = stats.find(s => ['monthlySnapshot', 'monthTotal'].includes(s.basis) && s.months.length === 1 && s.months[0] === 3);
  if (!july || !march) return null;
  if (july.basis !== march.basis) return null;
  const now = displayedValue(july), before = displayedValue(march);
  if (now == null || before == null || before <= 0) return null;
  const difference = (now - before) / before * 100;
  return `${difference > 0 ? '+' : ''}${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(difference)}%`;
}

export function periodNote(stat: SupplementalStat, metric: SupplementalMetric): string {
  if (metric === 'recipients') return stat.quarter === 2 ? 'Срез за II квартал не предоставлен' : `Срез ${stat.quarter === 1 ? 'марта' : 'июля'} · не итог квартала`;
  if (metric === 'payroll') return stat.months[0] === 3 ? 'Объём за март' : stat.months[0] === 7 ? 'Объём за июль' : 'Нет месячных данных';
  if (stat.partial) return metric === 'appeals' ? 'Июль–август · неполный квартал' : 'Июль · неполный квартал';
  return 'Полный квартальный период';
}

// Same canonical JSON as the Python builder: sorted keys, UTF-8, spaced separators.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(', ')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}: ${canonical(v)}`).join(', ')}}`;
  return JSON.stringify(value);
}
export async function validateSupplemental(raw: unknown, manifest: Manifest): Promise<Supplemental> {
  const data = raw as Supplemental;
  if (data?.version !== 2 || data.year !== manifest.year || !data.appeals?.banks || !data.payroll?.views || !Array.isArray(data.sources)) throw new Error('Формат дополнительных источников не поддерживается. Пересоберите данные.');
  if (Object.values(data.payroll.views).some(view => !Array.isArray(view.volumeMonthly) || view.volumeMonthly.length !== 3 || view.volumeMonthly[0].basis !== 'monthTotal' || view.volumeMonthly[0].months?.[0] !== 3 || view.volumeMonthly[2].basis !== 'monthTotal' || view.volumeMonthly[2].months?.[0] !== 7)) throw new Error('Месячные суммы ФОТ отсутствуют. Пересоберите дополнительные источники.');
  const context = { year: manifest.year, staff: manifest.staff, branches: manifest.branches };
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(context)));
  const fingerprint = Array.from(new Uint8Array(hash), n => n.toString(16).padStart(2, '0')).join('');
  if (fingerprint !== data.contextFingerprint) throw new Error('Состав пилота изменился. Пересоберите обращения и ФОТ командой pnpm data:supplemental.');
  return data;
}

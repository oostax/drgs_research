import type { Group, Metric, Stat } from './types';

export type MapMode = 'value' | 'change';
export function mapScore(current: Stat, previous: Stat | undefined, mode: MapMode) {
  if (current.status !== 'ready' || current.value == null) return null;
  if (mode === 'value') return current.value;
  if (!previous || previous.status !== 'ready' || previous.value == null || current.assignedOnly || previous.assignedOnly) return null;
  return current.value - previous.value;
}
export function mapUnits(metric: Metric, mode: MapMode) {
  if (mode === 'change' && ['complexShare', 'coverage'].includes(metric)) return 'п. п.';
  if (metric === 'payroll') return '₽';
  if (['process', 'leads'].includes(metric)) return 'б.';
  if (['complexShare', 'coverage'].includes(metric)) return '%';
  return '';
}
export const mapPalettes = {
  pilot: ['#daf2e9', '#a2ddc7', '#43b28f', '#00855e'],
  nonpilot: ['#ede9ff', '#c7bdf4', '#9380e6', '#5746d8'],
  change: ['#b73e35', '#e3aaa3', '#e8eaf0', '#88ceb5', '#00855e'],
};
export function mapColor(n: number | null, max: number, group: Group, mode: MapMode) {
  if (n == null) return 'url(#atlas-missing)';
  if (mode === 'change') return n === 0 ? mapPalettes.change[2] : n < 0 ? mapPalettes.change[Math.abs(n) / max > .5 ? 0 : 1] : mapPalettes.change[n / max > .5 ? 4 : 3];
  return mapPalettes[group][Math.min(3, Math.floor(Math.max(0, n) / max * 4))];
}

// Map-local fallback for source branches whose ISO is blank. Names were checked
// against the existing GeoJSON. 8645 is deliberately unresolved: its name does
// not identify a region and must not be guessed from its territorial bank.
const branchRegions: Record<string, string> = {
  '4157': 'RU-YEV', '8369': 'RU-YAN', '8556': 'RU-KAM', '8557': 'RU-CHU',
  '8579': 'RU-KL', '8585': 'RU-KC', '8589': 'RU-MO', '8591': 'RU-TY',
  '8594': 'RU-TAM', '8595': 'RU-ORL', '8596': 'RU-KRS', '8599': 'RU-KGN',
  '8601': 'RU-BU', '8602': 'RU-KK', '8609': 'RU-SMO', '8614': 'RU-ME',
  '8616': 'RU-TOM', '8617': 'RU-KO', '8620': 'RU-AD', '8625': 'RU-AST',
  '8628': 'RU-KR', '8629': 'RU-NGR', '8630': 'RU-PSK', '8631': 'RU-KB',
  '8632': 'RU-SE', '8633': 'RU-IN', '8639': 'RU-IVA', '8640': 'RU-KOS', '8643': 'RU-CE',
};
export function mapBranchIso(branch: { id: string; iso: string }) {
  return branch.iso || branchRegions[branch.id] || '';
}

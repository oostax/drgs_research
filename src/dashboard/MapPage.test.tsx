import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import fs from 'node:fs';
import { MapPage } from './MapPage';
import { defaults, format, value } from './model';
import { mapBranchIso, mapColor, mapScore } from './mapModel';
import type { Context, Manifest, Stat } from './types';
vi.mock('./Select', () => ({ Select: ({ label, value, options, onChange, disabled }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; disabled?: boolean }) => <select aria-label={label} value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));
const data: Manifest = JSON.parse(fs.readFileSync('public/dashboard/manifest.json', 'utf8'));
const geo = JSON.parse(fs.readFileSync('public/maps/russia.geojson', 'utf8'));
function Harness({ initial = {} }: { initial?: Partial<Context> }) {
  const [c, setContext] = useState<Context>({ ...defaults, page: 'map', group: 'pilot', ...initial });
  return c.page === 'map' ? <MapPage data={data} c={c} change={patch => setContext(old => ({ ...old, ...patch }))} /> : <output>{JSON.stringify(c)}</output>;
}
beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); vi.stubGlobal('matchMedia', () => ({ matches: false })); vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => geo }))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('Карта: управление и смысл данных', () => {
  it('сопоставляет подтверждённые территории и явно оставляет неоднозначный ГОСБ без географии', () => {
    const isos = new Set(geo.features.map((f: { properties: { ISO: string } }) => f.properties.ISO));
    expect(data.branches.filter(b => !mapBranchIso(b)).map(b => b.id)).toEqual(['8645']);
    expect(data.branches.filter(b => mapBranchIso(b)).every(b => isos.has(mapBranchIso(b)))).toBe(true);
    expect(mapBranchIso(data.branches.find(b => b.id === '8617')!)).toBe('RU-KO');
  });
  it('отличает ноль от отсутствия данных и не сравнивает неполные назначения', () => {
    const stat = (value: number | null): Stat => ({ status: 'ready', value });
    expect(mapScore(stat(0), undefined, 'value')).toBe(0);
    expect(mapScore(stat(5), stat(0), 'change')).toBe(5);
    expect(mapScore(stat(5), { ...stat(2), assignedOnly: true }, 'change')).toBeNull();
    expect(mapScore({ ...stat(5), status: 'unverified' }, stat(2), 'value')).toBeNull();
    expect(mapColor(null, 10, 'pilot', 'value')).not.toBe(mapColor(0, 10, 'pilot', 'value'));
    expect(mapColor(-5, 10, 'pilot', 'change')).not.toBe(mapColor(5, 10, 'pilot', 'change'));
  });
  it('сохраняет шкалу при поиске, открывает ГОСБ рядом с картой и передаёт контекст в анализ', async () => {
    const { container } = render(<Harness initial={{ metric: 'complex', quarter: 3 }} />);
    await screen.findByRole('button', { name: /^Выбрать ГОСБ: Татарстан/ });
    const scale = container.querySelector('.atlas-scale')!.textContent;
    fireEvent.change(screen.getByRole('textbox', { name: 'Поиск территории' }), { target: { value: '8610' } });
    expect(screen.getAllByRole('button', { name: /^Открыть ГОСБ:/ })).toHaveLength(1);
    expect(container.querySelector('.atlas-scale')!.textContent).toBe(scale);
    fireEvent.click(screen.getByRole('button', { name: 'Открыть ГОСБ: Татарстан' }));
    expect(screen.getByRole('heading', { name: 'Татарстан' })).toBeTruthy();
    const result = screen.getByRole('region', { name: 'Результаты ГОСБ: Пилот' });
    const context = { ...defaults, metric: 'complex' as const, branch: '8610' };
    expect(within(result).getByText(format(value(data, context, 'pilot', 'complex').value), {selector:'strong'})).toBeTruthy();
    expect(container.querySelector('.atlas-geography')!.getAttribute('style')).toContain('scale(3.6)');
    fireEvent.click(screen.getByRole('link', { name: 'Разобрать в анализе' }));
    expect(screen.getByRole('status').textContent).toContain('"branch":"8610"');
    expect(screen.getByRole('status').textContent).toContain('"metric":"complex"');
  });
  it('переключает группу окраски без смешивания значений и показывает обе группы в подробностях', async () => {
    render(<Harness initial={{ group: 'both' }} />);
    await screen.findByRole('button', { name: /^Выбрать ГОСБ: Татарстан/ });
    expect(screen.getAllByRole('button', { name: /^Открыть ГОСБ:/ })).toHaveLength(data.branches.filter(b => b.pilot).length);
    fireEvent.click(within(screen.getByRole('group', { name: 'Группа для окраски карты' })).getByRole('button', { name: 'Непилот', exact: true }));
    expect(screen.getAllByRole('button', { name: /^Открыть ГОСБ:/ })).toHaveLength(data.branches.length);
    fireEvent.click(screen.getByRole('button', { name: 'Открыть ГОСБ: Татарстан' }));
    expect(screen.getByRole('region', { name: 'Результаты ГОСБ: Пилот' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Результаты ГОСБ: Непилот · все роли' })).toBeTruthy();
  });
  it('открывает прямую ссылку на непилотный ГОСБ в режиме сравнения групп', async () => {
    const branch = data.branches.find(b => !b.pilot)!;
    render(<Harness initial={{ branch: branch.id, group: 'both' }} />);
    expect(screen.getByRole('heading', { name: branch.name, exact: true })).toBeTruthy();
    const colors = screen.getByRole('group', { name: 'Группа для окраски карты' });
    expect(within(colors).getByRole('button', { name: 'Непилот', exact: true }).getAttribute('aria-pressed')).toBe('true');
    await screen.findByRole('button', { name: new RegExp(`^Выбрать ГОСБ: ${branch.name}`) });
    expect(screen.getByRole('region', { name: 'Результаты ГОСБ: Непилот · все роли' })).toBeTruthy();
  });
  it('показывает абсолютное изменение и отключает сравнение для первого квартала', async () => {
    render(<Harness initial={{ metric: 'complexShare' }} />);
    await screen.findByRole('button', { name: /^Выбрать ГОСБ: Татарстан/ });
    fireEvent.click(screen.getByRole('button', { name: 'Изменение', exact: true }));
    expect(screen.getByRole('heading', { name: 'Где растёт и снижается показатель' })).toBeTruthy();
    expect(screen.getByText('Изменение, п. п.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'I квартал', exact: true }));
    expect(screen.getByRole('button', { name: 'Изменение', exact: true }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('heading', { name: 'Распределение по территориям' })).toBeTruthy();
  });
  it('оставляет доступ к данным при ошибке геометрии и повторяет загрузку', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ok: true, json: async () => geo }));
    render(<Harness />);
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Открыть ГОСБ: Татарстан' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку' }));
    await screen.findByRole('button', { name: /^Выбрать ГОСБ: Татарстан/ });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

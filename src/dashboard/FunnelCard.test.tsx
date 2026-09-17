import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import { SalesCard } from './SalesCard';
import { defaults } from './model';
import { funnelStat, funnelWeeks, perManager } from './funnelModel';
import type { Manifest } from './types';
const data: Manifest = JSON.parse(fs.readFileSync('public/dashboard/manifest.json', 'utf8'));
beforeEach(() => vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('Воронка сделок', () => {
  it('считает только две стадии, на штат без АКМ, и пересчитывает переключатели', () => {
    const { container } = render(<SalesCard funnel data={data} c={defaults} change={vi.fn()} />);
    expect(screen.getByRole('heading', {name:'Воронка сделок'})).toBeTruthy();
    let pilot = screen.getByRole('region', {name:'Пилот'}), other = screen.getByRole('region', {name:'Непилот'});
    expect(pilot.querySelector('.sales-number')?.textContent).toBe('25,6');
    expect(within(pilot).getByText('2 684')).toBeTruthy();
    expect(within(pilot).getByText('· 105 КМ')).toBeTruthy();
    expect(other.querySelector('.sales-number')?.textContent).toBe('23,1');
    expect(within(other).getByText('8 663')).toBeTruthy();
    expect(within(other).getByText('· 375 КМ')).toBeTruthy();
    expect(container.querySelectorAll('.funnel-fill')).toHaveLength(12);
    expect(within(pilot).getByText('+7,7%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Активация',exact:true}));
    pilot = screen.getByRole('region',{name:'Пилот'});
    expect(pilot.querySelector('.sales-number')?.textContent).toBe('0,3');
    expect(within(pilot).getByText('29')).toBeTruthy();
    expect(within(pilot).getByText('-64,2%')).toBeTruthy();
    expect(container.querySelectorAll('.funnel-fill')).toHaveLength(6);
    expect(container.querySelector('.funnel-realization')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Реализация',exact:true}));
    pilot = screen.getByRole('region',{name:'Пилот'});
    expect(pilot.querySelector('.sales-number')?.textContent).toBe('25,3');
    expect(within(pilot).getByText('2 655')).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Обе стадии',exact:true}));
    pilot = screen.getByRole('region',{name:'Пилот'});
    expect(pilot.querySelector('.sales-number')?.textContent).toBe('25,6');
  });
  it('недельная разбивка сходится с выбранной стадией для всех срезов', () => {
    for (const v of Object.values(data.views)) for (const p of v.periods) {
      for (const stage of ['both', 'realization', 'activation'] as const) {
        const distribution = funnelWeeks(p, stage), stat = funnelStat(p, stage);
        if (!distribution) continue;
        expect(distribution.weeks.reduce((n,w)=>n+w.count,0)+distribution.before+distribution.after+distribution.undated).toBe(stat.value);
      }
    }
  });
  it('при смене стадии в недельном режиме меняются значения и соблюдается знаменатель', () => {
    render(<SalesCard funnel data={data} c={defaults} change={vi.fn()} />);
    fireEvent.click(screen.getByRole('button',{name:'Недели'}));
    fireEvent.click(screen.getByRole('button',{name:'Активация',exact:true}));
    const v=data.views['pilot:all:all:without'], d=funnelWeeks(v.periods[2],'activation')!;
    const week=[...d.weeks].reverse().find(w=>!w.partial)!;
    const region=screen.getByRole('region',{name:'Пилот'});
    expect(region.querySelector('.funnel-absolute strong')?.textContent).toBe(week.count.toLocaleString('ru-RU'));
    expect(region.querySelector('.sales-number')?.textContent).toBe((week.count/105).toLocaleString('ru-RU',{maximumFractionDigits:1}));
  });
  it('не подменяет неизвестное нулём и не делит на пустой штат', () => {
    expect(perManager(0,105)).toBe(0); expect(perManager(10,0)).toBeNull(); expect(perManager(null,105)).toBeNull();
    const copy=structuredClone(data), v=copy.views['pilot:all:all:without'];
    v.kmCount=0;
    render(<SalesCard funnel data={copy} c={{...defaults,group:'pilot'}} change={vi.fn()} />);
    expect(screen.getByRole('region',{name:'Пилот'}).querySelector('.sales-number')?.textContent).toBe('—');
    expect(screen.getByText('2 684')).toBeTruthy();
    const p=v.periods[2];
    expect(funnelStat({...p,sales:{value:null,status:'missing'}},'both').value).toBeNull();
    expect(funnelStat({...p,stages:{'Реализация   сделки':4,'Активация продукта':2,'Обсуждение условий':100,'Выявление потребности':100}},'both').value).toBe(6);
  });
});

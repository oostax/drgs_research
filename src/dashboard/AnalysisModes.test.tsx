import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import fs from 'node:fs';
import App from './App';
import { defaults } from './model';
import { supplementalAnalysisRows } from './SupplementalAnalysis';
import type { Supplemental } from './supplementalModel';
import type { Manifest, Metric } from './types';
vi.mock('./Select', () => ({ Select: ({ label, value, options, onChange }: { label: string; value: string; options: {value:string;label:string}[]; onChange:(value:string)=>void }) => <select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select> }));
const data: Manifest = JSON.parse(fs.readFileSync('public/dashboard/manifest.json','utf8'));
const supplemental: Supplemental = JSON.parse(fs.readFileSync('public/dashboard/supplemental.json','utf8'));
beforeEach(()=>{
  vi.stubGlobal('fetch',vi.fn(async (url:string)=>({ok:true,json:async()=>url.includes('supplemental')?supplemental:data})));
  vi.stubGlobal('matchMedia',()=>({matches:true,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
  Element.prototype.scrollIntoView=vi.fn();
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
describe('Единый анализ всех показателей',()=>{
  it.each(['sales','complex','complexShare','meetings','coverage','process','leads','appeals','payroll','recipients'] as Metric[])('%s: один заголовок, одна детализация и подходящий период',async metric=>{
    window.history.replaceState({},'',`/?page=analysis&metric=${metric}&group=both&role=all&quarter=3`);
    render(<App/>);
    await screen.findByRole('table');
    expect(screen.getAllByRole('heading',{level:1})).toHaveLength(1);
    expect(screen.getAllByRole('region',{name:'Настройка анализа'})).toHaveLength(1);
    expect(screen.getAllByRole('region',{name:'Детализация данных'})).toHaveLength(1);
    expect(screen.queryByRole('article',{name:'ФОТ и получатели'})).toBeNull();
    expect(screen.queryByRole('article',{name:'Обращения клиентов'})).toBeNull();
    const headings=[...document.querySelectorAll('main h2')].map(e=>e.textContent);
    expect(new Set(headings).size).toBe(headings.length);
    const monthly=['payroll','recipients','appeals'].includes(metric);
    expect(screen.queryByRole('group',{name:'Квартал'})==null).toBe(monthly||metric==='coverage');
    if(monthly){expect(screen.getAllByRole('table')).toHaveLength(1);expect(screen.queryByText(/^Итого:/)).toBeNull();}
    if(!['sales','complex','complexShare'].includes(metric))expect(screen.queryByRole('combobox',{name:'Продукты'})).toBeNull();
  });
  it('месячная детализация фильтруется, листается и раскрывается из рейтинга',async()=>{
    window.history.replaceState({},'','/?page=analysis&metric=payroll&group=both&role=all');
    render(<App/>);const table=await screen.findByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    const first=within(table).getAllByRole('row')[1].textContent;
    fireEvent.click(screen.getByRole('button',{name:'Далее',exact:true}));
    expect(within(table).getAllByRole('row')[1].textContent).not.toBe(first);
    fireEvent.change(screen.getByRole('textbox',{name:'Найти ГОСБ'}),{target:{value:'9038'}});
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('Москва')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox',{name:'Найти ГОСБ'}),{target:{value:'нет такой территории'}});
    expect(screen.getByText(/Нет строк для выбранных условий/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button',{name:'Сбросить поиск'}));
    const balance=screen.getByRole('article',{name:'Распределение направлений изменений'});
    fireEvent.click(within(balance).getAllByRole('button',{name:/Снижение/})[0]);
    for(const row of within(table).getAllByRole('row').slice(1)){expect(row.textContent).toContain('Пилот');expect(row.textContent).toMatch(/-/);}
  });
  it('пустые месяцы не становятся нулями; нулевая база допускает абсолютный рост без процента',()=>{
    const copy=structuredClone(supplemental);
    const branch=data.branches.find(b=>copy.payroll.views[`pilot:${b.id}`]?.volumeMonthly.some(s=>(s.clients??0)>0))!;
    const stats=copy.payroll.views[`pilot:${branch.id}`].volumeMonthly;
    stats[0]={...stats[0], value:0,observed:0};stats[2]={...stats[2],value:100,observed:100};
    const c={...defaults,page:'analysis' as const,metric:'payroll' as const,branch:branch.id,group:'pilot' as const};
    expect(supplementalAnalysisRows(copy,data,c)[0]).toMatchObject({difference:100,percent:null});
    stats[0]={...stats[0],value:null,observed:null,status:'missing'};
    expect(supplementalAnalysisRows(copy,data,c)[0]).toMatchObject({difference:null,percent:null});
    stats[0]={...stats[0],value:100,observed:100,status:'ready'};
    expect(supplementalAnalysisRows(copy,data,c)[0]).toMatchObject({difference:0,percent:0});
  });
  it('тербанк выбирается один раз, без повторения его итогов по входящим ГОСБ',async()=>{
    window.history.replaceState({},'','/?page=analysis&metric=appeals&group=both&role=all');
    render(<App/>);await screen.findByRole('table');
    const control=screen.getByRole('combobox',{name:'Тербанк'});
    const options=within(control).getAllByRole('option');
    const branch=(options[1] as HTMLOptionElement).value;
    fireEvent.change(control,{target:{value:branch}});
    expect(within(await screen.findByRole('table')).getAllByRole('row')).toHaveLength(2);
    expect(screen.queryByRole('combobox',{name:'ГОСБ'})).toBeNull();
  });
});

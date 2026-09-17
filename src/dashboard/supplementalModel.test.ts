import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import type { Manifest } from './types';
import { availableMetrics, contextUrl, defaults, parseContext } from './model';
import { displayedValue, julyMarchChange, supplementalChange, supplementalFormat, supplementalSeries, validateSupplemental } from './supplementalModel';
import type { Supplemental } from './supplementalModel';

const data = JSON.parse(fs.readFileSync('public/dashboard/supplemental.json', 'utf8')) as Supplemental;
const manifest = JSON.parse(fs.readFileSync('public/dashboard/manifest.json', 'utf8')) as Manifest;
describe('Квартальные дополнительные источники', () => {
  it('месяцы обращений соответствуют листу d, независимо от квартального фильтра', () => {
    const series = supplementalSeries(data, defaults, 'appeals', true);
    expect(series.map(s => s.stats.map(displayedValue))).toEqual([
      [13373,15787,17799,17112,11478,12276,12916,12442],
      [18193,22858,24706,22901,17507,18932,19819,18266],
    ]);
    expect(series.map(s => supplementalChange(s.stats[7],s.stats[6]))).toEqual(['-3,7%','-7,8%']);
    for (const quarter of [1,2,3]) expect(supplementalSeries(data, {...defaults,quarter}, 'appeals', true)).toEqual(series);
    for (const [branch, tb] of Object.entries(data.appeals.branchToTerbank)) {
      const bank = data.appeals.banks.find(b => b.name === tb)!;
      const filtered = supplementalSeries(data, {...defaults,branch}, 'appeals', true);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].stats.map(displayedValue)).toEqual(bank.months);
    }
    expect(supplementalSeries(data, {...defaults,group:'pilot'}, 'appeals', true).map(s=>s.id)).toEqual(['pilot']);
    expect(supplementalSeries(data, {...defaults,group:'nonpilot'}, 'appeals', true).map(s=>s.id)).toEqual(['nonpilot']);
    const stat = series[0].stats[0];
    expect(supplementalChange(stat,{...stat,value:0})).toBeNull();
    expect(supplementalChange(stat,{...stat,value:null})).toBeNull();
  });
  it('периоды обращений сохраняются в ссылке и проверяются при загрузке', () => {
    const c = {...defaults,appealMonth:3,appealBaseMonth:1};
    expect(parseContext(contextUrl(c),manifest)).toEqual(c);
    expect(parseContext('?appealMonth=99&appealBaseMonth=0',manifest)).toMatchObject({appealMonth:8,appealBaseMonth:7,quarter:3});
  });
  it('проверяет отпечаток действующего реестра пилота', async () => {
    expect(await validateSupplemental(data, manifest)).toBe(data);
    await expect(validateSupplemental(data, { ...manifest, staff: [] })).rejects.toThrow('Состав пилота изменился');
    await expect(validateSupplemental({}, manifest)).rejects.toThrow('Формат');
    await expect(validateSupplemental({...data,version:1}, manifest)).rejects.toThrow('Формат');
  });
  it('сохраняет квартальные контрольные суммы обращений', () => {
    const series = supplementalSeries(data, defaults, 'appeals');
    expect(series.map(s => s.stats.map(displayedValue))).toEqual([[46959,40866,25358],[65757,59340,38085]]);
    expect([0,1,2].map(q => series.reduce((n,s) => n + s.stats[q].value!, data.appeals.groups.other[q]))).toEqual(data.appeals.total);
  });
  it.each(['all','senior','junior','akm'] as const)('обращения не меняются от роли %s и состава продуктов', role => {
    expect(supplementalSeries(data, { ...defaults, role, scope: 'with' }, 'appeals')).toEqual(supplementalSeries(data, defaults, 'appeals'));
  });
  it('ГОСБ одного ТБ получают один и тот же полный ТБ, без двойного счёта', () => {
    const mapped = Object.entries(data.appeals.branchToTerbank);
    const pair = mapped.find(([id,tb]) => mapped.some(([other,name]) => other !== id && name === tb))!;
    const other = mapped.find(([id,tb]) => id !== pair[0] && tb === pair[1])!;
    const a = supplementalSeries(data, {...defaults,branch:pair[0]}, 'appeals');
    expect(a).toEqual(supplementalSeries(data, {...defaults,branch:other[0]}, 'appeals'));
    expect(a).toHaveLength(1);
    expect(a[0].stats.map(displayedValue)).toEqual(data.appeals.banks.find(b=>b.name===pair[1])!.periods);
  });
  it('не подменяет отсутствующее сопоставление общим итогом', () => {
    expect(supplementalSeries(data, {...defaults,branch:'unknown'}, 'appeals')).toEqual([]);
  });
  it('пилотные ТБ определяются по ТБ, а не по флагу отдельного ГОСБ', () => {
    for (const b of manifest.branches) {
      const bank = data.appeals.banks.find(t => t.name === data.appeals.branchToTerbank[b.id]);
      if (!bank || bank.group === 'other') continue;
      expect(supplementalSeries(data, {...defaults,branch:b.id}, 'appeals')[0].id).toBe(bank.group);
      expect(supplementalSeries(data, {...defaults,branch:b.id,group:bank.group === 'pilot' ? 'nonpilot' : 'pilot'}, 'appeals')).toEqual([]);
    }
  });
  it('показывает заполненную часть ФОТ и не выдаёт её за готовый итог', () => {
    const pilot = supplementalSeries(data, defaults, 'payroll')[0];
    expect(pilot.stats.map(displayedValue)).toEqual([4238012313931,null,4819855388398]);
    expect([pilot.stats[0],pilot.stats[2]].every(s => s.value === null && s.status === 'unverified')).toBe(true);
    expect(supplementalChange(pilot.stats[1], pilot.stats[0])).toBeNull();
  });
  it('объём использует два месячных факта и защищает отсутствующий март', () => {
    const stats = supplementalSeries(data, defaults, 'payroll')[0].stats;
    expect(stats.map(s=>s.months)).toEqual([[3],[],[7]]);
    expect(stats.every(s=>s.basis==='monthTotal' && !s.partial)).toBe(true);
    expect(julyMarchChange([...stats].reverse())).toBe('+13,7%');
    expect(julyMarchChange([{...stats[0],value:null,observed:null},...stats.slice(1)])).toBeNull();
    expect(julyMarchChange([{...stats[0],value:0,observed:0},...stats.slice(1)])).toBeNull();
    for (const quarter of [1,2,3]) expect(supplementalSeries(data,{...defaults,quarter},'payroll')[0].stats).toEqual(stats);
  });
  it('переводит копейки в рубли без тысячекратного смещения', () => {
    expect(supplementalFormat(12345,'payroll').replaceAll('\u00a0',' ')).toBe('123,5 ₽');
    expect(supplementalFormat(123450000000,'payroll',true).replaceAll('\u00a0',' ')).toBe('1,2 млрд ₽');
  });
  it('непилот включает клиентов без сотрудника; третьей группы нет ни в одном ГОСБ', () => {
    expect(Object.keys(data.payroll.views).every(k => /^(pilot|nonpilot):/.test(k))).toBe(true);
    const series = supplementalSeries(data, {...defaults,group:'nonpilot'}, 'payroll');
    expect(series).toHaveLength(1);
    expect(series[0].stats.map(displayedValue)).toEqual([65546816862424,null,75621282562956]);
    expect(supplementalSeries(data, {...defaults,group:'nonpilot'}, 'recipients')[0].stats.map(displayedValue)).toEqual([9649777,null,9068715]);
  });
  it('сравнение ФОТ явно разрешает наблюдаемые суммы и защищает пропуски и нулевую базу', () => {
    const series = supplementalSeries(data, defaults, 'payroll');
    expect(series.map(s => julyMarchChange(s.stats))).toEqual(['+13,7%','+15,4%']);
    const [a,b] = series[0].stats;
    expect(supplementalChange(b,{...a,observed:0},true,true)).toBeNull();
    expect(supplementalChange(b,{...a,observed:null},true,true)).toBeNull();
    const recipients = supplementalSeries(data, defaults,'recipients')[0].stats;
    expect(supplementalChange(recipients[2],recipients[1],true,true)).toBeNull();
  });
  it('II квартал получателей отсутствует, срезы не суммируются', () => {
    const pilot = supplementalSeries(data, defaults, 'recipients')[0];
    expect(pilot.stats.map(displayedValue)).toEqual([687563,null,652053]);
    expect(pilot.stats[1].status).toBe('missing');
    expect(pilot.stats.every(s=>s.basis==='monthlySnapshot')).toBe(true);
  });
  it('получатели сравнивают июль с мартом, защищая пропуски и нулевую базу', () => {
    const series = supplementalSeries(data, defaults, 'recipients');
    expect(series.map(s => julyMarchChange(s.stats))).toEqual(['-5,2%', '-6%']);
    const stats = series[0].stats;
    expect(julyMarchChange([...stats].reverse())).toBe('-5,2%');
    expect(julyMarchChange(stats.slice(1))).toBeNull();
    expect(julyMarchChange([{ ...stats[0], value: 0, observed: 0 }, ...stats.slice(1)])).toBeNull();
    expect(julyMarchChange([{ ...stats[0], value: null, observed: null }, ...stats.slice(1)])).toBeNull();
    expect(julyMarchChange([stats[0], stats[1], { ...stats[2], value: null, observed: null }])).toBeNull();
    expect(julyMarchChange([stats[0], stats[1], { ...stats[2], value: 0, observed: 0 }])).toBe('-100%');
    expect(julyMarchChange([stats[0], stats[1], { ...stats[2], value: stats[0].observed, observed: stats[0].observed }])).toBe('0%');
    expect(julyMarchChange(supplementalSeries(data, defaults, 'payroll')[0].stats)).toBe('+13,7%');
    expect(julyMarchChange(data.payroll.views['pilot:all'].volume)).toBeNull();
  });
  it('ФОТ не зависит от фильтра продуктов, пилот содержит только младшую роль', () => {
    expect(supplementalSeries(data, {...defaults,scope:'with'},'payroll')).toEqual(supplementalSeries(data, defaults,'payroll'));
    expect(supplementalSeries(data, {...defaults,role:'junior'},'payroll')).toEqual(supplementalSeries(data, defaults,'payroll'));
    expect(supplementalSeries(data, {...defaults,role:'senior',group:'pilot'},'payroll')).toEqual([]);
    expect(supplementalSeries(data, {...defaults,role:'akm',group:'nonpilot'},'payroll')[0].id).toBe('nonpilot');
  });
  it('сравнивает только полные сопоставимые кварталы и защищает нулевую базу', () => {
    const p = supplementalSeries(data, defaults,'appeals')[0].stats;
    expect(supplementalChange(p[1],p[0])).toBe('−13%' .replace('−','-'));
    expect(supplementalChange(p[2],p[1])).toBeNull();
    expect(supplementalChange(p[1],{...p[0],value:0})).toBeNull();
  });
  it('не передаёт ТБ-суммы и неподтверждённый ФОТ в карту ГОСБ', () => {
    for (const metric of ['appeals','payroll','recipients']) {
      expect(availableMetrics({...defaults,page:'map'},manifest)).not.toContain(metric);
      expect(parseContext(`?page=map&metric=${metric}`,manifest).metric).toBe('sales');
    }
  });
  it('обращения: III ко II по фактическим суммам при явном разрешении неполного периода', () => {
    const series = supplementalSeries(data, defaults, 'appeals');
    expect(series.map(s => supplementalChange(s.stats[2], s.stats[1], true))).toEqual(['-37,9%', '-35,8%']);
    expect(supplementalChange(series[0].stats[2], { ...series[0].stats[1], value: 0 }, true)).toBeNull();
    const payroll = supplementalSeries(data, defaults, 'payroll')[0].stats;
    expect(supplementalChange(payroll[2], payroll[1], true)).toBeNull();
  });
});

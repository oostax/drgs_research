"""Quarterly supplemental aggregates. Raw files and raw bank keys stay intact."""
from __future__ import annotations
import collections
import hashlib
import json
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path
from build_dashboard import ROOT, cell, ident, inn, norm, workbook

# Same full department names, matching employee IDs and names in the current
# roster. These are source-specific aliases, not a global bank reorganisation.
BRANCH_ALIASES = {'9055': '9500', '9056': '9600'}
TB_NAMES = {'ББ': 'Байкальский банк', 'ВВБ': 'Волго-Вятский банк',
    'ДВБ': 'Дальневосточный банк', 'МБ': 'Московский банк', 'ПБ': 'Поволжский банк',
    'СЗБ': 'Северо-Западный банк', 'СИБ': 'Сибирский банк', 'СРБ': 'Среднерусский банк',
    'УБ': 'Уральский банк', 'ЦЧБ': 'Центрально-Черноземный банк', 'ЮЗБ': 'Юго-Западный банк'}


def canonical_branch(value):
    raw = ident(value)
    return BRANCH_ALIASES.get(raw, raw)


def number(value, money=False):
    if value is None:
        return None
    result = Decimal(str(value))
    if not result.is_finite() or result < 0:
        raise ValueError(f'Invalid source value: {value!r}')
    if money:
        return int((result * 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))
    if result != result.to_integral_value():
        raise ValueError(f'Non-integer recipient count: {value!r}')
    return int(result)


def volume_quarters(values):
    """Input: March, July, YTD to April, YTD to August, in integer kopecks.

    Negative differences are quarantined, not clamped to zero. Missing source
    operands stay missing. July is only the observed part of Q3.
    """
    _, july, april, august = values
    q2 = None if any(v is None for v in (july, april, august)) else august-april-july
    issue = q2 if q2 is not None and q2 < 0 else None
    return [april, q2 if issue is None else None, july], issue


def decode_rows(rows, kind):
    required = ['div_tb_name','gosb_id','div_gosb_name','inn','client_name',
                'vko_fio','post_state','position_type','tab_num','priority','signi_code']
    expected = ['ФОТ за март','ФОТ за июль','ФОТ нарастающий на 01.04.2026','ФОТ нарастающий на 01.08.2026'] if kind == 'volume' else ['Получатели в марте','Получатели в июле']
    if rows[0][1] != required + expected:
        raise ValueError(f'{kind}: unexpected headers')
    out = {}
    for rn,r in rows[1:]:
        bid, client = ident(cell(r,1)), inn(cell(r,3))
        if not client:
            raise ValueError(f'{kind}: invalid source key at row {rn}')
        key = (bid,client)
        if key in out:
            raise ValueError(f'{kind}: duplicate raw key {key}')
        out[key] = {'row':rn, 'rawBranch':bid, 'branch':canonical_branch(bid),
                    'inn':client, 'employeeId':ident(cell(r,8)), 'name':norm(cell(r,5)),
                    'values':[number(cell(r,i),kind == 'volume') for i in range(11,11+len(expected))]}
    return out


def summarize(values):
    known = [v for v in values if v is not None]
    observed = sum(known) if known else None
    return {'value':observed if len(known) == len(values) and values else None,
            'observed':observed, 'known':len(known), 'missing':len(values)-len(known)}


def payroll_clients(volume, recipients, staff, assignments=None):
    """Keep the full outer union of RAW keys, then use canonical keys for identity.

    A raw payroll fact is never copied or deleted. If both bank aliases carry
    amounts, both distinct raw facts contribute. Metadata-only alias rows are
    ownership evidence, not a second unknown monetary fact for that client.
    """
    clients = collections.defaultdict(lambda: {'volume':[], 'recipients':[], 'owners':set(), 'rawKeys':set()})
    for kind,source in [('volume',volume),('recipients',recipients)]:
        for raw_key,row in source.items():
            c = clients[(row['branch'],row['inn'])]
            c[kind].append(row)
            c['rawKeys'].add(raw_key)
            if row['employeeId']:
                c['owners'].add(row['employeeId'])
                person = staff.get(row['employeeId'])
                if person and row['name'] != norm(person['name']):
                    raise ValueError(f"Pilot ID/name conflict at {kind} row {row['row']}")
    result,issues = [],[]
    recovered = collections.Counter()
    for (bid,client),c in clients.items():
        owner = next(iter(c['owners'])) if len(c['owners']) == 1 else None
        if len(c['owners']) > 1:
            issues.append({'kind':'ownerConflict', 'branch':bid, 'inn':client, 'owners':sorted(c['owners'])})
        person = staff.get(owner)
        if person and person['branch'] != bid:
            raise ValueError(f'Unresolved pilot geography: {bid} != {person["branch"]}')
        # Product rule: a confirmed roster match is pilot; every other client
        # is nonpilot. Missing ownership remains an audit flag, not a cohort.
        group = 'pilot' if person else 'nonpilot'
        role = person['role'] if person else 'all'
        if assignments is not None and any(raw[0] in BRANCH_ALIASES for raw in c['rawKeys']):
            assignments.append({'branch':bid, 'inn':client, 'employeeId':owner,
                'staffRow':person.get('row') if person else None,
                'basis':'Exact source bank alias + INN; unique employee ID; pilot name and roster branch verified',
                'sources':[{'kind':kind,'rawBranch':r['rawBranch'],'row':r['row'],'employeeId':r['employeeId']}
                           for kind in ('volume','recipients') for r in c[kind]]})
        monetary = [r for r in c['volume'] if any(v is not None for v in r['values'])]
        period_inputs = [[],[],[]]
        for row in monetary:
            periods,negative = volume_quarters(row['values'])
            if negative is not None:
                issues.append({'kind':'negativeQuarter', 'quarter':2, 'row':row['row'],
                    'rawBranch':row['rawBranch'], 'branch':bid, 'inn':client,
                    'group':group, 'role':role, 'differenceKopecks':negative})
            for q,v in enumerate(periods):
                period_inputs[q].append(v)
            if person and not row['employeeId']:
                recovered[role] += 1
        volume_stats = [summarize(v or [None]) for v in period_inputs]
        # Read month facts directly, never substitute the cumulative Q1 amount
        # for March. Keep the quarter series separately for source reconciliation.
        volume_months = [summarize([r['values'][i] for r in monetary] or [None]) for i in (0,1)]
        recipient_rows = [r for r in c['recipients'] if any(v is not None for v in r['values'])]
        recipient_stats = [summarize([r['values'][i] for r in recipient_rows] or [None]) for i in (0,1)]
        result.append({'branch':bid,'inn':client,'employeeId':owner,'group':group,'role':role,
            'volume':volume_stats, 'recipients':[recipient_stats[0],summarize([None]),recipient_stats[1]],
            'volumeMonthly':[volume_months[0],summarize([None]),volume_months[1]],
            'rawKeys':len(c['rawKeys'])})
    return result,issues,dict(recovered)


def aggregate_clients(clients, metric):
    out = []
    for q in range(3):
        parts = [c[metric][q] for c in clients]
        observed = sum(p['observed'] for p in parts if p['observed'] is not None)
        missing = sum(p['value'] is None for p in parts)
        known = sum(p['observed'] is not None for p in parts)
        out.append({'quarter':q+1, 'value':observed if parts and not missing else None,
            'observed':observed if known else None, 'status':'ready' if parts and not missing else 'unverified' if known else 'missing',
            'clients':len(parts), 'knownClients':known, 'incompleteClients':missing,
            'partial':q == 2 if metric == 'volume' else False, 'basis':'quarterToDate' if metric == 'volume' else 'monthTotal' if metric == 'volumeMonthly' else 'monthlySnapshot',
            'months':([1,2,3] if q == 0 else [4,5,6] if q == 1 else [7]) if metric == 'volume' else ([3] if q == 0 else [] if q == 1 else [7])})
    return out


def appeals_quarters(rows, branches, staff):
    header = next(r for rn,r in rows if rn == 5)
    if header != ['Названия строк','январь','февраль','март','апрель','май','июнь','июль','август','Общий итог']:
        raise ValueError('Unexpected appeals month columns')
    pilot_codes = {branches[s['branch']]['tb'] for s in staff.values()}
    pilot_names = {TB_NAMES[c] for c in pilot_codes}
    known_names = set(TB_NAMES.values())
    records = []
    for rn,r in rows:
        if rn < 6:
            continue
        months = [number(v) for v in r[1:9]]
        if any(v is None for v in months) or sum(months) != r[9]:
            raise ValueError(f'Appeals row control failed at d!J{rn}')
        records.append({'name':r[0], 'row':rn, 'months':months,
            'group':'pilot' if r[0] in pilot_names else 'nonpilot' if r[0] in known_names else 'other',
            'periods':[sum(months[:3]),sum(months[3:6]),sum(months[6:])]})
    total = next(r for r in records if r['name'] == 'Общий итог')
    records = [r for r in records if r['name'] != 'Общий итог']
    if [sum(r['months'][i] for r in records) for i in range(8)] != total['months']:
        raise ValueError('Appeals monthly grand total mismatch')
    groups = {g:[sum(r['periods'][q] for r in records if r['group'] == g) for q in range(3)] for g in ('pilot','nonpilot','other')}
    return {'basis':'terbankQuarter', 'sourceYear':None, 'yearPolicy':'currentDashboardContext',
        'groupLabels':{'pilot':'ТБ с пилотом','nonpilot':'Остальные ТБ','other':'ЦА и не определён ТБ'},
        'roleBreakdown':False, 'sourceFilter':'Лист d, как предоставлен пользователем',
        'periods':[{'quarter':1,'months':[1,2,3],'partial':False},
            {'quarter':2,'months':[4,5,6],'partial':False}, {'quarter':3,'months':[7,8],'partial':True}],
        'branchToTerbank':{b['id']:TB_NAMES[b['tb']] for b in branches.values()},
        'banks':records, 'groups':groups, 'total':total['periods']}


def build(config, manifest):
    sources = []
    staff = {s['id']:s for s in manifest['staff']}
    branches = {b['id']:b for b in manifest['branches']}
    volume_sheets = workbook(config['volume'],sources)
    recipients_sheets = workbook(config['recipients'],sources)
    if len(volume_sheets) != 1 or len(recipients_sheets) != 1:
        raise ValueError('Expected one sheet per payroll source')
    volume = decode_rows(volume_sheets[0][1],'volume')
    del volume_sheets
    recipients = decode_rows(recipients_sheets[0][1],'recipients')
    del recipients_sheets
    assignments = []
    clients,issues,recovered = payroll_clients(volume,recipients,staff,assignments)
    views = {}
    for group in ('pilot','nonpilot'):
        for bid in ['all']+list(branches):
            selected = [c for c in clients if c['group'] == group and (group != 'pilot' or c['role'] == 'junior') and (bid == 'all' or c['branch'] == bid)]
            views[f'{group}:{bid}'] = {m:aggregate_clients(selected,m) for m in ('volume','volumeMonthly','recipients')}
    appeal_rows = dict(workbook(config['appeals'],sources))['d']
    # Source month totals must be identical before and after alias grouping.
    source_totals = {k:[sum(r['values'][i] or 0 for r in src.values()) for i in range(n)] for k,src,n in [('volume',volume,4),('recipients',recipients,2)]}
    for source_col,quarter in [(2,0),(1,2)]:
        assert source_totals['volume'][source_col] == sum(c['volume'][quarter]['observed'] or 0 for c in clients)
    for source_col,quarter in [(0,0),(1,2)]:
        assert source_totals['volume'][source_col] == sum(c['volumeMonthly'][quarter]['observed'] or 0 for c in clients)
        assert source_totals['recipients'][source_col] == sum(c['recipients'][quarter]['observed'] or 0 for c in clients)
    context = {k:manifest[k] for k in ('year','staff','branches')}
    result = {'version':2,'year':manifest['year'],'sources':sources,
        'contextFingerprint':hashlib.sha256(json.dumps(context,sort_keys=True,ensure_ascii=False).encode()).hexdigest(),
        'appeals':appeals_quarters(appeal_rows,branches,staff),
        'payroll':{'volumeUnit':'kopecks','recipientsUnit':'sourceRecipientCounts','branchAliases':BRANCH_ALIASES,
            'pilotRoles':['junior'],'groupLabels':{'pilot':'Пилот · младшая роль','nonpilot':'Непилот'},
            'groupPolicy':'Подтверждённый реестр пилота; все остальные клиенты — непилот, включая строки без определённого сотрудника.',
            'recipientPolicy':'Срез марта внутри I квартала; II квартал отсутствует; срез июля внутри III квартала. Не уникальные получатели за квартал.',
            'volumePolicy':'UI: месячные суммы марта (L) и июля (M), июль к марту. Накопительные N/O и расчётные кварталы сохранены только для аудита.',
            'views':views},
        'quality':{'rawVolumeRows':len(volume),'rawRecipientRows':len(recipients),'canonicalClients':len(clients),
            'clientsMergedAcrossAliases':sum(c['rawKeys']>1 for c in clients), 'recoveredPilotMonetaryRowsByRole':recovered,
            'issues':dict(collections.Counter(i['kind'] for i in issues)), 'sourceTotals':source_totals,
            'unresolvedEmployeeClients':sum(c['employeeId'] is None for c in clients)}}
    return result,{'issues':issues,'assignments':assignments}


def main():
    config = json.loads((ROOT/'data/sources.json').read_text())['supplemental']
    manifest = json.loads((ROOT/'public/dashboard/manifest.json').read_text())
    result,audit = build(config,manifest)
    (ROOT/'public/dashboard/supplemental.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n')
    output = ROOT/'output/audit/supplemental-quarter-issues.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(audit['issues'],ensure_ascii=False,indent=2)+'\n')
    (output.parent/'supplemental-assignments.json').write_text(json.dumps(audit['assignments'],ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'appeals':result['appeals']['groups'],'quality':result['quality'],
        'pilot':result['payroll']['views']['pilot:all']},ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()

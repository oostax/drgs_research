"""Read-only profiling of supplied payroll and appeal workbooks."""
import collections
import json
from decimal import Decimal
from pathlib import Path
from build_dashboard import workbook, cell, ident, inn


def main():
    root = Path('/Users/sergey/Downloads')
    manifest = json.loads(Path('public/dashboard/manifest.json').read_text())
    staff = {s['id']: s for s in manifest['staff']}
    branches = {b['id']: b for b in manifest['branches']}
    print('PILOT_TB', dict(collections.Counter(branches[s['branch']]['tb'] for s in staff.values())), flush=True)
    books = {}
    sources = []
    report = {'payroll': {}, 'pilotTerbanks': dict(collections.Counter(branches[s['branch']]['tb'] for s in staff.values())), 'sources': sources}
    for kind, filename in [('volume', 'Объем ФОТ (март, июль).xlsx'), ('recipients', 'Получатели ФОТ (март, июль).xlsx')]:
        sheet, rows = workbook(root / filename, sources)[0]
        counters = collections.Counter()
        keys = collections.defaultdict(list)
        roles = collections.Counter()
        sums = [Decimal(0), Decimal(0)]
        wrong_branches = collections.Counter()
        paired_roles = collections.Counter()
        for rn, r in rows[1:]:
            bid, client, eid = ident(cell(r, 1)), inn(cell(r, 3)), ident(cell(r, 8))
            key = (bid, client)
            keys[key].append((rn, r))
            counters['rows'] += 1
            counters['bad_inn'] += client is None
            counters['missing_staff'] += not bool(eid)
            counters['unknown_branch'] += bid not in branches
            for i in (11, 12):
                v = cell(r, i)
                counters[f'blank_{i}'] += v is None
                counters[f'zero_{i}'] += v == 0
                counters[f'negative_{i}'] += isinstance(v, (float, int)) and v < 0
                if isinstance(v, (float, int)): sums[i-11] += Decimal(str(v))
            if kind == 'volume' and all(cell(r,i) is not None for i in (12,13,14)):
                q2 = Decimal(str(r[14])) - Decimal(str(r[13])) - Decimal(str(r[12]))
                counters['q2_derivable_rows'] += 1
                counters['q2_negative_rows'] += q2 < 0
            if eid in staff:
                roles[staff[eid]['role']] += 1
                counters['pilot_wrong_branch'] += bid != staff[eid]['branch']
                if bid != staff[eid]['branch']:
                    wrong_branches[staff[eid]['role']] += 1
                if all(cell(r, i) is not None for i in (11, 12)):
                    paired_roles[staff[eid]['role']] += 1
        duplicates = [v for v in keys.values() if len(v) > 1]
        counters['duplicate_keys'] = len(duplicates)
        counters['duplicate_rows'] = sum(len(v)-1 for v in duplicates)
        counters['duplicate_value_conflicts'] = sum(len({(cell(r,11),cell(r,12)) for _,r in group}) > 1 for group in duplicates)
        counters['duplicate_owner_conflicts'] = sum(len({ident(cell(r,8)) for _,r in group}) > 1 for group in duplicates)
        print(kind, dict(counters), 'pilot_roles', dict(roles), 'raw_sums', sums, flush=True)
        print('DUPLICATE_SAMPLE', [[(rn, [cell(r,i) for i in (0,1,8,11,12)]) for rn,r in group] for group in duplicates[:5]], flush=True)
        books[kind] = keys
        report['payroll'][kind] = {'file': filename, 'sheet': sheet, 'counts': dict(counters),
            'rawSums': [str(s) for s in sums], 'pilotRowsByRole': dict(roles),
            'branchMismatchesByRole': dict(wrong_branches), 'pairedRowsByRole': dict(paired_roles)}
    a, b = books.values()
    report['join'] = {'common':len(a.keys() & b.keys()), 'volume_only':len(a.keys()-b.keys()), 'recipients_only':len(b.keys()-a.keys()),
        'owner_mismatch':sum({ident(cell(r,8)) for _,r in a[k]}!={ident(cell(r,8)) for _,r in b[k]} for k in a.keys() & b.keys()),
        'recipientsOnlySums': [sum(cell(r,i) or 0 for k in b.keys()-a.keys() for _,r in b[k]) for i in (11,12)]}
    print('JOIN', report['join'], flush=True)
    for sheet, rows in workbook(root/'обращения 2025-2026_свод.xlsx', sources):
        if sheet == 'd':
            print('APPEALS', json.dumps(rows, ensure_ascii=False), flush=True)
            values = {r[0]: r[1:9] for rn,r in rows if rn >= 6}
            for rn,r in rows:
                if rn >= 6:
                    assert sum(r[1:9]) == r[9], f'Row total mismatch: d!J{rn}'
            total = values.pop('Общий итог')
            assert [sum(v[i] for v in values.values()) for i in range(8)] == total
            pilot_names = ['Волго-Вятский банк','Поволжский банк','Северо-Западный банк','Сибирский банк']
            pilot_values = [sum(values[name][i] for name in pilot_names) for i in range(8)]
            report['appeals'] = {'sheet': 'd', 'year': None, 'monthlyTotals': total, 'pilotMonthlyTotals': pilot_values,
                'total': sum(total), 'pilotTotal': sum(pilot_values), 'rows': values,
                'quarterBucketsAll': [sum(total[:3]),sum(total[3:6]),sum(total[6:])],
                'quarterBucketsPilot': [sum(pilot_values[:3]),sum(pilot_values[3:6]),sum(pilot_values[6:])],
                'checks': 'Every row and monthly control total reconciled; year and priority filter unavailable'}
    output = Path('output/audit/supplemental-profile.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('REPORT', output, flush=True)


if __name__ == '__main__':
    main()

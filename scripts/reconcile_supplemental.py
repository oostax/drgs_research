"""Targeted tests of payroll identity, geography and quarter inconsistencies.

H1: bad employee-ID join -> falsified if names agree even across branch changes.
H2: client/service branch differs from employee branch -> supported if the same
    confirmed employee owns rows in multiple source branches.
H3: negative Q2 is numerical error -> falsified by cent-level material negatives.
H4: missing values can be inferred as zero -> check cross-source combinations;
    observations alone do not authorize a universal missing-to-zero rule.
"""
import collections
import json
from decimal import Decimal
from pathlib import Path
from build_dashboard import workbook, cell, ident, inn, norm


def main():
    root = Path('/Users/sergey/Downloads')
    manifest = json.loads(Path('public/dashboard/manifest.json').read_text())
    staff = {s['id']: s for s in manifest['staff']}
    _, volume = workbook(root/'Объем ФОТ (март, июль).xlsx', [])[0]
    _, recipients = workbook(root/'Получатели ФОТ (март, июль).xlsx', [])[0]
    rec = {(ident(cell(r,1)),inn(cell(r,3))): r for _,r in recipients[1:]}
    counts = collections.Counter()
    by_employee = collections.defaultdict(collections.Counter)
    shifts = collections.Counter()
    negatives = []
    blank_patterns = collections.Counter()
    for rn,r in volume[1:]:
        eid, bid = ident(cell(r,8)), ident(cell(r,1))
        if eid in staff:
            counts['pilotRows'] += 1
            same_name = norm(cell(r,5)) == norm(staff[eid]['name'])
            counts['pilotNameMismatch'] += not same_name
            by_employee[eid][bid] += 1
            if bid != staff[eid]['branch']:
                counts['branchMismatch'] += 1
                counts['branchMismatchNameMismatch'] += not same_name
                shifts[(bid,staff[eid]['branch'],staff[eid]['role'])] += 1
        if all(cell(r,i) is not None for i in (12,13,14)):
            q2 = Decimal(str(r[14])) - Decimal(str(r[13])) - Decimal(str(r[12]))
            if q2 < 0:
                negatives.append({'row':rn, 'sourceBranch':bid, 'role':staff.get(eid,{}).get('role','nonpilot'),
                    'july':r[12], 'toApril':r[13], 'toAugust':r[14], 'q2':str(q2)})
        rr = rec[(bid,inn(cell(r,3)))]
        for i in (11,12):
            v, n = cell(r,i), cell(rr,i)
            state = lambda x: 'blank' if x is None else 'zero' if x == 0 else 'positive'
            blank_patterns[(i, state(v), state(n))] += 1
    report = {'counts':dict(counts), 'pilotEmployeesInFile':len(by_employee),
        'employeesWithMultipleSourceBranches':sum(len(v)>1 for v in by_employee.values()),
        'employeesWhoseHomeBranchIsAbsent':sum(staff[e]['branch'] not in v for e,v in by_employee.items()),
        'largestBranchDifferences':[{'sourceBranch':a,'employeeBranch':b,'role':role,'rows':n} for (a,b,role),n in shifts.most_common(12)],
        'negativeQuarterRows':negatives,
        'blankPatterns':[{'column':i,'volume':v,'recipients':n,'rows':count} for (i,v,n),count in sorted(blank_patterns.items())]}
    output = Path('output/audit/supplemental-reconciliation.json')
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False,indent=2))


if __name__ == '__main__':
    main()

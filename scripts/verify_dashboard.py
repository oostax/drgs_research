#!/usr/bin/env python3
"""Independent SQL checks over exported facts; never reuse aggregation functions."""
import hashlib, json, math, sqlite3
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
m=json.loads((ROOT/'public/dashboard/manifest.json').read_text())
facts=json.loads((ROOT/'output/audit/canonical-facts.json').read_text())
controls=json.loads((ROOT/'output/audit/controls.json').read_text())
# Missing identity is a diagnostic, not evidence of contradictory records.
if controls['meetingConflicts']==0:
    assert not any(r['conflict'] for r in facts['meetings'])
db=sqlite3.connect(':memory:')
db.execute('create table offers(q int, grp text, branch text, employee text, fot int, complex int, role text, stageDate text)')
db.executemany('insert into offers values(?,?,?,?,?,?,?,?)',[(r['quarter'],r['group'],r['branch'],r['employeeId'],r['fot'],r['complex'],r['role'],r['stageDate']) for r in facts['offers']])
db.execute('create index offer_scope on offers(grp,q,fot,branch,role,stageDate,complex)')
# Cover branch checks without rescanning the full quarterly nonpilot population.
db.execute('create index offer_branch_scope on offers(grp,branch,q,role,fot,stageDate,complex)')
db.execute('create table meetings(grp text, branch text, role text, employee text, inn text, q1 int,q2 int,q3 int, conflict int)')
db.executemany('insert into meetings values(?,?,?,?,?,?,?,?,?)',[(r['group'],r['branch'],r['role'],r['employeeId'],r['inn'],*r['values'],r['conflict']) for r in facts['meetings']])
db.execute('create table surveys(grp text,branch text,role text,employee text,q int, v1 real,v2 real,v3 real,v4 real,id text unique,created text)')
db.executemany('insert into surveys values(?,?,?,?,?,?,?,?,?,?,?)',[(r['group'],r['branch'],r['role'],r['employeeId'] or r['name'],r['quarter'],*r['scores'],r['id'],r['date'][:10]) for r in facts['surveys']])
db.execute('create index meeting_scope on meetings(grp,branch,role)');db.execute('create index survey_scope on surveys(grp,branch,role,q)')
checks=0;report=[]
for key,v in m['views'].items():
    g,b,role,scope=key.split(':');where='grp=?';args=[g]
    if b!='all':where+=' and branch=?';args.append(b)
    if role!='all':where+=' and role=?';args.append(role)
    meetwhere=where+(" and role in ('senior','junior')" if g=='pilot' else '')
    base=db.execute('select count(distinct inn), count(distinct case when q2>0 or q3>0 then inn end) from meetings where '+meetwhere,args).fetchone()
    cover=v['coverage']
    # The owner defines absent employees as zero activity, not incomplete data.
    conflicts=db.execute('select count(*) from meetings where '+meetwhere+' and conflict=1',args).fetchone()[0]
    invalid=db.execute('select count(*) from meetings where '+meetwhere+' and inn is null',args).fetchone()[0]
    applicable=g=='nonpilot' or role!='akm'
    if g=='nonpilot':assert v['missingMeetingStaff']==[];checks+=1
    if applicable and not conflicts and not invalid and base[0]:
        assert cover['status']=='ready',(key,'coverage blocked without conflicts');checks+=1
    if cover['status']=='ready':
        assert cover['denominator']==base[0] and cover['numerator']==base[1],key
        assert base[0]>0 and 0<=base[1]<=base[0],key
        assert math.isclose(cover['value'],base[1]/base[0]*100,abs_tol=1e-10),key;checks+=3
    for p in v['periods']:
        q=p['quarter'];ms=p['meetings'];count=db.execute(f'select coalesce(sum(q{q}),0) from meetings where '+meetwhere,args).fetchone()[0]
        if applicable and not conflicts:
            assert ms['status']=='ready' and ms['value']==count,(key,q,'absent employees must count as zero');checks+=1
        if ms['status']=='ready':assert ms['value']==count,(key,q,'meetings');checks+=1
        elif 'observed' in ms:assert ms['observed']==count,(key,q,'observed');checks+=1
        n,respondents,process,leads=db.execute('select count(*),count(distinct employee),avg((v1+v2+v3)/3.0),avg(v4) from surveys where '+where+' and q=?',args+[q]).fetchone()
        survey=p['survey'];assert survey['basis']=='surveyCreated'
        expected_questions=db.execute('select avg(v1),avg(v2),avg(v3),avg(v4) from surveys where '+where+' and q=?',args+[q]).fetchone()
        for actual,expected in zip(survey['questions'],expected_questions):
            assert actual is None if expected is None else math.isclose(actual,expected,abs_tol=1e-10)
            checks+=1
        assert sum(w['responses'] for w in survey['weeks'])==n
        for w in survey['weeks']:
            wn,ws,wp,wl,*wq=db.execute('select count(*),count(distinct employee),avg((v1+v2+v3)/3.0),avg(v4),avg(v1),avg(v2),avg(v3),avg(v4) from surveys where '+where+' and q=? and created between ? and ?',args+[q,w['start'],w['end']]).fetchone()
            assert (w['responses'],w['sample'])==(wn,ws)
            for metric,expected in [('process',wp),('leads',wl)]:
                actual=w[metric];assert actual['responses']==wn and actual['sample']==ws
                assert actual['value'] is None if expected is None else math.isclose(actual['value'],expected,abs_tol=1e-10)
                checks+=3
            for actual,expected in zip(w['questions'],wq):
                assert actual is None if expected is None else math.isclose(actual,expected,abs_tol=1e-10)
                checks+=1
        for metric,expected in [('process',process),('leads',leads)]:
            s=p[metric]
            if n:
                assert s['status']=='ready' and math.isclose(s['value'],expected,abs_tol=1e-10),(key,q,metric)
                assert s['sample']==respondents and s['responses']==n
                assert 1<=s['value']<=3
            else:assert s['value'] is None and s['status']=='missing'
            checks+=3
        for metric,columns in [('sales',('products','stages')),('complex',('complexProducts','complexStages'))]:
            if p[metric]['status']=='ready':
                assert sum(r['count'] for r in p[columns[0]])==p[metric]['value'],(key,q,columns[0])
                assert sum(p[columns[1]].values())==p[metric]['value'],(key,q,columns[1]);checks+=2
        if g=='nonpilot' and b!='all':
            for metric,scope_clause,missing_scope in [('sales'," and fot=0" if scope=='without' else '',scope),('complex',' and fot=0 and complex=1','complex')]:
                assigned=db.execute('select count(*) from offers where '+where+' and q=?'+scope_clause,args+[q]).fetchone()[0]
                unplaced=db.execute("select count(*) from offers where grp='nonpilot' and (branch is null or branch='') and q=?"+scope_clause,[q]).fetchone()[0]
                actual=p[metric]
                assert actual['status']==('missing' if unplaced and not assigned else 'ready'),(key,q,metric,actual)
                assert actual['value']==(None if unplaced and not assigned else assigned),(key,q,metric)
                assert bool(actual.get('assignedOnly'))==bool(unplaced),(key,q,metric)
                assert m['quality']['unassignedOffersByQuarter'][str(q)][missing_scope]==unplaced
                checks+=4
        if g=='pilot' and role=='akm':assert p['sales']['value'] is None and p['meetings']['value'] is None
        if p['sales']['status']=='ready':
            weekly=p['salesWeeks'];assert weekly['basis']=='lastStageDate'
            # Independently sum each inclusive date range in SQL; no import of
            # the bucket/aggregation implementation. Check all supported slices.
            offerwhere=where+" and q=?"+(" and fot=0" if scope=='without' else '')+(" and role in ('senior','junior')" if g=='pilot' else '')
            total=0
            for w in weekly['weeks']:
                actual=db.execute('select count(*) from offers where '+offerwhere+' and stageDate between ? and ?',args+[q,w['start'],w['end']]).fetchone()[0]
                assert w['count']==actual,(key,q,w['id']);total+=actual;checks+=1
            for label,clause,dates in [('before','stageDate < ?',[weekly['weeks'][0]['start']]),('after','stageDate > ?',[weekly['weeks'][-1]['end']]),('undated','stageDate is null',[])]:
                actual=db.execute('select count(*) from offers where '+offerwhere+' and '+clause,args+[q]+dates).fetchone()[0]
                assert weekly[label]==actual,(key,q,label);total+=actual;checks+=1
            assert total==p['sales']['value'];checks+=1
        else:assert 'salesWeeks' not in p
        for metric in ['sales','complex','complexShare','meetings','process','leads','appeals','payroll','recipients']:
            s=p[metric];assert (s['status']=='ready')==(s['value'] is not None),(key,q,metric);checks+=1
    if g=='pilot' and b=='all' and role=='all' and scope=='without':
        report=[{k:p[k] for k in ('quarter','sales','complex','complexShare','meetings','process','leads')} for p in v['periods']]
ids={b['id'] for b in m['branches']};staff={s['id']:s for s in m['staff']}
assert len(ids)==84 and len(staff)==130
assert all(r['branch'] in ids for section in facts.values() for r in section if r['group']=='pilot')
assert all(r['employeeId'] in staff for section in facts.values() for r in section if r['group']=='pilot')
assert all((r['group']=='pilot')==(r['employeeId'] in staff) for section in facts.values() for r in section)
assert all(staff[e]['branch']=='8617' for e in ('809734','944221','797217','943866'))
for q in (1,2,3):
    assert db.execute('select count(*) from offers where q=?',(q,)).fetchone()[0]==controls['sourceSales'][str(q)]['offers']
    assert db.execute('select count(distinct employee) from offers where grp=? and q=?',('pilot',q)).fetchone()[0]<=130
    for scope in ('with','without'):
        count=db.execute('select count(*) from offers where grp=? and q=?'+(' and fot=0' if scope=='without' else ''),('nonpilot',q)).fetchone()[0]
        p=m['views'][f'nonpilot:all:all:{scope}']['periods'][q-1]
        assert p['sales']=={'value':count,'status':'ready'}
        cn,den=db.execute('select sum(complex),count(*) from offers where grp=? and q=? and fot=0',('nonpilot',q)).fetchone()
        assert p['complex']['value']==cn and p['complexShare']['denominator']==den
        assert math.isclose(p['complexShare']['value'],cn/den*100)
        checks+=5
assert all(s['branch']=='9042' for s in m['staff'] if s['id'] in ('1888026','318050','904811'))
assert all(s['branch']=='9500' for s in m['staff'] if s['rawBranch']=='ГОСБ по СПБ')
assert all(s['branch']=='9600' for s in m['staff'] if s['rawBranch']=='Головное отделение по ЛО')
checks+=6
checks+=len(staff)
result={'passed':True,'independentChecks':checks,'pilotQuarterControls':report,'method':'Independent SQL sums, DISTINCT denominators, weighted survey means, UI status invariants and breakdown identities. Exported canonical facts are the input; identity evidence is verified separately against the roster manifest.'}
(ROOT/'output/audit/independent-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps({'passed':True,'independentChecks':checks,'pilotMeetingsObserved':[p['meetings'].get('observed',p['meetings']['value']) for p in report]},ensure_ascii=False))

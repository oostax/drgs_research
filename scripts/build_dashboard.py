#!/usr/bin/env python3
"""Rebuild local, source-traceable pilot analytics. No network access required."""
from __future__ import annotations
import argparse, collections, csv, datetime as dt, gzip, hashlib, json, math, pickle, re, sqlite3, sys, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
NS = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
FUNNEL_STAGES = {'realization': 'Реализация сделки', 'activation': 'Активация продукта'}
def is_akm_position(position):
    return norm(position) in ('акм', 'ассистент клиентского менеджера')

ROLES = {'старшая/руководитель': 'senior', 'младшая': 'junior', 'акм': 'akm'}
COMPLEX = {'Краткосрочное финансирование', 'Овердрафт', 'Мезонинные продукты в недвижимости',
 'Финансирование недвижимости', 'Финансирование проектов и контрактов', 'Лизинг (кроме СБЛ)',
 'Лизинг СБЛ', 'Факторинг', 'Непокрытые аккредитивы'}
FOT = 'Зарплатные проекты (объем ФОТ)'
CONFIRMED = {'1888026': '9042', '318050': '9042', '904811': '9042'}
GEO = {
 '9038':('Москва','RU-MOW'), '1023':('Восточное ГОСБ','RU-MOS'), '1024':('Южное ГОСБ','RU-MOS'),
 '1025':('Западное ГОСБ','RU-MOS'), '1026':('Северное ГОСБ','RU-MOS'), '9500':('Санкт-Петербург','RU-SPE'),
 '9600':('Ленинградская область','RU-LEN'), '8610':('Татарстан','RU-TA'), '8619':('Краснодарский край','RU-KDA'),
 '8646':('Красноярский край','RU-KYA'), '7003':('Свердловская область','RU-SVE'), '8598':('Башкортостан','RU-BA'),
 '6991':('Самарская область','RU-SAM'), '8597':('Челябинская область','RU-CHE'), '5221':('Ростовская область','RU-ROS'),
 '8586':('Иркутская область','RU-IRK'), '9042':('Нижегородская область','RU-NIZ'), '6984':('Пермский край','RU-PER'),
 '8047':('Новосибирская область','RU-NVS'), '8615':('Кемеровская область','RU-KEM'), '8635':('Приморский край','RU-PRI'),
 '5940':('Ханты-Мансийский АО','RU-KHM'), '5230':('Ставропольский край','RU-STA'), '9013':('Воронежская область','RU-VOR'),
 '8644':('Алтайский край','RU-ALT'), '8647':('Тюменская область','RU-TYU'), '8603':('Республика Саха','RU-SA'),
 '8623':('Оренбургская область','RU-ORE'), '8592':('Белгородская область','RU-BEL'), '8621':('Волгоградская область','RU-VGG'),
 '8637':('Архангельская область','RU-ARK'), '8622':('Саратовская область','RU-SAR'), '9070':('Хабаровский край','RU-KHA'),
 '8634':('Омская область','RU-OMS'), '8604':('Тульская область','RU-TUL'), '8618':('Удмуртия','RU-UD'),
 '8627':('Мурманская область','RU-MUR'), '17':('Ярославская область','RU-YAR'), '8608':('Калужская область','RU-KLU'),
 '8638':('Вологодская область','RU-VLG'), '8567':('Сахалинская область','RU-SAK'), '8590':('Дагестан','RU-DA'),
 '8593':('Липецкая область','RU-LIP'), '8626':('Калининградская область','RU-KGD'), '8607':('Тверская область','RU-TVE'),
 '8611':('Владимирская область','RU-VLA'), '8624':('Пензенская область','RU-PNZ'), '8606':('Рязанская область','RU-RYA'),
 '8588':('Ульяновская область','RU-ULY'), '8612':('Кировская область','RU-KIR'), '8600':('Забайкальский край','RU-ZAB'),
 '8636':('Амурская область','RU-AMU'), '8605':('Брянская область','RU-BRY'), '8613':('Чувашия','RU-CU')}

def norm(v): return re.sub(r'\s+', ' ', str(v or '').replace('ё','е').strip()).casefold()
def ident(v):
    s = str(v or '').strip()
    if re.fullmatch(r'\d+\.0',s): s=s[:-2]
    return s.lstrip('0') or ('0' if s else '')
def inn(v):
    s=str(v or '').strip()
    if re.fullmatch(r'\d+\.0',s):s=s[:-2]
    if s.isdigit() and len(s) in (9,11):s='0'+s
    return s if s.isdigit() and len(s) in (10,12) else None
def colnum(s):
    n=0
    for c in re.match('[A-Z]+',s)[0]: n=n*26+ord(c)-64
    return n-1
def date(v):
    if isinstance(v,(int,float)):return dt.datetime(1899,12,30)+dt.timedelta(days=v)
    if isinstance(v,dt.datetime):return v
    try:return dt.datetime.fromisoformat(str(v).replace('Z',''))
    except ValueError:
        for fmt in ('%d.%m.%Y %H:%M:%S','%d.%m.%Y %H:%M','%d.%m.%Y'):
            try:return dt.datetime.strptime(str(v),fmt)
            except ValueError:pass
    raise ValueError(f'Нераспознанная дата: {v!r}')

def workbook(path, audit):
    """Read actual XML rows of EVERY sheet, ignoring the often incorrect dimension."""
    path=Path(path); sha=hashlib.sha256(path.read_bytes()).hexdigest()
    source={'file':path.name,'sha256':sha,'sheets':[]};audit.append(source)
    cache=ROOT/'.cache'/f'{sha}.pickle.gz';cache.parent.mkdir(exist_ok=True)
    if cache.exists():
        with gzip.open(cache,'rb') as f:out, meta=pickle.load(f)
        source['sheets']=meta;return out
    out=[]
    with zipfile.ZipFile(path) as z:
        shared=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            for _, e in ET.iterparse(z.open('xl/sharedStrings.xml'),events=('end',)):
                if e.tag==NS+'si':shared.append(''.join(t.text or '' for t in e.iter(NS+'t')));e.clear()
        rel=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        targets={r.attrib['Id']:r.attrib['Target'].lstrip('/') for r in rel}
        book=ET.fromstring(z.read('xl/workbook.xml'))
        for sheet in book.find(NS+'sheets'):
            target=targets[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            if not target.startswith('xl/'):target='xl/'+target
            rows=[];maxcol=0;nonempty=0;cells=0
            for _,e in ET.iterparse(z.open(target),events=('end',)):
                if e.tag!=NS+'row':continue
                r=[]
                for c in e.findall(NS+'c'):
                    i=colnum(c.attrib['r']);r.extend([None]*max(0,i+1-len(r)))
                    v=c.find(NS+'v');s=v.text if v is not None else None
                    kind=c.attrib.get('t')
                    if kind=='s':v=shared[int(s)] if s is not None else None
                    elif kind=='inlineStr':v=''.join(t.text or '' for t in c.iter(NS+'t'))
                    elif kind in ('str','e'):v=s
                    elif s is None:v=None
                    else:
                        try:v=float(s);v=int(v) if v.is_integer() else v
                        except ValueError:v=s
                    r[i]=v;cells+=v is not None
                maxcol=max(maxcol,len(r));nonempty+=any(v is not None for v in r)
                rows.append((int(e.attrib['r']),r));e.clear()
            meta={'name':sheet.attrib['name'],'rows':len(rows),'nonemptyRows':nonempty,'columns':maxcol,'nonemptyCells':cells,'state':sheet.attrib.get('state','visible')}
            source['sheets'].append(meta);out.append((sheet.attrib['name'],rows))
    with gzip.open(cache,'wb',compresslevel=1) as f:pickle.dump((out,source['sheets']),f,protocol=5)
    return out

def cell(r,i):return r[i] if i<len(r) else None

def week_bucket(stage_date, year, quarter, through):
    """Partition the snapshot, not a fabricated history of new sales."""
    if not stage_date:return 'undated'
    day=dt.date.fromisoformat(stage_date)
    start=dt.date(year,3*(quarter-1)+1,1)
    if day<start:return 'before'
    if day>through:return 'after'
    return (day-dt.timedelta(days=day.weekday())).isoformat()

def weekly_distribution(counts, year, quarter, through):
    start=dt.date(year,3*(quarter-1)+1,1)
    end=min(dt.date(year,quarter*3+1,1)-dt.timedelta(days=1),through)
    monday=start-dt.timedelta(days=start.weekday());weeks=[]
    while monday<=end:
        first=max(monday,start);last=min(monday+dt.timedelta(days=6),end)
        weeks.append({'id':monday.isoformat(),'start':first.isoformat(),'end':last.isoformat(),
                      'partial':(last-first).days<6,'count':counts[monday.isoformat()]})
        monday+=dt.timedelta(days=7)
    result={'basis':'lastStageDate','weeks':weeks,'before':counts['before'],
            'undated':counts['undated'],'after':counts['after']}
    assert sum(w['count'] for w in weeks)+sum(result[k] for k in ('before','undated','after'))==sum(counts.values())
    return result

def survey_summary(rows):
    """Completed, deduplicated questionnaires; never average weekly averages."""
    n=len(rows); respondents=len({r['employeeId'] or r['name'] for r in rows})
    means=[sum(r['scores'][i] for r in rows)/n if n else None for i in range(4)]
    def metric(v):return {'value':v,'status':'ready' if n else 'missing','sample':respondents,'responses':n}
    return {'questions':means,'process':metric(sum(means[:3])/3 if n else None),
            'leads':metric(means[3]),'sample':respondents,'responses':n}

def survey_period(rows, year, quarter, through):
    """Calendar weeks of survey creation, matching the existing quarter basis."""
    buckets=collections.defaultdict(list)
    for row in rows:
        day=dt.date.fromisoformat(row['date'][:10])
        buckets[(day-dt.timedelta(days=day.weekday())).isoformat()].append(row)
    calendar=weekly_distribution(collections.Counter(),year,quarter,through)['weeks']
    weeks=[{k:w[k] for k in ('id','start','end','partial')} | survey_summary(buckets[w['id']]) for w in calendar]
    assert sum(w['responses'] for w in weeks)==len(rows),'Survey dates outside the reporting period'
    return {'basis':'surveyCreated','questions':survey_summary(rows)['questions'],'weeks':weeks}

def read_optional(path, kind):
    """Future adapters accept validated CSV, one record per documented natural key."""
    if not path:return []
    required={'employeeId','quarter','sourceId'}|({'volume','recipients'} if kind=='payroll' else {'count'})
    with Path(path).open(encoding='utf-8-sig',newline='') as f:
        reader=csv.DictReader(f);assert required<=set(reader.fieldnames or []),f'{kind}: отсутствуют поля {required-set(reader.fieldnames or [])}'
        rows=list(reader)
    seen=set();period_keys=set()
    for r in rows:
        assert r['sourceId'] not in seen, f'{kind}: повтор sourceId';seen.add(r['sourceId'])
        r['employeeId']=ident(r['employeeId']);r['quarter']=int(r['quarter']);assert 1<=r['quarter']<=3
        key=(r['employeeId'],r['quarter']);assert key not in period_keys,f'{kind}: повтор сотрудник/квартал';period_keys.add(key)
        for field in required-{'employeeId','quarter','sourceId'}:
            r[field]=float(r[field]);assert math.isfinite(r[field]) and r[field]>=0
            if field!='volume':assert r[field].is_integer()
    return rows

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--sources',default=str(ROOT/'data/sources.json'));args=parser.parse_args()
    config=json.loads(Path(args.sources).read_text());sources=[];issues=[];corrections=[]
    output=ROOT/'output/audit';output.mkdir(parents=True,exist_ok=True)
    public=ROOT/'public/dashboard';public.mkdir(parents=True,exist_ok=True)
    def log(s):print(s,flush=True)
    log('Чтение справочников')
    clusters=workbook(config['branches'],sources)[0][1];allbranches={};aliases={}
    for rn,r in clusters[1:]:
        if not cell(r,1):continue
        bid=ident(r[1]);allbranches[bid]={'id':bid,'name':GEO.get(bid,(r[2],''))[0],'officialName':r[2],'tb':r[0],'iso':GEO.get(bid,('',''))[1]}
        aliases[norm(r[2])]=bid
    allowed={ident(r[1]) for _,r in clusters[1:] if cell(r,4) in (1,2,3)}
    for s,b in {'го по спб':'9500','госб по спб':'9500','го по г. санкт-петербургу':'9500','головное отделение по санкт-петербургу':'9500',
      'го по ло':'9600','головное отделение по ло':'9600','го по ленинградской области':'9600','головное отделение по ленинградской области':'9600',
      'аппарат московского банка':'9038','московский банк':'9038','восточное госб':'1023','южное госб':'1024','западное госб':'1025','северное госб':'1026',
      'приморское отделение':'8635','калининградское отделение':'8626','мурманское отделение':'8627','го по нижегородской области':'9042','головное отделение по нижегородской области':'9042',
      'головное отделение по республике крым':'9052','головное отделение по донецкой народной республике':'9053','головное отделение по луганской народной республике':'9014',
      'го по воронежской области':'9013','хабаровское отделение':'9070','благовещенское отделение':'8636','дагестанское отделение':'8590'}.items():aliases[s]=b
    def branch(raw):
        s=norm(raw);m=re.search(r'№\s*(\d+)',s)
        if m:return ident(m[1])
        if s.startswith('аппарат ') and s!='аппарат московского банка':return 'tb:'+s
        return aliases.get(s)
    staff={};names=collections.defaultdict(set);evidence=collections.defaultdict(set)
    roster=workbook(config['roster'],sources)
    for sheet,rows in roster:
        if sheet!='Лист2':continue
        for rn,r in rows:
            if rn<7 or not cell(r,11):continue
            eid=ident(cell(r,10));name=str(r[11]).strip();raw=cell(r,7);bid=CONFIRMED.get(eid) or branch(raw) or branch(cell(r,6))
            if not eid:issues.append({'type':'staff_id_missing','source':Path(config['roster']).name,'row':rn,'name':name});continue
            assert eid not in staff,f'Повтор табельного номера {eid}'
            assert not cell(r,12) or norm(cell(r,12)) in ROLES,f'Неизвестная роль M, строка {rn}'
            role=ROLES.get(norm(cell(r,12)));staff[eid]={'id':eid,'name':name,'branch':bid,'role':role,'position':cell(r,9),'tb':cell(r,5),'rawId':str(cell(r,10)),'rawBranch':raw,'row':rn}
            names[norm(name)].add(eid)
            if bid:evidence[norm(name)].add(bid)
            if role:
                corrections.append({'employeeId':eid,'name':name,'source':Path(config['roster']).name,'row':rn,'rawBranch':raw,'branch':bid,'basis':'Подтверждённое назначение №9042' if eid in CONFIRMED else 'Код ГОСБ / подтверждённый словарь названий','roleSource':str(cell(r,12))})
    pilots={e:s for e,s in staff.items() if s['role']}
    assert all(s['branch'] in allbranches for s in pilots.values()),'Участник пилота без подтверждённого ГОСБ'
    pilotbranches={s['branch'] for s in pilots.values()};branches={b:{**allbranches[b],'pilot':b in pilotbranches} for b in sorted(allbranches)}
    def person(name):
        ids=names.get(norm(name),set());return next(iter(ids)) if len(ids)==1 else None
    def cohort(eid,bid):
        if eid in pilots:return 'pilot',pilots[eid]['branch'],pilots[eid]['role']
        # Membership, not geography, defines the comparison cohort. Unknown
        # branches remain in the all-branch total, never in a made-up branch.
        return 'nonpilot',bid,'all'
    log(f'Справочник: {len(branches)} ГОСБ; пилот: {len(pilots)} сотрудников, {len(pilotbranches)} ГОСБ')
    log('Чтение всех строк встреч')
    meetings={};meeting_duplicates=0;invalid_inn=0;present=set();meeting_conflicts=set()
    for sheet,rows in workbook(config['meetings'],sources):
        for rn,r in rows:
            if rn==1:continue
            if len(r)<8:continue
            eid=ident(r[7]) or person(r[4]);bid=branch(r[1]);name=norm(r[4]);vals=tuple(int(cell(r,i) or 0) for i in (10,11,12))
            assert all(float(cell(r,i) or 0)==vals[j] and vals[j]>=0 for j,i in enumerate((10,11,12)))
            if bid:evidence[name].add(bid)
            if eid in pilots and name:assert name==norm(pilots[eid]['name']),f'Конфликт табельного номера и ФИО во встречах: {rn}'
            if eid in pilots and bid:assert bid==pilots[eid]['branch'],f'Конфликт назначения во встречах: {rn}'
            if eid:present.add(eid)
            # The physical employee/client relation is the deduplication unit; job titles are not keys.
            rawinn=str(cell(r,2) or '');client=inn(rawinn);key=(eid or ('name:'+name if name else 'unidentified:'+str(rn)),client or 'invalid:'+rawinn)
            fact={'employeeId':eid,'name':str(r[4] or ''),'branch':bid,'inn':client,'rawInn':rawinn,'client':str(r[3] or ''),'values':vals,'row':rn,'sheet':sheet,'source':Path(config['meetings']).name,'rawBranch':r[1]}
            if key in meetings:
                meeting_duplicates+=1
                if meetings[key]['values']!=vals:
                    meeting_conflicts.add(key);issues.append({'type':'meeting_conflict','employeeId':eid,'inn':client,'row':rn,'previousRow':meetings[key]['row']})
                continue
            meetings[key]=fact
    log('Чтение квартальных срезов')
    offers=[];source_controls={};unresolved=collections.defaultdict(collections.Counter);offer_registry={1:[],2:[],3:[]};global_ids={};asof_dates=collections.Counter()
    for q in (3,1,2):
        log(f'Срез {q}')
        seen={};rawstages=collections.Counter();dupes=0
        for sheet,rows in workbook(config['sales'][str(q)],sources):
            if not rows:continue
            header=rows[0][1]
            if 'ID продуктового предложения' not in header:continue
            hi={v:i for i,v in enumerate(header)}
            def get(r,key):return cell(r,hi[key]) if key in hi else None
            for rn,r in rows[1:]:
                oid=str(get(r,'ID продуктового предложения') or '').strip();name=str(get(r,'КМ') or '').strip();product=str(get(r,'Продукт') or '').strip();stage=str(get(r,'Стадия продажи') or '').strip()
                if not oid:issues.append({'type':'offer_id_missing','quarter':q,'row':rn});continue
                signature=(name,product,stage,str(get(r,'Клиент (ИНН)')))
                if oid in seen:
                    assert seen[oid]==signature,f'Конфликт ID предложения {oid}, квартал {q}'
                    dupes+=1;continue
                seen[oid]=signature;rawstages[stage]+=1
                eid=person(name);rawbranch=get(r,'ГОСБ');bid=branch(rawbranch)
                if q==3 and get(r,'Дата перехода на стадию') is not None and get(r,'Количество дней на текущей стадии') is not None:
                    asof_dates[(date(get(r,'Дата перехода на стадию'))+dt.timedelta(days=int(get(r,'Количество дней на текущей стадии')))).date().isoformat()]+=1
                if q==3 and eid in pilots and bid:assert bid==pilots[eid]['branch'],f'Конфликт назначения в продажах: {rn}'
                if q==3 and bid:evidence[norm(name)].add(bid)
                if not bid and eid in staff:bid=staff[eid]['branch']
                if not bid and len(evidence[norm(name)])==1:bid=next(iter(evidence[norm(name)]))
                group,bid,role=cohort(eid,bid)
                if not bid:unresolved[q][name]+=1
                if not group:continue
                fact={'quarter':q,'id':oid,'employeeId':eid,'name':name,'branch':bid,'group':group,'role':role,'product':product,'fot':product==FOT,'complex':product in COMPLEX,'stage':stage,'inn':inn(get(r,'Клиент (ИНН)')),'client':str(get(r,'Клиент (наименование)') or ''),'row':rn,'sheet':sheet,'source':Path(config['sales'][str(q)]).name,'rawBranch':rawbranch,'basis':'Табельный номер из однозначного ФИО; фиксированный состав пилота' if group=='pilot' else ('ГОСБ исходной строки' if rawbranch else 'Однозначное назначение по справочникам')}
                offers.append(fact)
                raw_date=get(r,'Дата перехода на стадию')
                try:fact['stageDate']=date(raw_date).date().isoformat() if raw_date is not None else None
                except (ValueError,OverflowError,TypeError):
                    fact['stageDate']=None
                    issues.append({'type':'stage_date_invalid','quarter':q,'row':rn,'source':fact['source']})
                if group=='pilot':offer_registry[q].append(fact)
        source_controls[q]={'offers':len(seen),'duplicates':dupes,'stages':dict(rawstages)};global_ids[q]=set(seen)
    assert len(asof_dates)==1,'Дата нового среза должна однозначно определяться из стадии и количества дней'
    asof=next(iter(asof_dates));asof_date=dt.date.fromisoformat(asof)
    for q,c in unresolved.items():
        for name,count in c.items():issues.append({'type':'historical_assignment' if q<3 else 'assignment','quarter':q,'name':name,'records':count,'reason':'Нет однозначного подтверждённого ГОСБ'})
    log('Чтение и устранение повторов анкет')
    surveys={};survey_duplicates=0;survey_invalid=0
    for path in sorted(Path(config['surveys']).glob('Настроение*.xlsx')):
        for sheet,rows in workbook(path,sources):
            if not rows:continue
            header=rows[0][1];statuscols=[i for i,h in enumerate(header) if str(h).startswith('Статус прох')]
            if not statuscols or not any('Как прошла Ваша' in str(h) for h in header):continue
            for rn,r in rows[1:]:
                if cell(r,statuscols[0])!='Пройдено':continue
                vals=[cell(r,i) for i in (9,11,13,15)]
                if not all(isinstance(x,(float,int)) and x in (1,2,3) for x in vals):survey_invalid+=1;continue
                created=date(r[0]);updated=date(r[3]);external=ident(r[4]);key=(external,created.isoformat());eid=external if external in staff else person(r[5])
                bid=branch(r[8]) or (staff.get(eid) or {}).get('branch');group,bid,role=cohort(eid,bid)
                fact={'id':external+'|'+created.isoformat(),'employeeId':eid,'name':(staff.get(eid) or {}).get('name',str(r[5])),'branch':bid,'group':group,'role':role,'quarter':(created.month-1)//3+1,'date':created.isoformat(),'updated':updated.isoformat(),'scores':vals,'source':path.name,'sheet':sheet,'row':rn}
                if key in surveys:
                    survey_duplicates+=1
                    if fact['updated']<surveys[key]['updated']:continue
                    if fact['updated']==surveys[key]['updated']:assert fact['scores']==surveys[key]['scores'],'Конфликт анкеты'
                surveys[key]=fact
    surveys=[s for s in surveys.values() if s['group'] and s['quarter'] in (1,2,3)]
    eligiblemeet=[]
    for key,f in meetings.items():
        eid=f['employeeId'];bid=f['branch'] or (staff.get(eid) or {}).get('branch')
        group,bid,role=cohort(eid,bid)
        if not group:continue
        # An unnamed source row is not a contradictory duplicate. It already
        # has its own physical-row key and remains in the nonpilot aggregate.
        identity_missing=not bool(f['employeeId'] or norm(f['name']))
        f.update(group=group,branch=bid,role=role,conflict=key in meeting_conflicts,identityMissing=identity_missing);eligiblemeet.append(f)
        if identity_missing:issues.append({'type':'meeting_identity','source':f['source'],'row':f['row'],'branch':bid,'reason':'Нет ФИО и табельного номера; строка сохранена отдельно в непилоте'})
        if not f['inn']:invalid_inn+=1
    del meetings
    # Materialise aggregates for every supported single-branch / single-role context.
    def keys(f):
        for b in (('all',f['branch']) if f['branch'] in branches else ('all',)):
            for role in (('all',f['role']) if f['group']=='pilot' else ('all',)):
                yield f"{f['group']}:{b}:{role}"
    def acc():return {'sales':0,'complex':0,'denominator':0,'stages':collections.Counter(),'products':collections.Counter(),'complexStages':collections.Counter(),'complexProducts':collections.Counter(),'employees':collections.Counter(),'meetings':0,'meetingRows':0,'answers':[],'respondents':set(),'payroll':0,'recipients':0,'appeals':0,'optional':set()}
    ag=collections.defaultdict(lambda:collections.defaultdict(acc));bases=collections.defaultdict(set);covered=collections.defaultdict(set);mconf=collections.Counter();minvalid=collections.Counter()
    weekly=collections.defaultdict(lambda:collections.defaultdict(collections.Counter))
    funnel_weekly=collections.defaultdict(lambda:collections.defaultdict(lambda:collections.defaultdict(collections.Counter)))
    survey_rows=collections.defaultdict(lambda:collections.defaultdict(list))
    for f in offers:
        q=f['quarter'];quarter_end=dt.date(config['year'],q*3+1,1)-dt.timedelta(days=1)
        bucket=week_bucket(f['stageDate'],config['year'],q,min(quarter_end,asof_date))
        for key in keys(f):
            for scope in (('with','without') if not f['fot'] else ('with',)):
                a=ag[key+':'+scope][f['quarter']]
                if f['group']=='nonpilot' or f['role'] in ('senior','junior'):
                    a['sales']+=1;a['stages'][f['stage']]+=1;a['products'][f['product']]+=1
                    weekly[key+':'+scope][q][bucket]+=1
                    for stage_id, stage_name in FUNNEL_STAGES.items():
                        if norm(f['stage'])==norm(stage_name):funnel_weekly[key+':'+scope][q][stage_id][bucket]+=1
                    if f['group']=='pilot':a['employees'][f['employeeId']]+=1
                if (f['group']=='nonpilot' or f['role']=='senior') and not f['fot']:
                    a['denominator']+=1;a['complex']+=f['complex']
                    if f['complex']:a['complexStages'][f['stage']]+=1;a['complexProducts'][f['product']]+=1
    for f in eligiblemeet:
        if f['group']=='pilot' and f['role'] not in ('senior','junior'):continue
        for key in keys(f):
            if f['inn']:
                bases[key].add(f['inn'])
                if any(f['values'][1:]):covered[key].add(f['inn'])
            else:minvalid[key]+=1
            if f['conflict']:mconf[key]+=1
            for scope in ('with','without'):
                for q,v in enumerate(f['values'],1):a=ag[key+':'+scope][q];a['meetings']+=v;a['meetingRows']+=1
    for f in surveys:
        for key in keys(f):
            for scope in ('with','without'):
                a=ag[key+':'+scope][f['quarter']];a['answers'].append(f['scores']);a['respondents'].add(f['employeeId'] or f['name'])
                survey_rows[key+':'+scope][f['quarter']].append(f)
    for kind in ('payroll','appeals'):
        for r in read_optional(config.get(kind),kind):
            assert r['employeeId'] in staff,f"{kind}: неизвестный сотрудник {r['employeeId']}"
            p=staff[r['employeeId']];g,b,role=cohort(p['id'],p['branch'])
            if not g or (kind=='payroll' and g=='pilot' and role!='junior'):continue
            for key in keys({'group':g,'branch':b,'role':role}):
                for scope in ('with','without'):
                    a=ag[key+':'+scope][r['quarter']];a['optional'].add(kind)
                    if kind=='payroll':a['payroll']+=r['volume'];a['recipients']+=r['recipients']
                    else:a['appeals']+=r['count']
    def stat(v=None,status='ready',reason=None,**extra):return {'value':v,'status':status,**({'reason':reason} if reason else {}),**extra}
    missing=stat(None,'missing','Ожидаются данные');na=stat(None,'notApplicable','Показатель не применяется к выбранной роли')
    # Unassigned facts stay in the overall nonpilot total, never in every branch.
    unassigned={str(q):{'with':0,'without':0,'complex':0} for q in (1,2,3)}
    for f in offers:
        if f['group']=='nonpilot' and not f['branch']:
            u=unassigned[str(f['quarter'])];u['with']+=1
            if not f['fot']:u['without']+=1;u['complex']+=bool(f['complex'])
    views={}
    for group in ('pilot','nonpilot'):
        for bid in ['all']+list(branches):
            for role in (('all','senior','junior','akm') if group=='pilot' else ('all',)):
                k=f'{group}:{bid}:{role}';scope_staff=[p for p in pilots.values() if (bid=='all' or p['branch']==bid) and (role=='all' or p['role']==role)]
                ms=[p for p in scope_staff if p['role'] in ('senior','junior')];absent=[p['id'] for p in ms if p['id'] not in present] if group=='pilot' else []
                km_staff = [p for p in staff.values() if (bid=='all' or p['branch']==bid) and ((p['role'] in ('senior','junior') and (role=='all' or p['role']==role)) if group=='pilot' else (not p['role'] and not is_akm_position(p['position'])))]
                for scope in ('without','with'):
                    key=k+':'+scope;periods=[]
                    for q in (1,2,3):
                        a=ag[key][q];branch_only=group=='nonpilot' and bid!='all';salesrole=group=='nonpilot' or role!='akm';complexrole=group=='nonpilot' or role in ('all','senior')
                        unknown=unassigned[str(q)]
                        def assigned_stat(n,unplaced,**extra):
                            if not branch_only or not unplaced:return stat(n,**extra)
                            if not n:return stat(None,'missing','Нет предложений с подтверждённой привязкой к этому ГОСБ; нераспределённые предложения учитываются отдельно',assignedOnly=True,observed=0,**extra)
                            return stat(n,reason='Учтены предложения с известным ГОСБ. Нераспределённые предложения не включены; полнота кварталов для сравнения не подтверждена',assignedOnly=True,**extra)
                        ss=assigned_stat(a['sales'],unknown[scope]);cs=assigned_stat(a['complex'],unknown['complex'],denominator=a['denominator'])
                        share=(stat(100*a['complex']/a['denominator'],numerator=a['complex'],denominator=a['denominator'],**({'assignedOnly':True,'reason':'Доля среди предложений с известным ГОСБ; нераспределённые предложения не включены'} if branch_only and unknown['without'] else {})) if a['denominator'] else stat(None,'missing','Нет портфеля для расчёта доли'))
                        # Confirmed by the owner: an employee absent from the
                        # supplied meeting export contributes zero meetings.
                        meetings_stat=stat(a['meetings'])
                        if mconf[k]:meetings_stat=stat(None,'unverified','Конфликт идентификации или повторов встреч',observed=a['meetings'])
                        answers=a['answers'];n=len(answers);resp=len(a['respondents']);process=stat(sum(sum(v[:3]) for v in answers)/(3*n),sample=resp,responses=n) if n else stat(None,'missing','Нет завершённых анкет за квартал',sample=0,responses=0)
                        leads=stat(sum(v[3] for v in answers)/n,sample=resp,responses=n) if n else stat(None,'missing','Нет завершённых анкет за квартал',sample=0,responses=0)
                        def optional_stat(kind,field):
                            if kind not in a['optional']:return missing
                            if q not in config.get(kind+'VerifiedQuarters',[]):return stat(None,'unverified','Источник получен; полнота квартала ещё не подтверждена',observed=a[field])
                            return stat(a[field])
                        payroll=optional_stat('payroll','payroll')
                        recipients=optional_stat('payroll','recipients')
                        periods.append({'quarter':q,'sales':ss if salesrole else na,'complex':cs if complexrole else na,'complexShare':share if complexrole else na,'meetings':meetings_stat if salesrole else na,'process':process,'leads':leads,'appeals':optional_stat('appeals','appeals'),'payroll':payroll if role in ('all','junior') else na,'recipients':recipients if role in ('all','junior') else na,'stages':dict(a['stages']) if salesrole else {},'products':[{'name':p,'count':n,'complex':p in COMPLEX} for p,n in a['products'].most_common()] if salesrole else [],'employees':[{'id':e,'count':n} for e,n in a['employees'].most_common()] if salesrole else [],'complexStages':dict(a['complexStages']) if complexrole else {},'complexProducts':[{'name':p,'count':n,'complex':True} for p,n in a['complexProducts'].most_common()] if complexrole else []})
                        periods[-1]['survey']=survey_period(survey_rows[key][q],config['year'],q,asof_date)
                        if salesrole and ss['status']=='ready':
                            periods[-1]['salesWeeks']=weekly_distribution(weekly[key][q],config['year'],q,asof_date)
                            assert sum(weekly[key][q].values())==a['sales']
                            periods[-1]['funnel']={stage_id:weekly_distribution(funnel_weekly[key][q][stage_id],config['year'],q,asof_date) for stage_id in FUNNEL_STAGES}
                            for stage_id,stage_name in FUNNEL_STAGES.items():
                                assert sum(funnel_weekly[key][q][stage_id].values())==sum(n for name,n in a['stages'].items() if norm(name)==norm(stage_name))
                    coverage=stat(100*len(covered[k])/len(bases[k]),numerator=len(covered[k]),denominator=len(bases[k])) if bases[k] else stat(None,'missing','Нет закреплённой клиентской базы')
                    if mconf[k] or minvalid[k]:coverage=stat(None,'unverified','Конфликт идентификации сотрудников или клиентов')
                    if role=='akm':coverage=na
                    views[key]={'periods':periods,'coverage':coverage,'staffCount':len(scope_staff) if group=='pilot' else None,'kmCount':len(km_staff),'missingMeetingStaff':absent}
    log('Независимая сверка через SQL')
    db=sqlite3.connect(':memory:');db.execute('create table offers(q int, grp text, branch text, role text, fot int, complex int, stage text, product text)')
    db.executemany('insert into offers values(?,?,?,?,?,?,?,?)',[(f['quarter'],f['group'],f['branch'],f['role'],f['fot'],f['complex'],f['stage'],f['product']) for f in offers])
    db.execute('create index offers_scope on offers(grp,q,branch,role,fot)')
    checks=0
    for key,v in views.items():
        g,b,r,scope=key.split(':');where='grp=?';params=[g]
        if b!='all':where+=' and branch=?';params.append(b)
        if r!='all':where+=' and role=?';params.append(r)
        for p in v['periods']:
            query=where+' and q=?';ps=params+[p['quarter']]
            if scope=='without':query+=' and fot=0'
            if g=='pilot':query+=" and role in ('senior','junior')"
            expected=db.execute('select count(*) from offers where '+query,ps).fetchone()[0]
            if p['sales']['status']=='ready':assert p['sales']['value']==expected;assert sum(p['stages'].values())==expected;checks+=2
            query=where+' and q=? and fot=0'+(" and role='senior'" if g=='pilot' else '')
            cn,den=db.execute('select coalesce(sum(complex),0),count(*) from offers where '+query,ps).fetchone()
            if p['complex']['status']=='ready':assert p['complex']['value']==cn;checks+=1
            if p['complexShare']['status']=='ready':assert p['complexShare']['denominator']==den;checks+=1
        if v['coverage']['status']=='ready':assert 0<=v['coverage']['value']<=100;checks+=1
    assert len({s['id'] for s in surveys})==len(surveys)
    assert len(pilots)==130 and len(pilotbranches)==23,'Изменился состав: требуется пересмотр контрольного состава'
    controls={'sourceSales':source_controls,'pilotStaff':len(pilots),'pilotBranches':len(pilotbranches),'roles':dict(collections.Counter(s['role'] for s in pilots.values())), 'meetingDuplicatesRemoved':meeting_duplicates,'meetingConflicts':len(meeting_conflicts),'invalidClientIdentifiers':invalid_inn,'surveyDuplicatesRemoved':survey_duplicates,'surveyInvalidCompleted':survey_invalid,'surveyResponsesInScope':len(surveys),'sqlChecks':checks,'crossQuarterRepeatedIds':{'1–2':len(global_ids[1]&global_ids[2]),'2–3':len(global_ids[2]&global_ids[3])},'unresolvedAssignments':{str(q):dict(c) for q,c in unresolved.items()},'pilotWithoutFot':views['pilot:all:all:without']}
    manifest={'version':1,'year':config['year'],'asOf':asof,'periods':[{'quarter':1,'label':'I квартал','through':'31.03.2026','partial':False},{'quarter':2,'label':'II квартал','through':'30.06.2026','partial':False},{'quarter':3,'label':'III квартал','through':asof_date.strftime('%d.%m.%Y'),'partial':asof_date<dt.date(config['year'],9,30)}], 'branches':list(branches.values()),'staff':[{k:v for k,v in p.items() if k!='position'} for p in pilots.values()],'views':views,'sources':sources,'quality':{'checks':checks,'meetingMissingStaff':[p['id'] for p in pilots.values() if p['role'] in ('senior','junior') and p['id'] not in present],'unresolvedByQuarter':{str(q):sum(c.values()) for q,c in unresolved.items()},'unassignedOffersByQuarter':unassigned,'surveyCount':len(surveys)},'complexProducts':sorted(COMPLEX)}
    def write(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    write(public/'manifest.json',manifest)
    for q,rows in offer_registry.items():
        with gzip.GzipFile(filename=str(public/f'offers-{q}.json.gz'),mode='wb',mtime=0) as f:f.write(json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode())
    for name,rows in [('meetings',[f for f in eligiblemeet if f['group']=='pilot']),('surveys',[f for f in surveys if f['group']=='pilot'])]:
        with gzip.GzipFile(filename=str(public/f'{name}.json.gz'),mode='wb',mtime=0) as f:f.write(json.dumps(rows,ensure_ascii=False,separators=(',',':')).encode())
    write(output/'controls.json',controls);write(output/'issues.json',issues);write(output/'assignments.json',corrections);write(output/'sources.json',sources)
    write(output/'canonical-facts.json',{'offers':offers,'meetings':eligiblemeet,'surveys':surveys})
    log(json.dumps({k:v for k,v in controls.items() if k not in ('pilotWithoutFot','unresolvedAssignments')},ensure_ascii=False))
    log('Готово: public/dashboard/manifest.json; output/audit')

if __name__=='__main__':main()

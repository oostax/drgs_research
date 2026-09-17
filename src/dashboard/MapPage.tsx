import { useEffect, useMemo, useRef, useState } from 'react';
import { geoConicEqualArea, geoPath } from 'd3-geo';
import type { FeatureCollection, Geometry } from 'geojson';
import type { Branch, Context, Group, Manifest, Metric } from './types';
import { availableMetrics, contextUrl, delta, format, groupNames, metricNames, quarters, roleNames, statusText, value } from './model';
import { Icon } from './Icons';
import { Select } from './Select';
import { mapBranchIso, mapColor, mapPalettes, mapScore, mapUnits, type MapMode } from './mapModel';
import './MapPage.css';

type Shape = { iso: string; path: string; center: [number, number]; bounds: [[number, number], [number, number]] };
const overrides: Record<string, [number, number]> = {
  '9500': [30.31, 59.94], '9600': [32.2, 60.3], '9038': [37.62, 55.75],
  '1023': [39, 55.6], '1024': [37.8, 54.8], '1025': [36.1, 55.5], '1026': [37.6, 56.4],
};
const cohortNames = { pilot: 'Пилот', nonpilot: 'Непилот' };
const numeric = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n);

export function MapPage({ data, c, change }: { data: Manifest; c: Context; change: (p: Partial<Context>) => void }) {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('desc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sidebar = useRef<HTMLElement>(null);
  const mapPanel = useRef<HTMLDivElement>(null);
  const [paintGroup, setPaintGroup] = useState<Group>(() => data.branches.some(b => b.id === c.branch && !b.pilot) ? 'nonpilot' : 'pilot');
  const [mode, setMode] = useState<MapMode>('value');
  const [camera, setCamera] = useState({ zoom: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const suppressClick = useRef(false);
  const drag = useRef<{ start: DOMPoint; x: number; y: number; moved: boolean } | null>(null);
  const group: Group = c.group === 'both' ? paintGroup : c.group;
  const comparable = c.quarter > 1 && c.metric !== 'coverage';
  const activeMode = comparable ? mode : 'value';
  const selectedSource = data.branches.find(b => b.id === c.branch && (group !== 'pilot' || b.pilot));
  const selected = selectedSource ? { ...selectedSource, iso: mapBranchIso(selectedSource) } : undefined;
  const projection = useMemo(() => geoConicEqualArea().rotate([-100, 0]).center([0, 62]).parallels([50, 70]).scale(500).translate([540, 300]), []);
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch('/maps/russia.geojson', { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((geo: FeatureCollection<Geometry, { ISO: string }>) => {
        if (controller.signal.aborted) return;
        projection.fitExtent([[30, 35], [1050, 580]], geo);
        const path = geoPath(projection);
        setShapes(geo.features.map(f => ({ iso: f.properties.ISO, path: path(f) || '', center: path.centroid(f), bounds: path.bounds(f) })));
      }).catch(() => { if (!controller.signal.aborted) setError('Карта не загрузилась. Все значения доступны в списке ГОСБ.'); });
    return () => controller.abort();
  }, [projection, retry]);
  const entries = useMemo(() => data.branches.filter(b => group !== 'pilot' || b.pilot).map(sourceBranch => {
    const branch = { ...sourceBranch, iso: mapBranchIso(sourceBranch) };
    const context = { ...c, branch: branch.id };
    const stat = value(data, context, group, c.metric);
    const previous = comparable ? value(data, context, group, c.metric, c.quarter - 1) : undefined;
    return { branch, stat, previous, score: mapScore(stat, previous, activeMode) };
  }), [data, c, group, comparable, activeMode]);
  // Search changes visibility, never the scale or comparison base.
  const maximum = Math.max(1, ...entries.map(e => Math.abs(e.score ?? 0)));
  const byId = new Map(entries.map(e => [e.branch.id, e]));
  const visible = entries.filter(e => (!region || e.branch.iso === region) && (!search || `${e.branch.name} ${e.branch.id}`.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))))
    .sort((a, b) => sort === 'name' ? a.branch.name.localeCompare(b.branch.name, 'ru') : a.score == null ? b.score == null ? a.branch.name.localeCompare(b.branch.name, 'ru') : 1 : b.score == null ? -1 : sort === 'asc' ? a.score - b.score : b.score - a.score);
  const visibleIds = new Set(visible.map(e => e.branch.id));
  const known = entries.filter(e => e.score != null).length;
  const hovered = hover ? byId.get(hover) : undefined;
  const pointFor = (b: Branch) => overrides[b.id] ? projection(overrides[b.id]) : shapes.find(s => s.iso === b.iso)?.center;
  const fit = () => setCamera({ zoom: 1, x: 0, y: 0 });
  const focusBranch = (b: Branch) => {
    const point = pointFor(b), shape = shapes.find(s => s.iso === b.iso);
    if (!point || !shape) return;
    const width = shape.bounds[1][0] - shape.bounds[0][0], height = shape.bounds[1][1] - shape.bounds[0][1];
    const zoom = Math.max(1.5, Math.min(3.6, 680 / Math.max(width, height * 1.6, 1)));
    setCamera({ zoom, x: (540 - point[0]) * zoom, y: (310 - point[1]) * zoom });
  };
  useEffect(() => {
    if (selected && shapes.length) focusBranch(selected);
    // Only an actual selection or loaded geometry moves the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, shapes]);
  useEffect(() => { if (selected) { detailHeading.current?.focus({ preventScroll: true }); if (window.matchMedia?.('(max-width: 950px)').matches) sidebar.current?.scrollIntoView({ block: 'start' }); } }, [selected?.id]);
  useEffect(() => { setHover(null); }, [c.metric, c.quarter, group, activeMode]);
  useEffect(() => { if (c.group === 'both' && data.branches.some(b => b.id === c.branch && !b.pilot)) setPaintGroup('nonpilot'); }, [c.branch, c.group, data.branches]);
  const choose = (b: Branch) => { change({ branch: b.id }); setHover(null); if (selected?.id === b.id) focusBranch(b); };
  const deselect = () => { change({ branch: 'all' }); fit(); };
  const selectGroup = (next: Group) => { setPaintGroup(next); setRegion(null); setSearch(''); setHover(null); if (next === 'pilot' && !selected?.pilot) change({ branch: 'all' }); };
  const zoomBy = (factor: number) => setCamera(old => {
    const zoom = Math.min(5, Math.max(1, old.zoom * factor)), scale = zoom / old.zoom;
    return { zoom, x: old.x * scale, y: old.y * scale };
  });
  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const wheel = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12); };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, [shapes.length, error]);
  const svgPoint = (x: number, y: number) => new DOMPoint(x, y).matrixTransform(svg.current?.getScreenCTM()?.inverse());
  const scoreText = (n: number | null) => n == null ? '—' : activeMode === 'value' ? format(n, c.metric) : `${n > 0 ? '+' : ''}${numeric(n)}${mapUnits(c.metric, activeMode) ? ` ${mapUnits(c.metric, activeMode)}` : ''}`;
  const noScore = (e: typeof entries[number]) => activeMode === 'change' && e.stat.status === 'ready' ? 'Нет сравнения' : statusText(e.stat);
  const reset = () => { change({ branch: 'all', group: 'pilot', role: 'all', scope: 'without' }); setSearch(''); setRegion(null); setMode('value'); setSort('desc'); fit(); };
  const partial = data.periods[c.quarter - 1].partial;
  const detailsGroups: Group[] = c.group === 'both' && selected?.pilot ? ['pilot', 'nonpilot'] : [group];
  return <div className="atlas">
    <section className="atlas-filters" aria-label="Фильтры карты">
      <div className="atlas-primary">
        <h1><Icon name="map" size={26} />Карта</h1>
        <Select label="Показатель" value={c.metric} onChange={metric => change({ metric: metric as Metric })} options={availableMetrics(c, data).map(metric => ({ value: metric, label: metricNames[metric] }))} />
        {c.metric === 'coverage' ? <span className="atlas-period-fixed">С 1 апреля · накопительно</span> : <div className="atlas-segment" role="group" aria-label="Квартал карты">{quarters.map((q, i) => <button key={q} aria-label={q} aria-pressed={c.quarter === i + 1} onClick={() => change({ quarter: i + 1 })}>{['I', 'II', 'III'][i]} кв.</button>)}</div>}
        <span className="atlas-date"><Icon name="clock" size={15} />{data.year} · {partial ? `по ${data.periods[c.quarter - 1].through.slice(0, 5)} · неполный квартал` : quarters[c.quarter - 1]}</span>
      </div>
      <button className="atlas-mobile-filters" aria-expanded={filtersOpen} aria-controls="atlas-extra-filters" onClick={() => setFiltersOpen(!filtersOpen)}><Icon name="filter" size={17} /><span>Фильтры · {c.group === 'both' ? 'Сравнение групп' : cohortNames[c.group]}</span><Icon name="down" size={15} /></button>
      <div id="atlas-extra-filters" className={`atlas-secondary ${filtersOpen ? 'is-open' : ''}`}>
        <Select label="Группа" value={c.group} onChange={next => { change({ group: next as Context['group'], branch: 'all' }); setSearch(''); setRegion(null); fit(); }} options={[{ value: 'pilot', label: 'Пилот' }, { value: 'nonpilot', label: 'Непилот · все роли' }, { value: 'both', label: 'Сравнение групп' }]} />
        <Select label="Роль пилота" disabled={c.group === 'nonpilot'} value={c.role} onChange={role => change({ role: role as Context['role'] })} options={Object.entries(roleNames).map(([value, label]) => ({ value, label }))} />
        <Select label="Продукты" value={c.metric.startsWith('complex') ? 'without' : c.scope} disabled={c.metric.startsWith('complex')} onChange={scope => change({ scope: scope as Context['scope'] })} options={[{ value: 'without', label: 'Без ФОТ' }, { value: 'with', label: 'С ФОТ' }]} />
        <button className="atlas-reset" onClick={reset}><Icon name="reset" size={16} />Сбросить</button>
      </div>
    </section>
    <section className="atlas-workspace" aria-label="Карта и результаты ГОСБ">
      <div className="atlas-map-panel" ref={mapPanel}>
        <header className="atlas-map-toolbar">
          <div><h2>{activeMode === 'change' ? 'Где растёт и снижается показатель' : 'Распределение по территориям'}</h2><p>{cohortNames[group]}{group === 'nonpilot' ? ' · все роли' : ''} · {known} из {entries.length} ГОСБ {activeMode === 'change' ? 'с базой сравнения' : 'со значениями'}</p></div>
          <div className="atlas-map-modes">
            {c.group === 'both' && <div className="atlas-segment" role="group" aria-label="Группа для окраски карты">{(['pilot', 'nonpilot'] as const).map(g => <button key={g} aria-pressed={group === g} onClick={() => selectGroup(g)}>{cohortNames[g]}</button>)}</div>}
            <div className="atlas-segment" role="group" aria-label="Отображение карты"><button aria-pressed={activeMode === 'value'} onClick={() => setMode('value')}>Значение</button><button aria-pressed={activeMode === 'change'} disabled={!comparable} title={!comparable ? c.metric === 'coverage' ? 'Покрытие считается накопительно' : 'Для первого квартала нет предыдущего периода' : 'Абсолютное изменение к предыдущему кварталу'} onClick={() => setMode('change')}>Изменение</button></div>
          </div>
          <button className="atlas-mobile-jump" onClick={() => { sidebar.current?.scrollIntoView({ block: 'start' }); sidebar.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }); }}><Icon name="search" size={17} />Найти ГОСБ</button>
        </header>
        <div className="atlas-canvas">
          {error ? <div className="atlas-map-message" role="alert"><Icon name="map" size={30} /><p>{error}</p><button onClick={() => setRetry(n => n + 1)}>Повторить загрузку</button></div> : <>
            {!shapes.length && <div className="atlas-map-message" role="status">Загружаем карту…</div>}
            <svg ref={svg} className={`atlas-svg ${dragging ? 'is-dragging' : ''}`} viewBox="0 0 1080 620" aria-label="Интерактивная карта ГОСБ России"
              onPointerDown={e => { if (e.button !== 0 || !e.isPrimary) return; suppressClick.current = false; drag.current = { start: svgPoint(e.clientX, e.clientY), x: camera.x, y: camera.y, moved: false }; }}
              onPointerMove={e => { const d = drag.current; if (!d) return; const point = svgPoint(e.clientX, e.clientY); if (Math.abs(point.x - d.start.x) + Math.abs(point.y - d.start.y) < 5 && !d.moved) return; d.moved = true; setDragging(true); setHover(null); e.currentTarget.setPointerCapture(e.pointerId); setCamera(old => ({ ...old, x: Math.max(-1080 * old.zoom, Math.min(1080 * old.zoom, d.x + point.x - d.start.x)), y: Math.max(-620 * old.zoom, Math.min(620 * old.zoom, d.y + point.y - d.start.y)) })); }}
              onPointerUp={() => { suppressClick.current = !!drag.current?.moved; drag.current = null; setDragging(false); }} onPointerCancel={() => { drag.current = null; setDragging(false); }} onPointerLeave={() => { setHover(null); if (!dragging) drag.current = null; }}>
              <defs><pattern id="atlas-multiple" width="9" height="9" patternUnits="userSpaceOnUse"><rect width="9" height="9" fill="#dce2ec" /><circle cx="4" cy="4" r="1.2" fill="#8794a9" /></pattern><pattern id="atlas-missing" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="#e9ecf2" /><path d="M-1 1 1-1 M0 7 7 0 M6 8 8 6" stroke="#c5cbd5" strokeWidth="1" /></pattern></defs>
              <g className="atlas-geography" style={{ transform: `translate(${camera.x + 540}px, ${camera.y + 310}px) scale(${camera.zoom}) translate(-540px, -310px)` }}>
                {shapes.map(shape => {
                  const es = entries.filter(e => e.branch.iso === shape.iso), single = es.length === 1 ? es[0] : null;
                  const highlighted = selected?.iso === shape.iso || es.some(e => e.branch.id === hover);
                  return <path key={shape.iso} d={shape.path} className={`atlas-region ${es.length ? 'is-available' : ''} ${highlighted ? 'is-highlighted' : ''}`} fill={single ? mapColor(single.score, maximum, group, activeMode) : es.length > 1 ? 'url(#atlas-multiple)' : '#e9ecf1'} stroke={highlighted ? '#20242e' : '#fff'} strokeWidth={highlighted ? 2 : 1} vectorEffect="non-scaling-stroke" opacity={search && !es.some(e => visibleIds.has(e.branch.id)) ? .25 : 1}
                    role={es.length > 1 ? 'button' : undefined} tabIndex={es.length > 1 ? 0 : undefined} aria-label={es.length > 1 ? `Выбрать ГОСБ территории: ${es.map(e => e.branch.name).join(', ')}` : undefined}
                    onClick={() => { if (suppressClick.current || drag.current?.moved) return; if (single) choose(single.branch); else if (es.length > 1) { setRegion(shape.iso); change({ branch: 'all' }); } }}
                    onKeyDown={e => { if (es.length > 1 && ['Enter', ' '].includes(e.key)) { e.preventDefault(); setRegion(shape.iso); change({ branch: 'all' }); } }}
                    onMouseEnter={() => { if (single && !dragging) setHover(single.branch.id); }} onMouseLeave={() => setHover(null)}><title>{es.map(e => `${e.branch.name}: ${scoreText(e.score)}`).join(' · ')}</title></path>;
                })}
                {entries.map(e => {
                  const point = pointFor(e.branch); if (!point || !Number.isFinite(point[0])) return null;
                  const active = selected?.id === e.branch.id, hot = hover === e.branch.id;
                  return <g key={e.branch.id} transform={`translate(${point[0]} ${point[1]})`} className="atlas-pin" opacity={visibleIds.has(e.branch.id) ? 1 : .2} role="button" tabIndex={visibleIds.has(e.branch.id) ? 0 : -1} aria-pressed={active} aria-label={`Выбрать ГОСБ: ${e.branch.name} · ${scoreText(e.score)}`}
                    onClick={() => { if (!suppressClick.current && !drag.current?.moved) choose(e.branch); }} onKeyDown={event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); choose(e.branch); } }} onFocus={() => setHover(e.branch.id)} onBlur={() => setHover(null)} onMouseEnter={() => { if (!dragging) setHover(e.branch.id); }} onMouseLeave={() => setHover(null)}>
                    <circle r={18 / camera.zoom} fill="transparent" />
                    {(active || hot) && <circle className={active ? 'atlas-selection-ring' : ''} r={13 / camera.zoom} fill="none" stroke="#20242e" strokeWidth={1.5 / camera.zoom} />}
                    <circle r={(active || hot ? 7 : 5.5) / camera.zoom} fill={group === 'pilot' ? '#00855e' : '#5746d8'} stroke="#fff" strokeWidth={2 / camera.zoom} />
                  </g>;
                })}
              </g>
            </svg>
          </>}
          <div className="atlas-camera" role="group" aria-label="Управление картой"><button aria-label="Увеличить карту" disabled={camera.zoom >= 5} onClick={() => zoomBy(1.35)}><Icon name="plus" size={19} /></button><span aria-live="polite">{Math.round(camera.zoom * 100)}%</span><button aria-label="Уменьшить карту" disabled={camera.zoom <= 1} onClick={() => zoomBy(1 / 1.35)}><Icon name="minus" size={19} /></button><button aria-label="Показать всю карту" onClick={fit}><Icon name="reset" size={18} /></button></div>
          {selected?.iso && <button className="atlas-map-selection" onClick={() => focusBranch(selected)}><Icon name="map" size={16} /><span>{selected.name}</span><Icon name="arrow" size={15} /></button>}
          {hovered && !dragging && <div className="atlas-tooltip" role="status"><span>{hovered.branch.name}</span><strong>{scoreText(hovered.score)}</strong><small>{cohortNames[group]} · {hovered.score == null ? noScore(hovered) : activeMode === 'change' ? `к ${quarters[c.quarter - 2]}` : quarters[c.quarter - 1]}</small></div>}
        </div>
        <footer className="atlas-map-footer">
          <div className="atlas-scale"><span>{activeMode === 'change' ? `Изменение, ${mapUnits(c.metric, activeMode) || 'шт.'}` : metricNames[c.metric]}</span>{known ? <><div className="atlas-scale-bands">{(activeMode === 'change' ? mapPalettes.change : mapPalettes[group]).map(color => <i key={color} style={{ background: color }} />)}</div><div className="atlas-scale-values"><span>{activeMode === 'change' ? scoreText(-maximum) : scoreText(0)}</span><span>{activeMode === 'change' ? '0' : scoreText(maximum / 2)}</span><span>{scoreText(maximum)}</span></div></> : <p>{activeMode === 'change' ? 'Нет полной базы для сравнения' : 'Нет подтверждённых значений'}</p>}</div>
          <div className="atlas-map-key"><span><i className="atlas-key-missing" />{activeMode === 'change' ? 'Нет сравнения' : 'Нет данных'}</span><span><i />Вне выбранной группы</span><span><i className="atlas-key-multiple" />Несколько ГОСБ · выбор по точкам</span></div>
        </footer>
        <p className="atlas-gesture-hint">Перетаскивайте карту · Ctrl / ⌘ + прокрутка — масштаб · точки и список открывают ГОСБ</p>
      </div>
      <aside ref={sidebar} className="atlas-sidebar" aria-label="Результаты территорий">
        <button className="atlas-mobile-back-map" onClick={() => mapPanel.current?.scrollIntoView({ block: 'start' })}><Icon name="map" size={17} />К карте</button>
        {selected ? <div className="atlas-details" key={selected.id}>
          <div className="atlas-detail-nav"><button onClick={deselect}><Icon name="chevron" size={15} />К списку ГОСБ</button><button aria-label="Снять выбор ГОСБ" onClick={deselect}><Icon name="close" size={18} /></button></div>
          <h2 ref={detailHeading} tabIndex={-1}>{selected.name}</h2><p className="atlas-branch-meta">№{selected.id} · {selected.tb}</p>{!selected.iso && <p className="atlas-unmapped-note"><Icon name="info" size={16} />Регион для карты не подтверждён. Данные ГОСБ доступны ниже.</p>}
          <p className="atlas-detail-metric">{metricNames[c.metric]} · {c.metric === 'coverage' ? 'с 1 апреля' : `${['I', 'II', 'III'][c.quarter - 1]} кв.${partial ? '*' : ''}`}</p>
          {detailsGroups.map(g => {
            const stat = value(data, c, g, c.metric), prior = comparable ? value(data, c, g, c.metric, c.quarter - 1) : null;
            const diff = prior ? delta(stat, prior, c.metric) : null;
            const periods = [1, 2, 3].map(q => value(data, c, g, c.metric, q));
            const peak = Math.max(1, ...periods.map(s => s.status === 'ready' ? s.value ?? 0 : 0));
            return <section className={`atlas-cohort atlas-${g}`} key={g} aria-label={`Результаты ГОСБ: ${groupNames[g]}`}>
              <div className="atlas-cohort-value"><span><i />{cohortNames[g]}</span><strong>{stat.status === 'ready' ? format(stat.value, c.metric) : '—'}</strong></div>
              {comparable && <div className="atlas-cohort-delta"><b className={diff?.tone}>{diff?.text ?? 'Нет сравнения'}</b><span>к {quarters[c.quarter - 2]}</span></div>}
              {stat.reason && <p className="atlas-stat-note">{stat.reason}</p>}
              {stat.numerator != null && stat.denominator != null && <p className="atlas-ratio">{format(stat.numerator)} из {format(stat.denominator)}{c.metric === 'coverage' ? ' клиентов' : ' предложений'}</p>}
              {c.metric !== 'coverage' && <div className="atlas-quarter-bars" role="group" aria-label={`Кварталы: ${cohortNames[g]}`}>{periods.map((s, i) => <button key={i} aria-pressed={c.quarter === i + 1} onClick={() => change({ quarter: i + 1 })} aria-label={`${quarters[i]} · ${cohortNames[g]}: ${s.status === 'ready' && s.value != null ? format(s.value, c.metric) : statusText(s)}`}><span>{['I', 'II', 'III'][i]} кв.</span><span className="atlas-quarter-track">{s.status === 'ready' && s.value != null && <i style={{ width: `${s.value / peak * 100}%` }} />}</span><b>{s.status === 'ready' && s.value != null ? format(s.value, c.metric) : '—'}</b></button>)}</div>}
              {stat.sample != null && <p className="atlas-stat-note">Ответивших: {stat.sample}{stat.sample < 5 ? ' · малая выборка' : ''}</p>}
            </section>;
          })}
          <a className="atlas-analysis-link" href={contextUrl({ ...c, group: c.group === 'both' ? 'both' : group, page: 'analysis' })} onClick={event => { if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); change({ page: 'analysis' }); }}>Разобрать в анализе<Icon name="arrow" size={18} /></a>
          <button className="atlas-detail-clear" onClick={deselect}>Выбрать другой ГОСБ</button>
        </div> : <>
          <div className="atlas-list-heading"><h2>ГОСБ</h2><span aria-live="polite">{visible.length}</span><p>{activeMode === 'change' ? 'Изменение к предыдущему кварталу' : `${cohortNames[group]} · ${metricNames[c.metric].toLocaleLowerCase('ru')}`}</p></div>
          <label className="atlas-search"><Icon name="search" size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Название или номер" aria-label="Поиск территории" />{search && <button aria-label="Очистить поиск территории" onClick={() => setSearch('')}><Icon name="close" size={15} /></button>}</label>
          <div className="atlas-list-sort"><Select label="Сортировка ГОСБ" value={sort} onChange={setSort} options={[{ value: 'desc', label: activeMode === 'change' ? 'Сначала рост' : 'По убыванию' }, { value: 'asc', label: activeMode === 'change' ? 'Сначала снижение' : 'По возрастанию' }, { value: 'name', label: 'По названию' }]} />{region && <button onClick={() => setRegion(null)}>Все регионы<Icon name="close" size={14} /></button>}</div>
          <div className="atlas-territories">{visible.map((e, i) => <button className={`atlas-territory ${hover === e.branch.id ? 'is-hovered' : ''}`} key={e.branch.id} onClick={() => choose(e.branch)} onMouseEnter={() => setHover(e.branch.id)} onMouseLeave={() => setHover(null)} aria-label={`Открыть ГОСБ: ${e.branch.name}`}><span className="atlas-rank">{i + 1}</span><span className="atlas-territory-name">{e.branch.name}<small>№{e.branch.id} · {e.branch.tb}{!e.branch.iso && ' · нет привязки к карте'}</small></span><strong className={activeMode === 'change' ? e.score != null && e.score < 0 ? 'down' : e.score != null && e.score > 0 ? 'up' : '' : ''}>{scoreText(e.score)}{e.score == null && <small>{noScore(e)}</small>}</strong></button>)}{!visible.length && <div className="atlas-empty"><Icon name="search" size={26} /><p>ГОСБ не найдены</p><button onClick={() => { setSearch(''); setRegion(null); }}>Очистить поиск</button></div>}</div>
          <p className="atlas-list-note">Выберите ГОСБ — здесь появятся кварталы и подробности.{entries.some(e => !e.branch.iso) ? ` ${entries.filter(e => !e.branch.iso).length} ГОСБ без подтверждённой привязки к карте.` : " Карта приблизится к территории."}</p>
        </>}
      </aside>
    </section>
    <p className="atlas-method-note"><Icon name="info" size={17} /><span>{activeMode === 'change' ? 'Цвет показывает абсолютное изменение к предыдущему кварталу. Неполная база исключена из сравнения. ' : 'Чем насыщеннее цвет, тем выше значение. Шкала общая для всех ГОСБ выбранной группы и не меняется при поиске. '}{c.metric.startsWith('complex') ? 'Сложные продукты пилота относятся к старшей роли; доля рассчитана от её портфеля без ФОТ. ' : ''}{partial ? `* III квартал по ${data.periods[2].through.slice(0, 5)}.` : ''}</span></p>
  </div>;
}

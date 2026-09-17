import type { SnapshotPeriod } from '../types'
import { fmt } from '../lib/format'

type StageRow = { name: string; values: Record<SnapshotPeriod, number> }
const colors = ['#C8F15A', '#62B8FF', '#B7C7D8', '#FF8B75', '#A98CFF']

export function PeriodVessels({ rows, selected, onSelect }: {
  rows: StageRow[]; selected: SnapshotPeriod; onSelect: (period: SnapshotPeriod) => void
}) {
  const periods: SnapshotPeriod[] = ['Q1', 'Q2', 'Q3']
  const totals = Object.fromEntries(periods.map((p) => [p, rows.reduce((sum, row) => sum + row.values[p], 0)])) as Record<SnapshotPeriod, number>
  return <div className="vessel-layout">
    <div className="vessels" role="group" aria-label="Распределение продаж по стадиям">
      {periods.map((period) => <button key={period} className={`vessel ${selected === period ? 'is-selected' : ''}`} onClick={() => onSelect(period)} aria-pressed={selected === period}>
        <span className="vessel-head"><b>{period}</b><small>{period === 'Q3' ? 'на 23.08' : 'закрыт'}</small></span>
        <span className="vessel-stack">
          {rows.map((row, i) => <span key={row.name} className="vessel-fill" title={`${row.name}: ${fmt(row.values[period])}`} style={{ '--fill': colors[i % colors.length], '--size': `${totals[period] ? Math.max(3, row.values[period] / totals[period] * 100) : 0}%` } as React.CSSProperties}/>) }
        </span>
        <strong>{fmt(totals[period])}</strong>
      </button>)}
    </div>
    <div className="stage-legend">
      {rows.map((row, i) => <div key={row.name}><i style={{ background: colors[i % colors.length] }}/><span>{row.name}</span><b>{fmt(row.values[selected])}</b></div>)}
    </div>
  </div>
}

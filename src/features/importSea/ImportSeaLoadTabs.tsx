import type { ImportSeaRow } from './types'

export const LOAD_TABS = ['all', 'FCL', 'LCL', 'unset'] as const
export type LoadTab = (typeof LOAD_TABS)[number]

const LABELS: Record<LoadTab, string> = {
  all: 'All',
  FCL: 'FCL',
  LCL: 'LCL',
  unset: 'No type',
}

export function matchesLoadTab(row: ImportSeaRow, tab: LoadTab): boolean {
  if (tab === 'all') return true
  if (tab === 'unset') return !row.load_type
  return row.load_type === tab
}

type Props = {
  rows: ImportSeaRow[]
  value: LoadTab
  onChange: (tab: LoadTab) => void
}

export default function ImportSeaLoadTabs({ rows, value, onChange }: Props) {
  const counts: Record<LoadTab, number> = { all: rows.length, FCL: 0, LCL: 0, unset: 0 }
  for (const row of rows) {
    if (row.load_type === 'FCL') counts.FCL += 1
    else if (row.load_type === 'LCL') counts.LCL += 1
    else counts.unset += 1
  }

  return (
    <div className="quotes-tabs" role="tablist" aria-label="Load type" style={{ marginBottom: 12 }}>
      {LOAD_TABS.map((tab) => {
        if (tab === 'unset' && counts.unset === 0 && value !== 'unset') return null
        const on = value === tab
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={on}
            className={`quotes-tabs__btn${on ? ' quotes-tabs__btn--on' : ''}`}
            onClick={() => onChange(tab)}
          >
            {LABELS[tab]}
            <span className="text-muted-foreground" style={{ fontSize: 11 }}>{counts[tab]}</span>
          </button>
        )
      })}
    </div>
  )
}

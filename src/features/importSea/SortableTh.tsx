import type { ImportSeaRow } from './types'

type SortableThProps = {
  label: string
  columnKey: keyof ImportSeaRow
  sortKey: keyof ImportSeaRow | null
  sortDir: 'asc' | 'desc'
  onSort: (key: keyof ImportSeaRow) => void
  className?: string
}

export default function SortableTh({
  label,
  columnKey,
  sortKey,
  sortDir,
  onSort,
  className,
}: SortableThProps) {
  const active = sortKey === columnKey
  const indicator = active ? (sortDir === 'asc' ? '▲' : '▼') : '↕'

  function activate() {
    onSort(columnKey)
  }

  return (
    <th
      role="button"
      tabIndex={0}
      className={`sortable-th${className ? ` ${className}` : ''}`}
      onClick={activate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          activate()
        }
      }}
    >
      {label}
      <span className={`sortable-th__ind${active ? ' sortable-th__ind--active' : ' muted'}`}>
        {indicator}
      </span>
    </th>
  )
}


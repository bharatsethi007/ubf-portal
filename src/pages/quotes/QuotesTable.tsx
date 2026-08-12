import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import type { QuoteRow } from './quotesTableColumns'

type Props = {
  rows: QuoteRow[]
  columns: ColumnDef<QuoteRow>[]
  loading: boolean
  onRowClick: (id: string) => void
  selectable?: boolean
  selectedIds?: Set<string>
  onToggle?: (id: string) => void
  onToggleAll?: () => void
  allSelected?: boolean
  someSelected?: boolean
}

export default function QuotesTable({
  rows, columns, loading, onRowClick,
  selectable = false, selectedIds, onToggle, onToggleAll, allSelected = false, someSelected = false,
}: Props) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })
  const colSpan = columns.length + (selectable ? 1 : 0)

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {selectable && (
                <th className="qsel-col">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected }}
                    onChange={onToggleAll}
                    aria-label="Select all"
                  />
                </th>
              )}
              {hg.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={colSpan} className="text-muted-foreground pad-inline">
                Loading quotes…
              </td>
            </tr>
          ) : table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="text-muted-foreground pad-inline">
                No quotes match your filters.
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="row-clickable"
                onClick={() => onRowClick(row.original.id)}
              >
                {selectable && (
                  <td className="qsel-col" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds?.has(row.original.id) ?? false}
                      onChange={() => onToggle?.(row.original.id)}
                      aria-label="Select quote"
                    />
                  </td>
                )}
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

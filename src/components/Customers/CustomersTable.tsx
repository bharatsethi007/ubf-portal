import { flexRender, type Table } from '@tanstack/react-table'
import type { CustomerStats } from '../../types/customer'

type Props = {
  table: Table<CustomerStats>
  loading: boolean
  colSpan: number
}

export default function CustomersTable({ table, loading, colSpan }: Props) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={colSpan} className="text-muted-foreground pad-inline">Loading customers…</td></tr>
          ) : table.getRowModel().rows.length === 0 ? (
            <tr><td colSpan={colSpan} className="text-muted-foreground pad-inline">No customers match your filters.</td></tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="row-clickable" data-href={row.original.account_id}>
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

import { useMemo, useState } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PortMap } from '../../../hooks/usePorts'
import type { PortalShipmentRow } from '../../dashboard/portalDashboardApi'
import { partyColumnHeader, type DirectionTab } from '../../dashboard/portalShipmentParty'
import {
  DIRECTION_TABS,
  filterShipments,
  MODE_TABS,
  PAGE_SIZE,
  type ModeTab,
} from '../../dashboard/portalShipmentTableFilters'
import { shipmentsTableColumns } from './shipmentsTableColumns'
import ShipmentsTablePagination from './ShipmentsTablePagination'

type Props = {
  rows: PortalShipmentRow[]
  ports: PortMap
  containerMap: Map<string, string[]>
}

export default function ShipmentsTable({ rows, ports, containerMap }: Props) {
  const [dirTab, setDirTab] = useState<DirectionTab>('all')
  const [modeTab, setModeTab] = useState<ModeTab>('All')
  const [sorting, setSorting] = useState<SortingState>([])

  const filtered = useMemo(
    () => filterShipments(rows, dirTab, modeTab),
    [rows, dirTab, modeTab],
  )

  const partyHeader = partyColumnHeader(dirTab)

  const columns = useMemo(
    () => shipmentsTableColumns({ ports, containerMap, partyHeader }),
    [ports, containerMap, partyHeader],
  )

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
    autoResetPageIndex: true,
  })

  const page = table.getState().pagination.pageIndex + 1
  const totalPages = table.getPageCount()

  return (
    <div className="portal-card portal-card--pad">
      <div className="portal-card-title">My Shipments</div>
      <div style={{ color: 'var(--portal-muted)', fontSize: 12.5, marginTop: 4 }}>
        Track all your bookings and stay updated
      </div>

      <div className="portal-ship-filters">
        <div className="portal-ship-filters__row">
          {DIRECTION_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`portal-filter-btn${dirTab === key ? ' portal-filter-btn--on-dark' : ''}`}
              onClick={() => setDirTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="portal-ship-filters__row">
          {MODE_TABS.map((t) => (
            <button
              key={t}
              type="button"
              className={`portal-filter-btn${modeTab === t ? ' portal-filter-btn--on' : ''}`}
              onClick={() => setModeTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="portal-empty">No shipments in this view.</p>
      ) : (
        <>
          <div className="portal-table-wrap overflow-hidden rounded-md border border-border bg-card">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className={header.id === 'numbers' ? 'text-right' : undefined}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cell.column.id === 'numbers' ? 'text-right' : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ShipmentsTablePagination
            page={page}
            totalPages={totalPages}
            totalRows={filtered.length}
            pageSize={PAGE_SIZE}
            onPage={(p) => table.setPageIndex(p - 1)}
          />
        </>
      )}
    </div>
  )
}

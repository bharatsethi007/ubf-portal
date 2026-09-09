import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { Search } from 'lucide-react'
import DateField from '@/components/DateField'
import Pagination from '../../components/Pagination'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { listCourierShipments, type CourierShipmentListRow } from './courierBookingsApi'
import { courierBookingsColumns, COURIER_STATUS_TABS } from './courierBookingsColumns'
import './courierBookingsList.css'

const PAGE_SIZE = 50

export default function CourierBookingsList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [createdFrom, setCreatedFrom] = useState<string | null>(null)
  const [createdTo, setCreatedTo] = useState<string | null>(null)
  const [statusTab, setStatusTab] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<CourierShipmentListRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const openDetail = useCallback((id: string) => navigate(`/bookings/courier/${id}`), [navigate])
  const columns = useMemo(() => courierBookingsColumns(openDetail), [openDetail])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusTab, createdFrom, createdTo])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await listCourierShipments({
          page,
          pageSize: PAGE_SIZE,
          q: debouncedSearch,
          status: statusTab === 'all' ? undefined : statusTab,
          createdFrom: createdFrom ?? undefined,
          createdTo: createdTo ?? undefined,
        })
        if (cancelled) return
        setRows(res.rows)
        setTotal(res.total)
        setError('')
      } catch (e) {
        if (cancelled) return
        setRows([])
        setTotal(0)
        setError(e instanceof Error ? e.message : 'Failed to load courier shipments')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [page, debouncedSearch, statusTab, createdFrom, createdTo])

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })
  const colSpan = columns.length

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <h1>Courier bookings</h1>
        </header>

        <div className="quotes-tabs" role="tablist" aria-label="Shipment status">
          {COURIER_STATUS_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={statusTab === key}
              className={`quotes-tabs__btn${statusTab === key ? ' quotes-tabs__btn--on' : ''}`}
              onClick={() => setStatusTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="quotes-page__toolbar courier-list__toolbar">
          <label className="quotes-page__search">
            <Search size={16} strokeWidth={2} />
            <input
              className="input input--sm"
              placeholder="Search ref, tracking, shipper, consignee"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="courier-list__dates">
            <div className="courier-list__date-field">
              <span className="courier-list__date-label">From</span>
              <DateField value={createdFrom} onChange={setCreatedFrom} width={140} placeholder="From" />
            </div>
            <div className="courier-list__date-field">
              <span className="courier-list__date-label">To</span>
              <DateField value={createdTo} onChange={setCreatedTo} width={140} placeholder="To" />
            </div>
          </div>
        </div>

        {error ? <p style={{ color: '#B23B3B', fontSize: 13, margin: '8px 0' }}>{error}</p> : null}

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
                <tr>
                  <td colSpan={colSpan} className="text-muted-foreground pad-inline">
                    Loading courier shipments...
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="text-muted-foreground pad-inline">
                    No courier shipments found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="row-clickable"
                    onClick={() => navigate(`/bookings/courier/${row.original.id}`)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  )
}

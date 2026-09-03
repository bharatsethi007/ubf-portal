import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import Pagination from '../../../components/Pagination'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { listAirLocalChargeSheets, type AirLocalChargeSheetRow } from './airLocalChargesApi'
import { airLocalChargeSheetsColumns, AIR_LOCAL_STATUS_TABS, AIR_LOCAL_DIRECTION_TABS } from './airLocalChargeSheetsColumns'

const PAGE_SIZE = 50

export default function AirLocalChargesList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState<string>('all')
  const [directionFilter, setDirectionFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AirLocalChargeSheetRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const columns = useMemo(() => airLocalChargeSheetsColumns(), [])

  useEffect(() => { setPage(1) }, [debouncedSearch, statusTab, directionFilter])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await listAirLocalChargeSheets({ page, pageSize: PAGE_SIZE, search: debouncedSearch, status: statusTab, direction: directionFilter })
        if (cancelled) return
        setRows(res.rows)
        setTotal(res.total)
        setError('')
      } catch (e) {
        if (cancelled) return
        setRows([])
        setTotal(0)
        setError(e instanceof Error ? e.message : 'Failed to load air local charge sheets')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [page, debouncedSearch, statusTab, directionFilter])

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })
  const colSpan = columns.length

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <Link to="/setup/rates" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 8 }}>
            <ArrowLeft size={15} /> Rates
          </Link>
          <h1>Air Local / Port Charges</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--muted-foreground)', fontSize: 14 }}>
            House tariff of origin &amp; destination airport charges, keyed by airport, movement, and airline.
          </p>
        </header>

        <div className="quotes-tabs" role="tablist" aria-label="Sheet status">
          {AIR_LOCAL_STATUS_TABS.map(({ key, label }) => (
            <button key={key} type="button" role="tab" aria-selected={statusTab === key}
              className={`quotes-tabs__btn${statusTab === key ? ' quotes-tabs__btn--on' : ''}`}
              onClick={() => setStatusTab(key)}>
              {label}
            </button>
          ))}
        </div>

        <div className="quotes-page__toolbar">
          <label className="quotes-page__search">
            <Search size={16} strokeWidth={2} />
            <input className="input input--sm" placeholder="Search title" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <select className="input input--sm" value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value)} aria-label="Direction filter" style={{ maxWidth: 160 }}>
            {AIR_LOCAL_DIRECTION_TABS.map(({ key, label }) => (<option key={key} value={key}>{key === 'all' ? 'All directions' : label}</option>))}
          </select>
          <button type="button" className="btn quotes-page__new-btn" onClick={() => navigate('/setup/rates/air-local/new')}>
            <Plus size={16} strokeWidth={2} />
            New sheet
          </button>
        </div>

        {error && <p style={{ color: '#B23B3B', fontSize: 13, margin: '8px 0' }}>{error}</p>}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((header) => (
                    <th key={header.id}>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colSpan} className="text-muted-foreground pad-inline">Loading sheets…</td></tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr><td colSpan={colSpan} className="text-muted-foreground pad-inline">No air local charge sheets yet. Create one to get started.</td></tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="row-clickable" onClick={() => navigate(`/setup/rates/air-local/${row.original.id}`)}>
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

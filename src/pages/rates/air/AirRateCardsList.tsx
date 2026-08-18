import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { ArrowLeft, Plus, Search } from 'lucide-react'
import Pagination from '../../../components/Pagination'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { listAirRateCards, type AirRateCardRow } from '../airRatesApi'
import { airRateCardsColumns, AIR_STATUS_TABS } from './airRateCardsColumns'

const PAGE_SIZE = 50

export default function AirRateCardsList() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AirRateCardRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const columns = useMemo(() => airRateCardsColumns(), [])

  useEffect(() => { setPage(1) }, [debouncedSearch, statusTab])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await listAirRateCards({ page, pageSize: PAGE_SIZE, search: debouncedSearch, status: statusTab })
        if (cancelled) return
        setRows(res.rows)
        setTotal(res.total)
        setError('')
      } catch (e) {
        if (cancelled) return
        setRows([])
        setTotal(0)
        setError(e instanceof Error ? e.message : 'Failed to load rate cards')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [page, debouncedSearch, statusTab])

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })
  const colSpan = columns.length

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <Link to="/setup/rates" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none', marginBottom: 8 }}>
            <ArrowLeft size={15} /> Rates
          </Link>
          <h1>Air Charges</h1>
        </header>

        <div className="quotes-tabs" role="tablist" aria-label="Rate card status">
          {AIR_STATUS_TABS.map(({ key, label }) => (
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
            <input className="input input--sm" placeholder="Search airline, title" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <button type="button" className="btn quotes-page__new-btn" onClick={() => navigate('/setup/rates/air/new')}>
            <Plus size={16} strokeWidth={2} />
            New rate card
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
                <tr><td colSpan={colSpan} className="text-muted-foreground pad-inline">Loading rate cards…</td></tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr><td colSpan={colSpan} className="text-muted-foreground pad-inline">No air rate cards yet. Create one to get started.</td></tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="row-clickable" onClick={() => navigate(`/setup/rates/air/${row.original.id}`)}>
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

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { Plus, Search } from 'lucide-react'
import Pagination from '@/components/Pagination'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { listConsignments, boardCounts, TMS_BOARD_TABS, type TmsBoardKey, type TmsConsignmentRow } from './tmsApi'
import { opsColumns } from './opsColumns'
import ConsignmentDetailWindow from './ConsignmentDetailWindow'

const PAGE_SIZE = 50

export default function TmsOpsBoard() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [board, setBoard] = useState<TmsBoardKey>('current')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<TmsConsignmentRow[]>([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [drawerId, setDrawerId] = useState<string | null>(null)
  const debouncedSearch = useDebouncedValue(search, 300)
  const columns = useMemo(() => opsColumns(), [])

  useEffect(() => { setPage(1) }, [debouncedSearch, board])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await listConsignments({ board, page, pageSize: PAGE_SIZE, search: debouncedSearch })
        if (cancelled) return
        setRows(res.rows); setTotal(res.total); setError('')
      } catch (e) {
        if (cancelled) return
        setRows([]); setTotal(0); setError(e instanceof Error ? e.message : 'Failed to load consignments')
      } finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [board, page, debouncedSearch])

  useEffect(() => { boardCounts().then(setCounts).catch(() => {}) }, [])

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() })
  const colSpan = columns.length

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head"><h1>TMS — Operations</h1></header>

        <div className="quotes-tabs" role="tablist" aria-label="Consignment board">
          {TMS_BOARD_TABS.map(({ key, label }) => (
            <button key={key} type="button" role="tab" aria-selected={board === key}
              className={`quotes-tabs__btn${board === key ? ' quotes-tabs__btn--on' : ''}`}
              onClick={() => setBoard(key)}>
              {label}{counts[key] != null ? ` (${counts[key]})` : ''}
            </button>
          ))}
        </div>

        <div className="quotes-page__toolbar">
          <label className="quotes-page__search">
            <Search size={16} strokeWidth={2} />
            <input className="input input--sm" placeholder="Search consignment, company" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <button type="button" className="btn quotes-page__new-btn" onClick={() => navigate('/tms/new')}>
            <Plus size={16} strokeWidth={2} /> New consignment
          </button>
        </div>

        {error && <p style={{ color: '#B23B3B', fontSize: 13, margin: '8px 0' }}>{error}</p>}

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id}>{h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colSpan} className="text-muted-foreground pad-inline">Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={colSpan} className="text-muted-foreground pad-inline">No consignments on this board.</td></tr>
              ) : (
                table.getRowModel().rows.map((r) => (
                  <tr key={r.id} className="row-clickable" onClick={() => setDrawerId(r.original.id)}>
                    {r.getVisibleCells().map((c) => <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      <ConsignmentDetailWindow id={drawerId} onClose={() => setDrawerId(null)} />
    </div>
  )
}

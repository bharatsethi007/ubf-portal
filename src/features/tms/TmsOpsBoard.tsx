import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { Plus, Search, Truck, CalendarClock, AlertTriangle, CheckCircle2, Archive } from 'lucide-react'
import Pagination from '@/components/Pagination'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { listConsignments, boardCounts, TMS_BOARD_TABS, type TmsBoardKey, type TmsConsignmentRow } from './tmsApi'
import { opsColumns } from './opsColumns'
import ConsignmentDetailWindow from './ConsignmentDetailWindow'

const PAGE_SIZE = 50

const TAB_ICON: Record<TmsBoardKey, typeof Truck> = {
  current: Truck, scheduled: CalendarClock, incomplete: AlertTriangle,
  completed: CheckCircle2, archived: Archive,
}
const TAB_COLOR: Record<TmsBoardKey, { text: string; bar: string; pill: string }> = {
  current: { text: 'text-[#0A2472]', bar: 'bg-[#0A2472]', pill: 'bg-[#0A2472]/10 text-[#0A2472]' },
  scheduled: { text: 'text-amber-600', bar: 'bg-amber-500', pill: 'bg-amber-100 text-amber-700' },
  incomplete: { text: 'text-red-600', bar: 'bg-red-500', pill: 'bg-red-100 text-red-700' },
  completed: { text: 'text-emerald-600', bar: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700' },
  archived: { text: 'text-neutral-600', bar: 'bg-neutral-400', pill: 'bg-neutral-200 text-neutral-600' },
}

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
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-neutral-900">Ops</h1>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5">
            <Search size={16} className="text-neutral-400" />
            <input className="w-56 bg-transparent text-sm outline-none placeholder:text-neutral-400" placeholder="Search consignment, company" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <button type="button" onClick={() => navigate('/tms/new')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#0A2472] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0A2472]/90">
            <Plus size={16} /> New consignment
          </button>
        </div>
      </div>

      <div className="mb-1 flex flex-wrap gap-1 border-b border-neutral-200" role="tablist" aria-label="Consignment board">
        {TMS_BOARD_TABS.map(({ key, label }) => {
          const Icon = TAB_ICON[key]
          const c = TAB_COLOR[key]
          const on = board === key
          return (
            <button key={key} type="button" role="tab" aria-selected={on} onClick={() => setBoard(key)}
              className={`relative flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium transition-colors ${on ? c.text : 'text-neutral-500 hover:text-neutral-800'}`}>
              <Icon size={15} className={on ? c.text : 'text-neutral-400'} />
              {label}
              {counts[key] != null && <span className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${on ? c.pill : 'bg-neutral-100 text-neutral-500'}`}>{counts[key]}</span>}
              {on && <span className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full ${c.bar}`} />}
            </button>
          )
        })}
      </div>

      {error && <p className="my-2 text-sm text-red-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-[12px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-neutral-200">
                {hg.headers.map((h) => (
                  <th key={h.id} className="whitespace-nowrap px-3 py-1.5 text-left text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colSpan} className="px-3 py-6 text-sm text-neutral-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={colSpan} className="px-3 py-6 text-sm text-neutral-400">No consignments on this board.</td></tr>
            ) : (
              table.getRowModel().rows.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-neutral-100 hover:bg-neutral-50" onClick={() => setDrawerId(r.original.id)}>
                  {r.getVisibleCells().map((c) => <td key={c.id} className="px-3 py-1.5 align-middle">{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3"><Pagination page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} /></div>

      <ConsignmentDetailWindow id={drawerId} onClose={() => setDrawerId(null)} />
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Trash2, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import Pagination from '../../components/Pagination'
import { supabase } from '../../supabase'
import { deleteQuotes, setQuotesStatus } from './quotesApi'
import QuotesTable from './QuotesTable'
import BulkStatusModal from './BulkStatusModal'
import { quotesTableColumns, STATUS_TABS, type QuoteRow } from './quotesTableColumns'

const PAGE_SIZE_OPTIONS = [25, 50, 100, 500]

type QuoteDbRow = {
  id: string
  quote_no: string | null
  status: string
  customer_name: string | null
  shipment_mode: string | null
  shipment_type: string | null
  from_port_code: string | null
  to_port_code: string | null
  created_at: string
  created_by: string | null
}

type Props = {
  search: string
  onOpen: (id: string) => void
  portMap: Map<string, string>
  staffMap: Map<string, string>
}

export default function QuotesListView({ search, onOpen, portMap, staffMap }: Props) {
  const [statusTab, setStatusTab] = useState<string>('open')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [rows, setRows] = useState<QuoteRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const reqId = useRef(0)

  const columns = useMemo(() => quotesTableColumns(portMap, staffMap), [portMap, staffMap])

  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
  }, [search, statusTab, pageSize])

  const reload = useCallback(async () => {
    const my = ++reqId.current
    setLoading(true)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('quotes')
      .select(
        'id, quote_no, status, customer_name, shipment_mode, shipment_type, from_port_code, to_port_code, created_at, created_by',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })

    if (statusTab !== 'all') query = query.eq('status', statusTab)

    const term = search.trim()
    if (term) query = query.or(`quote_no.ilike.%${term}%,customer_name.ilike.%${term}%`)

    const { data, error: err, count } = await query.range(from, to)
    if (my !== reqId.current) return

    if (err) {
      setError(err.message)
      setRows([])
      setTotal(0)
    } else {
      setError('')
      setRows(
        ((data as QuoteDbRow[]) ?? []).map((r) => ({
          id: r.id,
          quote_no: r.quote_no,
          status: r.status,
          customer_name: r.customer_name,
          shipment_mode: r.shipment_mode,
          shipment_type: r.shipment_type,
          from_port_code: r.from_port_code,
          to_port_code: r.to_port_code,
          created_by: r.created_by,
          created_at: r.created_at,
        })),
      )
      setTotal(count ?? 0)
    }
    setLoading(false)
  }, [page, pageSize, search, statusTab])

  useEffect(() => { reload() }, [reload])

  function toggleId(id: string) {
    setSelectedIds((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id))
  const someSelected = rows.some((r) => selectedIds.has(r.id))
  function toggleAll() {
    setSelectedIds((s) => {
      const n = new Set(s)
      if (rows.every((r) => n.has(r.id))) rows.forEach((r) => n.delete(r.id))
      else rows.forEach((r) => n.add(r.id))
      return n
    })
  }

  async function handleBulkDelete() {
    const ids = [...selectedIds]
    if (!ids.length) return
    if (!window.confirm(`Delete ${ids.length} quote${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return
    setBusy(true)
    try {
      await deleteQuotes(ids)
      toast.success(`Deleted ${ids.length} quote${ids.length > 1 ? 's' : ''}`)
      setSelectedIds(new Set())
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleApplyStatus(from: string, to: string) {
    const ids = rows
      .filter((r) => selectedIds.has(r.id) && (from === 'any' || r.status === from))
      .map((r) => r.id)
    if (!ids.length) {
      toast.error('No selected quotes match that status')
      return
    }
    setBusy(true)
    try {
      await setQuotesStatus(ids, to)
      toast.success(`Updated ${ids.length} quote${ids.length > 1 ? 's' : ''}`)
      setStatusModalOpen(false)
      setSelectedIds(new Set())
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const selectedCount = selectedIds.size

  return (
    <>
      <div className="quotes-tabs" role="tablist" aria-label="Quote status">
        {STATUS_TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={statusTab === key}
            className={`quotes-tabs__btn${statusTab === key ? ' quotes-tabs__btn--on' : ''}`}
            onClick={() => setStatusTab(key)}
          >
            <Icon size={14} strokeWidth={2} />
            {label}
          </button>
        ))}
      </div>

      {selectedCount > 0 && (
        <div className="quotes-bulkbar">
          <span className="quotes-bulkbar__count">{selectedCount} selected</span>
          <button type="button" className="quotes-bulkbar__btn" disabled={busy} onClick={() => setStatusModalOpen(true)}>
            <RefreshCw size={15} strokeWidth={2} /> Change status
          </button>
          <button type="button" className="quotes-bulkbar__btn quotes-bulkbar__btn--danger" disabled={busy} onClick={handleBulkDelete}>
            <Trash2 size={15} strokeWidth={2} /> Delete
          </button>
          <button type="button" className="quotes-bulkbar__btn quotes-bulkbar__btn--ghost" onClick={() => setSelectedIds(new Set())}>
            <X size={15} strokeWidth={2} /> Clear
          </button>
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <QuotesTable
        rows={rows}
        columns={columns}
        loading={loading}
        onRowClick={onOpen}
        selectable
        selectedIds={selectedIds}
        onToggle={toggleId}
        onToggleAll={toggleAll}
        allSelected={allSelected}
        someSelected={someSelected}
      />

      <div className="quotes-page__footer">
        <label className="quotes-page__pagesize">
          <span>Rows</span>
          <select
            className="input input--sm"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <Pagination page={page} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <BulkStatusModal
        open={statusModalOpen}
        count={selectedCount}
        busy={busy}
        onClose={() => setStatusModalOpen(false)}
        onApply={handleApplyStatus}
      />
    </>
  )
}

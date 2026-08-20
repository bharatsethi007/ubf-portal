import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, Plus, ClipboardList } from 'lucide-react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
} from '@tanstack/react-table'
import Pagination from '../../components/Pagination'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { agentsColumns } from './agentsColumns'
import {
  listAgents,
  listFreightNetworks,
  type AgentDirectoryRow,
  type AgentListSort,
  type FreightNetwork,
} from './agentsApi'
import NewAgentModal from './NewAgentModal'
import { fetchReviewQueueCount } from './review/reviewApi'
import './agents.css'

const PAGE_SIZE = 50

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'prospect', label: 'Prospect' },
  { key: 'inactive', label: 'Inactive' },
]

const TRUSTED_TABS = [
  { key: 'all', label: 'All' },
  { key: 'yes', label: 'Trusted' },
  { key: 'no', label: 'Not trusted' },
]

function toListSort(sorting: SortingState): AgentListSort | undefined {
  const col = sorting[0]
  if (!col) return undefined
  if (col.id !== 'last_activity' && col.id !== 'job_count') return undefined
  return { id: col.id, desc: col.desc }
}

export default function AgentsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [network, setNetwork] = useState('all')
  const [trusted, setTrusted] = useState('all')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<AgentDirectoryRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [networks, setNetworks] = useState<FreightNetwork[]>([])
  const [showNew, setShowNew] = useState(false)
  const [reviewCount, setReviewCount] = useState<number | null>(null)
  const [sorting, setSorting] = useState<SortingState>([{ id: 'last_activity', desc: true }])
  const debouncedSearch = useDebouncedValue(search, 300)
  const columns = useMemo(() => agentsColumns(), [])
  const listSort = useMemo(() => toListSort(sorting), [sorting])

  useEffect(() => {
    listFreightNetworks().then(setNetworks).catch(() => {})
  }, [])

  useEffect(() => {
    fetchReviewQueueCount().then(setReviewCount).catch(() => {})
  }, [])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, status, network, trusted, listSort])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listAgents({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      status,
      network,
      trusted,
      sort: listSort,
    })
      .then(({ rows: nextRows, total: nextTotal }) => {
        if (cancelled) return
        setRows(nextRows)
        setTotal(nextTotal)
        setError('')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e.message ?? 'Failed to load agents')
        setRows([])
        setTotal(0)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page, debouncedSearch, status, network, trusted, listSort])

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableSortingRemoval: false,
  })

  return (
    <div className="customers-page agents-page">
      <header className="customers-page__head">
        <h1>Agents</h1>
        <div className="customers-page__toolbar">
          <label className="customers-page__search">
            <Search size={16} strokeWidth={2} />
            <input
              className="input input--sm"
              placeholder="Search by name or ERP code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <div className="agents-page__head-actions">
            <Link to="/agents/review" className="btn btn--inline agent-review-link-btn">
              <ClipboardList size={16} strokeWidth={2} />
              Review
              {reviewCount != null && (
                <span className="agent-review-count-chip">
                  {reviewCount > 99 ? '99+' : reviewCount}
                </span>
              )}
            </Link>
            <button type="button" className="btn quotes-page__new-btn" onClick={() => setShowNew(true)}>
              <Plus size={16} strokeWidth={2} /> New agent
            </button>
          </div>
        </div>
      </header>

      <div className="customers-page__filters">
        <div className="customers-segment" role="group" aria-label="Status filter">
          {STATUS_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`customers-segment__btn${status === key ? ' customers-segment__btn--on' : ''}`}
              onClick={() => setStatus(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="customers-segment" role="group" aria-label="Trusted filter">
          {TRUSTED_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`customers-segment__btn${trusted === key ? ' customers-segment__btn--on' : ''}`}
              onClick={() => setTrusted(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="customers-page__select-label">
          Network
          <select
            className="input input--sm customers-page__select"
            value={network}
            onChange={(e) => setNetwork(e.target.value)}
          >
            <option value="all">All</option>
            <option value="none">No network</option>
            {networks.map((n) => (
              <option key={n.code} value={n.code}>
                {n.code}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="error card pad-inline">{error}</div>}

      <div className="customers-table card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th key={h.id} style={h.column.id === 'job_count' ? { textAlign: 'right' } : undefined}>
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="text-muted-foreground pad-inline">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-muted-foreground pad-inline">
                    No agents found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="row-clickable"
                    onClick={() => navigate(`/agents/${row.original.id}`)}
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

      {showNew && (
        <NewAgentModal
          networks={networks}
          onClose={() => setShowNew(false)}
          onCreated={(id) => {
            setShowNew(false)
            navigate(`/agents/${id}`)
          }}
        />
      )}
    </div>
  )
}

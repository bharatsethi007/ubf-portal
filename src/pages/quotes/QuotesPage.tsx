import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import Pagination from '../../components/Pagination'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { supabase } from '../../supabase'
import QuotesTable from './QuotesTable'
import {
  quotesTableColumns,
  STATUS_TABS,
  type QuoteRow,
} from './quotesTableColumns'

const PAGE_SIZE = 50

type QuoteDbRow = {
  id: string
  quote_no: string | null
  status: string
  customer_name: string | null
  shipment_mode: string | null
  pickup_location: string | null
  drop_location: string | null
  created_at: string
  created_by: string | null
}

function pageRange(page: number): { from: number; to: number } {
  const from = (page - 1) * PAGE_SIZE
  return { from, to: from + PAGE_SIZE - 1 }
}

export default function QuotesPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusTab, setStatusTab] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<QuoteRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const columns = useMemo(() => quotesTableColumns(), [])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, statusTab])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    ;(async () => {
      const { from, to } = pageRange(page)
      let query = supabase
        .from('quotes')
        .select(
          'id, quote_no, status, customer_name, shipment_mode, pickup_location, drop_location, created_at, created_by',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })

      if (statusTab !== 'all') query = query.eq('status', statusTab)

      const term = debouncedSearch.trim()
      if (term) {
        query = query.or(`quote_no.ilike.%${term}%,customer_name.ilike.%${term}%`)
      }

      const { data, error: err, count } = await query.range(from, to)
      if (cancelled) return

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
            pickup_location: r.pickup_location,
            drop_location: r.drop_location,
            created_at: r.created_at,
            created_by_name: null,
          })),
        )
        setTotal(count ?? 0)
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [page, debouncedSearch, statusTab])

  return (
    <div className="quotes-page">
      <div className="card quotes-page__card">
        <header className="quotes-page__head">
          <h1>Quotations</h1>
        </header>

        <div className="quotes-tabs" role="tablist" aria-label="Quote status">
          {STATUS_TABS.map(({ key, label }) => (
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

        <div className="quotes-page__toolbar">
          <label className="quotes-page__search">
            <Search size={16} strokeWidth={2} />
            <input
              className="input input--sm"
              placeholder="Search quote #, customer"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn quotes-page__new-btn"
            onClick={() => navigate('/quotes/new')}
          >
            <Plus size={16} strokeWidth={2} />
            New Quote
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        <QuotesTable
          rows={rows}
          columns={columns}
          loading={loading}
          onRowClick={(id) => navigate(`/quotes/${id}`)}
        />
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  )
}

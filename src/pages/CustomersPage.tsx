import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '../supabase'
import Pagination from '../components/Pagination'
import { customerDisplayName, customerPageRange, PAGE_SIZE } from '../utils/customerQuery'
import { fmtShort } from '../utils/format'
import type { CustomerStats } from '../types/customer'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

function RoleBadges({ row }: { row: CustomerStats }) {
  return (
    <span className="customer-badges">
      {row.is_importer && <span className="pill scheduled">Importer</span>}
      {row.is_exporter && <span className="pill booked">Exporter</span>}
      {!row.is_importer && !row.is_exporter && <span className="muted">—</span>}
    </span>
  )
}

function PortalBadge({ active }: { active: boolean }) {
  return active
    ? <span className="pill arrived">Active</span>
    : <span className="pill booked">No access</span>
}

export default function CustomersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<CustomerStats[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, showInactive])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    ;(async () => {
      const { from, to } = customerPageRange(page)
      let query = supabase
        .from('v_customer_stats')
        .select('*', { count: 'exact' })
        .order('total_shipments', { ascending: false })

      if (!showInactive) query = query.eq('closed', false)

      const term = debouncedSearch.trim()
      if (term) {
        if (/^\d+$/.test(term)) query = query.or(`name.ilike.%${term}%,account_id.eq.${term}`)
        else query = query.ilike('name', `%${term}%`)
      }

      const { data, error: err, count } = await query.range(from, to)
      if (cancelled) return

      if (err) {
        setError(err.message)
        setRows([])
        setTotal(0)
      } else {
        setError('')
        setRows((data as CustomerStats[]) ?? [])
        setTotal(count ?? 0)
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [page, debouncedSearch, showInactive])

  return (
    <div className="customers-page">
      <header className="customers-page__head">
        <h1>Customers</h1>
        <div className="customers-page__toolbar">
          <label className="customers-page__search">
            <Search size={16} strokeWidth={2} />
            <input
              className="input input--sm"
              placeholder="Search by name or account ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="customers-page__toggle check-row">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Show inactive
          </label>
        </div>
      </header>

      {error && <div className="error card pad-inline">{error}</div>}

      <div className="customers-table card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Branch</th>
                <th>Role</th>
                <th>Total</th>
                <th>In transit</th>
                <th>This month</th>
                <th>Last activity</th>
                <th>Portal</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="muted pad-inline">Loading customers…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={8} className="muted pad-inline">No customers match your filters.</td></tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.account_id}
                    className="row-clickable"
                    onClick={() => navigate(`/customers/${row.account_id}`)}
                  >
                    <td>
                      <strong>{customerDisplayName(row)}</strong>
                      {!row.name && <span className="muted mono"> #{row.account_id}</span>}
                    </td>
                    <td>{row.branch ?? '—'}</td>
                    <td><RoleBadges row={row} /></td>
                    <td>{row.total_shipments}</td>
                    <td>{row.in_transit}</td>
                    <td>{row.this_month}</td>
                    <td className="mono">{fmtShort(row.last_activity)}</td>
                    <td><PortalBadge active={row.has_portal_access} /></td>
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

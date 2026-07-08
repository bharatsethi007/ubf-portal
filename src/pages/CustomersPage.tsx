import { useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { getCoreRowModel, useReactTable } from '@tanstack/react-table'
import { supabase } from '../supabase'
import Pagination from '../components/Pagination'
import CustomersTable from '../components/Customers/CustomersTable'
import { customersTableColumns } from '../components/Customers/customersTableColumns'
import {
  ROLE_FILTERS,
  SORT_PRESETS,
  type RoleFilter,
  type SortPreset,
} from '../components/Customers/customersTableFilters'
import { customerPageRange, PAGE_SIZE } from '../utils/customerQuery'
import type { CustomerStats } from '../types/customer'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

export default function CustomersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [managerFilter, setManagerFilter] = useState('all')
  const [sortPreset, setSortPreset] = useState<SortPreset>('activity')
  const [managers, setManagers] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<CustomerStats[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const columns = useMemo(() => customersTableColumns(), [])

  useEffect(() => {
    supabase
      .from('customers')
      .select('sales_manager')
      .not('sales_manager', 'is', null)
      .then(({ data }) => {
        const set = new Set<string>()
        for (const r of data ?? []) {
          if (r.sales_manager) set.add(r.sales_manager)
        }
        setManagers([...set].sort())
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, showInactive, roleFilter, managerFilter, sortPreset])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    ;(async () => {
      const { from, to } = customerPageRange(page)
      let query = supabase.from('v_customer_stats').select('*', { count: 'exact' })

      if (sortPreset === 'alpha') query = query.order('name', { ascending: true, nullsFirst: false })
      else query = query.order('last_activity', { ascending: false, nullsFirst: false })

      if (!showInactive) query = query.eq('closed', false)
      if (roleFilter === 'importer') query = query.eq('is_importer', true)
      else if (roleFilter === 'exporter') query = query.eq('is_exporter', true)
      if (managerFilter !== 'all') query = query.eq('sales_manager', managerFilter)

      const term = debouncedSearch.trim()
      if (term) {
        if (/^[A-Za-z0-9]+$/.test(term)) {
          query = query.or(`name.ilike.%${term}%,account_id.ilike.%${term}%`)
        } else {
          query = query.ilike('name', `%${term}%`)
        }
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
  }, [page, debouncedSearch, showInactive, roleFilter, managerFilter, sortPreset])

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
  })

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

      <div className="customers-page__filters">
        <div className="customers-segment" role="group" aria-label="Role filter">
          {ROLE_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`customers-segment__btn${roleFilter === key ? ' customers-segment__btn--on' : ''}`}
              onClick={() => setRoleFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="customers-segment" role="group" aria-label="Sort">
          {SORT_PRESETS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              className={`customers-segment__btn${sortPreset === key ? ' customers-segment__btn--on' : ''}`}
              onClick={() => setSortPreset(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {managers.length > 0 && (
          <label className="customers-page__select-label">
            Sales manager
            <select
              className="input input--sm customers-page__select"
              value={managerFilter}
              onChange={(e) => setManagerFilter(e.target.value)}
            >
              <option value="all">All</option>
              {managers.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && <div className="error card pad-inline">{error}</div>}

      <div
        className="customers-table card"
        onClick={(e) => {
          const tr = (e.target as HTMLElement).closest('tr.row-clickable')
          const id = tr?.getAttribute('data-href')
          if (id) navigate(`/customers/${id}`)
        }}
      >
        <CustomersTable table={table} loading={loading} colSpan={columns.length} />
        <Pagination page={page} total={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  )
}

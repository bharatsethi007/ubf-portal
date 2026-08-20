import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import CsKpiCards from './CsKpiCards'
import CsBreakdownCharts from './CsBreakdownCharts'
import CsByCustomerTable from './CsByCustomerTable'
import CsComplaintsTable from './CsComplaintsTable'
import {
  fetchCsComplaintsSummary,
  fetchCsComplaintsList,
  fetchCsComplaintsByCustomer,
  fetchCsComplaintsBreakdown,
  type CsComplaintsSummary,
  type CsComplaintsListRow,
  type CsComplaintsByCustomerRow,
  type CsBreakdownRow,
  type CsFilters,
} from './csReportsApi'

const SEVERITIES = ['', 'low', 'medium', 'high', 'critical'] as const
const STATUSES = ['', 'open', 'in_progress', 'resolved', 'closed'] as const
const TYPES = ['', 'damage', 'delay', 'service', 'documentation', 'billing', 'customs', 'other'] as const

const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate())

function initialRange() {
  const today = new Date()
  return { from: isoDate(addMonths(today, -12)), to: isoDate(today) }
}

function labelize(v: string): string {
  if (!v) return 'All'
  return v.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

type CustomerFilter = { accountId: string; name: string }

export default function ComplaintsPanel() {
  const range = useMemo(() => initialRange(), [])
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const [severity, setSeverity] = useState('')
  const [status, setStatus] = useState('')
  const [type, setType] = useState('')
  const [customer, setCustomer] = useState<CustomerFilter | null>(null)

  const [summary, setSummary] = useState<CsComplaintsSummary | null>(null)
  const [list, setList] = useState<CsComplaintsListRow[]>([])
  const [byCustomer, setByCustomer] = useState<CsComplaintsByCustomerRow[]>([])
  const [byType, setByType] = useState<CsBreakdownRow[]>([])
  const [bySeverity, setBySeverity] = useState<CsBreakdownRow[]>([])
  const [loading, setLoading] = useState(true)

  const filters: CsFilters = useMemo(() => ({
    from: from || null,
    to: to || null,
    customer: customer?.accountId ?? null,
    severity: severity || null,
    status: status || null,
    type: type || null,
  }), [from, to, customer, severity, status, type])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const [s, rows, cust, tBreak, sBreak] = await Promise.all([
          fetchCsComplaintsSummary(filters),
          fetchCsComplaintsList(filters),
          fetchCsComplaintsByCustomer(filters),
          fetchCsComplaintsBreakdown('type', filters),
          fetchCsComplaintsBreakdown('severity', filters),
        ])
        if (cancelled) return
        setSummary(s)
        setList(rows)
        setByCustomer(cust)
        setByType(tBreak)
        setBySeverity(sBreak)
      } catch (e) {
        if (cancelled) return
        toast.error(e instanceof Error ? e.message : 'Failed to load complaints report')
        setSummary(null)
        setList([])
        setByCustomer([])
        setByType([])
        setBySeverity([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [filters])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="quotes-page__toolbar">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--muted-foreground)' }}>
            From
            <input type="date" className="input input--sm" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--muted-foreground)' }}>
            To
            <input type="date" className="input input--sm" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--muted-foreground)' }}>
            Severity
            <select className="input input--sm" value={severity} onChange={(e) => setSeverity(e.target.value)}>
              {SEVERITIES.map((v) => <option key={v || 'all'} value={v}>{labelize(v)}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--muted-foreground)' }}>
            Status
            <select className="input input--sm" value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUSES.map((v) => <option key={v || 'all'} value={v}>{labelize(v)}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--muted-foreground)' }}>
            Type
            <select className="input input--sm" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((v) => <option key={v || 'all'} value={v}>{labelize(v)}</option>)}
            </select>
          </label>
        </div>
        {customer && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500,
            color: '#3B5BFE', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 999, padding: '4px 10px',
          }}>
            {customer.name}
            <button type="button" className="btn btn--inline" style={{ marginTop: 0, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 1 }}
              onClick={() => setCustomer(null)} aria-label="Clear customer filter">
              <X size={14} />
            </button>
          </span>
        )}
      </div>

      <CsKpiCards summary={summary} loading={loading} />
      <CsBreakdownCharts byType={byType} bySeverity={bySeverity} loading={loading} />
      <CsByCustomerTable
        rows={byCustomer}
        loading={loading}
        onSelectCustomer={(accountId, name) => setCustomer({ accountId, name })}
      />
      <CsComplaintsTable rows={list} loading={loading} />
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { Seg } from '../reportsUi'
import CsatKpiCards from './CsatKpiCards'
import CsatTrendChart from './CsatTrendChart'
import CsatChannelSection from './CsatChannelSection'
import CsatByCustomerTable from './CsatByCustomerTable'
import CsatByRepTable from './CsatByRepTable'
import CsatCommentsFeed from './CsatCommentsFeed'
import {
  fetchCsatSummary,
  fetchCsatTrend,
  fetchCsatByChannel,
  fetchCsatByRep,
  fetchCsatByCustomer,
  fetchCsatComments,
  type CsatSummary,
  type CsatTrendRow,
  type CsatByChannelRow,
  type CsatByRepRow,
  type CsatByCustomerRow,
  type CsatCommentRow,
  type CsatFilters,
  type CsatBucket,
} from './csatApi'

const CHANNELS = [
  { k: '', label: 'All channels' },
  { k: 'job', label: 'Job' },
  { k: 'portal', label: 'Portal' },
  { k: 'whatsapp', label: 'WhatsApp' },
  { k: 'email_signature', label: 'Email signature' },
] as const

const BUCKETS = [
  { k: 'month', label: 'Month' },
  { k: 'week', label: 'Week' },
  { k: 'day', label: 'Day' },
] as const

const isoDate = (d: Date) => d.toISOString().slice(0, 10)
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate())

function initialRange() {
  const today = new Date()
  return { from: isoDate(addMonths(today, -12)), to: isoDate(today) }
}

type AccountFilter = { accountId: string; name: string }

export default function CsatPanel() {
  const range = useMemo(() => initialRange(), [])
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const [channel, setChannel] = useState('')
  const [bucket, setBucket] = useState<CsatBucket>('month')
  const [account, setAccount] = useState<AccountFilter | null>(null)

  const [summary, setSummary] = useState<CsatSummary | null>(null)
  const [trend, setTrend] = useState<CsatTrendRow[]>([])
  const [byChannel, setByChannel] = useState<CsatByChannelRow[]>([])
  const [byRep, setByRep] = useState<CsatByRepRow[]>([])
  const [byCustomer, setByCustomer] = useState<CsatByCustomerRow[]>([])
  const [comments, setComments] = useState<CsatCommentRow[]>([])
  const [loading, setLoading] = useState(true)

  const filters: CsatFilters = useMemo(() => ({
    from: from || null,
    to: to || null,
    channel: channel || null,
    account: account?.accountId ?? null,
    staff: null,
  }), [from, to, channel, account])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const [s, tr, ch, rep, cust, comm] = await Promise.all([
          fetchCsatSummary(filters),
          fetchCsatTrend(filters, bucket),
          fetchCsatByChannel(filters),
          fetchCsatByRep(filters),
          fetchCsatByCustomer(filters),
          fetchCsatComments(filters),
        ])
        if (cancelled) return
        setSummary(s)
        setTrend(tr)
        setByChannel(ch)
        setByRep(rep)
        setByCustomer(cust)
        setComments(comm)
      } catch (e) {
        if (cancelled) return
        toast.error(e instanceof Error ? e.message : 'Failed to load CSAT report')
        setSummary(null)
        setTrend([])
        setByChannel([])
        setByRep([])
        setByCustomer([])
        setComments([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [filters, bucket])

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
            Channel
            <select className="input input--sm" value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS.map((c) => <option key={c.k || 'all'} value={c.k}>{c.label}</option>)}
            </select>
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Trend bucket</span>
            <Seg options={BUCKETS as any} value={bucket} onChange={(k) => setBucket(k as CsatBucket)} />
          </div>
        </div>
        {account && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500,
            color: '#3B5BFE', background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 999, padding: '4px 10px',
          }}>
            {account.name}
            <button type="button" className="btn btn--inline" style={{ marginTop: 0, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 1 }}
              onClick={() => setAccount(null)} aria-label="Clear account filter">
              <X size={14} />
            </button>
          </span>
        )}
      </div>

      <CsatKpiCards summary={summary} loading={loading} />
      <CsatTrendChart rows={trend} loading={loading} />
      <CsatChannelSection rows={byChannel} loading={loading} />
      <CsatByCustomerTable
        rows={byCustomer}
        loading={loading}
        onSelectAccount={(accountId, name) => setAccount({ accountId, name })}
      />
      <CsatByRepTable rows={byRep} loading={loading} />
      <CsatCommentsFeed rows={comments} loading={loading} />
    </div>
  )
}

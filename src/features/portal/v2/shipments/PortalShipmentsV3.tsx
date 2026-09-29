import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight, Download, Plus, Search, X } from 'lucide-react'
import { usePorts } from '../../../../hooks/usePorts'
import { detailPath, isSea, todayIso } from '../homeModel'
import ShipmentRow from './ShipmentRow'
import { BUCKETS, inBucket, searchText, sortRows, toCsv, type Bucket, type ListShipment, type Range, type SortKey } from './shipmentList'
import { useShipmentList } from './useShipmentList'
import './shipments.css'

const PAGE = 25
type Dir = 'all' | 'import' | 'export'
type Mode = 'all' | 'sea' | 'air'

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="pv3-seg" role="group" aria-label={label}>
      {options.map((o) => <button key={o.v} type="button" className={value === o.v ? 'pv3-seg__on' : ''} onClick={() => onChange(o.v)}>{o.label}</button>)}
    </div>
  )
}

/** Shipments list: status buckets, search across refs and containers, filters, CSV export. */
export default function PortalShipmentsV3() {
  const navigate = useNavigate()
  const { ports } = usePorts()
  const [params, setParams] = useSearchParams()
  const bucket = (params.get('status') as Bucket) || 'all'
  const [range, setRange] = useState<Range>('12m')
  const [dir, setDir] = useState<Dir>('all')
  const [mode, setMode] = useState<Mode>('all')
  const [sort, setSort] = useState<SortKey>('eta')
  const [q, setQ] = useState(params.get('q') ?? '')
  const [page, setPage] = useState(0)
  const { rows, pending, loading, error } = useShipmentList(range)

  const scoped = useMemo(() => rows.filter((s) =>
    (dir === 'all' || s.direction === dir) && (mode === 'all' || (mode === 'sea') === isSea(s))), [rows, dir, mode])

  const counts = useMemo(() => {
    const today = todayIso()
    return Object.fromEntries(BUCKETS.map((b) => [b.key, scoped.filter((s) => inBucket(s, b.key, today)).length])) as Record<Bucket, number>
  }, [scoped])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const today = todayIso()
    const hit = scoped.filter((s) => inBucket(s, bucket, today) && (!needle || searchText(s, ports).includes(needle)))
    return sortRows(hit, sort)
  }, [scoped, bucket, q, ports, sort])

  useEffect(() => { setPage(0) }, [bucket, q, dir, mode, range, sort])
  const pages = Math.max(1, Math.ceil(shown.length / PAGE))
  const slice = shown.slice(page * PAGE, page * PAGE + PAGE)

  const setBucket = (b: Bucket) => {
    const p = new URLSearchParams(params)
    if (b === 'all') p.delete('status'); else p.set('status', b)
    setParams(p, { replace: true })
  }
  const open = (s: ListShipment) => navigate(detailPath(s))

  function exportCsv() {
    const blob = new Blob([toCsv(shown, ports)], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `ub-freight-shipments-${todayIso()}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div className="pv3-page">
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Shipments</h1>
          <p>{loading ? 'Loading your shipments…' : `${rows.length.toLocaleString('en-NZ')} shipments · ${counts.transit} in transit · ${counts.arriving} arriving this week`}</p>
        </div>
        <div className="pv3-head__actions">
          <button type="button" className="pv3-btn pv3-btn--ghost" onClick={exportCsv} disabled={!shown.length}><Download size={15} /> Export</button>
          <Link to="/portal/bookings/new" className="pv3-btn pv3-btn--primary"><Plus size={15} /> New booking</Link>
        </div>
      </div>

      {pending > 0 && (
        <Link to="/portal/bookings" className="pv3-sl__pending pv3-rise">
          <span className="pv3-sl__dot" /> {pending} booking request{pending === 1 ? '' : 's'} not yet a shipment. They appear here once we create the job.
          <span className="pv3-link">View bookings <ArrowRight size={14} /></span>
        </Link>
      )}

      <div className="pv3-sl__tabs pv3-rise" role="tablist" aria-label="Status">
        {BUCKETS.map((b) => (
          <button key={b.key} type="button" role="tab" aria-selected={bucket === b.key}
            className={`pv3-sl__tab${bucket === b.key ? ' pv3-sl__tab--on' : ''}${b.key === 'attention' && counts.attention ? ' pv3-sl__tab--warn' : ''}`}
            onClick={() => setBucket(b.key)}>
            {b.label}<span>{loading ? '·' : counts[b.key]}</span>
          </button>
        ))}
      </div>

      <section className="pv3-card pv3-sl pv3-rise" style={{ animationDelay: '.06s' }}>
        <div className="pv3-sl__bar">
          <label className="pv3-sl__search">
            <Search size={16} aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shipment, PO, container, supplier, vessel" aria-label="Search shipments" />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search"><X size={14} /></button>}
          </label>
          <Seg label="Direction" value={dir} onChange={setDir} options={[{ v: 'all', label: 'All' }, { v: 'import', label: 'Imports' }, { v: 'export', label: 'Exports' }]} />
          <Seg label="Mode" value={mode} onChange={setMode} options={[{ v: 'all', label: 'All' }, { v: 'sea', label: 'Sea' }, { v: 'air', label: 'Air' }]} />
          <select className="pv3-sl__select" value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Date range">
            <option value="90d">Last 90 days</option>
            <option value="12m">Last 12 months</option>
            <option value="all">All time</option>
          </select>
          <select className="pv3-sl__select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
            <option value="eta">Sort: arrival</option>
            <option value="etd">Sort: departure</option>
            <option value="recent">Sort: newest job</option>
            <option value="no">Sort: shipment no.</option>
          </select>
        </div>

        {error && <div className="pv3-error">{error}</div>}

        <div className="pv3-table-wrap">
          <table className="pv3-table pv3-sl__table">
            <thead>
              <tr><th>Shipment</th><th>Supplier / consignee</th><th>Route</th><th>Vessel / container</th><th>Cargo</th><th>Status</th><th aria-label="Open" /></tr>
            </thead>
            <tbody>
              {loading && [0, 1, 2, 3, 4, 5].map((i) => <tr key={i}><td colSpan={7}><span className="pv3-skel" /></td></tr>)}
              {!loading && slice.map((s, i) => <ShipmentRow key={s.job_unique} s={s} ports={ports} onOpen={open} delay={Math.min(i, 12) * 0.015} />)}
              {!loading && !slice.length && (
                <tr><td colSpan={7} className="pv3-empty-cell">
                  {q ? <>Nothing matches “{q}”. <button type="button" className="pv3-textbtn" onClick={() => setQ('')}>Clear search</button></> : 'No shipments in this view.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {!loading && shown.length > PAGE && (
          <footer className="pv3-sl__foot">
            <span>{page * PAGE + 1}–{Math.min(shown.length, page * PAGE + PAGE)} of {shown.length.toLocaleString('en-NZ')}</span>
            <div>
              <button type="button" className="pv3-iconbtn" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
              <span>{page + 1} / {pages}</span>
              <button type="button" className="pv3-iconbtn" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
            </div>
          </footer>
        )}
      </section>
    </div>
  )
}

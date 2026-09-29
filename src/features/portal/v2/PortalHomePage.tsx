import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowRight, Plane, Plus, Search, Ship, Tag } from 'lucide-react'
import { usePorts } from '../../../hooks/usePorts'
import GlobalMap from './GlobalMap'
import { CalendarCard, ExceptionsCard } from './HomeCards'
import ShipmentPeek from './ShipmentPeek'
import { useCountUp } from './useCountUp'
import { usePortalHome, type HomeShipment } from './usePortalHome'
import {
  addDays, calendarEvents, detailPath, exceptions, fmtDay, fmtMoney, fmtNum, isSea, money, placeName, progressPct,
  shipmentNo, shortCode, stageLabel, stageTone, titleCase, todayIso,
} from './homeModel'
import type { PortalOutletContext } from './PortalShellV2'

function greeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function Kpi({ label, value, sub, tone, delay, to }: { label: string; value: string; sub?: string; tone?: 'red' | 'amber' | 'blue'; delay: number; to?: string }) {
  const body = (
    <>
      <span className="pv3-kpi__label">{label}</span>
      <span className={`pv3-kpi__value${tone ? ` pv3-kpi__value--${tone}` : ''}`}>{value}</span>
      {sub && <span className="pv3-kpi__sub">{sub}</span>}
    </>
  )
  return to
    ? <Link to={to} className="pv3-card pv3-kpi pv3-rise pv3-hover" style={{ animationDelay: `${delay}s` }}>{body}</Link>
    : <div className="pv3-card pv3-kpi pv3-rise" style={{ animationDelay: `${delay}s` }}>{body}</div>
}

export default function PortalHomePage() {
  const navigate = useNavigate()
  const { account, openSearch } = useOutletContext<PortalOutletContext>()
  const { ports } = usePorts()
  const { pool, active, invoices, analytics, positions, loading, error } = usePortalHome()
  const today = todayIso()

  const m = useMemo(() => money(invoices), [invoices])
  const inTransit = useMemo(() => active.filter((s) => s.stage === 2).length, [active])
  const arriving = useMemo(() => pool.filter((s) => s.stage < 3 && s.eta && s.eta >= today && s.eta <= addDays(today, 7)).length, [pool, today])
  const exc = useMemo(() => exceptions(pool, active, m, ports), [pool, active, m, ports])
  const events = useMemo(() => calendarEvents(pool, ports), [pool, ports])
  const rows = useMemo(() => [...active].sort((a, b) => (a.eta ?? '9999').localeCompare(b.eta ?? '9999')), [active])

  const cActive = useCountUp(loading ? 0 : active.length)
  const cTransit = useCountUp(loading ? 0 : inTransit)
  const cArr = useCountUp(loading ? 0 : arriving)
  const cExc = useCountUp(loading ? 0 : exc.length)
  const cOpen = useCountUp(loading ? 0 : m.open)

  const open = useCallback((s: HomeShipment) => navigate(detailPath(s)), [navigate])

  const byId = useMemo(() => new Map(pool.map((s) => [s.job_unique, s])), [pool])
  const [picked, setPicked] = useState<number | null>(null)
  const peekRef = useRef<HTMLDivElement>(null)
  const pickedShip = picked != null ? byId.get(picked) ?? null : null
  const select = useCallback((id: number) => setPicked((cur) => (cur === id ? null : id)), [])
  useEffect(() => {
    if (pickedShip) peekRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [pickedShip])
  const statusOf = useCallback((id: number) => {
    const s = byId.get(id)
    return s ? { label: stageLabel(s), tone: stageTone(s) } : { label: '—', tone: 'grey' }
  }, [byId])
  const company = titleCase(account?.displayName) || 'there'

  return (
    <div className="pv3-page">
      <div className="pv3-head pv3-rise">
        <div>
          <h1>{greeting()}, {company}</h1>
          <p>{new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div className="pv3-head__actions">
          <button type="button" className="pv3-btn pv3-btn--ghost" onClick={openSearch}><Search size={15} /> Find shipment</button>
          <Link to="/portal/rates" className="pv3-btn pv3-btn--ghost"><Tag size={15} /> Get rates</Link>
          <Link to="/portal/bookings/new" className="pv3-btn pv3-btn--primary"><Plus size={15} /> New booking</Link>
        </div>
      </div>

      {error && <div className="pv3-error">{error}</div>}

      <div className="pv3-kpis">
        <Kpi label="Active shipments" value={String(Math.round(cActive))} sub={`${Math.round(cTransit)} in transit`} delay={0.04} to="/portal/shipments" />
        <Kpi label="Arriving next 7 days" value={String(Math.round(cArr))} sub="by scheduled ETA" delay={0.08} />
        <Kpi label="Exceptions" value={String(Math.round(cExc))} sub={exc.length ? 'need a look' : 'all clear'} tone={exc.length ? 'red' : undefined} delay={0.12} />
        <Kpi label="Open balance" value={fmtMoney(cOpen, m.currency)} sub={m.overdue > 0 ? `${fmtMoney(m.overdue, m.currency)} past due` : 'nothing past due'} tone={m.overdue > 0 ? 'amber' : undefined} delay={0.16} to="/portal/billing" />
      </div>

      <div className="pv3-rise" style={{ animationDelay: '.1s' }}>
        <GlobalMap active={active} pool={pool} lanes={analytics?.lanes ?? []} ports={ports} positions={positions} />
      </div>

      <div className="pv3-split">
        <ExceptionsCard items={exc} loading={loading} selected={picked} onSelect={select} />
        <CalendarCard events={events} selected={picked} onSelect={select} statusOf={statusOf} />
      </div>

      <div ref={peekRef} className={`pv3-peek-panel${pickedShip ? ' pv3-peek-panel--open' : ''}`} aria-live="polite">
        {pickedShip && (
          <div className="pv3-card pv3-peek-panel__inner" key={pickedShip.job_unique}>
            <ShipmentPeek s={pickedShip} ports={ports} onClose={() => setPicked(null)} />
          </div>
        )}
      </div>

      <section className="pv3-card pv3-table-card pv3-rise" style={{ animationDelay: '.2s' }}>
        <header className="pv3-card__head">
          <h2>Active shipments</h2>
          <Link to="/portal/shipments" className="pv3-link">All shipments <ArrowRight size={14} /></Link>
        </header>
        <div className="pv3-table-wrap">
          <table className="pv3-table">
            <thead>
              <tr>
                <th>Shipment</th><th>Route</th><th>Mode</th><th>Carrier</th><th>ETD</th><th>ETA</th><th>Status</th><th>Your PO</th>
              </tr>
            </thead>
            <tbody>
              {loading && [0, 1, 2, 3].map((i) => (
                <tr key={i}><td colSpan={8}><span className="pv3-skel" /></td></tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={8} className="pv3-empty-cell">No active shipments right now.</td></tr>
              )}
              {!loading && rows.slice(0, 12).map((s) => (
                <tr key={s.job_unique} onClick={() => open(s)} tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') open(s) }}>
                  <td>
                    <span className="pv3-mono pv3-strong">{shipmentNo(s)}</span>
                    <span className="pv3-cell-sub">{titleCase(s.goods_desc).slice(0, 42) || titleCase(s.direction === 'import' ? s.shipper_name : s.consignee_name)}</span>
                  </td>
                  <td>
                    <span className="pv3-mono">{shortCode(s.origin)} → {shortCode(s.destination)}</span>
                    <span className="pv3-cell-sub">{placeName(s.origin, ports)} to {placeName(s.destination, ports)}</span>
                  </td>
                  <td><span className="pv3-mode">{isSea(s) ? <Ship size={14} /> : <Plane size={14} />}{isSea(s) ? (s.load_type ?? 'Sea') : 'Air'}</span></td>
                  <td className="pv3-ellipsis">{s.vessel_flight ?? '—'}</td>
                  <td className="pv3-mono">{fmtDay(s.departed ?? s.etd)}</td>
                  <td className="pv3-mono">{fmtDay(s.arrived ?? s.eta)}</td>
                  <td>
                    <span className={`pv3-pill pv3-pill--${stageTone(s)}`}>{stageLabel(s)}</span>
                    <span className="pv3-progress"><span style={{ width: `${progressPct(s)}%` }} /></span>
                  </td>
                  <td className={s.customer_ref ? 'pv3-mono' : 'pv3-missing'}>{s.customer_ref ?? 'Add PO'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Link to="/portal/analytics" className="pv3-card pv3-home-an pv3-rise pv3-hover" style={{ animationDelay: '.25s' }}>
        <div>
          <b>Analytics</b>
          <span>Cost per kg, lanes, supplier scorecard and emissions</span>
        </div>
        {analytics && (
          <div className="pv3-home-an__nums">
            <span><i>Shipments, 12 months</i>{fmtNum(analytics.totals.shipments)}</span>
            <span><i>Freight spend</i>{fmtMoney(analytics.totals.spend, m.currency, true)}</span>
            <span><i>Containers</i>{fmtNum(analytics.totals.containers)}</span>
          </div>
        )}
        <span className="pv3-link">Open analytics <ArrowRight size={14} /></span>
      </Link>
    </div>
  )
}

import { useMemo } from 'react'
import { Link, useNavigate, useOutletContext } from 'react-router-dom'
import { ArrowRight, CheckCircle2, CreditCard, Hash, Plane, Plus, Ship } from 'lucide-react'
import { usePorts } from '../../../hooks/usePorts'
import PacificMap from './PacificMap'
import { useCountUp } from './useCountUp'
import { usePortalHome, type HomeShipment } from './usePortalHome'
import {
  activity, buildLanes, countries, detailPath, fmtMoney, isSea, money, needs, placeName, progressPct,
  shipmentNo, shortCode, sortForMotion, stageLabel, statusLine, titleCase,
} from './homeModel'
import type { PortalOutletContext } from './PortalShellV2'

function todayLong(): string {
  return new Date().toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function PortalHomePage() {
  const navigate = useNavigate()
  const { account } = useOutletContext<PortalOutletContext>()
  const { ports } = usePorts()
  const { active, recent, invoices, loading, error } = usePortalHome()

  const sorted = useMemo(() => sortForMotion(active), [active])
  const { lanes } = useMemo(() => buildLanes(active, ports), [active, ports])
  const nIslands = useMemo(() => countries(active, ports), [active, ports])
  const m = useMemo(() => money(invoices), [invoices])
  const todo = useMemo(() => needs(active, m), [active, m])
  const feed = useMemo(() => activity(active, recent, invoices, ports), [active, recent, invoices, ports])

  const cMoving = useCountUp(loading ? 0 : active.length)
  const cIslands = useCountUp(loading ? 0 : nIslands)
  const cOpen = useCountUp(loading ? 0 : m.open)

  const company = titleCase(account?.displayName) || 'there'

  return (
    <div className="pv2-home">
      <section className="pv2-hero">
        <div className="pv2-hero__inner">
          <div className="pv2-hero__copy">
            <div className="pv2-rise pv2-hero__eyebrow">
              <span className="pv2-livedot" aria-hidden><span className="pv2-ping pv2-ping--green" /></span>
              Live · {todayLong()}
            </div>
            <h1 className="pv2-rise pv2-hero__title" style={{ animationDelay: '.08s' }}>
              Kia ora, {company}.
              <span className="pv2-hero__subtitle">
                {loading ? 'Loading your shipments…' : active.length > 0 ? 'Here is everything on the move.' : 'Nothing on the move right now.'}
              </span>
            </h1>

            <div className="pv2-rise pv2-stats" style={{ animationDelay: '.18s' }}>
              <div className="pv2-stat">
                <span className="pv2-stat__num">{Math.round(cMoving)}</span>
                <span className="pv2-stat__label">shipments on the go</span>
              </div>
              <div className="pv2-stat">
                <span className="pv2-stat__num">{Math.round(cIslands)}</span>
                <span className="pv2-stat__label">{nIslands === 1 ? 'country' : 'countries'} in play</span>
              </div>
              <Link to="/portal/billing" className={`pv2-stat${m.overdue > 0 ? ' pv2-stat--warn' : ''}`}>
                <span className="pv2-stat__num">{fmtMoney(cOpen, m.currency, cOpen >= 10000 ? 0 : 2)}</span>
                <span className="pv2-stat__label">open balance</span>
              </Link>
            </div>

            <div className="pv2-rise pv2-needs" style={{ animationDelay: '.3s' }}>
              {!loading && todo.length === 0 && (
                <div className="pv2-need pv2-need--clear">
                  <span className="pv2-need__icon pv2-need__icon--green"><CheckCircle2 size={18} /></span>
                  <span className="pv2-need__text">
                    <span className="pv2-need__title">All clear</span>
                    <span className="pv2-need__body">Nothing needs you right now. We will message you if that changes.</span>
                  </span>
                </div>
              )}
              {todo.map((n) => (
                <div key={n.key} className="pv2-need">
                  <span className="pv2-sheen" aria-hidden />
                  <span className={`pv2-need__icon pv2-need__icon--${n.tone}`}>
                    {n.key === 'overdue' ? <CreditCard size={18} /> : <Hash size={18} />}
                  </span>
                  <span className="pv2-need__text">
                    <span className="pv2-need__title">{n.title}</span>
                    <span className="pv2-need__body">{n.body}</span>
                  </span>
                  <Link to={n.to} className={n.tone === 'amber' ? 'pv2-btn pv2-btn--primary' : 'pv2-btn pv2-btn--ghost'}>{n.cta}</Link>
                </div>
              ))}
            </div>
          </div>

          <div className="pv2-hero__map">
            <PacificMap lanes={lanes} />
          </div>
        </div>
      </section>

      <section className="pv2-body">
        {error && <div className="pv2-error">{error}</div>}

        <div className="pv2-body__main">
          <div className="pv2-section-head">
            <h2>In motion</h2>
            <div className="pv2-section-head__actions">
              <Link to="/portal/shipments" className="pv2-link">All shipments <ArrowRight size={14} /></Link>
              <Link to="/portal/bookings" className="pv2-btn pv2-btn--primary pv2-btn--sm"><Plus size={14} /> Book</Link>
            </div>
          </div>

          {loading ? (
            <div className="pv2-cards">
              {[0, 1, 2].map((i) => <div key={i} className="pv2-card pv2-skel" style={{ height: 196 }} />)}
            </div>
          ) : sorted.length === 0 ? (
            <div className="pv2-empty">
              <Ship size={22} />
              <p>No active shipments. Your recent deliveries are on the Shipments page.</p>
              <Link to="/portal/bookings" className="pv2-btn pv2-btn--primary">Book a shipment</Link>
            </div>
          ) : (
            <div className="pv2-cards">
              {sorted.slice(0, 6).map((s, i) => (
                <ShipmentCard key={s.job_unique} s={s} i={i} ports={ports} onOpen={() => navigate(detailPath(s))} />
              ))}
            </div>
          )}
          {sorted.length > 6 && (
            <Link to="/portal/shipments" className="pv2-more">
              <span>{sorted.length - 6} more on the go</span>
              <span className="pv2-link">View all <ArrowRight size={14} /></span>
            </Link>
          )}
        </div>

        <aside className="pv2-card pv2-feed">
          <div className="pv2-feed__head">
            <h2>Activity</h2>
            <span className="pv2-live"><span />Live</span>
          </div>
          {feed.length === 0 && !loading && <p className="pv2-muted">No recent activity.</p>}
          {feed.map((f, i) => (
            <div key={f.key} className="pv2-feed__row" style={{ animationDelay: `${0.4 + i * 0.1}s` }}>
              <span className={`pv2-feed__dot pv2-feed__dot--${f.tone}`} />
              <span className="pv2-feed__text">
                <span className="pv2-feed__title">{f.title}</span>
                <span className="pv2-feed__sub">{f.sub}</span>
              </span>
              <span className="pv2-feed__when">{f.when}</span>
            </div>
          ))}
        </aside>
      </section>
    </div>
  )
}

function ShipmentCard({ s, i, ports, onOpen }: { s: HomeShipment; i: number; ports: ReturnType<typeof usePorts>['ports']; onOpen: () => void }) {
  const pct = progressPct(s)
  const label = stageLabel(s)
  const goods = titleCase(s.goods_desc)
  const party = titleCase(s.direction === 'import' ? s.shipper_name : s.consignee_name)
  return (
    <button type="button" className="pv2-card pv2-scard pv2-lift pv2-rise" style={{ animationDelay: `${0.25 + i * 0.07}s` }} onClick={onOpen}>
      <span className="pv2-scard__top">
        <span className={`pv2-pill pv2-pill--${s.stage >= 3 ? 'green' : s.stage === 2 ? 'blue' : 'grey'}`}>{label}</span>
        <span className="pv2-scard__mode">
          {isSea(s) ? <Ship size={13} aria-hidden /> : <Plane size={13} aria-hidden />}
          {[s.load_type, s.vessel_flight].filter(Boolean).join(' · ') || (isSea(s) ? 'Sea' : 'Air')}
        </span>
      </span>
      <span className="pv2-scard__no">{shipmentNo(s)}</span>
      <span className="pv2-scard__desc">{[goods, party].filter(Boolean).join(' · ') || '—'}</span>
      <span className="pv2-route">
        <span className="pv2-route__code" title={placeName(s.origin, ports)}>{shortCode(s.origin)}</span>
        <span className="pv2-route__track"><span className="pv2-route__fill" style={{ width: `${pct}%`, animationDelay: `${0.5 + i * 0.08}s` }} /></span>
        <span className="pv2-route__code" title={placeName(s.destination, ports)}>{shortCode(s.destination)}</span>
      </span>
      <span className="pv2-scard__line">{statusLine(s, ports)}</span>
    </button>
  )
}

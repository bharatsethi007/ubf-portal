import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Anchor, Check, ChevronRight, Copy, Gauge, MessageSquare, Package, Plane, Radio, Ship } from 'lucide-react'
import { usePorts } from '../../../../hooks/usePorts'
import TrackMap from '../../../publicTrack/TrackMap'
import TrackEtaCard from '../../../publicTrack/TrackEtaCard'
import TrackTimeline from '../../../publicTrack/TrackTimeline'
import { ago, boxType } from '../../../publicTrack/trackFormat'
import { usePortalShipment } from '../../shipment/usePortalShipment'
import CargoContainersTab from '../../shipment/tabs/CargoContainersTab'
import DocumentsTab from '../../shipment/tabs/DocumentsTab'
import InvoicesTab from '../../shipment/tabs/InvoicesTab'
import TaskTab from '../../shipment/tabs/TaskTab'
import AdditionalServicesTab from '../../shipment/tabs/AdditionalServicesTab'
import ShipmentCsatWidget from '../../../../pages/portal/ShipmentCsatWidget'
import { detailPath, fmtDay, fmtNum, placeName, shipmentNo, shortCode, titleCase } from '../homeModel'
import InvoiceDrawer from '../billing/InvoiceDrawer'
import { toBillInvoice, type BillInvoice } from '../billing/billingApi'
import { usePortalTrack } from './usePortalTrack'
import { useMessageDock } from '../messages/MessagesDock'
import ContainerDatesCard from '../actions/ContainerDatesCard'

const TABS = ['Overview', 'Cargo & containers', 'Documents', 'Invoices', 'Tasks', 'Additional services'] as const
type Tab = (typeof TABS)[number]
const LEGACY: Record<string, Tab> = { Summary: 'Overview', 'Track & trace': 'Overview', Task: 'Tasks' }

const TRACK_BASE = ((import.meta.env.VITE_TRACKING_BASE_URL as string | undefined) || 'https://tracking.ubfreight.com').replace(/\/+$/, '')

function useIsDesktop() {
  const q = '(min-width: 900px)'
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setD(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return d
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
      <span className="flex items-center gap-2 text-slate-500">{icon}{label}</span>
      <span className="truncate text-right text-slate-800">{value}</span>
    </div>
  )
}

export default function PortalShipmentDetailV3() {
  const { jobNo } = useParams()
  const [params, setParams] = useSearchParams()
  const { ports } = usePorts()
  const { data, loading, error } = usePortalShipment(jobNo)
  const s = data?.shipment ?? null
  const pt = usePortalTrack(s, ports)
  const desktop = useIsDesktop()
  const [copied, setCopied] = useState(false)
  const [openInv, setOpenInv] = useState<BillInvoice | null>(null)
  const { openMessages } = useMessageDock()

  const raw = params.get('tab') ?? 'Overview'
  const tab: Tab = (TABS as readonly string[]).includes(raw) ? (raw as Tab) : LEGACY[raw] ?? 'Overview'
  const setTab = (t: Tab) => setParams((p) => { const n = new URLSearchParams(p); n.set('tab', t); return n }, { replace: true })

  const padding = useMemo(() => (desktop
    ? { top: 60, bottom: 60, left: 420, right: 70 }
    : { top: 40, bottom: 40, left: 30, right: 60 }), [desktop])

  useEffect(() => { if (s) document.title = `${shipmentNo(s)} · UB Freight` }, [s])

  if (loading) {
    return (
      <div className="pv3-page">
        <span className="pv3-skel" style={{ width: 220, height: 28 }} />
        <div className="pv3-card pv3-skel-card" style={{ height: 520 }} />
      </div>
    )
  }
  if (error || !data || !s) {
    return (
      <div className="pv3-page">
        <div className="pv3-card" style={{ padding: 32, textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: 18, color: 'var(--ink)' }}>Shipment not found</h1>
          <p className="pv3-muted">{error || 'It may belong to another account, or the link is out of date.'}</p>
          <Link to="/portal/shipments" className="pv3-btn pv3-btn--primary" style={{ marginTop: 12 }}>Back to shipments</Link>
        </div>
      </div>
    )
  }

  const no = shipmentNo(s)
  const sea = (s.mode ?? '').toLowerCase() === 'sea'
  const goods = titleCase(s.goods_desc)
  const party = titleCase((s.direction ?? '') === 'import' ? s.shipper_name : s.consignee_name)
  const t = pt?.track
  const v = t?.vessel
  const vesselLine = v?.name ? [v.name, v.voyage].filter(Boolean).join(' · ') : s.vessel_flight
  const nowLine = v?.position
    ? [v.speed_kn != null ? `${v.speed_kn} kn` : null, v.nm_to_go != null ? `${v.nm_to_go.toLocaleString()} nm to go` : null].filter(Boolean).join(' · ') || 'At sea'
    : null
  const shareLink = pt?.token ? `${TRACK_BASE}/t/${pt.token}` : null
  const copy = async () => {
    if (!shareLink) return
    await navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  const showCsat = Boolean(data.booking?.delivery_date && data.booking?.id)

  const panel = t && (
    <>
      <TrackEtaCard t={t} />
      <div className="border-b border-slate-100 px-5 py-3">
        <Fact icon={sea ? <Ship size={15} /> : <Plane size={15} />} label={sea ? 'Vessel' : 'Flight'} value={vesselLine} />
        <Fact icon={<Gauge size={15} />} label="Now" value={nowLine} />
        {v?.position_at ? <p className="-mt-0.5 text-right text-[11px] text-slate-400">Position {ago(v.position_at)}</p> : null}
        {t.containers.map((c) => (
          <Fact key={c.no} icon={<Package size={15} />} label="Container" value={[c.no, boxType(c.type)].filter(Boolean).join(' · ')} />
        ))}
        <Fact icon={<Anchor size={15} />} label="House bill" value={s.house_bill} />
      </div>
      <div className="px-5 py-3 text-[11px] leading-5 text-slate-400">
        {pt?.live
          ? <p>Live tracking{t.updated_at ? ` · updated ${ago(t.updated_at)}` : ''}. Times in your local timezone.</p>
          : <p>Schedule-based view from booking dates. Live vessel tracking appears once carrier data is connected.</p>}
      </div>
    </>
  )

  return (
    <div className="pv3-page">
      <nav className="pv3-crumbs" aria-label="Breadcrumb">
        <Link to="/portal">Home</Link><ChevronRight size={12} />
        <Link to="/portal/shipments">Shipments</Link><ChevronRight size={12} />
        <span>{no}</span>
      </nav>

      <header className="pv3-card pv3-dhead pv3-rise">
        <div className="pv3-dhead__main">
          <span className="pv3-peek__mode">{sea ? <Ship size={16} /> : <Plane size={16} />}</span>
          <div className="pv3-dhead__text">
            <div className="pv3-dhead__row">
              <h1 className="pv3-mono">{no}</h1>
              <span className={`pv3-pill pv3-pill--${t?.status === 'delivered' || t?.status === 'arrived' || t?.status === 'released' ? 'green' : t?.status === 'sailing' ? 'blue' : 'grey'}`}>
                {s.status ?? '—'}
              </span>
              {pt?.live && <span className="pv3-live-badge"><Radio size={12} /> Live</span>}
            </div>
            <p>{[goods, party].filter(Boolean).join(' · ') || '—'}</p>
            <div className="pv3-dhead__chips">
              <span><b className="pv3-mono">{shortCode(s.origin)} → {shortCode(s.destination)}</b> {placeName(s.origin, ports)} to {placeName(s.destination, ports)}</span>
              <span>{sea ? `Sea${s.load_type ? ` · ${s.load_type}` : ''}` : 'Air'}</span>
              <span>{(s.direction ?? '') === 'import' ? 'Import' : 'Export'}</span>
              {s.weight_kg ? <span>{fmtNum(Number(s.weight_kg))} kg</span> : null}
              {s.customer_ref ? <span>PO <b className="pv3-mono">{s.customer_ref}</b></span> : <span className="pv3-missing">No PO on file</span>}
            </div>
          </div>
        </div>
        <div className="pv3-dhead__actions">
          {shareLink && (
            <button type="button" className={`pv3-btn ${copied ? 'pv3-btn--ok' : 'pv3-btn--ghost'}`} onClick={() => void copy()}>
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Link copied' : 'Share tracking'}
            </button>
          )}
          <button type="button" className="pv3-btn pv3-btn--ghost" onClick={() => openMessages({ job: s.job_unique, subject: `Shipment ${no}` })}><MessageSquare size={14} /> Message UBF</button>
          <button type="button" className="pv3-btn pv3-btn--primary" onClick={() => setTab('Documents')}>Documents</button>
        </div>
      </header>

      {t && (
        desktop ? (
          <section className="pv3-track pv3-rise" style={{ animationDelay: '.08s' }}>
            <TrackMap track={t} padding={padding} />
            <aside className="pv3-track__panel">{panel}</aside>
          </section>
        ) : (
          <section className="pv3-rise">
            <div className="pv3-track pv3-track--mobile"><TrackMap track={t} padding={padding} /></div>
            <div className="pv3-card pv3-track__below">{panel}</div>
          </section>
        )
      )}

      {showCsat && <ShipmentCsatWidget bookingId={data.booking!.id} />}

      <div className="pv3-tabs" role="tablist" aria-label="Shipment sections">
        {TABS.map((x) => (
          <button key={x} type="button" role="tab" aria-selected={tab === x}
            className={`pv3-tabs__btn${tab === x ? ' pv3-tabs__btn--on' : ''}`} onClick={() => setTab(x)}>
            {x}
            {x === 'Invoices' && data.invoices.length > 0 && <span className="pv3-tabs__n">{data.invoices.length}</span>}
            {x === 'Cargo & containers' && data.containers.length > 0 && <span className="pv3-tabs__n">{data.containers.length}</span>}
          </button>
        ))}
      </div>

      <div className="pv3-tabpanel pv3-rise" key={tab}>
        {tab === 'Overview' && data.booking?.id && <ContainerDatesCard bookingId={data.booking.id} docsTo={detailPath(s, 'Documents')} />}
        {tab === 'Overview' && (
          <div className="pv3-overview">
            <section className="pv3-card pv3-overview__timeline">
              <header className="pv3-card__head"><h2>Journey</h2></header>
              {t && <TrackTimeline t={t} />}
            </section>
            <section className="pv3-card pv3-overview__facts">
              <header className="pv3-card__head"><h2>Details</h2></header>
              <dl className="pv3-peek__facts">
                {([
                  ['Shipment', no],
                  ['House bill', s.house_bill],
                  ['Master bill', s.master_bill],
                  ['Your PO', s.customer_ref],
                  ['Shipper', titleCase(s.shipper_name)],
                  ['Consignee', titleCase(s.consignee_name)],
                  ['Carrier', s.vessel_flight],
                  ['ETD', s.etd ? fmtDay(s.etd) : null],
                  ['ETA', s.eta ? fmtDay(s.eta) : null],
                  ['Packages', s.pack_qty ? `${fmtNum(Number(s.pack_qty))} ${titleCase(s.pack_type) || 'pcs'}` : null],
                  ['Weight', s.weight_kg ? `${fmtNum(Number(s.weight_kg))} kg` : null],
                  ['Volume', s.volume_m3 ? `${Number(s.volume_m3).toFixed(2)} m³` : null],
                  ['Goods', goods || null],
                  ['Marks', s.marks],
                ] as [string, string | null][]).filter(([, val]) => val).map(([k, val]) => (
                  <div key={k}><dt>{k}</dt><dd title={val ?? ''}>{val}</dd></div>
                ))}
              </dl>
            </section>
          </div>
        )}
        {tab === 'Cargo & containers' && <div className="pv3-card pv3-tabcard"><CargoContainersTab shipment={s} containers={data.containers} /></div>}
        {tab === 'Documents' && <div className="pv3-card pv3-tabcard"><DocumentsTab bookingId={data.booking?.id ?? null} /></div>}
        {tab === 'Invoices' && <div className="pv3-card pv3-tabcard"><InvoicesTab invoices={data.invoices}
          onOpen={(i) => setOpenInv(toBillInvoice(i, { shipment_no: shipmentNo(s), customer_ref: s.customer_ref, origin: s.origin, destination: s.destination }))} /></div>}
        {tab === 'Tasks' && data.booking?.id && <ContainerDatesCard bookingId={data.booking.id} docsTo={detailPath(s, 'Documents')} />}
        {tab === 'Tasks' && <div className="pv3-card pv3-tabcard"><TaskTab tasks={data.tasks} /></div>}
        {tab === 'Additional services' && <div className="pv3-card pv3-tabcard"><AdditionalServicesTab /></div>}
      </div>
      {openInv && <InvoiceDrawer inv={openInv} fromShipment onClose={() => setOpenInv(null)} />}
    </div>
  )
}

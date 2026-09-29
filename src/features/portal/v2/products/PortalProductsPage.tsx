import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Boxes, PackageSearch, Search, Upload, X } from 'lucide-react'
import { addDays, fmtDay, fmtNum, titleCase, todayIso } from '../homeModel'
import PoList from './PoList'
import SkuDrawer from './SkuDrawer'
import UploadPanel from './UploadPanel'
import { fetchProducts, fetchSupplyChain, poRows, skuRows, type Product, type SkuRow, type SupplyChain } from './productsApi'
import { money2 } from '../analytics/analyticsApi'
import '../shipments/shipments.css'
import '../rates/rates.css'
import './products.css'

type Tab = 'skus' | 'pos'

/** SKUs and purchase orders: where every product is, what's still to ship, lead times and freight per unit. */
export default function PortalProductsPage() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'pos' ? 'pos' : 'skus'
  const [sc, setSc] = useState<SupplyChain | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [upload, setUpload] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([fetchSupplyChain(), fetchProducts()])
      setSc(a); setProducts(b); setErr('')
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load') }
  }, [])
  useEffect(() => { void load() }, [load])

  const skus = useMemo(() => (sc ? skuRows(sc, products) : []), [sc, products])
  const pos = useMemo(() => (sc ? poRows(sc) : []), [sc])
  const needle = q.trim().toLowerCase()
  const skuShown = useMemo(() => skus
    .filter((r) => !needle || [r.sku, r.description, r.supplier, r.product?.category].filter(Boolean).join(' ').toLowerCase().includes(needle))
    .sort((a, b) => (b.transit + b.booked + b.open) - (a.transit + a.booked + a.open) || a.sku.localeCompare(b.sku)), [skus, needle])
  const poShown = useMemo(() => pos
    .filter((p) => !needle || [p.po_number, p.supplier, ...p.lines.map((l) => l.sku)].filter(Boolean).join(' ').toLowerCase().includes(needle))
    .sort((a, b) => (b.order_date ?? '').localeCompare(a.order_date ?? '')), [pos, needle])

  const today = todayIso()
  const kpi = useMemo(() => {
    const transit = skus.reduce((n, r) => n + r.transit, 0)
    const openQty = skus.reduce((n, r) => n + r.open, 0)
    const soon = skus.filter((r) => r.nextEta && r.nextEta <= addDays(today, 14)).length
    const leads = skus.map((r) => r.leadDays).filter((d): d is number => d != null)
    return {
      transit, openQty, soon,
      lead: leads.length ? Math.round(leads.reduce((a, b) => a + b, 0) / leads.length) : null,
      openPos: pos.filter((p) => p.status === 'open' && p.health !== 'arrived').length,
      late: pos.filter((p) => p.health === 'late').length,
    }
  }, [skus, pos, today])

  const setTab = (t: Tab) => { const p = new URLSearchParams(params); if (t === 'skus') p.delete('tab'); else p.set('tab', t); setParams(p, { replace: true }) }
  const row = picked ? skus.find((r) => r.sku === picked) ?? null : null
  const empty = sc && !skus.length && !pos.length

  return (
    <div className="pv3-page">
      <div className="pv3-head pv3-rise">
        <div>
          <h1>Products & POs</h1>
          <p>Track every SKU from purchase order to your door.</p>
        </div>
        <div className="pv3-head__actions">
          <button type="button" className="pv3-btn pv3-btn--primary" onClick={() => setUpload(true)}><Upload size={15} /> Upload</button>
        </div>
      </div>

      {err && <div className="pv3-error">{err}</div>}
      {upload && <UploadPanel onDone={() => void load()} onClose={() => setUpload(false)} initial={products.length ? 'po' : 'products'} />}

      {empty && !upload && (
        <section className="pv3-card pv3-prod__empty pv3-rise">
          <PackageSearch size={36} />
          <h2>See every SKU on the water</h2>
          <p>Upload your purchase orders (PO number, SKU, quantity) from Excel. We match them to your shipments by PO reference, then show what's ordered, in transit and arrived, lead times per supplier and freight cost per unit.</p>
          <button type="button" className="pv3-btn pv3-btn--primary" onClick={() => setUpload(true)}><Upload size={15} /> Upload purchase orders</button>
          <span className="pv3-muted">Tip: put your PO number in the booking reference when you book with us, and matching is automatic.</span>
        </section>
      )}

      {!empty && (
        <>
          <div className="pv3-kpis pv3-prod__kpis">
            {[
              ['SKUs', fmtNum(skus.length), `${kpi.openPos} open POs`],
              ['Units in transit', fmtNum(kpi.transit), 'on the water or in the air'],
              ['Units not yet shipped', fmtNum(kpi.openQty), kpi.late ? `${kpi.late} PO${kpi.late === 1 ? '' : 's'} behind schedule` : 'on open POs'],
              ['SKUs arriving in 14 days', fmtNum(kpi.soon), 'by current ETA'],
              ['Avg lead time', kpi.lead != null ? `${kpi.lead} d` : '—', 'order to arrival'],
            ].map(([l, v, s], i) => (
              <div key={l} className="pv3-card pv3-kpi pv3-rise" style={{ animationDelay: `${0.03 * i}s` }}>
                <span className="pv3-kpi__label">{l}</span><span className={`pv3-kpi__value${l === 'Units not yet shipped' && kpi.late ? ' pv3-kpi__value--amber' : ''}`}>{v}</span><span className="pv3-kpi__sub">{s}</span>
              </div>
            ))}
          </div>

          <div className="pv3-sl__tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'skus'} className={`pv3-sl__tab${tab === 'skus' ? ' pv3-sl__tab--on' : ''}`} onClick={() => setTab('skus')}>SKUs<span>{skus.length}</span></button>
            <button type="button" role="tab" aria-selected={tab === 'pos'} className={`pv3-sl__tab${tab === 'pos' ? ' pv3-sl__tab--on' : ''}`} onClick={() => setTab('pos')}>Purchase orders<span>{pos.length}</span></button>
          </div>

          <section className="pv3-card pv3-sl pv3-rise">
            <div className="pv3-sl__bar">
              <label className="pv3-sl__search">
                <Search size={16} aria-hidden />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === 'skus' ? 'Where is my SKU? Search SKU, description, supplier' : 'Search PO number, supplier or SKU'} aria-label="Search" />
                {q && <button type="button" onClick={() => setQ('')} aria-label="Clear"><X size={14} /></button>}
              </label>
              {tab === 'skus' && (
                <div className="pv3-legend pv3-legend--inline pv3-prod__legend" aria-label="Pipeline legend">
                  <span><i className="pv3-legend__sq pv3-prod__p-open" />Not shipped</span>
                  <span><i className="pv3-legend__sq pv3-prod__p-booked" />Booked</span>
                  <span><i className="pv3-legend__sq pv3-prod__p-transit" />In transit</span>
                  <span><i className="pv3-legend__sq pv3-prod__p-arrived" />Arrived</span>
                </div>
              )}
            </div>
            {!sc ? <div className="pv3-skel-list">{[0, 1, 2, 3].map((i) => <span key={i} className="pv3-skel" />)}</div> : tab === 'skus' ? (
              <div className="pv3-table-wrap">
                <table className="pv3-table">
                  <thead><tr><th>SKU</th><th>Supplier</th><th>Pipeline</th><th>Not shipped</th><th>In transit</th><th>Arrived</th><th>Next arrival</th><th>Lead time</th><th>Freight / unit</th></tr></thead>
                  <tbody>
                    {skuShown.slice(0, 300).map((r) => <SkuLine key={r.sku} r={r} onOpen={() => setPicked(r.sku)} />)}
                    {!skuShown.length && <tr><td colSpan={9} className="pv3-empty-cell">No SKUs match.</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : <PoList pos={poShown} sc={sc} onChanged={() => void load()} />}
          </section>
          <p className="pv3-foot"><Boxes size={12} /> Freight per unit shares each shipment's UB Freight invoices across the PO lines on it, by value. Lead time runs from PO date to arrival.</p>
        </>
      )}

      {row && sc && <SkuDrawer row={row} sc={sc} onClose={() => setPicked(null)} />}
    </div>
  )
}

function SkuLine({ r, onOpen }: { r: SkuRow; onOpen: () => void }) {
  const total = r.open + r.booked + r.transit + r.arrived
  const seg = (v: number) => `${total ? (v / total) * 100 : 0}%`
  return (
    <tr tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen() }}>
      <td><b className="pv3-mono pv3-strong">{r.sku}</b><span className="pv3-cell-sub" title={r.description ?? ''}>{titleCase(r.description).slice(0, 40) || '—'}</span></td>
      <td className="pv3-ellipsis">{titleCase(r.supplier) || '—'}</td>
      <td>
        <div className="pv3-prod__pipe" title={`${fmtNum(r.open)} not shipped · ${fmtNum(r.booked)} booked · ${fmtNum(r.transit)} in transit · ${fmtNum(r.arrived)} arrived`}>
          <span className="pv3-prod__p-open" style={{ width: seg(r.open) }} />
          <span className="pv3-prod__p-booked" style={{ width: seg(r.booked) }} />
          <span className="pv3-prod__p-transit" style={{ width: seg(r.transit) }} />
          <span className="pv3-prod__p-arrived" style={{ width: seg(r.arrived) }} />
        </div>
      </td>
      <td>{r.open ? fmtNum(r.open) : '—'}</td>
      <td>{r.transit ? <b>{fmtNum(r.transit)}</b> : '—'}{r.booked ? <span className="pv3-cell-sub">+{fmtNum(r.booked)} booked</span> : null}</td>
      <td>{r.arrived ? fmtNum(r.arrived) : '—'}</td>
      <td>{r.nextEta ? fmtDay(r.nextEta) : '—'}</td>
      <td>{r.leadDays != null ? `${r.leadDays} d` : '—'}</td>
      <td>{r.freightPerUnit != null ? money2(r.freightPerUnit) : '—'}</td>
    </tr>
  )
}

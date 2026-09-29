import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { detailPath, fmtDay, fmtNum, titleCase } from '../homeModel'
import { whereOf, type SkuRow, type SupplyChain } from './productsApi'
import { money2 } from '../analytics/analyticsApi'

const WHERE = { booked: { l: 'Booked', t: 'grey' }, transit: { l: 'In transit', t: 'blue' }, arrived: { l: 'Arrived', t: 'green' } } as const

/** "Where is my SKU": every PO line for it and the shipments carrying it. */
export default function SkuDrawer({ row, sc, onClose }: { row: SkuRow; sc: SupplyChain; onClose: () => void }) {
  const ship = new Map(sc.shipments.map((s) => [s.job_unique, s]))
  const lines = sc.lines.filter((l) => l.sku === row.sku)
  const p = row.product
  return (
    <div className="pv3-skud" role="dialog" aria-label={`SKU ${row.sku}`}>
      <button type="button" className="pv3-skud__scrim" aria-label="Close" onClick={onClose} />
      <aside className="pv3-skud__panel">
        <header className="pv3-skud__head">
          <div>
            <span className="pv3-mono pv3-strong">{row.sku}</span>
            <h2>{titleCase(row.description) || 'No description'}</h2>
            <span className="pv3-muted">{[titleCase(row.supplier), p?.category, p?.hs_code ? `HS ${p.hs_code}` : null].filter(Boolean).join(' · ')}</span>
          </div>
          <button type="button" className="pv3-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>

        <div className="pv3-sku__flow">
          {[['On order', row.open], ['Booked', row.booked], ['In transit', row.transit], ['Arrived', row.arrived]].map(([l, v]) => (
            <div key={l as string}><span>{l}</span><b>{fmtNum(v as number)}</b></div>
          ))}
        </div>
        <dl className="pv3-peek__facts">
          <div><dt>Next arrival</dt><dd>{row.nextEta ? fmtDay(row.nextEta) : '—'}</dd></div>
          <div><dt>Lead time</dt><dd>{row.leadDays != null ? `${row.leadDays} days order to arrival` : 'After first arrival'}</dd></div>
          <div><dt>Freight per unit</dt><dd>{row.freightPerUnit != null ? money2(row.freightPerUnit) : '—'}</dd></div>
          <div><dt>Unit value</dt><dd>{p?.unit_value != null ? `${p.currency ?? ''} ${p.unit_value}` : '—'}</dd></div>
        </dl>

        <h3 className="pv3-skud__h3">Purchase orders</h3>
        <ul className="pv3-sku__lines">
          {lines.map((l) => {
            const alloc = l.allocations.reduce((n, a) => n + a.qty, 0)
            return (
              <li key={l.line_id}>
                <div className="pv3-sku__po">
                  <b className="pv3-mono">{l.po_number}</b>
                  <span>{fmtNum(l.qty_ordered)} ordered{l.order_date ? ` · ${fmtDay(l.order_date)}` : ''}</span>
                  {l.qty_ordered - alloc > 0 && l.po_status === 'open' && <span className="pv3-tag pv3-tag--amber">{fmtNum(l.qty_ordered - alloc)} not shipped</span>}
                </div>
                {l.allocations.map((a) => {
                  const s = ship.get(a.job_unique)
                  const w = WHERE[whereOf(s)]
                  return (
                    <Link key={a.job_unique} to={detailPath({ job_unique: a.job_unique })} className="pv3-sku__ship">
                      <span className="pv3-mono">{s?.shipment_no ?? `#${a.job_unique}`}</span>
                      <span>{fmtNum(a.qty)} units</span>
                      <span className={`pv3-pill pv3-pill--${w.t}`}>{w.l}</span>
                      <span className="pv3-cell-sub">{s?.arrived ? `Arrived ${fmtDay(s.arrived)}` : s?.eta ? `ETA ${fmtDay(s.eta)}` : ''}</span>
                    </Link>
                  )
                })}
              </li>
            )
          })}
          {!lines.length && <li className="pv3-muted">Not on any purchase order yet.</li>}
        </ul>
      </aside>
    </div>
  )
}

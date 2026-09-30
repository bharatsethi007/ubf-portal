import { Link } from 'react-router-dom'
import { ArrowRight, FileText, MessageSquare, Plane, Receipt, Ship, X } from 'lucide-react'
import type { PortMap } from '../../../hooks/usePorts'
import type { HomeShipment } from './usePortalHome'
import { detailPath, fmtDay, fmtNum, isSea, placeName, shipmentNo, shortCode, stageLabel, stageTone, titleCase } from './homeModel'

const STEPS = ['Booked', 'Departed', 'Arrived', 'Delivered']

type Props = { s: HomeShipment; ports: PortMap; onClose?: () => void; compact?: boolean }

export default function ShipmentPeek({ s, ports, onClose, compact }: Props) {
  const no = shipmentNo(s)
  const goods = titleCase(s.goods_desc)
  const party = titleCase(s.direction === 'import' ? s.shipper_name : s.consignee_name)
  const done = s.stage >= 3 ? 3 : s.stage === 2 ? 2 : 1
  const dep = s.departed ?? s.etd
  const arr = s.arrived ?? s.eta
  const facts: [string, string | null][] = [
    ['Carrier', s.vessel_flight],
    ['Load', isSea(s) ? (s.load_type ?? 'Sea') : 'Air'],
    ['Packages', s.pack_qty ? `${fmtNum(Number(s.pack_qty))} ${titleCase(s.pack_type) || 'pcs'}` : null],
    ['Weight', s.weight_kg ? `${fmtNum(Number(s.weight_kg))} kg` : null],
    ['Volume', s.volume_m3 ? `${Number(s.volume_m3).toFixed(2)} m³` : null],
    ['House bill', s.house_bill],
    ['Master bill', s.master_bill],
    ['Your PO', s.customer_ref],
  ]

  return (
    <article className={`pv3-peek${compact ? ' pv3-peek--compact' : ''}`} aria-label={`Shipment ${no}`}>
      <header className="pv3-peek__head">
        <div className="pv3-peek__id">
          <span className="pv3-peek__mode">{isSea(s) ? <Ship size={14} /> : <Plane size={14} />}</span>
          <div>
            <div className="pv3-peek__no pv3-mono">{no}</div>
            <div className="pv3-peek__sub">{[goods, party].filter(Boolean).join(' · ') || '—'}</div>
          </div>
        </div>
        <div className="pv3-peek__right">
          <span className={`pv3-pill pv3-pill--${stageTone(s)}`}>{stageLabel(s)}</span>
          {onClose && (
            <button type="button" className="pv3-iconbtn" aria-label="Close" onClick={onClose}><X size={16} /></button>
          )}
        </div>
      </header>

      <div className="pv3-peek__route">
        <div>
          <span className="pv3-peek__code pv3-mono">{shortCode(s.origin)}</span>
          <span className="pv3-peek__city">{placeName(s.origin, ports)}</span>
          <span className="pv3-peek__date">{dep ? `${s.departed ? 'Departed' : 'ETD'} ${fmtDay(dep)}` : 'ETD to be confirmed'}</span>
        </div>
        <ol className="pv3-steps" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} className={i < done ? 'pv3-steps__done' : i === done ? 'pv3-steps__next' : ''} style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
              <span className="pv3-steps__dot" />
              <span className="pv3-steps__label">{label}</span>
            </li>
          ))}
        </ol>
        <div className="pv3-peek__end">
          <span className="pv3-peek__code pv3-mono">{shortCode(s.destination)}</span>
          <span className="pv3-peek__city">{placeName(s.destination, ports)}</span>
          <span className="pv3-peek__date">{arr ? `${s.arrived ? 'Arrived' : 'ETA'} ${fmtDay(arr)}` : 'ETA to be confirmed'}</span>
        </div>
      </div>

      {!compact && (
        <dl className="pv3-peek__facts">
          {facts.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd className={k.includes('bill') || k === 'Your PO' ? 'pv3-mono' : ''}>{v}</dd></div>
          ))}
          {!s.customer_ref && <div><dt>Your PO</dt><dd className="pv3-missing">Not added</dd></div>}
        </dl>
      )}

      <div className="pv3-peek__actions">
        <Link to={detailPath(s)} className="pv3-btn pv3-btn--primary">View shipment <ArrowRight size={14} /></Link>
        <Link to={detailPath(s, 'Documents')} className="pv3-btn pv3-btn--ghost"><FileText size={14} /> Documents</Link>
        <Link to={detailPath(s, 'Invoices')} className="pv3-btn pv3-btn--ghost"><Receipt size={14} /> Invoices</Link>
        <Link to={`/portal/messages?job=${s.job_unique}`} className="pv3-btn pv3-btn--ghost"><MessageSquare size={14} /> Message UBF</Link>
      </div>
    </article>
  )
}

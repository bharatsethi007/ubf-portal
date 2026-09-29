import { AlertTriangle, ChevronRight, Plane, Ship } from 'lucide-react'
import type { PortMap } from '../../../../hooks/usePorts'
import { fmtDay, isSea, placeName, progressPct, shipmentNo, stageLabel, stageTone, titleCase } from '../homeModel'
import { countryOf, isLate, partyOf, type ListShipment } from './shipmentList'

function Place({ code, ports }: { code: string | null; ports: PortMap }) {
  const cc = countryOf(code, ports)
  return (
    <span className="pv3-sl__place">
      {cc ? <span className={`fi fi-${cc} pv3-sl__flag`} aria-hidden /> : <span className="pv3-sl__flag pv3-sl__flag--none" aria-hidden />}
      <span>{placeName(code, ports)}</span>
    </span>
  )
}

const num = (n: number | null | undefined, unit: string, dp = 0) =>
  n == null || Number(n) === 0 ? null : `${Number(n).toLocaleString('en-NZ', { maximumFractionDigits: dp })} ${unit}`

type Props = { s: ListShipment; ports: PortMap; onOpen: (s: ListShipment) => void; delay: number }

export default function ShipmentRow({ s, ports, onOpen, delay }: Props) {
  const sea = isSea(s)
  const late = isLate(s)
  const cargo = [num(s.pack_qty, titleCase(s.pack_type) || 'pcs'), num(s.weight_kg, 'kg'), num(s.volume_m3, 'm³', 2)].filter(Boolean)
  const box = s.containers[0]
  return (
    <tr tabIndex={0} onClick={() => onOpen(s)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(s) }}
      className="pv3-sl__row" style={{ animationDelay: `${delay}s` }}>
      <td>
        <div className="pv3-sl__id">
          <span className={`pv3-sl__mode pv3-sl__mode--${sea ? 'sea' : 'air'}`}>{sea ? <Ship size={14} /> : <Plane size={14} />}</span>
          <div>
            <span className="pv3-sl__no">{shipmentNo(s)}</span>
            <span className="pv3-cell-sub pv3-ellipsis" title={s.goods_desc ?? ''}>{titleCase(s.goods_desc).slice(0, 38) || `${sea ? s.load_type ?? 'Sea' : 'Air'} ${s.direction ?? ''}`}</span>
          </div>
        </div>
      </td>
      <td>
        <span className="pv3-sl__party pv3-ellipsis" title={partyOf(s)}>{partyOf(s) || '—'}</span>
        {s.customer_ref ? <span className="pv3-sl__po">PO {s.customer_ref}</span> : <span className="pv3-cell-sub">No PO</span>}
      </td>
      <td>
        <div className="pv3-sl__route">
          <div><Place code={s.origin} ports={ports} /><span className="pv3-sl__date">{fmtDay(s.departed ?? s.etd)}{!s.departed && s.etd ? ' est.' : ''}</span></div>
          <div className="pv3-sl__track"><span style={{ width: `${progressPct(s)}%` }} /></div>
          <div><Place code={s.destination} ports={ports} /><span className={`pv3-sl__date${late ? ' pv3-sl__date--late' : ''}`}>{fmtDay(s.arrived ?? s.eta)}{!s.arrived && s.eta ? ' est.' : ''}</span></div>
        </div>
      </td>
      <td>
        <span className="pv3-ellipsis pv3-sl__vessel" title={s.vessel_flight ?? ''}>{s.vessel_flight || '—'}</span>
        {box && <span className="pv3-cell-sub pv3-mono">{box}{s.containers.length > 1 ? ` +${s.containers.length - 1}` : ''}</span>}
      </td>
      <td className="pv3-sl__cargo">
        {cargo.length ? cargo.map((c) => <span key={c as string}>{c}</span>) : <span className="pv3-cell-sub">—</span>}
      </td>
      <td>
        <span className={`pv3-pill pv3-pill--${stageTone(s)}`}>{stageLabel(s)}</span>
        {late && <span className="pv3-sl__late"><AlertTriangle size={12} /> Past ETA</span>}
      </td>
      <td className="pv3-sl__go"><ChevronRight size={16} /></td>
    </tr>
  )
}

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { money } from '@/features/quoteBooking/quoteBookingApi'
import type { BookingCost } from './bookingCostsApi'
import { COST_TYPES, GROUP_LABEL, type CostType } from './costTypes'

type Props = {
  cost: BookingCost
  onSave: (patch: Partial<BookingCost>) => void
  onDelete: () => void
}

const SOURCE_LABEL: Record<string, string> = { quote: 'Quote', rate_card: 'Rate card', manual: 'Manual' }

export default function CostRow({ cost, onSave, onDelete }: Props) {
  const [vendor, setVendor] = useState(cost.vendor_name ?? '')
  const [desc, setDesc] = useState(cost.description)
  const [ccy, setCcy] = useState(cost.currency)
  const [amt, setAmt] = useState(String(cost.amount))

  const commit = (patch: Partial<BookingCost>) => onSave(patch)
  const noFx = cost.currency !== 'NZD' && Number(cost.fx_rate) === 1

  return (
    <tr>
      <td>
        <select className="input input--sm" style={{ width: 120 }} value={cost.cost_type}
          onChange={(e) => commit({ cost_type: e.target.value as CostType })}>
          {COST_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </td>
      <td><input className="input input--sm" style={{ width: 150 }} value={vendor} placeholder="Vendor"
        onChange={(e) => setVendor(e.target.value)}
        onBlur={() => { if (vendor !== (cost.vendor_name ?? '')) commit({ vendor_name: vendor || null }) }} /></td>
      <td><input className="input input--sm" style={{ width: 200 }} value={desc}
        onChange={(e) => setDesc(e.target.value)}
        onBlur={() => { if (desc.trim() && desc !== cost.description) commit({ description: desc.trim() }) }} /></td>
      <td>
        <select className="input input--sm" style={{ width: 110 }} value={cost.charge_group ?? ''}
          onChange={(e) => commit({ charge_group: (e.target.value || null) as BookingCost['charge_group'] })}>
          <option value="">-</option>
          {Object.entries(GROUP_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </td>
      <td><input className="input input--sm" style={{ width: 60 }} value={ccy} maxLength={3}
        onChange={(e) => setCcy(e.target.value.toUpperCase())}
        onBlur={() => { if (ccy.length === 3 && ccy !== cost.currency) commit({ currency: ccy }) }} /></td>
      <td><input className="input input--sm" style={{ width: 100, textAlign: 'right' }} value={amt} inputMode="decimal"
        onChange={(e) => setAmt(e.target.value)}
        onBlur={() => { const n = Number(amt); if (!Number.isNaN(n) && n !== Number(cost.amount)) commit({ amount: n }) }} /></td>
      <td style={{ textAlign: 'right' }}>{noFx ? <span className="bk-pill bk-pill--amber" title="No FX rate for this currency">no FX</span> : money(cost.amount_nzd)}</td>
      <td><span className="bk-pill">{SOURCE_LABEL[cost.source] ?? cost.source}</span></td>
      <td><button className="icon-btn" title="Remove cost" aria-label="Remove cost" onClick={onDelete}><Trash2 size={14} /></button></td>
    </tr>
  )
}

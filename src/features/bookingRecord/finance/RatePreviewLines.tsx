import { Plus } from 'lucide-react'
import { toNzd, type FxRates } from '@/pages/rates/fx'
import { money } from '@/features/quoteBooking/quoteBookingApi'
import { COST_TYPE_LABEL, GROUP_LABEL } from './costTypes'
import type { PreviewLine } from './costMapping'

type Props = {
  lines: PreviewLine[]
  rates: FxRates
  busy: boolean
  onToggle: (key: string) => void
  onAdd: () => void
}

export default function RatePreviewLines({ lines, rates, busy, onToggle, onAdd }: Props) {
  const picked = lines.filter((l) => l.include)
  const nzd = picked.reduce((s, l) => s + (toNzd(l.amount, l.currency, rates, 'buy') ?? 0), 0)
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div className="table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr><th /><th>Charge</th><th>Group</th><th>Type</th><th>Vendor</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>NZD</th></tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const n = toNzd(l.amount, l.currency, rates, 'buy')
              return (
                <tr key={l.key} style={{ opacity: l.include ? 1 : 0.5 }}>
                  <td><input type="checkbox" checked={l.include} onChange={() => onToggle(l.key)} /></td>
                  <td>{l.description}</td>
                  <td>{GROUP_LABEL[l.charge_group ?? ''] ?? '-'}</td>
                  <td>{COST_TYPE_LABEL[l.cost_type]}</td>
                  <td>{l.vendor_name ?? '-'}</td>
                  <td style={{ textAlign: 'right' }}>{money(l.amount, l.currency)}</td>
                  <td style={{ textAlign: 'right' }}>{n == null ? <span className="text-muted-foreground">no FX</span> : money(n)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="text-sm text-muted-foreground">{picked.length} selected · ≈ NZD {money(nzd)}. Origin/freight/dest ticks follow incoterm.</span>
        <button className="btn btn--inline" title="Add selected to expected costs" aria-label="Add selected to expected costs"
          disabled={busy || picked.length === 0} onClick={onAdd}
          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 'auto', height: 32, padding: '0 12px' }}>
          <Plus size={16} />
        </button>
      </div>
    </div>
  )
}

import { Ship, Clock, ArrowRight } from 'lucide-react'
import type { RateOption } from './rateSearchApi'

const money = (n: number, cur: string) => `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

type Props = { option: RateOption; fromCode: string; toCode: string; onUse?: () => void; busy?: boolean }

export default function RateOptionCard({ option: o, fromCode, toCode, onUse, busy }: Props) {
  return (
    <div style={{ border: '1px solid var(--color-line)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, background: '#fff' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{o.carrierName}</span>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, padding: '2px 8px', borderRadius: 999, background: 'rgba(10,36,114,0.08)', color: '#0A2472' }}>{o.status}</span>
          {o.chips.map((c) => (
            <span key={c.container_type} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)' }}>
              <Ship size={13} /> {c.container_type} {money(c.base_rate, o.currency)}
            </span>
          ))}
          {o.transitDays != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)' }}>
              <Clock size={13} /> {o.transitDays} days
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13 }}>
          <span>{o.via ? `${fromCode} → ${o.via}` : fromCode}</span>
          <ArrowRight size={14} color="var(--muted-foreground)" />
          <span>{toCode}</span>
        </div>
        <div className="text-muted-foreground" style={{ fontSize: 11, marginTop: 6 }}>
          freight {money(o.freightTotal, o.currency)}{o.surchargeTotal > 0 ? ` + surcharges ${money(o.surchargeTotal, o.currency)}` : ''}
          {o.surcharges.length > 0 ? ` (${o.surcharges.length} surcharge${o.surcharges.length === 1 ? '' : 's'})` : ''}
          {o.missingCodes.length > 0 ? ` · no rate for ${o.missingCodes.join(', ')}` : ''}
          {o.validTo ? ` · valid to ${o.validTo}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }}>{money(o.total, o.currency)}</div>
          <div className="text-muted-foreground" style={{ fontSize: 11 }}>est. buy</div>
        </div>
        {onUse && (
          <button type="button" className="btn btn--inline" style={{ marginTop: 0 }} onClick={onUse} disabled={busy}>
            {busy ? 'Using…' : 'Use rate'}
          </button>
        )}
      </div>
    </div>
  )
}

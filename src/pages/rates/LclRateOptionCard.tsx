import { Package, Clock, ArrowRight, CalendarClock } from 'lucide-react'
import type { LclRateOption } from './lclRateSearchApi'

const money = (n: number, cur: string) => `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
const wmRate = (n: number, cur: string) => `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/wm`

function marginColor(m: number | null): string {
  if (m == null) return 'var(--muted-foreground)'
  if (m <= 0) return '#B23B3B'
  if (m < 15) return '#B4791F'
  return '#1F8A4C'
}

type Props = { option: LclRateOption; fromCode: string; toCode: string; onUse?: () => void; busy?: boolean }

export default function LclRateOptionCard({ option: o, fromCode, toCode, onUse, busy }: Props) {
  const hasSell = o.sellTotal > 0 && o.sellTotal !== o.total
  const margin = o.sellTotal > 0 ? Math.round(((o.sellTotal - o.total) / o.sellTotal) * 1000) / 10 : null
  const sellPerWm = o.sellPerWm > 0 ? o.sellPerWm : o.ratePerWm
  const surchargeCount = o.laneCharges.length + o.surcharges.length

  return (
    <div style={{ border: '1px solid var(--color-line)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, background: '#fff' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>{o.coLoaderName}</span>
          <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, padding: '2px 8px', borderRadius: 999, background: 'rgba(10,36,114,0.08)', color: '#0A2472' }}>{o.status}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)' }}>
            <Package size={13} /> {o.wm.toLocaleString()} w/m @ {wmRate(o.ratePerWm, o.currency)}
            {sellPerWm !== o.ratePerWm && <span style={{ color: '#1F8A4C' }}>→ {wmRate(sellPerWm, o.currency)}</span>}
          </span>
          {o.minCharge > 0 && (
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>min {money(o.minCharge, o.currency)}</span>
          )}
          {o.transitDays != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)' }}>
              <Clock size={13} /> {o.transitDays} days
            </span>
          )}
          {o.frequency && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)' }}>
              <CalendarClock size={13} /> {o.frequency}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13 }}>
          <span>{o.via ? `${fromCode} → ${o.via}` : fromCode}</span>
          <ArrowRight size={14} color="var(--muted-foreground)" />
          <span>{toCode}</span>
        </div>
        <div className="text-muted-foreground" style={{ fontSize: 11, marginTop: 6 }}>
          freight {money(o.freightTotal, o.currency)}{hasSell ? ` / sell ${money(o.freightSellTotal, o.currency)}` : ''}
          {o.freightTotal >= o.minCharge && o.ratePerWm * o.wm < o.minCharge ? ' (min applied)' : ''}
          {o.surchargeTotal > 0 ? ` · surcharges ${money(o.surchargeTotal, o.currency)}${hasSell ? ` / sell ${money(o.surchargeSellTotal, o.currency)}` : ''}` : ''}
          {surchargeCount > 0 ? ` (${surchargeCount} line${surchargeCount === 1 ? '' : 's'})` : ''}
          {o.validTo ? ` · valid to ${o.validTo}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {hasSell ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--muted-foreground)' }}>{money(o.total, o.currency)}</div>
                <div className="text-muted-foreground" style={{ fontSize: 11 }}>est. buy</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }}>{money(o.sellTotal, o.currency)}</div>
                <div className="text-muted-foreground" style={{ fontSize: 11 }}>est. sell</div>
              </div>
            </div>
            {margin != null && (
              <span style={{ fontSize: 11, fontWeight: 600, color: marginColor(margin), whiteSpace: 'nowrap' }}>
                {margin.toFixed(1)}% margin
              </span>
            )}
          </>
        ) : (
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }}>{money(o.total, o.currency)}</div>
            <div className="text-muted-foreground" style={{ fontSize: 11 }}>est. buy</div>
          </div>
        )}
        {onUse && (
          <button type="button" className="btn btn--inline" style={{ marginTop: 0 }} onClick={onUse} disabled={busy}>
            {busy ? 'Using…' : 'Use rate'}
          </button>
        )}
      </div>
    </div>
  )
}

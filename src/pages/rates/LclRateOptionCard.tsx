import { useState } from 'react'
import { Package, Clock, ArrowRight, CalendarClock, ChevronDown, Info } from 'lucide-react'
import { lclSurchargeAmounts, type LclRateOption } from './lclRateSearchApi'
import type { RateOptionCartage } from '../quotes/rateOptionCartage'
import { toNzd, fmtMoney, fmtNzd, type FxRates } from './fx'

const wmRate = (n: number, cur: string) => `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/wm`

function marginColor(m: number | null): string {
  if (m == null) return 'var(--muted-foreground)'
  if (m <= 0) return '#B23B3B'
  if (m < 15) return '#B4791F'
  return '#1F8A4C'
}

type Item = { label: string; meta: string; buy: number; sell: number; currency: string }
type Leg = { key: string; title: string; items: Item[] }

type Props = { option: LclRateOption; fromCode: string; toCode: string; onUse?: () => void; busy?: boolean; cartage?: RateOptionCartage; fxRates?: FxRates }

// Freight, origin, destination: every line in its own currency; totals in NZD when FX allows.
function buildLegs(o: LclRateOption): Leg[] {
  const cur = o.currency
  const wm = o.wm
  const freight: Item[] = [{ label: 'Ocean freight LCL', meta: `${wm} w/m @ ${wmRate(o.ratePerWm, cur)}${o.ratePerWm * wm < o.minCharge ? ` · min ${fmtMoney(o.minCharge, cur)}` : ''}`, buy: o.freightTotal, sell: o.freightSellTotal, currency: cur }]
  for (const c of o.laneCharges) {
    freight.push({ label: c.label || c.code, meta: `${wmRate(c.perWm, cur)} × ${wm}${c.min != null && c.perWm * wm < c.min ? ` · min ${fmtMoney(c.min, cur)}` : ''}`,
      buy: Math.max(c.perWm * wm, c.min ?? 0), sell: Math.max(c.sellPerWm * wm, c.min ?? 0), currency: cur })
  }
  const origin: Item[] = []
  const dest: Item[] = []
  for (const s of o.surcharges) {
    const a = lclSurchargeAmounts(s, wm, o.cbm > 0 ? o.cbm : wm, o.freightTotal, o.freightSellTotal)
    if (!a) continue
    const meta = `${a.unit}${a.qty !== 1 ? ` × ${a.qty}` : ''}${s.minAmount != null ? ` · min ${fmtMoney(s.minAmount, s.currency)}` : ''}`
    const it: Item = { label: s.label, meta, buy: a.buy, sell: a.sell, currency: s.currency }
    if (s.scope === 'origin') origin.push(it); else if (s.scope === 'dest') dest.push(it); else freight.push(it)
  }
  return [
    { key: 'freight', title: 'Freight & surcharges', items: freight },
    { key: 'origin', title: 'Origin charges', items: origin },
    { key: 'dest', title: 'Destination charges', items: dest },
  ]
}

export default function LclRateOptionCard({ option: o, fromCode, toCode, onUse, busy, cartage, fxRates }: Props) {
  const [open, setOpen] = useState(false)
  const rates: FxRates = fxRates ?? new Map()
  const legs = buildLegs(o)
  const all = legs.flatMap((l) => l.items)

  let buyNzd = 0, sellNzd = 0, convertible = true
  for (const it of all) {
    const b = toNzd(it.buy, it.currency, rates, 'buy'); const s = toNzd(it.sell, it.currency, rates, 'sell')
    if (b == null || s == null) { convertible = false; break }
    buyNzd += b; sellNzd += s
  }
  const singleCur = all.every((it) => it.currency === o.currency)
  const buyShown = convertible ? fmtNzd(Math.round(buyNzd * 100) / 100) : fmtMoney(o.total, o.currency)
  const sellShown = convertible ? fmtNzd(Math.round(sellNzd * 100) / 100) : fmtMoney(o.sellTotal, o.currency)
  const margin = convertible && sellNzd > 0 ? Math.round(((sellNzd - buyNzd) / sellNzd) * 1000) / 10
    : o.sellTotal > 0 ? Math.round(((o.sellTotal - o.total) / o.sellTotal) * 1000) / 10 : null
  const hasSell = convertible ? Math.abs(sellNzd - buyNzd) > 0.005 : o.sellTotal > 0 && o.sellTotal !== o.total
  const sellPerWm = o.sellPerWm > 0 ? o.sellPerWm : o.ratePerWm

  return (
    <div style={{ border: '1px solid var(--color-line)', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {o.coLoaderLogo && <img src={o.coLoaderLogo} alt={o.coLoaderName} title={o.coLoaderName} style={{ height: 22, maxWidth: 140, objectFit: 'contain' }} />}
            <span style={{ fontWeight: 600, fontSize: 15 }}>{o.coLoaderName}</span>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, padding: '2px 8px', borderRadius: 999, background: 'rgba(10,36,114,0.08)', color: '#0A2472' }}>{o.status}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)' }}>
              <Package size={13} /> {o.wm.toLocaleString()} w/m @ {wmRate(o.ratePerWm, o.currency)}
              {sellPerWm !== o.ratePerWm && <span style={{ color: '#1F8A4C' }}>→ {wmRate(sellPerWm, o.currency)}</span>}
            </span>
            {o.transitDays != null && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)' }}><Clock size={13} /> {o.transitDays} days</span>}
            {o.frequency && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)' }}><CalendarClock size={13} /> {o.frequency}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13 }}>
            <span>{o.via ? `${fromCode} → ${o.via}` : fromCode}</span>
            <ArrowRight size={14} color="var(--muted-foreground)" />
            <span>{toCode}</span>
            {o.originAgent && <span className="text-muted-foreground" style={{ fontSize: 12 }}>· origin agent {o.originAgent}</span>}
          </div>
          <div className="text-muted-foreground" style={{ fontSize: 11, marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            {open ? 'Hide breakdown' : 'View charges'}{o.validTo ? ` · valid to ${o.validTo}` : ''}
          </div>
          {cartage && cartage.status === 'ok' && cartage.amount > 0 && (
            <div style={{ fontSize: 12, marginTop: 4, color: '#0A2472', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {cartage.carrierLogo
                ? <img src={cartage.carrierLogo} alt={cartage.carrierShort} title={cartage.carrierShort} style={{ height: 18, width: 56, objectFit: 'contain' }} />
                : cartage.carrierShort ? <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#0A2472', color: '#fff' }}>{cartage.carrierShort}</span> : null}
              <span>{cartage.leg === 'dest' ? 'Destination' : 'Origin'} cartage: NZD {cartage.amount.toLocaleString()}</span>
              {cartage.canChange ? <span role="button" onClick={(e) => { e.stopPropagation(); cartage.onChange?.() }} style={{ fontSize: 12, color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}>Change</span> : null}
              {cartage.confidence && cartage.confidence !== 'green' ? <span style={{ color: '#B4791F' }}>· zone {cartage.confidence}</span> : null}
            </div>
          )}
        </button>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
            <div>
              <div style={{ fontSize: hasSell ? 15 : 18, fontWeight: hasSell ? 600 : 700, whiteSpace: 'nowrap', color: hasSell ? 'var(--muted-foreground)' : undefined }}>{buyShown}</div>
              <div className="text-muted-foreground" style={{ fontSize: 11 }}>est. buy</div>
            </div>
            {hasSell && (
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }}>{sellShown}</div>
                <div className="text-muted-foreground" style={{ fontSize: 11 }}>est. sell</div>
              </div>
            )}
          </div>
          {hasSell && margin != null && <span style={{ fontSize: 11, fontWeight: 600, color: marginColor(margin), whiteSpace: 'nowrap' }}>{margin.toFixed(1)}% margin</span>}
          {!convertible && !singleCur && <span className="text-muted-foreground" style={{ fontSize: 10 }}>{o.currency} lines only · add FX rates</span>}
          {onUse && (
            <button type="button" className="btn btn--inline" style={{ marginTop: 0 }} onClick={onUse} disabled={busy}>
              {busy ? 'Using…' : 'Use rate'}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--color-line)', background: '#f8fafc', padding: '12px 18px 16px' }}>
          {legs.map((leg) => (
            <div key={leg.key} style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0A2472', marginBottom: 6 }}>{leg.title}</div>
              {leg.items.length === 0
                ? <div className="text-muted-foreground" style={{ fontSize: 12, padding: '4px 0' }}>None on this card.</div>
                : leg.items.map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid #eef2f6' }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ fontSize: 13, display: 'block' }}>{it.label}</span>
                      <span className="text-muted-foreground" style={{ fontSize: 11 }}>{it.meta}</span>
                    </span>
                    <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 13, display: 'block' }}>{fmtMoney(it.sell, it.currency)}</span>
                      {it.currency !== 'NZD' && <span className="text-muted-foreground" style={{ fontSize: 11 }}>{(() => { const n = toNzd(it.sell, it.currency, rates, 'sell'); return n != null ? `≈ ${fmtNzd(Math.round(n * 100) / 100)}` : 'no FX rate' })()}</span>}
                    </span>
                  </div>
                ))}
            </div>
          ))}
          {o.possibleCharges.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0A2472', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Info size={13} /> Possible extras <span className="text-muted-foreground" style={{ fontSize: 11, fontWeight: 400 }}>only if they apply · not in total</span>
              </div>
              {o.possibleCharges.map((c, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', borderBottom: '1px solid #eef2f6', fontSize: 12 }}>
                  <span>{c.label}{c.condition ? <span className="text-muted-foreground" style={{ fontSize: 11 }}> · {c.condition}</span> : null}</span>
                  <span className="text-muted-foreground" style={{ whiteSpace: 'nowrap' }}>{fmtMoney(c.amount, c.currency)}</span>
                </div>
              ))}
            </div>
          )}
          {o.terms && <div className="text-muted-foreground" style={{ fontSize: 11, marginTop: 12, lineHeight: 1.5 }}>{o.terms}</div>}
        </div>
      )}
    </div>
  )
}

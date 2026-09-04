import { useState } from 'react'
import { Plane, Clock, ArrowRight, ChevronDown, CalendarClock, AlertTriangle } from 'lucide-react'
import type { AirRateOption, AirRateSurcharge } from './airRateSearchApi'
import { resolveLegs, completenessFor, serviceTypeForIncoterm, type FoundSources } from './incotermLegs'
import { toNzd, fmtMoney, fmtNzd, type FxRates } from './fx'
import AirlineLogo from './AirlineLogo.tsx'

function marginColor(m: number | null): string {
  if (m == null) return 'var(--muted-foreground)'
  if (m <= 0) return '#B23B3B'
  if (m < 15) return '#B4791F'
  return '#1F8A4C'
}

type LegKey = 'origin' | 'freight' | 'dest'
type Item = { key: string; label: string; meta: string; buy: number; sell: number; currency: string; sellNzd: number | null; buyNzd: number | null }

type Props = {
  option: AirRateOption
  fromCode: string
  toCode: string
  onUse?: (selectedKeys: string[]) => void
  busy?: boolean
  fxRates?: FxRates
  incoterm?: string
  movement?: string
  isAgent?: boolean
  freightTerms?: string
}

export default function AirRateOptionCard({ option: o, fromCode, toCode, onUse, busy, fxRates, incoterm, movement, isAgent, freightTerms }: Props) {
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<Record<string, boolean>>({})
  const rates: FxRates = fxRates ?? new Map()
  const cur = o.currency || 'NZD'

  // Which legs the customer pays under this incoterm+direction (null = unknown → all on).
  const scope = resolveLegs({ isAgent, incoterm, movement, freightTerms })
  const scopeLabel = isAgent ? 'agent' : (incoterm || 'terms')
  const legDefault = (leg: LegKey) => (scope ? scope[leg] : true)

  const isOn = (key: string, def: boolean) => (key in sel ? sel[key] : def)
  const toggle = (key: string, def: boolean) => setSel((s) => ({ ...s, [key]: !(key in s ? s[key] : def) }))

  function mk(key: string, label: string, meta: string, buy: number, sell: number, currency: string = cur): Item {
    return { key, label, meta, buy, sell, currency, sellNzd: toNzd(sell, currency, rates, 'sell'), buyNzd: toNzd(buy, currency, rates, 'buy') }
  }

  // Per-line surcharge amounts, computed exactly as the search engine totals them.
  function surAmounts(s: AirRateSurcharge): { buy: number; sell: number; meta: string } {
    if (s.basis === 'per_kg') return { buy: s.amount * o.chargeableKg, sell: s.sellAmount * o.chargeableKg, meta: `${fmtMoney(s.amount, cur)}/kg × ${o.chargeableKg} kg` }
    if (s.basis === 'per_cbm') { const cbm = o.cbm > 0 ? o.cbm : 1; return { buy: s.amount * cbm, sell: s.sellAmount * cbm, meta: `${fmtMoney(s.amount, cur)}/CBM × ${cbm}` } }
    if (s.basis === 'percent') return { buy: (s.amount / 100) * o.freightTotal, sell: (s.sellAmount / 100) * o.freightSellTotal, meta: `${s.amount}% of freight` }
    return { buy: s.amount, sell: s.sellAmount, meta: s.basis === 'per_awb' ? 'per AWB' : s.basis === 'per_bl' ? 'per B/L' : 'flat' }
  }

  const freightMeta = `${o.billedKg.toLocaleString()} kg @ ${fmtMoney(o.appliedRatePerKg, cur)}/kg`
    + (o.billedKg > o.chargeableKg ? ` · break-pivot from ${o.chargeableKg} kg` : '')
    + (o.minApplied ? ` · min ${fmtMoney(o.minCharge, cur)}` : '')
  const freightItem = o.freightless ? null : mk('f:air', 'Air freight', freightMeta, o.freightTotal, o.freightSellTotal)

  const surItems = o.surcharges.map((s, i) => {
    const a = surAmounts(s)
    return { it: mk(`s:${i}`, s.label, a.meta, a.buy, a.sell), scope: s.scope }
  })

  // Local charges (origin/dest sheets), each in its own currency; cartage tagged.
  const localMeta = (basis: string, cartage: string | null) => (cartage ? `${basis} · cartage (${cartage})` : basis)
  const localOrigin = o.localCharges.map((c, i) => ({ c, i })).filter((x) => x.c.group === 'origin')
    .map(({ c, i }) => mk(`l:${i}`, c.label, localMeta(c.basis, c.cartageType), c.buyAmount, c.sellAmount, c.sellCurrency || c.buyCurrency || cur))
  const localDest = o.localCharges.map((c, i) => ({ c, i })).filter((x) => x.c.group === 'dest')
    .map(({ c, i }) => mk(`l:${i}`, c.label, localMeta(c.basis, c.cartageType), c.buyAmount, c.sellAmount, c.sellCurrency || c.buyCurrency || cur))

  const originItems = [...localOrigin, ...surItems.filter((x) => x.scope === 'origin').map((x) => x.it)]
  const destItems = [...localDest, ...surItems.filter((x) => x.scope === 'dest').map((x) => x.it)]
  const freightItems = [...(freightItem ? [freightItem] : []), ...surItems.filter((x) => x.scope !== 'origin' && x.scope !== 'dest').map((x) => x.it)]

  const legs: { key: LegKey; title: string; word: string; port: string; items: Item[] }[] = [
    { key: 'origin', title: 'Origin charges', word: 'origin', port: fromCode, items: originItems },
    { key: 'freight', title: 'Freight & surcharges', word: 'freight', port: `${fromCode} → ${toCode}`, items: freightItems },
    { key: 'dest', title: 'Destination charges', word: 'destination', port: toCode, items: destItems },
  ]

  const allKeys = legs.flatMap((l) => l.items.map((i) => i.key))
  const setAll = (v: boolean) => setSel(Object.fromEntries(allKeys.map((k) => [k, v])))

  // Completeness (advisory): what this incoterm/direction requires but we didn't find.
  const found: FoundSources = {
    freight: o.freightTotal > 0,
    originCharges: originItems.length > 0,
    destCharges: destItems.length > 0,
    originCartage: o.localCharges.some((c) => c.group === 'origin' && !!c.cartageType),
    destCartage: o.localCharges.some((c) => c.group === 'dest' && !!c.cartageType),
  }
  const svc = isAgent ? '' : (serviceTypeForIncoterm(incoterm) || '')
  const completeness = completenessFor(scope, found, { origin: /^Door/i.test(svc), dest: /Door$/i.test(svc) })

  let grandSell = 0, grandBuy = 0, convertible = true
  for (const leg of legs) for (const it of leg.items) {
    if (!isOn(it.key, legDefault(leg.key))) continue
    if (it.sellNzd == null || it.buyNzd == null) { convertible = false; continue }
    grandSell += it.sellNzd; grandBuy += it.buyNzd
  }
  grandSell = Math.round(grandSell * 100) / 100
  grandBuy = Math.round(grandBuy * 100) / 100
  const nzdMargin = convertible && grandSell > 0 ? Math.round(((grandSell - grandBuy) / grandSell) * 1000) / 10 : null
  const fallbackSell = o.sellTotal > 0 ? o.sellTotal : o.total

  function handleUse() {
    if (!onUse) return
    onUse(allKeys.filter((k, idx) => {
      const leg = legs.find((l) => l.items.some((it) => it.key === k))
      return isOn(k, leg ? legDefault(leg.key) : true)
    }))
  }

  return (
    <div style={{ border: '1px solid var(--color-line)', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 16, padding: '14px 18px' }}>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <AirlineLogo code={o.airlineCode} name={o.airlineName} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>{o.airlineName}</span>
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, padding: '2px 8px', borderRadius: 999, background: 'rgba(10,36,114,0.08)', color: '#0A2472' }}>{o.status}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)' }}><Plane size={13} /> Air · {o.chargeableKg.toLocaleString()} kg</span>
            {o.transitDays != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)' }}><Clock size={13} /> {o.transitDays} days</span>
            )}
            {o.frequency && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)' }}><CalendarClock size={13} /> {o.frequency}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13 }}>
            <span>{o.via ? `${fromCode} → ${o.via}` : fromCode}</span>
            <ArrowRight size={14} color="var(--muted-foreground)" />
            <span>{toCode}</span>
          </div>
          <div className="text-muted-foreground" style={{ fontSize: 11, marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ChevronDown size={13} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            {open ? 'Hide breakdown' : 'View & choose charges'}
            {o.validTo ? ` · valid to ${o.validTo}` : ''}
          </div>
        </button>

        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {convertible ? (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', color: 'var(--muted-foreground)' }}>{fmtNzd(grandBuy)}</div>
                  <div className="text-muted-foreground" style={{ fontSize: 11 }}>est. buy</div>
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtNzd(grandSell)}</div>
                  <div className="text-muted-foreground" style={{ fontSize: 11 }}>est. sell · selected</div>
                </div>
              </div>
              {nzdMargin != null && (
                <span style={{ fontSize: 11, fontWeight: 600, color: marginColor(nzdMargin), whiteSpace: 'nowrap' }}>{nzdMargin.toFixed(1)}% margin</span>
              )}
            </>
          ) : (
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtMoney(fallbackSell, cur)}</div>
              <div className="text-muted-foreground" style={{ fontSize: 11 }}>est. sell</div>
              <div className="text-muted-foreground" style={{ fontSize: 10, whiteSpace: 'nowrap', marginTop: 2 }}>add FX rates to total in NZD</div>
            </div>
          )}
          {onUse && (
            <button type="button" className="btn btn--inline" style={{ marginTop: 0 }} onClick={handleUse} disabled={busy}>
              {busy ? 'Using…' : 'Use rate'}
            </button>
          )}
        </div>
      </div>

      {!completeness.complete && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: '#FFF7E6', borderTop: '1px solid #FCE2B0', color: '#8A5A00', fontSize: 12 }}>
          <AlertTriangle size={14} />
          <span>Incomplete for {scopeLabel} {movement} — usually needs: {completeness.missing.join(', ')}. Add in Rates or price manually; you can still use it.</span>
        </div>
      )}

      {open && (
        <div style={{ borderTop: '1px solid var(--color-line)', background: '#f8fafc', padding: '12px 18px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, marginBottom: 2 }}>
            <button type="button" onClick={() => setAll(true)} style={{ fontSize: 11, fontWeight: 600, color: '#3B5BFE', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Select all</button>
            <button type="button" onClick={() => setAll(false)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear</button>
          </div>
          {legs.map((leg) => {
            const inScope = scope ? scope[leg.key] : true
            return (
            <div key={leg.key} style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0A2472', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                {leg.title}
                {!inScope && <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--muted-foreground)', background: '#eef2f6', borderRadius: 999, padding: '1px 7px' }}>not billed ({scopeLabel})</span>}
              </div>
              {leg.items.length === 0 ? (
                <div style={{ fontSize: 12, color: inScope ? '#B4791F' : 'var(--muted-foreground)', padding: '4px 0' }}>No {leg.word} charges for {leg.port} on this lane.</div>
              ) : (
                leg.items.map((it) => {
                  const on = isOn(it.key, legDefault(leg.key))
                  return (
                    <div key={it.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid #eef2f6', opacity: on ? 1 : 0.55 }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, cursor: 'pointer' }}>
                        <input type="checkbox" checked={on} onChange={() => toggle(it.key, legDefault(leg.key))} style={{ marginTop: 3 }} />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 13, display: 'block' }}>{it.label}</span>
                          <span className="text-muted-foreground" style={{ fontSize: 11 }}>{it.meta}</span>
                        </span>
                      </label>
                      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 13 }}>{fmtMoney(it.sell, it.currency)}</div>
                        <div className="text-muted-foreground" style={{ fontSize: 11 }}>{it.sellNzd != null ? `≈ ${fmtNzd(it.sellNzd)}` : 'no FX rate'}</div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            )
          })}
          {convertible && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12, fontSize: 14 }}>
              <span className="text-muted-foreground">Selected total (sell)</span>
              <span style={{ fontWeight: 700 }}>{fmtNzd(grandSell)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

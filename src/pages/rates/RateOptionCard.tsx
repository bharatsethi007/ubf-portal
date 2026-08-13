import { useState } from 'react'
import { Ship, Clock, ArrowRight, ChevronDown } from 'lucide-react'
import type { RateOption } from './rateSearchApi'
import { toNzd, fmtMoney, fmtNzd, type FxRates } from './fx'
import { chargeLegsFor, legPayersFor, type LegPayer } from './incotermLegs'

const SIZE_TO_CANONICAL: Record<string, string> = {
  '20': '20GP', '40': '40GP', '20HC': '20HC', '40HC': '40HQ', '40HQ': '40HQ', '20GP': '20GP', '40GP': '40GP',
}
const norm = (s: string) => SIZE_TO_CANONICAL[s] ?? s

function marginColor(m: number | null): string {
  if (m == null) return 'var(--muted-foreground)'
  if (m <= 0) return '#B23B3B'
  if (m < 15) return '#B4791F'
  return '#1F8A4C'
}

type LegKey = 'origin' | 'freight' | 'dest'

type Item = {
  key: string
  label: string
  meta: string
  sell: number
  currency: string
  sellNzd: number | null
  buyNzd: number | null
  unpriced?: boolean
}

type Props = {
  option: RateOption
  fromCode: string
  toCode: string
  onUse?: (selected: RateOption) => void
  busy?: boolean
  fxRates?: FxRates
  containers?: { size: string; qty: number }[]
  incoterm?: string
  movement?: string
}

export default function RateOptionCard({ option: o, fromCode, toCode, onUse, busy, fxRates, containers, incoterm, movement }: Props) {
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<Record<string, boolean>>({})
  const rates: FxRates = fxRates ?? new Map()

  const scope = chargeLegsFor(incoterm, movement)          // which legs the customer pays (null = unknown)
  const payers = legPayersFor(incoterm)                    // absolute Buyer/Seller per leg (null = unknown)
  const ourRole: LegPayer | null = (movement || '').toLowerCase() === 'export' ? 'Seller' : (movement || '').toLowerCase() === 'import' ? 'Buyer' : null
  // Everything defaults to selected; the Buyer/Seller bubbles are advisory and the
  // quoter unticks whatever the counterparty covers.
  const legDefault = (_leg: LegKey) => true

  const qtyByCode = new Map<string, number>()
  if (containers) for (const c of containers) qtyByCode.set(norm(c.size), (qtyByCode.get(norm(c.size)) ?? 0) + c.qty)

  const isOn = (key: string, def: boolean) => (key in sel ? sel[key] : def)
  const toggle = (key: string, def: boolean) => setSel((s) => ({ ...s, [key]: !(key in s ? s[key] : def) }))

  function mk(key: string, label: string, meta: string, buy: number, sell: number, currency: string, unpriced?: boolean): Item {
    return { key, label, meta, sell, currency, sellNzd: unpriced ? 0 : toNzd(sell, currency, rates, 'sell'), buyNzd: unpriced ? 0 : toNzd(buy, currency, rates, 'buy'), unpriced }
  }

  // Build items per leg (origin → freight → dest). All shown; nothing hidden by incoterm.
  const originItems: Item[] = o.localCharges.map((c, i) => ({ c, i })).filter((x) => x.c.group === 'origin')
    .map(({ c, i }) => mk(`l:${i}`, c.label, c.basis, c.buyAmount, c.sellAmount, c.sellCurrency || c.buyCurrency))
  const destItems: Item[] = o.localCharges.map((c, i) => ({ c, i })).filter((x) => x.c.group === 'dest')
    .map(({ c, i }) => mk(`l:${i}`, c.label, c.basis, c.buyAmount, c.sellAmount, c.sellCurrency || c.buyCurrency))
  const freightItems: Item[] = [
    ...o.chips.map((c) => {
      const qty = qtyByCode.get(c.container_type) ?? null
      const sellUnit = c.sell_rate > 0 ? c.sell_rate : c.base_rate
      const mult = qty ?? 1
      return mk(`f:${c.container_type}`, `Ocean freight · ${c.container_type}`, qty != null ? `${fmtMoney(c.base_rate, o.currency)}/ctr · ×${qty}` : 'per container', c.base_rate * mult, sellUnit * mult, o.currency)
    }),
    ...o.missingCodes.map((code) => mk(`x:${code}`, `Ocean freight · ${code}`, 'no rate on this card', 0, 0, o.currency, true)),
    ...o.surcharges.map((s, i) => mk(`s:${i}`, s.label, s.basis, s.lineAmount, s.lineSell, o.currency)),
  ]

  const legs: { key: LegKey; title: string; word: string; port: string; items: Item[] }[] = [
    { key: 'origin', title: 'Origin charges', word: 'origin', port: fromCode, items: originItems },
    { key: 'freight', title: 'Freight & surcharges', word: 'freight', port: `${fromCode} → ${toCode}`, items: freightItems },
    { key: 'dest', title: 'Destination charges', word: 'destination', port: toCode, items: destItems },
  ]

  const allKeys = legs.flatMap((l) => l.items.filter((i) => !i.unpriced).map((i) => i.key))
  const setAll = (v: boolean) => setSel(Object.fromEntries(allKeys.map((k) => [k, v])))

  // Totals over CHECKED, priced items only.
  let grandSell = 0, grandBuy = 0, convertible = true
  for (const leg of legs) for (const it of leg.items) {
    if (it.unpriced || !isOn(it.key, legDefault(leg.key))) continue
    if (it.sellNzd == null || it.buyNzd == null) { convertible = false; continue }
    grandSell += it.sellNzd; grandBuy += it.buyNzd
  }
  const nzdMargin = convertible && grandSell > 0 ? Math.round(((grandSell - grandBuy) / grandSell) * 1000) / 10 : null
  const fallbackSell = o.sellTotal > 0 ? o.sellTotal : o.total

  // In-scope legs we couldn't rate at all → gentle warning.
  const missingLegs = scope ? legs.filter((l) => scope[l.key] && l.items.filter((x) => !x.unpriced).length === 0).map((l) => l.word) : []

  function handleUse() {
    if (!onUse) return
    const filtered: RateOption = {
      ...o,
      chips: o.chips.filter((c) => isOn(`f:${c.container_type}`, legDefault('freight'))),
      surcharges: o.surcharges.filter((_, i) => isOn(`s:${i}`, legDefault('freight'))),
      localCharges: o.localCharges.filter((c, i) => isOn(`l:${i}`, legDefault(c.group === 'dest' ? 'dest' : 'origin'))),
    }
    onUse(filtered)
  }

  function payerBubble(leg: LegKey) {
    if (!payers) return null
    const who = payers[leg]
    const ours = ourRole != null && who === ourRole
    return (
      <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999, whiteSpace: 'nowrap',
        color: ours ? '#3730a3' : '#64748b', background: ours ? '#eef2ff' : '#f1f5f9', border: `1px solid ${ours ? '#c7d2fe' : '#e2e8f0'}` }}>
        {who} pays{ours ? ' · you' : ''}
      </span>
    )
  }

  return (
    <div style={{ border: '1px solid var(--color-line)', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 16, padding: '14px 18px' }}>
        <button type="button" onClick={() => setOpen((v) => !v)} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{o.carrierName}</span>
            {o.carrierLineName && o.carrierLineName !== o.carrierName && (
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>· {o.carrierLineName}</span>
            )}
            <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, padding: '2px 8px', borderRadius: 999, background: 'rgba(10,36,114,0.08)', color: '#0A2472' }}>{o.status}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)' }}><Ship size={13} /> Sea FCL</span>
            {o.transitDays != null && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)' }}><Clock size={13} /> {o.transitDays} days</span>
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
          {missingLegs.length > 0 && (
            <div style={{ fontSize: 11, color: '#B4791F', marginTop: 6, fontWeight: 500 }}>
              ⚠ No {missingLegs.join(' or ')} rate found for this lane — add it in Rates or price it manually.
            </div>
          )}
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
              <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtMoney(fallbackSell, o.currency)}</div>
              <div className="text-muted-foreground" style={{ fontSize: 11 }}>est. sell · freight only</div>
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

      {open && (
        <div style={{ borderTop: '1px solid var(--color-line)', background: '#f8fafc', padding: '12px 18px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 14, marginBottom: 2 }}>
            <button type="button" onClick={() => setAll(true)} style={{ fontSize: 11, fontWeight: 600, color: '#3B5BFE', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Select all</button>
            <button type="button" onClick={() => setAll(false)} style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Clear</button>
          </div>
          {legs.map((leg) => (
            <div key={leg.key} style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#0A2472' }}>{leg.title}</span>
                {payerBubble(leg.key)}
              </div>
              {leg.items.length === 0 ? (
                <div style={{ fontSize: 12, color: scope && scope[leg.key] ? '#B4791F' : 'var(--muted-foreground)', padding: '4px 0' }}>
                  No {leg.word} charges found for {leg.port} on this lane.
                </div>
              ) : (
                leg.items.map((it) => {
                  const on = !it.unpriced && isOn(it.key, legDefault(leg.key))
                  return (
                    <div key={it.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '5px 0', borderBottom: '1px solid #eef2f6', opacity: it.unpriced ? 0.6 : on ? 1 : 0.55 }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, cursor: it.unpriced ? 'default' : 'pointer' }}>
                        <input type="checkbox" disabled={it.unpriced} checked={on} onChange={() => toggle(it.key, legDefault(leg.key))} style={{ marginTop: 3 }} />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ fontSize: 13, display: 'block' }}>{it.label}</span>
                          <span className="text-muted-foreground" style={{ fontSize: 11 }}>{it.meta}</span>
                        </span>
                      </label>
                      <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {it.unpriced ? (
                          <div style={{ fontSize: 12, color: '#B4791F', fontWeight: 600 }}>Not rated</div>
                        ) : (
                          <>
                            <div style={{ fontSize: 13 }}>{fmtMoney(it.sell, it.currency)}</div>
                            <div className="text-muted-foreground" style={{ fontSize: 11 }}>{it.sellNzd != null ? `≈ ${fmtNzd(it.sellNzd)}` : 'no FX rate'}</div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          ))}
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

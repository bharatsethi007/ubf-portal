import { useEffect, useState } from 'react'
import { Ship, Clock, ArrowRight } from 'lucide-react'
import { fetchQuoteLane, searchFclRates, type RateOption, type QuoteLane } from '../rates/rateSearchApi'

const money = (n: number, cur: string) => `${cur} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export default function QuoteVendorRates({ quoteId }: { quoteId: string }) {
  const [loading, setLoading] = useState(true)
  const [lane, setLane] = useState<QuoteLane | null>(null)
  const [options, setOptions] = useState<RateOption[]>([])
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr('')
    ;(async () => {
      try {
        const l = await fetchQuoteLane(quoteId)
        if (cancelled) return
        setLane(l)
        setOptions(await searchFclRates(l))
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Search failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [quoteId])

  if (loading) return <p className="qr-placeholder">Searching your rate cards…</p>
  if (err) return <p className="qr-placeholder" style={{ color: '#B23B3B' }}>{err}</p>
  if (!lane?.from_port_code || !lane?.to_port_code) return <p className="qr-placeholder">Set an origin and destination port on this quote to search rates.</p>
  if (options.length === 0) return <p className="qr-placeholder">No matching rates found for {lane.from_port_code} → {lane.to_port_code}. Check that a rate card for this lane is set to Validated or Active.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="text-muted-foreground" style={{ fontSize: 12, margin: 0 }}>
        {lane.from_port_code} → {lane.to_port_code} · {lane.containers.map((c) => `${c.qty}× ${c.size}`).join(', ')} · {options.length} option{options.length === 1 ? '' : 's'}
      </p>
      {options.map((o) => (
        <div key={o.cardId} style={{ border: '1px solid var(--color-line)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, background: '#fff' }}>
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
              <span>{o.via ? `${lane.from_port_code} → ${o.via} → ${lane.to_port_code}` : lane.from_port_code}</span>
              <ArrowRight size={14} color="var(--muted-foreground)" />
              <span>{lane.to_port_code}</span>
            </div>
            <div className="text-muted-foreground" style={{ fontSize: 11, marginTop: 6 }}>
              freight {money(o.freightTotal, o.currency)}{o.surchargeTotal > 0 ? ` + surcharges ${money(o.surchargeTotal, o.currency)}` : ''}
              {o.surcharges.length > 0 ? ` (${o.surcharges.length} surcharge${o.surcharges.length === 1 ? '' : 's'})` : ''}
              {o.missingCodes.length > 0 ? ` · no rate for ${o.missingCodes.join(', ')}` : ''}
              {o.validTo ? ` · valid to ${o.validTo}` : ''}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap' }}>{money(o.total, o.currency)}</div>
            <div className="text-muted-foreground" style={{ fontSize: 11 }}>est. buy</div>
          </div>
        </div>
      ))}
    </div>
  )
}

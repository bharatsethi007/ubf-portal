import { useEffect, useState } from 'react'
import { fetchQuoteLane, searchFclRates, type RateOption, type QuoteLane } from '../rates/rateSearchApi'
import RateOptionCard from '../rates/RateOptionCard'

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
        <RateOptionCard key={o.cardId} option={o} fromCode={lane.from_port_code!} toCode={lane.to_port_code!} />
      ))}
    </div>
  )
}

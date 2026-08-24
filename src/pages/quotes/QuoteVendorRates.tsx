import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { useEffectiveRates } from '../../hooks/useEffectiveRates'
import { fetchQuoteLane, searchFclRates, type RateOption, type QuoteLane } from '../rates/rateSearchApi'
import { fetchLclQuoteLane, searchLclRates, type LclRateOption, type LclQuoteLane } from '../rates/lclRateSearchApi'
import { fetchAirQuoteLane, searchAirRates, type AirRateOption, type AirQuoteLane } from '../rates/airRateSearchApi'
import RateOptionCard from '../rates/RateOptionCard'
import LclRateOptionCard from '../rates/LclRateOptionCard'
import AirRateOptionCard from '../rates/AirRateOptionCard'

type Kind = 'fcl' | 'lcl' | 'air'

export default function QuoteVendorRates({ quoteId }: { quoteId: string }) {
  const { rates: fxRates } = useEffectiveRates('NZD')
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<Kind>('fcl')
  const [fcl, setFcl] = useState<{ lane: QuoteLane; options: RateOption[] } | null>(null)
  const [lcl, setLcl] = useState<{ lane: LclQuoteLane; options: LclRateOption[] } | null>(null)
  const [air, setAir] = useState<{ lane: AirQuoteLane; options: AirRateOption[] } | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setErr(''); setFcl(null); setLcl(null); setAir(null)
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('quotes').select('shipment_mode, shipment_type').eq('id', quoteId).single()
        if (error) throw error
        const mode = String((data as Record<string, any>)?.shipment_mode ?? '')
        const type = String((data as Record<string, any>)?.shipment_type ?? '')
        const isAir = /air/i.test(mode) || type.toUpperCase() === 'AIR'
        const isLcl = !isAir && type.toUpperCase() === 'LCL'
        const k: Kind = isAir ? 'air' : isLcl ? 'lcl' : 'fcl'
        if (cancelled) return
        setKind(k)
        if (k === 'air') {
          const lane = await fetchAirQuoteLane(quoteId)
          const options = await searchAirRates(lane)
          if (!cancelled) setAir({ lane, options })
        } else if (k === 'lcl') {
          const lane = await fetchLclQuoteLane(quoteId)
          const options = await searchLclRates(lane)
          if (!cancelled) setLcl({ lane, options })
        } else {
          const lane = await fetchQuoteLane(quoteId)
          const options = await searchFclRates(lane)
          if (!cancelled) setFcl({ lane, options })
        }
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

  const lane = kind === 'air' ? air?.lane : kind === 'lcl' ? lcl?.lane : fcl?.lane
  if (!lane?.from_port_code || !lane?.to_port_code)
    return <p className="qr-placeholder">Set an origin and destination port on this quote to search rates.</p>

  const count = kind === 'air' ? (air?.options.length ?? 0) : kind === 'lcl' ? (lcl?.options.length ?? 0) : (fcl?.options.length ?? 0)
  const kindLabel = kind === 'air' ? 'air' : kind === 'lcl' ? 'LCL' : 'FCL'
  if (count === 0)
    return <p className="qr-placeholder">No matching {kindLabel} rates found for {lane.from_port_code} → {lane.to_port_code}. Check that a rate card for this lane is set to Validated or Active.</p>

  const summaryExtra =
    kind === 'air' ? `${air!.lane.chargeableKg} kg chargeable`
    : kind === 'lcl' ? `${lcl!.lane.wm} W/M`
    : fcl!.lane.containers.map((c) => `${c.qty}× ${c.size}`).join(', ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="text-muted-foreground" style={{ fontSize: 12, margin: 0 }}>
        {lane.from_port_code} → {lane.to_port_code} · {summaryExtra} · {count} option{count === 1 ? '' : 's'}
      </p>
      {kind === 'air' && air!.options.map((o) => (
        <AirRateOptionCard key={o.cardId} option={o} fromCode={lane.from_port_code!} toCode={lane.to_port_code!} fxRates={fxRates} />
      ))}
      {kind === 'lcl' && lcl!.options.map((o) => (
        <LclRateOptionCard key={o.cardId} option={o} fromCode={lane.from_port_code!} toCode={lane.to_port_code!} />
      ))}
      {kind === 'fcl' && fcl!.options.map((o) => (
        <RateOptionCard key={o.cardId} option={o} fromCode={lane.from_port_code!} toCode={lane.to_port_code!} fxRates={fxRates} />
      ))}
    </div>
  )
}

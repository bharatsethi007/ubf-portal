import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../supabase'
import { useEffectiveRates } from '../../hooks/useEffectiveRates'
import { useTaxRates } from '../../hooks/useQuoteRefData'
import { fetchQuoteLane, searchFclRates, type RateOption, type QuoteLane } from '../rates/rateSearchApi'
import { fetchLclQuoteLane, searchLclRates, type LclRateOption, type LclQuoteLane } from '../rates/lclRateSearchApi'
import { fetchAirQuoteLane, searchAirRates, type AirRateOption, type AirQuoteLane } from '../rates/airRateSearchApi'
import { buildBuyLinesFromOption, buildLclBuyLinesFromOption, buildAirBuyLinesFromOption } from '../rates/quoteFromRate'
import {
  fetchQuoteResponseLines,
  saveQuoteResponseLines,
  updateResponseTotals,
  computeResponseTotals,
  type QuoteResponseLine,
} from './quoteResponseLinesApi'
import { createQuoteResponse, updateQuoteResponseHeader, type QuoteResponseHeader, type QuoteResponseSummary } from './quoteResponsesApi'
import RateOptionCard from '../rates/RateOptionCard'
import LclRateOptionCard from '../rates/LclRateOptionCard'
import AirRateOptionCard from '../rates/AirRateOptionCard'

type Kind = 'fcl' | 'lcl' | 'air'

type Pending = {
  cardId: string
  target: QuoteResponseSummary
  build: () => QuoteResponseLine[]
  header: Partial<QuoteResponseHeader>
}

export default function QuoteVendorRates({
  quoteId,
  responses,
  onChanged,
}: {
  quoteId: string
  responses: QuoteResponseSummary[]
  onChanged: (openResponseId?: string) => void
}) {
  const { rates: fxRates } = useEffectiveRates('NZD')
  const { items: taxes } = useTaxRates()
  const taxRateByCode = useMemo(() => {
    const m: Record<string, number> = {}
    for (const t of taxes) m[t.code] = t.rate_pct
    return m
  }, [taxes])

  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<Kind>('fcl')
  const [fcl, setFcl] = useState<{ lane: QuoteLane; options: RateOption[] } | null>(null)
  const [lcl, setLcl] = useState<{ lane: LclQuoteLane; options: LclRateOption[] } | null>(null)
  const [air, setAir] = useState<{ lane: AirQuoteLane; options: AirRateOption[] } | null>(null)
  const [err, setErr] = useState('')
  const [busyCard, setBusyCard] = useState<string | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)

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

  // No response yet → create one and attach. Response exists → prompt Replace / Add.
  async function useRate(cardId: string, build: () => QuoteResponseLine[], header: Partial<QuoteResponseHeader>) {
    if (busyCard) return
    if (responses.length === 0) {
      setBusyCard(cardId)
      try {
        const { id } = await createQuoteResponse(quoteId)
        const lines = build()
        await saveQuoteResponseLines(id, lines)
        await updateQuoteResponseHeader(id, header)
        await updateResponseTotals(id, computeResponseTotals(lines, taxRateByCode))
        toast.success('Rates added to a new response')
        onChanged(id)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not add rates')
      } finally {
        setBusyCard(null)
      }
      return
    }
    setPending({ cardId, target: responses[0], build, header })
  }

  async function applyChoice(replace: boolean) {
    if (!pending) return
    const { cardId, target, build, header } = pending
    setPending(null)
    setBusyCard(cardId)
    try {
      const fresh = build()
      const finalLines = replace ? fresh : [...(await fetchQuoteResponseLines(target.id)), ...fresh]
      await saveQuoteResponseLines(target.id, finalLines)
      if (replace) await updateQuoteResponseHeader(target.id, header)
      await updateResponseTotals(target.id, computeResponseTotals(finalLines, taxRateByCode))
      toast.success(replace ? 'Response rates replaced' : 'Rates added to response')
      onChanged(target.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update response')
    } finally {
      setBusyCard(null)
    }
  }

  function curHeader(currency: string, carrier: string | null, transit: number | null, via: string | null): Partial<QuoteResponseHeader> {
    return {
      ...(currency ? { currency } : {}),
      carrier: carrier || null,
      transit_time_days: transit != null ? String(transit) : null,
      via_port: via || null,
    }
  }

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

  const from = lane.from_port_code!
  const to = lane.to_port_code!

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <p className="text-muted-foreground" style={{ fontSize: 12, margin: 0 }}>
        {from} → {to} · {summaryExtra} · {count} option{count === 1 ? '' : 's'} · Use a rate to push its lines into a response.
      </p>

      {kind === 'air' && air!.options.map((o) => (
        <AirRateOptionCard key={o.cardId} option={o} fromCode={from} toCode={to} fxRates={fxRates} busy={busyCard === o.cardId}
          onUse={(keys) => useRate(o.cardId, () => buildAirBuyLinesFromOption(o, keys), curHeader(o.currency, o.airlineName || null, o.transitDays, o.via))} />
      ))}
      {kind === 'lcl' && lcl!.options.map((o) => (
        <LclRateOptionCard key={o.cardId} option={o} fromCode={from} toCode={to} busy={busyCard === o.cardId}
          onUse={() => useRate(o.cardId, () => buildLclBuyLinesFromOption(o), curHeader(o.currency, o.coLoaderName || null, o.transitDays, o.via))} />
      ))}
      {kind === 'fcl' && fcl!.options.map((o) => (
        <RateOptionCard key={o.cardId} option={o} fromCode={from} toCode={to} fxRates={fxRates} busy={busyCard === o.cardId}
          containers={fcl!.lane.containers}
          onUse={(sel) => useRate(o.cardId, () => buildBuyLinesFromOption(sel, fcl!.lane.containers), curHeader(sel.currency, sel.carrierLineName || sel.carrierName || null, sel.transitDays, sel.via))} />
      ))}

      {pending && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,17,40,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
             onClick={() => setPending(null)}>
          <div style={{ background: '#fff', borderRadius: 12, maxWidth: 440, width: '100%', padding: 20, boxShadow: '0 10px 40px rgba(0,0,0,0.2)' }}
               onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#0A2472' }}>Rates already in this response</h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--muted-foreground)' }}>
              {pending.target.response_no ?? 'The existing response'} already has rate lines. Replace them with the selected rate, or add the selected rate to the existing lines?
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setPending(null)} style={{ background: 'transparent' }}>Cancel</button>
              <button className="btn" onClick={() => applyChoice(false)} style={{ background: '#fff', border: '1px solid #0A2472', color: '#0A2472' }}>Add</button>
              <button className="btn" onClick={() => applyChoice(true)} style={{ background: '#0A2472', color: '#fff' }}>Replace</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// After "Create quote" from an email: run the same rate-card search as New Quote and attach the
// cheapest valid option (by NZD buy) as a draft response. Staff still review before anything is sent.
import { supabase } from '../../supabase'
import { fetchEffectiveRates } from '../setup/fxRatesApi'
import { fetchQuoteLane, searchFclRates } from '../rates/rateSearchApi'
import { fetchLclQuoteLane, searchLclRates } from '../rates/lclRateSearchApi'
import { fetchAirQuoteLane, searchAirRates } from '../rates/airRateSearchApi'
import { buildAirBuyLinesFromOption, buildBuyLinesFromOption, buildLclBuyLinesFromOption } from '../rates/quoteFromRate'
import { computeResponseTotals, saveQuoteResponseLines, updateResponseTotals, type QuoteResponseLine } from '../quotes/quoteResponseLinesApi'
import { createQuoteResponse, updateQuoteResponseHeader, type QuoteResponseHeader } from '../quotes/quoteResponsesApi'
import { withLiveFx } from '../quotes/responseFx'

export type AutoRate =
  | { status: 'attached'; carrier: string; options: number }
  | { status: 'no_ports'; missing: string[] }
  | { status: 'no_cargo' }
  | { status: 'no_rates'; lane: string }

type Pick = { buyNzd: number; carrier: string; lines: () => QuoteResponseLine[]; header: Partial<QuoteResponseHeader> }

const head = (currency: string, carrier: string | null, transit: number | null, via: string | null): Partial<QuoteResponseHeader> => ({
  ...(currency ? { currency } : {}), carrier: carrier || null,
  transit_time_days: transit != null ? String(transit) : null, via_port: via || null,
})

async function taxMap(): Promise<Record<string, number>> {
  const { data } = await supabase.from('tax_rates').select('code,rate_pct')
  const m: Record<string, number> = {}
  for (const t of (data ?? []) as { code: string; rate_pct: number | null }[]) m[String(t.code)] = Number(t.rate_pct ?? 0)
  return m
}

export async function autoRateQuote(quoteId: string): Promise<AutoRate> {
  const { data: q, error } = await supabase.from('quotes').select('shipment_mode,shipment_type,from_port_code,to_port_code').eq('id', quoteId).single()
  if (error) throw new Error(error.message)
  const missing = [!q.from_port_code && 'origin port', !q.to_port_code && 'destination port'].filter(Boolean) as string[]
  if (missing.length) return { status: 'no_ports', missing }

  let fx = new Map<string, { buy: number; sell: number }>()
  try { fx = await fetchEffectiveRates('NZD') } catch { /* rank in source currency */ }
  const nzd = (amt: number, cur: string) => (!cur || cur === 'NZD' ? amt : amt * (fx.get(cur)?.buy ?? 1e6))

  const isAir = /air/i.test(String(q.shipment_mode ?? '')) || String(q.shipment_type ?? '').toUpperCase() === 'AIR'
  const isLcl = !isAir && String(q.shipment_type ?? '').toUpperCase() === 'LCL'
  const picks: Pick[] = []

  if (isAir) {
    const lane = await fetchAirQuoteLane(quoteId)
    if (!(lane.chargeableKg > 0)) return { status: 'no_cargo' }
    for (const o of await searchAirRates(lane)) picks.push({
      buyNzd: nzd(o.total, o.currency), carrier: o.airlineName || o.airlineCode,
      lines: () => buildAirBuyLinesFromOption(o), header: head(o.currency, o.airlineName || null, o.transitDays, o.via),
    })
  } else if (isLcl) {
    const lane = await fetchLclQuoteLane(quoteId)
    if (!(lane.wm > 0)) return { status: 'no_cargo' }
    for (const o of await searchLclRates(lane)) picks.push({
      buyNzd: nzd(o.total, o.currency), carrier: o.coLoaderName || o.coLoaderCode,
      lines: () => buildLclBuyLinesFromOption(o), header: head(o.currency, o.coLoaderName || null, o.transitDays, o.via),
    })
  } else {
    const lane = await fetchQuoteLane(quoteId)
    if (!lane.containers.length) return { status: 'no_cargo' }
    // Cards missing a requested container size can't price the whole job; skip them.
    for (const o of (await searchFclRates(lane)).filter((x) => x.missingCodes.length === 0)) picks.push({
      buyNzd: nzd(o.total, o.currency), carrier: o.carrierLineName || o.carrierName,
      lines: () => buildBuyLinesFromOption(o, lane.containers), header: head(o.currency, o.carrierLineName || o.carrierName || null, o.transitDays, o.via),
    })
  }

  const best = picks.filter((p) => p.buyNzd > 0).sort((a, b) => a.buyNzd - b.buyNzd)[0]
  if (!best) return { status: 'no_rates', lane: `${q.from_port_code} to ${q.to_port_code}` }

  const { id } = await createQuoteResponse(quoteId)
  const lines = await withLiveFx(best.lines())
  await saveQuoteResponseLines(id, lines)
  await updateQuoteResponseHeader(id, best.header)
  await updateResponseTotals(id, computeResponseTotals(lines, await taxMap()))
  return { status: 'attached', carrier: best.carrier, options: picks.length }
}

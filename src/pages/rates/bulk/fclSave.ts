import { supabase } from '@/supabase'
import type { ParseResult } from './fclSheetParse'

export type CreatedCard = { id: string; title: string; carrier: string; lines: number; flagged: number; surcharges: number }
export type FclSaveResult = { cards: CreatedCard[]; localSheets: number; skipped: number }
type Job = { title: string; carrier: string; currency: string; validFrom: string; validTo: string; sellRates: boolean; file: string; knownCarriers: Set<string> }

const SIZE: Record<string, string[]> = { '20': ['20GP', '20HC', '20NOR'], '40': ['40GP', '40HQ', '40NOR'], all: ['20GP', '20HC', '20NOR', '40GP', '40HQ', '40NOR'] }

/** One draft card per carrier found in the file, plus draft local-charge sheets per carrier and port. */
const SUR_BASIS = new Set(['per_container', 'per_bl', 'per_cbm', 'per_wm', 'per_teu', 'per_kg', 'per_awb', 'percent', 'flat'])

export async function saveFclResult(job: Job, r: ParseResult): Promise<FclSaveResult> {
  // Foreign keys: only canonical container and currency codes may be written.
  const [{ data: ct }, { data: cu }] = await Promise.all([
    supabase.from('container_types').select('code').eq('active', true),
    supabase.from('currencies').select('code'),
  ])
  const ctOk = new Set((ct ?? []).map((x: { code: string }) => x.code))
  const cuOk = new Set((cu ?? []).map((x: { code: string }) => x.code))
  const cur = (c: string) => (cuOk.has(c) ? c : job.currency)
  const byCarrier = new Map<string, typeof r.lines>()
  let skipped = 0
  for (const l of r.lines) {
    const rate = job.sellRates ? (l.sell_rate ?? l.base_rate) : (l.base_rate ?? l.sell_rate)
    if (!l.origin_port_code || !l.dest_port_code || !ctOk.has(l.container_type) || rate == null) { skipped++; continue }
    const car = l.carrier && job.knownCarriers.has(l.carrier) ? l.carrier : job.carrier
    if (!byCarrier.has(car)) byCarrier.set(car, [])
    byCarrier.get(car)!.push(l)
  }
  const multi = byCarrier.size > 1
  const cards: CreatedCard[] = []
  for (const [car, lines] of byCarrier) {
    const title = multi || !car ? `${job.title} · ${car || 'carrier unknown'}` : job.title
    const { data: card, error } = await supabase.from('rate_cards').insert({
      rate_type: 'fcl', shipping_line_code: car || null, title, currency_code: job.currency, status: 'draft',
      valid_from: job.validFrom || null, valid_to: job.validTo || null, terms: `Bulk import from ${job.file}. Review amber/red lines before validating.`,
    }).select('id').single()
    if (error) throw new Error(error.message)
    const cardId = String(card.id)
    const rows = lines.map((l) => ({
      rate_card_id: cardId, origin_port_code: l.origin_port_code, dest_port_code: l.dest_port_code, container_type: l.container_type,
      base_rate: job.sellRates ? null : l.base_rate, sell_rate: job.sellRates ? (l.sell_rate ?? l.base_rate) : l.sell_rate,
      currency_code: cur(l.currency_code), transit_days: l.transit_days, via: l.via || null,
      confidence: l.confidence, raw_origin: l.raw_origin || null,
    }))
    for (let i = 0; i < rows.length; i += 500) {
      const { error: e2 } = await supabase.from('rate_card_fcl_lines').insert(rows.slice(i, i + 500))
      if (e2) throw new Error(e2.message)
    }
    const sur = r.surcharges.filter((s) => !s.carrier || s.carrier === car || (!multi && !byCarrier.has(s.carrier)))
      .map((s) => ({
        rate_card_id: cardId, label: s.label, amount: s.amount, sell_amount: s.amount, currency_code: cur(s.currency_code),
        basis: SUR_BASIS.has(s.basis) ? s.basis : 'per_container', container_type: s.container_type && ctOk.has(s.container_type) ? s.container_type : null, scope: s.scope, origin_port_code: s.origin_port_code, condition: s.condition || null, confidence: 'amber',
      }))
    if (sur.length) {
      const { error: e3 } = await supabase.from('rate_surcharges').insert(sur)
      if (e3) throw new Error(e3.message)
    }
    cards.push({ id: cardId, title, carrier: car, lines: rows.length, flagged: lines.filter((l) => l.confidence !== 'green').length, surcharges: sur.length })
  }

  // Local charges: one draft sheet per carrier x port x direction.
  const groups = new Map<string, typeof r.local>()
  for (const p of r.local) {
    const k = [p.carrier || job.carrier, p.port_code, p.direction].join('|')
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(p)
  }
  for (const [k, items] of groups) {
    const [car, port, dir] = k.split('|')
    const { data: sh, error } = await supabase.from('local_charge_sheets').insert({
      title: `${car} ${port} ${dir === 'dest' ? 'destination' : 'origin'} charges (${job.title})`, direction: dir, movement: dir === 'dest' ? 'import' : 'export',
      mode: 'fcl', port_codes: [port], shipping_line_codes: car ? [car] : [], co_loader_codes: [], valid_from: job.validFrom || null, status: 'draft',
    }).select('id').single()
    if (error) throw new Error(error.message)
    const { error: e4 } = await supabase.from('local_charge_lines').insert(items.map((p, i) => ({
      sheet_id: sh.id, ord: i + 1, charge_code: p.charge_code || null, label: p.label, charge_group: dir === 'dest' ? 'destination' : 'origin',
      container_types: SIZE[p.size] ?? SIZE.all, basis: p.basis, buy_amount: p.amount, buy_currency: p.currency_code || 'NZD', sell_currency: p.currency_code || 'NZD',
    })))
    if (e4) throw new Error(e4.message)
  }

  // Port aliases are NOT learned here: these codes are unreviewed AI output. They are learned when staff fix lines.
  return { cards, localSheets: groups.size, skipped }
}

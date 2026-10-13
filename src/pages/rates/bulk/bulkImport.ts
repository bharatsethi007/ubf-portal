import * as XLSX from 'xlsx'
import { supabase } from '@/supabase'
import { createFclRateCard, createLclRateCard, insertFclLines, insertLclLines, learnPortAliases, type FclLineDraft, type LclLineDraft } from '../ratesApi'
import { createAirRateCard, insertAirLines, type AirLineDraft } from '../airRatesApi'
import { parseFclSheets } from './fclSheetParse'
import { saveFclResult, type CreatedCard } from './fclSave'

export type BulkKind = 'fcl' | 'lcl' | 'air'
export type SheetData = { name: string; rows: string[][]; hidden?: boolean }
export type JobStatus = 'ready' | 'working' | 'done' | 'failed'

export type BulkJob = {
  id: string
  file: string
  sheets: SheetData[]
  sheet: string
  /** FCL: every sheet to read (one workbook can hold several carriers and a local-charges tab). */
  sheetSel: string[]
  kind: BulkKind
  /** FCL: shipping line code. LCL: co-loader code. Air: airline code. */
  carrier: string
  carrierName: string
  currency: string
  sellRates: boolean
  title: string
  validFrom: string
  validTo: string
  status: JobStatus
  step?: string
  error?: string
  cardId?: string
  parsed?: number
  saved?: number
  flagged?: number
  skipped?: number
  cards?: CreatedCard[]
  localSheets?: number
  warnings?: string[]
}

const MAX_PARSE_ROWS = 300
const PARSE_FN: Record<BulkKind, string> = { fcl: 'rate-card-parse', lcl: 'rate-card-parse-lcl', air: 'rate-card-parse-air' }

/** Drop empty rows and padded columns so the parse prompt stays small. */
export function trimSheet(rows: string[][]): string[][] {
  const nonEmpty = rows.filter((r) => r.some((c) => (c ?? '').toString().trim() !== ''))
  let maxCol = 0
  for (const r of nonEmpty) {
    for (let i = r.length - 1; i >= 0; i--) {
      if ((r[i] ?? '').toString().trim() !== '') { if (i + 1 > maxCol) maxCol = i + 1; break }
    }
  }
  return nonEmpty.slice(0, MAX_PARSE_ROWS).map((r) => r.slice(0, maxCol).map((c) => (c ?? '').toString()))
}

export async function readWorkbook(file: File): Promise<SheetData[]> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  const meta = wb.Workbook?.Sheets ?? []
  return wb.SheetNames.map((name, i) => ({
    name, hidden: !!meta[i]?.Hidden,
    rows: XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name], { header: 1, raw: false, defval: '' }),
  }))
}

/** FCL default: every visible sheet that is not obviously notes or contacts. */
export function defaultSheetSel(sheets: SheetData[]): string[] {
  return sheets.filter((s) => !s.hidden && !/note|term|condition|contact|format|search|list|office/i.test(s.name)
    && s.rows.some((r) => r.some((c) => /\d{2,}/.test(String(c ?? ''))))).map((s) => s.name)
}

export function guessKind(fileName: string, sheetNames: string[]): BulkKind {
  const s = `${fileName} ${sheetNames.join(' ')}`.toLowerCase()
  if (/\bair\b|airfreight|air freight|awb|\bkg\b/.test(s)) return 'air'
  if (/\blcl\b|w\/m|\bcfs\b|consol/.test(s)) return 'lcl'
  return 'fcl'
}

export function pickSheet(kind: BulkKind, names: string[]): string {
  const score = (n: string) => {
    const s = n.toLowerCase(); let v = 0
    if (/rate|tariff|freight|sell|import/.test(s)) v += 2
    if (kind === 'air' && /air/.test(s)) v += 2
    if (kind === 'lcl' && /lcl/.test(s)) v += 2
    if (/export|note|agent|cfs|contact|term|condition|search|list|office|fsc|ssc/.test(s)) v -= 2
    return v
  }
  return [...names].sort((a, b) => score(b) - score(a))[0] ?? names[0] ?? ''
}

/** Match a carrier option whose code or name appears in the file name. */
export function guessCarrier(fileName: string, options: { code: string; name: string }[]): { code: string; name: string } | null {
  const f = fileName.toLowerCase().replace(/[_\-.]+/g, ' ')
  const hit = options.find((o) => {
    const name = o.name.toLowerCase()
    const first = name.split(/\s+/)[0]
    return (o.code.length >= 3 && new RegExp(`\\b${o.code.toLowerCase()}\\b`).test(f)) || (first.length >= 4 && f.includes(first))
  })
  return hit ?? null
}

const s = (v: unknown) => (v != null ? String(v) : '')
const conf = (v: unknown) => (v === 'amber' || v === 'red' ? v : 'green') as 'green' | 'amber' | 'red'

async function createCard(j: BulkJob): Promise<string> {
  const base = { title: j.title, currency_code: j.currency, valid_from: j.validFrom, valid_to: j.validTo }
  if (j.kind === 'fcl') return (await createFclRateCard({ ...base, shipping_line_code: j.carrier })).id
  if (j.kind === 'lcl') return (await createLclRateCard({ ...base, co_loader_code: j.carrier })).id
  return (await createAirRateCard({ ...base, airline_code: j.carrier, airline_name: j.carrierName })).id
}

async function parse(j: BulkJob, cardId: string): Promise<any[]> {
  const rows = j.sheets.find((x) => x.name === j.sheet)?.rows ?? []
  const { data, error } = await supabase.functions.invoke(PARSE_FN[j.kind], { body: { rate_card_id: cardId, sheet: trimSheet(rows) } })
  if (error) throw new Error(error.message || 'Parse failed')
  if (data?.error) throw new Error(String(data.error))
  return Array.isArray(data?.lines) ? data.lines : []
}

type Saved = { saved: number; flagged: number; skipped: number }

async function saveLines(j: BulkJob, cardId: string, lines: any[]): Promise<Saved> {
  const cur = j.currency
  const common = (l: any, i: number) => ({
    key: `b-${i}`, dbId: null, origin_port_code: s(l.origin_port_code).toUpperCase(), dest_port_code: s(l.dest_port_code).toUpperCase(),
    currency_code: l.currency_code || cur, transit_days: s(l.transit_days), via: s(l.via),
    confidence: conf(l.confidence), raw_origin: s(l.raw_origin), note: s(l.note),
  })
  const num = (v: string | undefined) => (v ?? '') !== '' && !isNaN(Number(v))
  let good: (FclLineDraft | LclLineDraft | AirLineDraft)[] = []
  if (j.kind === 'fcl') {
    const d: FclLineDraft[] = lines.map((l, i) => ({ ...common(l, i), container_type: s(l.container_type).toUpperCase(),
      base_rate: j.sellRates ? '' : s(l.base_rate), sell_rate: j.sellRates ? s(l.base_rate) : '' }))
    good = d.filter((l) => l.origin_port_code && l.dest_port_code && l.container_type && num(j.sellRates ? l.sell_rate : l.base_rate))
    if (good.length) await insertFclLines(cardId, good as FclLineDraft[])
  } else if (j.kind === 'lcl') {
    const d: LclLineDraft[] = lines.map((l, i) => ({ ...common(l, i), rate_per_wm: s(l.rate_per_wm), min_charge: s(l.min_charge), frequency: s(l.frequency),
      lane_charges: Array.isArray(l.lane_charges) ? l.lane_charges.map((c: any) => ({ code: String(c.code || '').toUpperCase(), label: String(c.label || c.code || ''), per_wm: Number(c.per_wm) || 0 })) : [] }))
    good = d.filter((l) => l.origin_port_code && l.dest_port_code && num(l.rate_per_wm))
    if (good.length) await insertLclLines(cardId, good as LclLineDraft[])
  } else {
    const d: AirLineDraft[] = lines.map((l, i) => ({ ...common(l, i), min_charge: s(l.min_charge), rate_n: s(l.rate_n), rate_45: s(l.rate_45),
      rate_100: s(l.rate_100), rate_250: s(l.rate_250), rate_500: s(l.rate_500), rate_1000: s(l.rate_1000), frequency: s(l.frequency), margin_type: '', margin_value: '' }))
    good = d.filter((l) => l.origin_port_code && l.dest_port_code && [l.min_charge, l.rate_n, l.rate_45, l.rate_100, l.rate_250, l.rate_500, l.rate_1000].some(num))
    if (good.length) await insertAirLines(cardId, good as AirLineDraft[])
  }
  if (j.kind !== 'air') {
    const pairs = good.filter((l) => l.raw_origin && l.origin_port_code && l.raw_origin.trim().toUpperCase() !== l.origin_port_code)
      .map((l) => ({ alias: (l.raw_origin as string).trim(), port_code: l.origin_port_code }))
    try { await learnPortAliases(pairs) } catch { /* non-fatal */ }
  }
  return { saved: good.length, flagged: good.filter((l) => l.confidence !== 'green').length, skipped: lines.length - good.length }
}

/** One file end to end: draft card, AI parse, save valid lines. Never activates a card. */
/** FCL: every selected sheet, chunked; one draft card per carrier plus draft local-charge sheets. */
async function processFcl(j: BulkJob, knownCarriers: Set<string>, report: (p: Partial<BulkJob>) => void): Promise<void> {
  try {
    const sheets = j.sheets.filter((s) => j.sheetSel.includes(s.name))
    if (!sheets.length) throw new Error('Tick at least one sheet.')
    report({ status: 'working', step: 'AI reading sheets', error: undefined, warnings: undefined })
    const r = await parseFclSheets(sheets, { shipping_line_code: j.carrier || null, currency_code: j.currency, valid_from: j.validFrom || null, valid_to: j.validTo || null },
      (done, total) => report({ step: `AI reading sheets ${done}/${total}` }))
    if (!r.lines.length && !r.local.length) throw new Error(r.failed[0] ?? 'No rates found on the ticked sheets.')
    report({ parsed: r.lines.length, step: 'Saving drafts' })
    const s = await saveFclResult({ ...j, knownCarriers }, r)
    const lines = s.cards.reduce((a, c) => a + c.lines, 0)
    report({
      status: 'done', step: undefined, cards: s.cards, localSheets: s.localSheets, saved: lines,
      flagged: s.cards.reduce((a, c) => a + c.flagged, 0), skipped: s.skipped, cardId: s.cards[0]?.id, warnings: r.failed,
    })
  } catch (e) {
    report({ status: 'failed', step: undefined, error: e instanceof Error ? e.message : 'Failed' })
  }
}

export async function processJob(j: BulkJob, report: (p: Partial<BulkJob>) => void, knownCarriers: Set<string> = new Set()): Promise<void> {
  if (j.kind === 'fcl') return processFcl(j, knownCarriers, report)
  let cardId: string | undefined
  try {
    report({ status: 'working', step: 'Creating draft card', error: undefined })
    cardId = await createCard(j)
    report({ cardId, step: 'AI reading sheet' })
    const lines = await parse(j, cardId)
    if (!lines.length) throw new Error('No rate lines found on that sheet. Try another sheet.')
    report({ parsed: lines.length, step: 'Saving lines' })
    const r = await saveLines(j, cardId, lines)
    if (!r.saved) throw new Error(`AI found ${lines.length} lines but none had port, container and rate.`)
    report({ status: 'done', step: undefined, ...r })
  } catch (e) {
    if (cardId) { await supabase.from('rate_cards').delete().eq('id', cardId).eq('status', 'draft'); cardId = undefined }
    report({ status: 'failed', step: undefined, cardId: undefined, error: e instanceof Error ? e.message : 'Failed' })
  }
}

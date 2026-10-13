import { supabase } from '@/supabase'

// Client side of rate-card-parse for FCL workbooks: split each sheet into row chunks (header rows repeated),
// parse chunks in parallel, then merge and de-duplicate across chunks and sheets.

export type ParsedLine = {
  origin_port_code: string; raw_origin: string; dest_port_code: string; raw_dest: string
  container_type: string; base_rate: number | null; sell_rate: number | null; currency_code: string
  transit_days: number | null; via: string; carrier: string; confidence: 'green' | 'amber' | 'red'; note: string; sheet: string
}
export type ParsedSurcharge = {
  label: string; amount: number; currency_code: string; basis: string; container_type: string | null
  scope: string; origin_port_code: string | null; carrier: string | null; condition: string
}
export type ParsedLocal = {
  port_code: string; direction: 'dest' | 'origin'; carrier: string; charge_code: string; label: string
  basis: string; size: '20' | '40' | 'all'; amount: number; currency_code: string
}
export type ParseResult = { lines: ParsedLine[]; surcharges: ParsedSurcharge[]; local: ParsedLocal[]; failed: string[] }

type Ctx = { shipping_line_code: string | null; currency_code: string; valid_from: string | null; valid_to: string | null }

const HEADER_ROWS = 6
const CHUNK_ROWS = 40
const PARALLEL = 3

function nonEmpty(rows: string[][]): string[][] {
  const kept = rows.filter((r) => r.some((c) => (c ?? '').toString().trim() !== ''))
  let maxCol = 0
  for (const r of kept) for (let i = r.length - 1; i >= 0; i--) if ((r[i] ?? '').toString().trim()) { maxCol = Math.max(maxCol, i + 1); break }
  return kept.map((r) => r.slice(0, maxCol).map((c) => (c ?? '').toString()))
}

/** Header rows repeated on every chunk so each call still sees the column meanings. */
export function chunkSheet(rows: string[][]): string[][][] {
  const all = nonEmpty(rows)
  if (all.length <= HEADER_ROWS + CHUNK_ROWS) return [all]
  const head = all.slice(0, HEADER_ROWS)
  const body = all.slice(HEADER_ROWS)
  const out: string[][][] = []
  for (let i = 0; i < body.length; i += CHUNK_ROWS) out.push([...head, ...body.slice(i, i + CHUNK_ROWS)])
  return out
}

async function callParse(sheet: string[][], ctx: Ctx, sheetName: string) {
  const { data, error } = await supabase.functions.invoke('rate-card-parse', { body: { sheet, context: { ...ctx, sheet_name: sheetName } } })
  if (error) throw new Error(error.message || 'Parse failed')
  if (data?.error) throw new Error(String(data.error))
  return data as { lines: any[]; surcharges: any[]; local_charges: any[] }
}

export async function parseFclSheets(sheets: { name: string; rows: string[][] }[], ctx: Ctx, onProgress: (done: number, total: number) => void): Promise<ParseResult> {
  const jobs = sheets.flatMap((s) => chunkSheet(s.rows).map((rows) => ({ sheet: s.name, rows })))
  const res: ParseResult = { lines: [], surcharges: [], local: [], failed: [] }
  let next = 0; let done = 0
  onProgress(0, jobs.length)
  const worker = async () => {
    while (next < jobs.length) {
      const j = jobs[next++]
      try {
        const r = await callParse(j.rows, ctx, j.sheet)
        res.lines.push(...(r.lines ?? []).map((l: any) => ({ ...l, sheet: j.sheet })))
        res.surcharges.push(...(r.surcharges ?? []))
        res.local.push(...(r.local_charges ?? []))
      } catch (e) {
        res.failed.push(`${j.sheet}: ${e instanceof Error ? e.message : 'failed'}`)
      }
      onProgress(++done, jobs.length)
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALLEL, jobs.length) }, worker))
  return dedupe(res)
}

/** Same lane twice (header overlap, summary tab) -> keep the richer row: buy + sell beats sell only. */
function dedupe(r: ParseResult): ParseResult {
  const lines = new Map<string, ParsedLine>()
  for (const l of r.lines) {
    const k = [l.carrier, l.origin_port_code, l.dest_port_code, l.container_type, l.via, l.raw_origin].join('|')
    const prev = lines.get(k)
    if (!prev) { lines.set(k, l); continue }
    const score = (x: ParsedLine) => (x.base_rate != null ? 2 : 0) + (x.sell_rate != null ? 1 : 0)
    if (score(l) > score(prev)) lines.set(k, l)
  }
  // Sell-only rows that duplicate a buy+sell row on another sheet (e.g. a summary tab) add nothing.
  const priced = new Set([...lines.values()].filter((l) => l.base_rate != null).map((l) => [l.origin_port_code, l.dest_port_code, l.container_type, l.sell_rate].join('|')))
  const kept = [...lines.values()].filter((l) => l.base_rate != null || !priced.has([l.origin_port_code, l.dest_port_code, l.container_type, l.sell_rate].join('|')))
  const sk = (s: ParsedSurcharge) => [s.carrier, s.label.toLowerCase(), s.container_type, s.origin_port_code, s.amount].join('|')
  const lk = (p: ParsedLocal) => [p.carrier, p.port_code, p.direction, p.label.toLowerCase(), p.size, p.amount].join('|')
  return {
    lines: kept,
    surcharges: [...new Map(r.surcharges.map((s) => [sk(s), s])).values()],
    local: [...new Map(r.local.map((p) => [lk(p), p])).values()].filter((p, i, all) =>
      // Same charge code + amount from a notes block and a charges table -> keep the first.
      !p.charge_code || all.findIndex((q) => q.charge_code === p.charge_code && q.carrier === p.carrier && q.port_code === p.port_code
        && q.direction === p.direction && q.size === p.size && q.amount === p.amount) === i),
    failed: r.failed,
  }
}

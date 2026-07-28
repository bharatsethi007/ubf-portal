import { supabase } from '../../supabase'

export type QuoteCargoLine = {
  id: string
  ord: number
  cargo_description: string
  package_type: string
  packages: string
  volume_cbm: string
  volume_wt: string
  gross_wt: string
  chargeable_wt: string
}

export function newQuoteCargoLine(ord = 0): QuoteCargoLine {
  return {
    id: crypto.randomUUID(),
    ord,
    cargo_description: '',
    package_type: '',
    packages: '',
    volume_cbm: '',
    volume_wt: '',
    gross_wt: '',
    chargeable_wt: '',
  }
}

function numStr(v: unknown): string {
  if (v == null || v === '') return ''
  return String(v)
}

function mapRow(row: Record<string, unknown>): QuoteCargoLine {
  return {
    id: String(row.id),
    ord: Number(row.ord) || 0,
    cargo_description: (row.cargo_description as string | null) ?? '',
    package_type: (row.package_type as string | null) ?? '',
    packages: numStr(row.packages),
    volume_cbm: numStr(row.volume_cbm),
    volume_wt: numStr(row.volume_wt),
    gross_wt: numStr(row.gross_wt),
    chargeable_wt: numStr(row.chargeable_wt),
  }
}

function isEmptyLine(line: QuoteCargoLine): boolean {
  const nums = [line.packages, line.volume_cbm, line.volume_wt, line.gross_wt, line.chargeable_wt]
  return !line.cargo_description.trim() && nums.every((n) => !n.trim())
}

function parseNumField(s: string): number | null {
  return Number(s) || null
}

export async function fetchQuoteCargo(quoteId: string): Promise<QuoteCargoLine[]> {
  const { data, error } = await supabase
    .from('quote_cargo_lines')
    .select('*')
    .eq('quote_id', quoteId)
    .order('ord')

  if (error) throw error
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>))
}

export async function saveQuoteCargo(quoteId: string, lines: QuoteCargoLine[]): Promise<void> {
  const { error: delErr } = await supabase
    .from('quote_cargo_lines')
    .delete()
    .eq('quote_id', quoteId)

  if (delErr) throw delErr

  const rows = lines
    .filter((line) => !isEmptyLine(line))
    .map((line, index) => ({
      id: line.id,
      quote_id: quoteId,
      ord: index,
      cargo_description: line.cargo_description.trim() || null,
      package_type: line.package_type.trim() || null,
      packages: parseNumField(line.packages),
      volume_cbm: parseNumField(line.volume_cbm),
      volume_wt: parseNumField(line.volume_wt),
      gross_wt: parseNumField(line.gross_wt),
      chargeable_wt: parseNumField(line.chargeable_wt),
    }))

  if (!rows.length) return

  const { error: insErr } = await supabase.from('quote_cargo_lines').insert(rows)
  if (insErr) throw insErr
}

import { supabase } from '../../supabase'

export type QuoteCargoLine = {
  id: string
  ord: number
  cargo_description: string
  package_type: string
  quantity: string
  packages: string
  weight_unit: string
  per_package_weight: string
  total_weight: string
  length: string
  width: string
  height: string
  dim_unit: string
  volume_cbm: string
  total_cbm: string
  volume_wt: string
  gross_wt: string
  chargeable_wt: string
  override_chargeable: boolean
}

export function newQuoteCargoLine(ord = 0): QuoteCargoLine {
  return {
    id: crypto.randomUUID(),
    ord,
    cargo_description: '',
    package_type: '',
    quantity: '',
    packages: '',
    weight_unit: 'KG',
    per_package_weight: '',
    total_weight: '',
    length: '',
    width: '',
    height: '',
    dim_unit: 'CM',
    volume_cbm: '',
    total_cbm: '',
    volume_wt: '',
    gross_wt: '',
    chargeable_wt: '',
    override_chargeable: false,
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
    quantity: numStr(row.quantity),
    packages: numStr(row.packages),
    weight_unit: (row.weight_unit as string | null) || 'KG',
    per_package_weight: numStr(row.per_package_weight),
    total_weight: numStr(row.total_weight),
    length: numStr(row.length),
    width: numStr(row.width),
    height: numStr(row.height),
    dim_unit: (row.dim_unit as string | null) || 'CM',
    volume_cbm: numStr(row.volume_cbm),
    total_cbm: numStr(row.total_cbm),
    volume_wt: numStr(row.volume_wt),
    gross_wt: numStr(row.gross_wt),
    chargeable_wt: numStr(row.chargeable_wt),
    override_chargeable: Boolean(row.override_chargeable),
  }
}

function isEmptyLine(line: QuoteCargoLine): boolean {
  const nums = [
    line.packages,
    line.quantity,
    line.per_package_weight,
    line.total_weight,
    line.length,
    line.width,
    line.height,
    line.volume_cbm,
    line.total_cbm,
    line.volume_wt,
    line.gross_wt,
    line.chargeable_wt,
  ]
  return !line.cargo_description.trim() && nums.every((n) => !n.trim())
}

function parseNumField(s: string): number | null {
  return Number(s) || null
}

function dimToMetres(value: number, unit: string): number {
  if (unit === 'M') return value
  if (unit === 'IN') return value * 0.0254
  return value / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function computeCargoLine(
  row: QuoteCargoLine,
  mode: 'air' | 'sea',
): { cbm: number; totalCbm: number; grossTotal: number; chargeable: number } {
  const l = Number(row.length)
  const w = Number(row.width)
  const h = Number(row.height)

  let cbm = 0
  if (Number.isFinite(l) && l > 0 && Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0) {
    const lm = dimToMetres(l, row.dim_unit || 'CM')
    const wm = dimToMetres(w, row.dim_unit || 'CM')
    const hm = dimToMetres(h, row.dim_unit || 'CM')
    cbm = lm * wm * hm
  }

  const qty = Number(row.quantity) || Number(row.packages) || 0
  const totalCbm = cbm * qty
  const perPkgWeight = Number(row.per_package_weight) || 0
  const totalWeight = Number(row.total_weight) || perPkgWeight * qty
  const grossTotal = Number(row.gross_wt) || totalWeight
  const volumetric = totalCbm * 167
  const chargeable = mode === 'air' ? Math.max(grossTotal, volumetric) : totalCbm

  return {
    cbm: round4(cbm),
    totalCbm: round4(totalCbm),
    grossTotal: round2(grossTotal),
    chargeable: round2(chargeable),
  }
}

export function applyComputedFields(
  line: QuoteCargoLine,
  mode: 'air' | 'sea',
): QuoteCargoLine {
  const c = computeCargoLine(line, mode)
  return {
    ...line,
    volume_cbm: c.cbm ? String(c.cbm) : '',
    total_cbm: c.totalCbm ? String(c.totalCbm) : '',
    chargeable_wt: line.override_chargeable
      ? line.chargeable_wt
      : c.chargeable ? String(c.chargeable) : '',
  }
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
      quantity: parseNumField(line.quantity),
      packages: parseNumField(line.packages),
      weight_unit: line.weight_unit.trim() || 'KG',
      per_package_weight: parseNumField(line.per_package_weight),
      total_weight: parseNumField(line.total_weight),
      length: parseNumField(line.length),
      width: parseNumField(line.width),
      height: parseNumField(line.height),
      dim_unit: line.dim_unit.trim() || 'CM',
      volume_cbm: parseNumField(line.volume_cbm),
      total_cbm: parseNumField(line.total_cbm),
      volume_wt: parseNumField(line.volume_wt),
      gross_wt: parseNumField(line.gross_wt),
      chargeable_wt: parseNumField(line.chargeable_wt),
      override_chargeable: line.override_chargeable,
    }))

  if (!rows.length) return

  const { error: insErr } = await supabase.from('quote_cargo_lines').insert(rows)
  if (insErr) throw insErr
}

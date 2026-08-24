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

// Air chargeable weight is billed in 0.5 kg increments, always rounded UP (IATA rule).
function ceilHalf(n: number): number {
  return Math.ceil(n * 2) / 2
}

// Air volumetric divisor: 1 CBM = 167 kg (IATA 6000 cm3/kg expressed per m3).
const AIR_VOLUMETRIC_PER_CBM = 167

export function computeCargoLine(
  row: QuoteCargoLine,
  mode: 'air' | 'sea',
): { cbm: number; totalCbm: number; grossTotal: number; chargeable: number } {
  const l = Number(row.length)
  const w = Number(row.width)
  const h = Number(row.height)

  // Per-unit CBM from dimensions, when all three are present.
  let cbm = 0
  const hasDims =
    Number.isFinite(l) && l > 0 && Number.isFinite(w) && w > 0 && Number.isFinite(h) && h > 0
  if (hasDims) {
    const lm = dimToMetres(l, row.dim_unit || 'CM')
    const wm = dimToMetres(w, row.dim_unit || 'CM')
    const hm = dimToMetres(h, row.dim_unit || 'CM')
    cbm = lm * wm * hm
  }

  const qty = Number(row.quantity) || Number(row.packages) || 0

  // Total CBM: dimensions win when present; otherwise honour a user-typed total
  // (this is the total-shipment entry path, where CBM is entered directly).
  let totalCbm = cbm * qty
  if (!hasDims) {
    const typedTotal = Number(row.total_cbm)
    if (Number.isFinite(typedTotal) && typedTotal > 0) totalCbm = typedTotal
  }

  const perPkgWeight = Number(row.per_package_weight) || 0
  // Per-pkg × qty is authoritative whenever a per-package weight is given; only
  // fall back to a directly-typed total weight when there is no per-package
  // weight. Never read gross_wt here — it is a derived OUTPUT, and reading it
  // back would freeze the row against qty / weight edits once it has been saved.
  const grossTotal = perPkgWeight > 0 ? perPkgWeight * qty : (Number(row.total_weight) || 0)

  const volumetric = totalCbm * AIR_VOLUMETRIC_PER_CBM
  const chargeable =
    mode === 'air' ? ceilHalf(Math.max(grossTotal, volumetric)) : totalCbm

  return {
    cbm: round4(cbm),
    totalCbm: round4(totalCbm),
    grossTotal: round2(grossTotal),
    chargeable: mode === 'air' ? chargeable : round2(chargeable),
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
    total_cbm: c.totalCbm ? String(c.totalCbm) : line.total_cbm,
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

export async function saveQuoteCargo(
  quoteId: string,
  lines: QuoteCargoLine[],
  mode: 'air' | 'sea' = 'sea',
): Promise<void> {
  const { error: delErr } = await supabase
    .from('quote_cargo_lines')
    .delete()
    .eq('quote_id', quoteId)

  if (delErr) throw delErr

  // Persist the derived weights/volumes (not just the display) so downstream
  // consumers — air rate search (gross_wt + total_cbm), PDF, reports — read real
  // numbers. A value the user typed always wins over the computed one.
  const rows = lines
    .filter((line) => !isEmptyLine(line))
    .map((line, index) => {
      const c = computeCargoLine(line, mode)
      const hasPerPkg = (Number(line.per_package_weight) || 0) > 0
      return {
        id: line.id,
        quote_id: quoteId,
        ord: index,
        cargo_description: line.cargo_description.trim() || null,
        package_type: line.package_type.trim() || null,
        quantity: parseNumField(line.quantity),
        packages: parseNumField(line.packages),
        weight_unit: line.weight_unit.trim() || 'KG',
        per_package_weight: parseNumField(line.per_package_weight),
        // Derived from per-pkg × qty when a per-package weight exists; otherwise
        // honour a directly-typed total. c.* is the single source of truth so a
        // stale stored value can never override a fresh qty / weight edit.
        total_weight: hasPerPkg ? (c.grossTotal || null) : parseNumField(line.total_weight),
        length: parseNumField(line.length),
        width: parseNumField(line.width),
        height: parseNumField(line.height),
        dim_unit: line.dim_unit.trim() || 'CM',
        volume_cbm: c.cbm || null,
        total_cbm: c.totalCbm || null,
        volume_wt: mode === 'air' && c.totalCbm ? round2(c.totalCbm * 167) : null,
        gross_wt: c.grossTotal || null,
        chargeable_wt: line.override_chargeable
          ? parseNumField(line.chargeable_wt)
          : (c.chargeable || null),
        override_chargeable: line.override_chargeable,
      }
    })

  if (!rows.length) return

  const { error: insErr } = await supabase.from('quote_cargo_lines').insert(rows)
  if (insErr) throw insErr
}

export async function fetchCargoDescriptionSuggestions(): Promise<string[]> {
  const { data, error } = await supabase
    .from('quote_cargo_lines')
    .select('cargo_description')
    .not('cargo_description', 'is', null)
    .limit(500)
  if (error) throw error
  const seen = new Set<string>(); const out: string[] = []
  for (const r of (data ?? []) as { cargo_description: string | null }[]) {
    const v = (r.cargo_description ?? '').trim()
    const k = v.toLowerCase()
    if (v && !seen.has(k)) { seen.add(k); out.push(v) }
    if (out.length >= 60) break
  }
  return out
}

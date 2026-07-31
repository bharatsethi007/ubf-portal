import { supabase } from '../../supabase'
import type { QuoteResponseLine } from '../quotes/quoteResponseLinesApi'

export type ChargeTemplate = { id: string; name: string; line_count?: number }

type TemplateRow = { id: string; name: string; charge_template_lines?: { count: number }[] }

type TemplateLineRow = Record<string, unknown>

function numStr(v: unknown): string {
  if (v == null || v === '') return ''
  return String(v)
}

function parseNumField(s: string): number | null {
  return Number(s) || null
}

function isEmptyLine(line: QuoteResponseLine): boolean {
  const nums = [line.qty, line.min_buy, line.min_sell, line.buy_rate, line.sell_rate]
  return !line.description.trim() && !line.buy_rate.trim() && !line.sell_rate.trim()
    && nums.every((n) => !n.trim() || n.trim() === '1')
}

function mapTemplateLine(row: TemplateLineRow): QuoteResponseLine {
  return {
    id: crypto.randomUUID(),
    ord: Number(row.ord) || 0,
    description: (row.description as string | null) ?? '',
    is_service_charge: Boolean(row.is_service_charge),
    charge_group: (row.charge_group as string | null) || 'freight',
    vendor: (row.vendor as string | null) ?? '',
    unit: (row.unit as string | null) ?? '',
    qty: numStr(row.qty),
    buy_currency: (row.buy_currency as string | null) || 'NZD',
    sell_currency: (row.sell_currency as string | null) || 'NZD',
    min_buy: numStr(row.min_buy),
    min_sell: numStr(row.min_sell),
    buy_rate: numStr(row.buy_rate),
    sell_rate: numStr(row.sell_rate),
    tax: (row.tax as string | null) ?? '',
    ex_rate_buy: '1',
    ex_rate_sell: '1',
  }
}

function lineToInsertRow(templateId: string, line: QuoteResponseLine, index: number) {
  return {
    template_id: templateId,
    ord: index,
    description: line.description.trim() || null,
    is_service_charge: line.is_service_charge,
    charge_group: line.charge_group || 'freight',
    vendor: line.vendor.trim() || null,
    unit: line.unit.trim() || null,
    qty: parseNumField(line.qty),
    buy_currency: line.buy_currency.trim() || null,
    sell_currency: line.sell_currency.trim() || null,
    min_buy: parseNumField(line.min_buy),
    min_sell: parseNumField(line.min_sell),
    buy_rate: parseNumField(line.buy_rate),
    sell_rate: parseNumField(line.sell_rate),
    tax: line.tax.trim() || null,
  }
}

async function insertTemplateLines(templateId: string, lines: QuoteResponseLine[]): Promise<void> {
  const rows = lines
    .filter((line) => !isEmptyLine(line))
    .map((line, index) => lineToInsertRow(templateId, line, index))
  if (!rows.length) return
  const { error } = await supabase.from('charge_template_lines').insert(rows)
  if (error) throw error
}

export async function fetchChargeTemplates(): Promise<ChargeTemplate[]> {
  const { data, error } = await supabase
    .from('charge_templates')
    .select('id, name, charge_template_lines(count)')
    .order('name')
  if (error) throw error
  return ((data ?? []) as TemplateRow[]).map((row) => ({
    id: String(row.id),
    name: row.name,
    line_count: row.charge_template_lines?.[0]?.count,
  }))
}

export async function fetchChargeTemplateLines(templateId: string): Promise<QuoteResponseLine[]> {
  const { data, error } = await supabase
    .from('charge_template_lines')
    .select('*')
    .eq('template_id', templateId)
    .order('ord')
  if (error) throw error
  return (data ?? []).map((row) => mapTemplateLine(row as TemplateLineRow))
}

export async function createChargeTemplate(name: string, lines: QuoteResponseLine[]): Promise<string> {
  const { data, error } = await supabase
    .from('charge_templates')
    .insert({ name: name.trim() })
    .select('id')
    .single()
  if (error) throw error
  const templateId = String(data.id)
  await insertTemplateLines(templateId, lines)
  return templateId
}

export async function updateChargeTemplate(
  id: string,
  name: string,
  lines: QuoteResponseLine[],
): Promise<void> {
  const { error: updErr } = await supabase
    .from('charge_templates')
    .update({ name: name.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
  if (updErr) throw updErr

  const { error: delErr } = await supabase
    .from('charge_template_lines')
    .delete()
    .eq('template_id', id)
  if (delErr) throw delErr

  await insertTemplateLines(id, lines)
}

export async function deleteChargeTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('charge_templates').delete().eq('id', id)
  if (error) throw error
}

import { buildQuotesQuery, type QuoteListFilters } from './quotesListQuery'
import type { QuoteRow } from './quotesTableColumns'

const BATCH = 1000

function modeLabel(r: QuoteRow): string {
  const m = (r.shipment_mode ?? '').toLowerCase()
  const t = (r.shipment_type ?? '').toUpperCase()
  if (m.includes('air') || t === 'AIR') return 'Air'
  return t || r.shipment_mode || ''
}

function cell(v: string | null | undefined): string {
  const s = v ?? ''
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Exports every quote matching the current tab + filters, not just the visible page.
export async function exportQuotesCsv(
  f: QuoteListFilters,
  portMap: Map<string, string>,
  staffMap: Map<string, string>,
): Promise<number> {
  const rows: QuoteRow[] = []
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await buildQuotesQuery(f).range(from, from + BATCH - 1)
    if (error) throw error
    const batch = (data ?? []) as QuoteRow[]
    rows.push(...batch)
    if (batch.length < BATCH) break
  }

  const port = (c: string | null) => (c ? portMap.get(c) ?? c : '')
  const head = ['Quote #', 'Customer', 'Mode', 'Type', 'Status', 'Origin', 'Destination', 'Source', 'Created by', 'Created', 'Expires', 'Lost reason', 'Lost note']
  const lines = rows.map((r) => [
    r.quote_no, r.customer_name, modeLabel(r), r.movement_type, r.status,
    port(r.from_port_code), port(r.to_port_code), r.source ?? 'manual',
    r.created_by ? staffMap.get(r.created_by) ?? '' : '', fmtDate(r.created_at),
    r.expires_at ? fmtDate(r.expires_at) : '', r.lost_reason ?? '', r.lost_note ?? '',
  ].map(cell).join(','))

  const csv = '﻿' + [head.join(','), ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ubf-quotes-${f.statusTab}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  return rows.length
}

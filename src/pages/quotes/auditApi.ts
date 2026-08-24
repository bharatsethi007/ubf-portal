import { supabase } from '../../supabase'

export type AuditRow = {
  id: number
  tableName: string
  op: 'I' | 'U' | 'D'
  rowPk: string | null
  actorEmail: string | null
  diff: Record<string, any> | null
  createdAt: string
}

export type AuditEvent = {
  id: number
  createdAt: string
  actor: string
  kind: 'create' | 'update' | 'delete' | 'status' | 'send'
  summary: string
  changes: { label: string; from: string; to: string }[]
}

export async function fetchAuditPage(quoteId: string, page: number, pageSize = 20): Promise<{ rows: AuditRow[]; total: number }> {
  const from = page * pageSize
  const { data, error, count } = await supabase
    .from('audit_log')
    .select('id, table_name, op, row_pk, actor_email, diff, created_at', { count: 'exact' })
    .eq('quote_id', quoteId)
    .order('id', { ascending: false })
    .range(from, from + pageSize - 1)
  if (error) throw error
  const rows: AuditRow[] = ((data as Record<string, any>[]) ?? []).map((r) => ({
    id: Number(r.id), tableName: String(r.table_name), op: String(r.op) as 'I' | 'U' | 'D',
    rowPk: r.row_pk ?? null, actorEmail: r.actor_email ?? null, diff: r.diff ?? null, createdAt: r.created_at,
  }))
  return { rows, total: count ?? 0 }
}

const FIELD_LABELS: Record<string, string> = {
  status: 'Status', incoterms: 'Incoterm', incoterm_place: 'Incoterm place',
  movement_type: 'Movement', shipment_mode: 'Mode', shipment_type: 'Shipment type', service_type: 'Service',
  from_port_code: 'Origin (POL)', to_port_code: 'Destination (POD)',
  customer_account_id: 'Customer', customer_name: 'Customer name', customer_po: 'Customer ref',
  shipper: 'Shipper', consignee: 'Consignee', shipper_address: 'Shipper address', consignee_address: 'Consignee address',
  pickup_address: 'Pickup address', drop_address: 'Delivery address',
  carrier: 'Carrier', via_port: 'Via', transit_time_days: 'Transit days',
  total_sell: 'Sell total', total_buy: 'Buy total', net_profit: 'Net profit', margin_pct: 'Margin',
  cargo_description: 'Description', quantity: 'Qty', package_type: 'Package', total_weight: 'Weight',
  container_size: 'Container', container_type: 'Type', qty: 'Qty',
}
function labelFor(k: string): string { return FIELD_LABELS[k] ?? k.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) }

function fmtVal(k: string, v: any): string {
  if (v === null || v === undefined || v === '') return '—'
  if (['total_sell', 'total_buy', 'net_profit'].includes(k)) { const n = Number(v); return isNaN(n) ? String(v) : `$${n.toLocaleString('en-NZ', { maximumFractionDigits: 2 })}` }
  if (k === 'margin_pct') { const n = Number(v); return isNaN(n) ? String(v) : `${n.toFixed(1)}%` }
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  const s = String(v)
  return s.length > 40 ? `${s.slice(0, 40)}…` : s
}

export function humanizeRow(r: AuditRow): AuditEvent {
  const d = r.diff ?? {}
  const base = { id: r.id, createdAt: r.createdAt, actor: r.actorEmail ?? 'System' }
  const changes = r.op === 'U'
    ? Object.entries(d).map(([k, v]) => ({ label: labelFor(k), from: fmtVal(k, (v as any)?.old), to: fmtVal(k, (v as any)?.new) }))
    : []
  const pick = (k: string) => (d[k]?.new ?? d[k])

  if (r.tableName === 'quotes') {
    if (r.op === 'I') return { ...base, kind: 'create', summary: 'Quote created', changes: [] }
    if (r.op === 'D') return { ...base, kind: 'delete', summary: 'Quote deleted', changes: [] }
    if ('status' in d) return { ...base, kind: 'status', summary: `Status ${fmtVal('status', d.status.old)} → ${fmtVal('status', d.status.new)}`, changes: changes.filter((c) => c.label !== 'Status') }
    const first = changes[0]
    return { ...base, kind: 'update', summary: changes.length === 1 && first ? `${first.label}: ${first.from} → ${first.to}` : `${changes.length} field${changes.length === 1 ? '' : 's'} updated`, changes }
  }
  if (r.tableName === 'quote_responses') {
    if (r.op === 'I') return { ...base, kind: 'create', summary: 'Response created', changes: [] }
    if (r.op === 'D') return { ...base, kind: 'delete', summary: 'Response deleted', changes: [] }
    if ('status' in d) return { ...base, kind: 'status', summary: `Response status ${fmtVal('status', d.status.old)} → ${fmtVal('status', d.status.new)}`, changes: changes.filter((c) => c.label !== 'Status') }
    return { ...base, kind: 'update', summary: 'Response updated', changes }
  }
  if (r.tableName === 'rate_requests') {
    if (r.op === 'I') return { ...base, kind: 'send', summary: 'Rate request drafted', changes: [] }
    if (r.op === 'U' && 'status' in d) return { ...base, kind: 'send', summary: `Rate request ${fmtVal('status', d.status.new)}`, changes: [] }
    if (r.op === 'D') return { ...base, kind: 'delete', summary: 'Rate request deleted', changes: [] }
    return { ...base, kind: 'update', summary: 'Rate request updated', changes }
  }
  if (r.tableName === 'quote_cargo_lines') {
    const desc = String(pick('cargo_description') ?? 'cargo line')
    if (r.op === 'I') return { ...base, kind: 'create', summary: `Cargo added: ${desc}`, changes: [] }
    if (r.op === 'D') return { ...base, kind: 'delete', summary: `Cargo removed: ${desc}`, changes: [] }
    return { ...base, kind: 'update', summary: `Cargo changed: ${desc}`, changes }
  }
  if (r.tableName === 'quote_containers') {
    const sz = String(pick('container_size') ?? 'container')
    if (r.op === 'I') return { ...base, kind: 'create', summary: `Container added: ${sz}`, changes: [] }
    if (r.op === 'D') return { ...base, kind: 'delete', summary: `Container removed: ${sz}`, changes: [] }
    return { ...base, kind: 'update', summary: `Container changed: ${sz}`, changes }
  }
  return { ...base, kind: r.op === 'I' ? 'create' : r.op === 'D' ? 'delete' : 'update', summary: `${r.tableName} ${r.op}`, changes }
}

// Collapse replace-save bursts (cargo/containers, same actor within 5s) into one line.
export function buildEvents(rows: AuditRow[]): AuditEvent[] {
  const CHURNY = new Set(['quote_cargo_lines', 'quote_containers'])
  const out: AuditEvent[] = []
  let i = 0
  while (i < rows.length) {
    const r = rows[i]
    if (CHURNY.has(r.tableName)) {
      const t0 = new Date(r.createdAt).getTime()
      let j = i, added = 0, removed = 0, changed = 0
      while (j < rows.length && rows[j].tableName === r.tableName && (rows[j].actorEmail ?? '') === (r.actorEmail ?? '') && Math.abs(new Date(rows[j].createdAt).getTime() - t0) <= 5000) {
        const op = rows[j].op
        if (op === 'I') added++; else if (op === 'D') removed++; else changed++
        j++
      }
      if (j - i > 1) {
        const name = r.tableName === 'quote_cargo_lines' ? 'Cargo' : 'Containers'
        const parts = [added && `${added} added`, removed && `${removed} removed`, changed && `${changed} changed`].filter(Boolean)
        out.push({ id: r.id, createdAt: r.createdAt, actor: r.actorEmail ?? 'System', kind: 'update', summary: `${name} updated (${parts.join(', ')})`, changes: [] })
        i = j
        continue
      }
    }
    out.push(humanizeRow(r))
    i++
  }
  return out
}

import { supabase } from '../../../../supabase'
import { addDays, todayIso } from '../homeModel'

export type Product = {
  id: string; sku: string; description: string | null; category: string | null; supplier: string | null; hs_code: string | null
  unit_value: number | null; currency: string | null; unit_weight_kg: number | null; unit_cbm: number | null; units_per_carton: number | null
}

export type Allocation = { job_unique: number; qty: number; implicit: boolean }
export type PoLine = {
  line_id: string; po_id: string; po_number: string; supplier: string | null; order_date: string | null; required_date: string | null
  po_status: string; currency: string | null; sku: string; description: string | null; qty_ordered: number; unit_price: number | null
  allocations: Allocation[]
}
export type ScShipment = {
  job_unique: number; stage: number; etd: string | null; eta: string | null; departed: string | null; arrived: string | null
  origin: string | null; destination: string | null; mode: string | null; shipper_name: string | null; customer_ref: string | null
  vessel_flight: string | null; shipment_no: string; freight_cost: number
}
export type SupplyChain = { lines: PoLine[]; po_shipments: { po_id: string; job_unique: number }[]; shipments: ScShipment[] }

export async function fetchSupplyChain(): Promise<SupplyChain> {
  const { data, error } = await supabase.rpc('portal_supply_chain')
  if (error) throw new Error('Could not load purchase orders.')
  return data as SupplyChain
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('portal_products')
    .select('id, sku, description, category, supplier, hs_code, unit_value, currency, unit_weight_kg, unit_cbm, units_per_carton')
    .eq('active', true).order('sku').limit(5000)
  if (error) throw new Error('Could not load products.')
  return (data ?? []) as Product[]
}

export async function importRows(kind: 'products' | 'po', rows: Record<string, unknown>[]): Promise<Record<string, number>> {
  const fn = kind === 'products' ? 'portal_import_products' : 'portal_import_po_lines'
  const { data, error } = await supabase.rpc(fn, { p_rows: rows })
  if (error) throw new Error(error.message.replace(/^.*?:\s*/, '') || 'Upload failed')
  return data as Record<string, number>
}

export async function allocate(lineId: string, jobUnique: number, qty: number): Promise<void> {
  const { error } = await supabase.from('portal_po_allocations').upsert({ po_line_id: lineId, job_unique: jobUnique, qty }, { onConflict: 'po_line_id,job_unique' })
  if (error) throw new Error('Could not save. Check the quantity and shipment.')
}

export async function unallocate(lineId: string, jobUnique: number): Promise<void> {
  const { error } = await supabase.from('portal_po_allocations').delete().eq('po_line_id', lineId).eq('job_unique', jobUnique)
  if (error) throw new Error('Could not remove.')
}

export async function setPoStatus(poId: string, status: 'open' | 'closed' | 'cancelled'): Promise<void> {
  const { error } = await supabase.from('portal_purchase_orders').update({ status }).eq('id', poId)
  if (error) throw new Error('Could not update the PO.')
}

export type RecentShipment = { job_unique: number; label: string; eta: string | null }
export async function fetchRecentShipments(): Promise<RecentShipment[]> {
  const { data } = await supabase.from('portal_shipments')
    .select('job_unique, module, job_no, shipment_no, consol_key, shipper_name, eta, customer_ref, stage')
    .gte('doc_date', addDays(todayIso(), -180)).order('doc_date', { ascending: false }).limit(300)
  return ((data ?? []) as Record<string, any>[]).map((s) => {
    const no = String(s.module ?? '').startsWith('FI') ? `${s.module}-${s.shipment_no}${Number(s.job_no) > 1 ? `/${s.job_no}` : ''}` : String(s.job_no ?? s.consol_key)
    return { job_unique: s.job_unique, eta: s.eta, label: `${no} · ${s.shipper_name ?? ''}${s.customer_ref ? ` · ${s.customer_ref}` : ''}` }
  })
}

// ---------- derived model ----------
export type Where = 'booked' | 'transit' | 'arrived'
export const whereOf = (s: ScShipment | undefined): Where => (!s ? 'booked' : s.stage >= 3 ? 'arrived' : s.stage === 2 ? 'transit' : 'booked')
const arrivalOf = (s: ScShipment) => s.arrived ?? (s.stage >= 3 ? s.eta : null)
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

export type SkuRow = {
  sku: string; description: string | null; supplier: string | null; product?: Product
  ordered: number; booked: number; transit: number; arrived: number; open: number
  nextEta: string | null; leadDays: number | null; freightPerUnit: number | null; pos: number; lastOrder: string | null
}

/** Freight per shipment split across its PO lines by value (qty x price), else by quantity. */
function freightShares(sc: SupplyChain): Map<string, number> {
  const ship = new Map(sc.shipments.map((s) => [s.job_unique, s]))
  const byJob = new Map<number, { key: string; w: number }[]>()
  for (const l of sc.lines) for (const a of l.allocations) {
    const list = byJob.get(a.job_unique) ?? []
    list.push({ key: `${l.line_id}|${a.job_unique}`, w: a.qty * (l.unit_price ?? 0) || a.qty })
    byJob.set(a.job_unique, list)
  }
  const out = new Map<string, number>()
  for (const [job, parts] of byJob) {
    const cost = ship.get(job)?.freight_cost ?? 0
    const total = parts.reduce((n, p) => n + p.w, 0)
    if (!cost || !total) continue
    for (const p of parts) out.set(p.key, (cost * p.w) / total)
  }
  return out
}

export function skuRows(sc: SupplyChain, products: Product[]): SkuRow[] {
  const ship = new Map(sc.shipments.map((s) => [s.job_unique, s]))
  const shares = freightShares(sc)
  const prod = new Map(products.map((p) => [p.sku, p]))
  const rows = new Map<string, SkuRow & { _lead: number[]; _cost: number; _costQty: number }>()
  const get = (sku: string, l?: PoLine) => {
    let r = rows.get(sku)
    if (!r) {
      const p = prod.get(sku)
      r = { sku, description: p?.description ?? l?.description ?? null, supplier: p?.supplier ?? l?.supplier ?? null, product: p,
        ordered: 0, booked: 0, transit: 0, arrived: 0, open: 0, nextEta: null, leadDays: null, freightPerUnit: null, pos: 0, lastOrder: null,
        _lead: [], _cost: 0, _costQty: 0 }
      rows.set(sku, r)
    }
    return r
  }
  for (const p of products) get(p.sku)
  for (const l of sc.lines) {
    if (l.po_status === 'cancelled') continue
    const r = get(l.sku, l)
    r.pos += 1
    r.ordered += l.qty_ordered
    if (l.order_date && (!r.lastOrder || l.order_date > r.lastOrder)) r.lastOrder = l.order_date
    let alloc = 0
    for (const a of l.allocations) {
      const s = ship.get(a.job_unique)
      const w = whereOf(s)
      r[w] += a.qty
      alloc += a.qty
      if (s && w !== 'arrived' && s.eta && (!r.nextEta || s.eta < r.nextEta)) r.nextEta = s.eta
      const arr = s ? arrivalOf(s) : null
      if (arr && l.order_date) r._lead.push(days(l.order_date, arr))
      const c = shares.get(`${l.line_id}|${a.job_unique}`)
      if (c) { r._cost += c; r._costQty += a.qty }
    }
    if (l.po_status === 'open') r.open += Math.max(0, l.qty_ordered - alloc)
  }
  return [...rows.values()].map(({ _lead, _cost, _costQty, ...r }) => ({
    ...r,
    leadDays: _lead.length ? Math.round(_lead.reduce((a, b) => a + b, 0) / _lead.length) : null,
    freightPerUnit: _costQty ? _cost / _costQty : null,
  }))
}

export type PoRow = {
  po_id: string; po_number: string; supplier: string | null; order_date: string | null; required_date: string | null; status: string; currency: string | null
  lines: PoLine[]; ordered: number; shipped: number; arrived: number; value: number; jobs: number[]; health: 'open' | 'partial' | 'transit' | 'arrived' | 'late' | 'closed'
}

export function poRows(sc: SupplyChain): PoRow[] {
  const ship = new Map(sc.shipments.map((s) => [s.job_unique, s]))
  const map = new Map<string, PoRow>()
  for (const l of sc.lines) {
    let p = map.get(l.po_id)
    if (!p) {
      p = { po_id: l.po_id, po_number: l.po_number, supplier: l.supplier, order_date: l.order_date, required_date: l.required_date, status: l.po_status,
        currency: l.currency, lines: [], ordered: 0, shipped: 0, arrived: 0, value: 0, jobs: [], health: 'open' }
      map.set(l.po_id, p)
    }
    p.lines.push(l)
    p.ordered += l.qty_ordered
    p.value += l.qty_ordered * (l.unit_price ?? 0)
    for (const a of l.allocations) {
      p.shipped += a.qty
      if (whereOf(ship.get(a.job_unique)) === 'arrived') p.arrived += a.qty
      if (!p.jobs.includes(a.job_unique)) p.jobs.push(a.job_unique)
    }
  }
  for (const ps of sc.po_shipments) { const p = map.get(ps.po_id); if (p && !p.jobs.includes(ps.job_unique)) p.jobs.push(ps.job_unique) }
  const today = todayIso()
  for (const p of map.values()) {
    const open = p.ordered - p.shipped
    p.health = p.status !== 'open' ? 'closed'
      : p.arrived >= p.ordered && p.ordered > 0 ? 'arrived'
      : open > 0 && p.required_date && p.required_date < today ? 'late'
      : p.shipped >= p.ordered && p.ordered > 0 ? 'transit'
      : p.shipped > 0 ? 'partial' : 'open'
  }
  return [...map.values()]
}

export const HEALTH: Record<PoRow['health'], { label: string; tone: 'grey' | 'blue' | 'green' | 'red' | 'amber' }> = {
  open: { label: 'Not shipped', tone: 'grey' },
  partial: { label: 'Partly shipped', tone: 'amber' },
  transit: { label: 'All shipped', tone: 'blue' },
  arrived: { label: 'Arrived', tone: 'green' },
  late: { label: 'Behind schedule', tone: 'red' },
  closed: { label: 'Closed', tone: 'grey' },
}

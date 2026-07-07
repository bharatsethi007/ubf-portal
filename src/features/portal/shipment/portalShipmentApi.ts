import { supabase } from '../../../supabase'
import type { Container } from '../../../types/container'
import type { Invoice } from '../../../types/invoice'
import { buildShipmentTimeline } from './portalShipmentTimeline'
import { buildShipmentTasks } from './portalShipmentTasks'
import type { PortalShipmentBundle, PortalShipmentDetail } from './portalShipmentDetailTypes'

const DETAIL_SELECT = `
  job_unique, module, mode, direction, house_bill, job_no, shipment_no,
  origin, destination, vessel_flight, etd, eta, departed, arrived, doc_date,
  relevant_date, created_src, shipper_name, consignee_name, customer_ref, load_type,
  consol_key, goods_desc, pack_qty, pack_type, weight_kg, volume_m3, marks, final_dest,
  master_bill, status, customers ( name )
`

const INVOICE_SELECT =
  'invoice_no, doctype, module, job_unique, doc_date, date_due, amt_local, balance, tax_amount, currency'

/** Resolve route param (job no / house bill / #job_unique) under RLS. */
export async function fetchPortalShipment(jobNoParam: string): Promise<PortalShipmentDetail | null> {
  const key = decodeURIComponent(jobNoParam.trim())
  if (!key) return null

  if (key.startsWith('#')) {
    const ju = Number(key.slice(1))
    if (!Number.isFinite(ju)) return null
    return fetchByFilter('job_unique', ju)
  }

  if (/^\d+$/.test(key)) {
    const n = Number(key)
    const { data: byJobNo } = await supabase
      .from('shipments')
      .select(DETAIL_SELECT)
      .eq('job_no', n)
      .order('relevant_date', { ascending: false, nullsFirst: false })
      .limit(2)
    if (byJobNo?.length === 1) return byJobNo[0] as PortalShipmentDetail
    if ((byJobNo?.length ?? 0) > 1) return byJobNo![0] as PortalShipmentDetail
    return fetchByFilter('job_unique', n)
  }

  const { data: byBill } = await supabase
    .from('shipments')
    .select(DETAIL_SELECT)
    .eq('house_bill', key)
    .order('relevant_date', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  return (byBill as PortalShipmentDetail | null) ?? null
}

async function fetchByFilter(col: string, val: string | number): Promise<PortalShipmentDetail | null> {
  const { data, error } = await supabase
    .from('shipments')
    .select(DETAIL_SELECT)
    .eq(col, val)
    .maybeSingle()
  if (error || !data) return null
  return data as PortalShipmentDetail
}

async function fetchContainers(consolKey: string | null, mode: string | null): Promise<Container[]> {
  if (!consolKey || mode !== 'sea') return []
  const { data, error } = await supabase
    .from('containers')
    .select('c_number, seal, container_size, avail_from, avail_to')
    .eq('consol_key', consolKey)
    .order('c_number')

  if (error || !data) return []

  const seen = new Set<string>()
  const rows: Container[] = []
  for (const row of data) {
    const num = String(row.c_number ?? '').trim()
    if (!num || seen.has(num)) continue
    seen.add(num)
    rows.push(row as Container)
  }
  return rows
}

async function fetchInvoices(jobUnique: number): Promise<Invoice[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('job_unique', jobUnique)
    .order('doc_date', { ascending: false })
  if (error || !data) return []
  return data as Invoice[]
}

export async function loadPortalShipmentBundle(jobNoParam: string): Promise<PortalShipmentBundle | null> {
  const shipment = await fetchPortalShipment(jobNoParam)
  if (!shipment) return null

  const [containers, invoices] = await Promise.all([
    fetchContainers(shipment.consol_key, shipment.mode),
    fetchInvoices(shipment.job_unique),
  ])

  const timeline = buildShipmentTimeline(shipment)
  const tasks = buildShipmentTasks(shipment)

  return { shipment, containers, invoices, timeline, tasks }
}

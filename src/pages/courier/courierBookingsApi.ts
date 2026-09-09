import { supabase } from '../../supabase'
import type { CourierShipment } from './courierShipmentTypes'

const LIST_SELECT =
  'id,booking_ref,carrier,service,status,waybill_no,shipper_name,shipper_company,shipper_city,shipper_country,receiver_name,receiver_company,receiver_city,receiver_country,created_at'

export type CourierShipmentListRow = {
  id: string
  booking_ref: string | null
  carrier: string | null
  service: string | null
  status: string | null
  waybill_no: string | null
  shipper_name: string | null
  shipper_company: string | null
  shipper_city: string | null
  shipper_country: string | null
  receiver_name: string | null
  receiver_company: string | null
  receiver_city: string | null
  receiver_country: string | null
  created_at: string
}

export type ListCourierShipmentsArgs = {
  q?: string
  status?: string
  page: number
  pageSize?: number
}

export async function listCourierShipments(args: ListCourierShipmentsArgs): Promise<{ rows: CourierShipmentListRow[]; total: number }> {
  const pageSize = args.pageSize ?? 50
  const from = (args.page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('courier_shipments')
    .select(LIST_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })

  const term = (args.q ?? '').trim()
  if (term) {
    query = query.or(
      `booking_ref.ilike.%${term}%,waybill_no.ilike.%${term}%,shipper_name.ilike.%${term}%,receiver_name.ilike.%${term}%`,
    )
  }

  if (args.status) query = query.eq('status', args.status)

  const { data, error, count } = await query.range(from, to)
  if (error) throw error

  return { rows: (data ?? []) as CourierShipmentListRow[], total: count ?? 0 }
}

export async function getCourierShipment(id: string): Promise<CourierShipment> {
  const { data, error } = await supabase.from('courier_shipments').select('*').eq('id', id).single()
  if (error) throw error
  return data as CourierShipment
}

export async function getCourierLabelUrl(labelPath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('courier-labels').createSignedUrl(labelPath, 300)
  if (error) throw error
  if (!data?.signedUrl) throw new Error('No signed URL returned')
  return data.signedUrl
}

import { supabase } from '@/supabase'

export type CalRow = {
  id: string; consignment_no: string | null; status: string; order_type: string
  sender_company: string | null; receiver_company: string | null
  preferred_pickup_at: string | null; preferred_delivery_at: string | null
  assigned_driver_leg1: string | null
}

export async function listCalendarConsignments(dayStartISO: string, dayEndISO: string): Promise<CalRow[]> {
  const { data, error } = await supabase.from('tms_consignments')
    .select('id,consignment_no,status,order_type,sender_company,receiver_company,preferred_pickup_at,preferred_delivery_at,assigned_driver_leg1')
    .eq('archived', false)
    .gte('preferred_pickup_at', dayStartISO).lt('preferred_pickup_at', dayEndISO)
    .order('preferred_pickup_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as CalRow[]
}

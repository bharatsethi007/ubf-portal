import { supabase } from '../../supabase'
import { bookingModuleToTwCode, type BookingModule } from '../../types/booking'

export type ReferenceJob = {
  job_unique?: number
  house_bill: string | null
  master_bill?: string | null
  status: string | null
  origin: string | null
  destination: string | null
  relevant_date: string | null
  vessel_flight: string | null
  goods_desc: string | null
  pack_qty: number | null
  pack_type: string | null
  weight_kg: number | null
  volume_m3?: number | null
  commodity?: string | null
  score?: number | null
  same_lane?: boolean | null
  etd?: string | null
  eta?: string | null
  mode?: string | null
  direction?: string | null
  module?: string | null
}

export type JobsReferenceParams = {
  shipperAccountId?: string | null
  consigneeAccountId?: string | null
  origin?: string | null
  destination?: string | null
  module?: string | null
}

export function isSameLane(job: ReferenceJob): boolean {
  if (job.same_lane) return true
  return job.score != null && job.score >= 1
}

export async function fetchJobsReference(params: JobsReferenceParams): Promise<ReferenceJob[]> {
  const twModule = params.module
    ? (['EA', 'ES', 'IA', 'IS'].includes(params.module)
      ? bookingModuleToTwCode(params.module as BookingModule)
      : params.module)
    : null

  const rpcArgs = {
    p_shipper_account: params.shipperAccountId || null,
    p_consignee_account: params.consigneeAccountId || null,
    p_origin: params.origin || null,
    p_destination: params.destination || null,
    p_module: twModule,
  }

  console.log('[get_jobs_reference] args', rpcArgs)

  const { data, error } = await supabase.rpc('get_jobs_reference', rpcArgs)

  if (error) {
    console.error('[get_jobs_reference] error', error)
    throw error
  }

  console.log('[get_jobs_reference] rows', data?.length ?? 0, data)
  return (data ?? []) as ReferenceJob[]
}

export function formatRefDate(d: string | null | undefined): string {
  if (!d) return '—'
  const iso = d.includes('T') ? d : `${d}T00:00:00`
  const t = new Date(iso)
  return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function statusTone(status: string | null): 'arrived' | 'transit' | 'slate' {
  const s = (status ?? '').toLowerCase()
  if (s.includes('arriv')) return 'arrived'
  if (s.includes('transit') || s.includes('depart')) return 'transit'
  return 'slate'
}

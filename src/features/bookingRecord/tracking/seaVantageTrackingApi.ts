import { supabase } from '@/supabase'

export type SvRefreshSummary = {
  ok?: boolean
  skipped?: boolean
  reason?: string
  carrier?: string | null
  sv_carrier_code?: string | null
  containers_registered: number
  containers_found: number
  events_written: number
  positions_written: number
  containers_no_data: string[]
  last_refreshed_at: string
  error?: string
}

type FnPayload = { error?: string; message?: string } & Partial<SvRefreshSummary>
type InvokeError = Error & { context?: Response }

async function readFnErrorPayload(error: InvokeError | null): Promise<FnPayload | null> {
  if (!error?.context) return null
  try { return (await error.context.json()) as FnPayload } catch { return null }
}

export async function refreshSeaVantage(bookingId: string): Promise<SvRefreshSummary> {
  const { data, error } = await supabase.functions.invoke('seavantage-refresh', {
    body: { booking_id: bookingId },
  })
  const payload = ((data as FnPayload | null) ??
    (await readFnErrorPayload(error as InvokeError | null))) as FnPayload | null
  if (error || payload?.error) {
    const msg = payload?.message ?? payload?.error ?? error?.message ?? 'SeaVantage refresh failed'
    throw new Error(msg)
  }
  return data as SvRefreshSummary
}

export type ShippingLineRoute =
  | { route: 'maersk'; line: string }
  | { route: 'seavantage'; line: string; verified: boolean; svCode: string | null }
  | { route: 'unmapped'; line: string }
  | { route: 'none' }

export async function resolveShippingLineRoute(bookingId: string): Promise<ShippingLineRoute> {
  const { data } = await supabase.rpc('resolve_booking_carrier', { p_booking_id: bookingId })
  const row = (Array.isArray(data) ? data[0] : data) as
    | { line_code: string; sv_carrier_code: string | null; is_maersk: boolean; verified: boolean }
    | null | undefined
  if (!row?.line_code) return { route: 'none' }
  if (row.is_maersk) return { route: 'maersk', line: row.line_code }
  return { route: 'seavantage', line: row.line_code, verified: Boolean(row.verified), svCode: row.sv_carrier_code ?? null }
}

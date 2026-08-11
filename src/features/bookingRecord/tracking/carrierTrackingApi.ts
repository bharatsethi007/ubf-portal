import { supabase } from '@/supabase'

export type CarrierRefreshSummary = {
  ok?: boolean
  containers_found: number
  events_written: number
  containers_not_recognised: string[]
  matched_carrier?: string | null
  last_refreshed_at: string
  error?: string
}

type FnPayload = { error?: string; message?: string } & Partial<CarrierRefreshSummary>
type InvokeError = Error & { context?: Response }

async function readFnErrorPayload(error: InvokeError | null): Promise<FnPayload | null> {
  if (!error?.context) return null
  try {
    return (await error.context.json()) as FnPayload
  } catch {
    return null
  }
}

export async function refreshCarrier(bookingId: string): Promise<CarrierRefreshSummary> {
  const { data, error } = await supabase.functions.invoke('carrier-refresh', {
    body: { booking_id: bookingId },
  })
  const payload = ((data as FnPayload | null) ??
    (await readFnErrorPayload(error as InvokeError | null))) as FnPayload | null

  if (error || payload?.error) {
    const msg = payload?.message ?? payload?.error ?? error?.message ?? 'Carrier refresh failed'
    throw new Error(msg)
  }
  return data as CarrierRefreshSummary
}

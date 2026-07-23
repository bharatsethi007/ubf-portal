import { supabase } from '@/supabase'
import type { PortConnectRefreshSummary } from './trackingTypes'

type FnPayload = { error?: string; message?: string; ok?: boolean; subscribed?: string[] }

type InvokeError = Error & { context?: Response }

async function readFnErrorPayload(error: InvokeError | null): Promise<FnPayload | null> {
  if (!error?.context) return null
  try {
    return (await error.context.json()) as FnPayload
  } catch {
    return null
  }
}

async function invokeTrackingFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  const payload = ((data as FnPayload | null) ??
    (await readFnErrorPayload(error as InvokeError | null))) as FnPayload | null

  if (error || payload?.error) {
    const msg = payload?.message ?? payload?.error ?? error?.message ?? `${name} failed`
    throw new Error(msg)
  }
  return data as T
}

export async function subscribePortConnect(
  bookingId: string,
  containerNumbers: string[],
): Promise<{ subscribed: string[] }> {
  return invokeTrackingFn('portconnect-subscribe', {
    booking_id: bookingId,
    container_numbers: containerNumbers,
  })
}

export async function unsubscribePortConnect(
  bookingId: string,
  containerNo?: string,
): Promise<void> {
  await invokeTrackingFn('portconnect-unsubscribe', {
    booking_id: bookingId,
    ...(containerNo ? { container_no: containerNo } : {}),
  })
}

export async function refreshPortConnect(
  bookingId: string,
): Promise<PortConnectRefreshSummary> {
  return invokeTrackingFn('portconnect-refresh', { booking_id: bookingId })
}

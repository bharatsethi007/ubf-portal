import { supabase } from '../../../../supabase'

export type WaStatus = { linked: boolean; masked?: string; opted_in?: boolean }

type FnPayload = { ok?: boolean; error?: string; message?: string; to_masked?: string; remaining?: number }
type InvokeError = Error & { context?: Response }

/** The signed-in user's own linked WhatsApp number, if any. */
export async function fetchWaStatus(): Promise<WaStatus> {
  const { data, error } = await supabase.rpc('portal_wa_status')
  if (error) return { linked: false }
  return (data as WaStatus) ?? { linked: false }
}

async function verify(body: Record<string, unknown>): Promise<FnPayload> {
  const { data, error } = await supabase.functions.invoke('whatsapp-verify', { body })
  if (data) return data as FnPayload
  const ctx = (error as InvokeError | null)?.context
  if (ctx) {
    try { return (await ctx.json()) as FnPayload } catch { /* fall through */ }
  }
  return { error: 'network' }
}

export async function sendWaCode(number: string): Promise<{ ok: true; toMasked: string } | { ok: false; message: string }> {
  const r = await verify({ action: 'start', wa_id: number, consent: true })
  if (r.ok) return { ok: true, toMasked: r.to_masked ?? number }
  if (r.error === 'rate_limited') return { ok: false, message: 'Too many attempts. Try again in an hour.' }
  if (r.error === 'send_failed' || r.error === 'invalid_number') return { ok: false, message: "We couldn't send a code to that number. Check it includes the country code." }
  return { ok: false, message: 'Something went wrong. Try again.' }
}

export async function confirmWaCode(number: string, code: string): Promise<{ ok: true } | { ok: false; message: string; restart?: boolean }> {
  const r = await verify({ action: 'confirm', wa_id: number, code })
  if (r.ok) return { ok: true }
  if (r.error === 'invalid_code') {
    const left = r.remaining ?? 0
    return { ok: false, message: `Wrong code. ${left} attempt${left === 1 ? '' : 's'} left.` }
  }
  if (r.error === 'no_active_code' || r.error === 'too_many_attempts') return { ok: false, message: 'This code has expired. Send a new one.', restart: true }
  return { ok: false, message: r.message ?? 'Could not verify. Try again.' }
}

import { supabase } from '@/supabase'

/**
 * bookings.account_id must be a row in customers. Agent accounts such as UBNAN (UBF Fiji) live in the
 * ERP account list but not in customers, so they can only be the bill-to, never the booking's account.
 */
export async function bookingAccountId(candidates: (string | null | undefined)[]): Promise<string | null> {
  const ids = [...new Set(candidates.filter((x): x is string => !!x))]
  if (!ids.length) return null
  const { data } = await supabase.from('customers').select('account_id').in('account_id', ids)
  const ok = new Set((data ?? []).map((r) => r.account_id as string))
  return ids.find((id) => ok.has(id)) ?? null
}

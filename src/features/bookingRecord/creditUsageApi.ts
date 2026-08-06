import { supabase } from '../../supabase'

export type CreditUsage = { credit_limit: number | null; outstanding: number }

export async function fetchCreditUsage(accountId: string): Promise<CreditUsage | null> {
  const { data, error } = await supabase.rpc('get_account_credit_usage', { p_account_id: accountId })
  if (error) throw error
  const row = (data as CreditUsage[] | null)?.[0]
  return row ?? null
}

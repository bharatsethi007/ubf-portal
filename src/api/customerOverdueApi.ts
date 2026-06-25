import { supabase } from '../supabase'

export type CustomerOverdue = {
  overdue_count: number
  overdue_amount: number
  currency: string
  oldest_due: string | null
}

export function isOverdueSevere(count: number, amount: number): boolean {
  return count >= 5 || amount >= 5000
}

function parseOverdueRow(raw: unknown): CustomerOverdue | null {
  if (raw == null || typeof raw !== 'object') return null

  const r = raw as Record<string, unknown>
  const count = Number(r.overdue_count ?? 0)
  if (!Number.isFinite(count) || count <= 0) return null

  const amount = Number(r.overdue_amount ?? 0)
  return {
    overdue_count: count,
    overdue_amount: Number.isFinite(amount) ? amount : 0,
    currency: typeof r.currency === 'string' && r.currency ? r.currency : 'NZD',
    oldest_due: typeof r.oldest_due === 'string' ? r.oldest_due : null,
  }
}

export async function fetchCustomerOverdue(
  accountId: string,
  days = 30,
): Promise<CustomerOverdue | null> {
  const { data, error } = await supabase.rpc('get_customer_overdue', {
    p_account_id: accountId,
    p_days: days,
  })
  if (error) return null

  const row = Array.isArray(data) ? data[0] : data
  return parseOverdueRow(row)
}

export async function fetchOverdueBatch(
  accountIds: string[],
  days = 30,
): Promise<Record<string, CustomerOverdue>> {
  const unique = [...new Set(accountIds.map((id) => id.trim()).filter(Boolean))]
  if (unique.length === 0) return {}

  const { data, error } = await supabase.rpc('get_overdue_batch', {
    p_account_ids: unique,
    p_days: days,
  })
  if (error || data == null || typeof data !== 'object' || Array.isArray(data)) return {}

  const map: Record<string, CustomerOverdue> = {}
  for (const [accountId, raw] of Object.entries(data as Record<string, unknown>)) {
    const parsed = parseOverdueRow(raw)
    if (parsed) map[accountId] = parsed
  }
  return map
}

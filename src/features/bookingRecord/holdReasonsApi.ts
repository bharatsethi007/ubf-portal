import { supabase } from '@/supabase'

export type HoldReason = {
  code: string
  label: string
  sort_order: number | null
}

export async function fetchHoldReasons(): Promise<HoldReason[]> {
  const { data, error } = await supabase
    .from('hold_reasons')
    .select('code, label, sort_order')
    .eq('active', true)
    .order('sort_order')
  if (error) throw error
  return (data ?? []) as HoldReason[]
}

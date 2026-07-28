import { supabase } from '../../../supabase'

export type AtfFacility = {
  atf_code: number
  facility: string
  address: string | null
  city: string | null
}

export async function fetchAtfFacility(atfRaw: string | null | undefined): Promise<AtfFacility | null> {
  if (!atfRaw) return null
  const code = parseInt(String(atfRaw).trim(), 10)
  if (!Number.isFinite(code)) return null
  const { data } = await supabase
    .from('atf_facilities')
    .select('atf_code, facility, address, city')
    .eq('atf_code', code)
    .maybeSingle()
  return data ?? null
}

export function formatAtfAddress(f: AtfFacility | null): string {
  if (!f) return ''
  const parts = [f.facility, f.address, f.city].map((p) => (p ?? '').trim()).filter(Boolean)
  return parts.join(', ')
}

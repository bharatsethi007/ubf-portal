import { supabase } from '@/supabase'

export type PartyResult = {
  source: 'customer' | 'address_book'
  key: string
  company: string
  address: string
  additional_info?: string
  contact?: string
  phone?: string
  email?: string
}

function customerAddress(c: any): string {
  return [c.address1, c.address2, c.address3, c.city, c.postcode, c.country].filter(Boolean).join(', ')
}

export async function searchParties(q: string): Promise<PartyResult[]> {
  const s = q.trim()
  if (s.length < 2) return []
  const [cust, book] = await Promise.all([
    supabase.from('customers').select('account_id,name,address1,address2,address3,city,postcode,country,phone,email,contact').ilike('name', `%${s}%`).eq('closed', false).limit(6),
    supabase.from('tms_address_book').select('id,company_name,address,additional_info,contact_name,phone,email').ilike('company_name', `%${s}%`).limit(6),
  ])
  const out: PartyResult[] = []
  ;(cust.data ?? []).forEach((c: any) => out.push({ source: 'customer', key: `c:${c.account_id}`, company: c.name, address: customerAddress(c), contact: c.contact ?? '', phone: c.phone ?? '', email: c.email ?? '' }))
  ;(book.data ?? []).forEach((b: any) => out.push({ source: 'address_book', key: `b:${b.id}`, company: b.company_name, address: b.address ?? '', additional_info: b.additional_info ?? '', contact: b.contact_name ?? '', phone: b.phone ?? '', email: b.email ?? '' }))
  return out
}

export type AddressBookEntry = { id: string; company_name: string; address: string | null; additional_info: string | null; contact_name: string | null; phone: string | null; email: string | null }

export async function listAddressBook(q?: string): Promise<AddressBookEntry[]> {
  let query = supabase.from('tms_address_book').select('id,company_name,address,additional_info,contact_name,phone,email').order('company_name').limit(50)
  if (q && q.trim()) query = query.ilike('company_name', `%${q.trim()}%`)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as AddressBookEntry[]
}

export async function addAddressBook(p: { company: string; address: string; additional_info?: string; contact?: string; phone?: string; email?: string }) {
  const { error } = await supabase.from('tms_address_book').insert({
    company_name: p.company, address: p.address || null, additional_info: p.additional_info || null,
    contact_name: p.contact || null, phone: p.phone || null, email: p.email || null,
  })
  if (error) throw error
}

export async function deleteAddressBook(id: string) {
  const { error } = await supabase.from('tms_address_book').delete().eq('id', id)
  if (error) throw error
}

export type DupePair = { a_id: string; a_company: string; a_address: string | null; b_id: string; b_company: string; b_address: string | null; sim: number }

export async function findDuplicates(): Promise<DupePair[]> {
  const { data, error } = await supabase.rpc('tms_address_book_dupes', { threshold: 0.45 })
  if (error) throw error
  return (data ?? []) as DupePair[]
}

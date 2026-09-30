import { supabase } from '../../../../supabase'
import type { PlaceValue } from './googlePlaces'

export type ContactRole = 'shipper' | 'consignee' | 'both'

/** One party in the customer's address book, and the same shape a booking carries. */
export type Party = {
  company: string
  contact_name: string
  email: string
  phone: string
  address: string
  street: string
  city: string
  region: string
  postcode: string
  country: string
  country_code: string
  place_id: string
  lat: number | null
  lng: number | null
}

export type Contact = Party & { id: string; role: ContactRole; notes: string; updated_at: string }

export const EMPTY_PARTY: Party = {
  company: '', contact_name: '', email: '', phone: '', address: '', street: '', city: '', region: '',
  postcode: '', country: '', country_code: '', place_id: '', lat: null, lng: null,
}

export const ROLE_LABEL: Record<ContactRole, string> = { shipper: 'Shipper', consignee: 'Consignee', both: 'Shipper and consignee' }

const COLS = 'id, role, company, contact_name, email, phone, address, street, city, region, postcode, country, country_code, place_id, lat, lng, notes, updated_at'
const s = (v: unknown) => (v == null ? '' : String(v))

function toContact(r: Record<string, unknown>): Contact {
  return {
    id: s(r.id), role: (r.role as ContactRole) ?? 'both', company: s(r.company), contact_name: s(r.contact_name), email: s(r.email),
    phone: s(r.phone), address: s(r.address), street: s(r.street), city: s(r.city), region: s(r.region), postcode: s(r.postcode),
    country: s(r.country), country_code: s(r.country_code), place_id: s(r.place_id),
    lat: r.lat == null ? null : Number(r.lat), lng: r.lng == null ? null : Number(r.lng), notes: s(r.notes), updated_at: s(r.updated_at),
  }
}

export async function listContacts(): Promise<Contact[]> {
  const { data, error } = await supabase.from('portal_contacts').select(COLS).order('company')
  if (error) throw new Error('Contacts could not load.')
  return (data ?? []).map((r) => toContact(r as Record<string, unknown>))
}

const nul = (v: string) => (v.trim() ? v.trim() : null)

function row(c: Party & { role: ContactRole; notes?: string }) {
  return {
    role: c.role, company: c.company.trim(), contact_name: nul(c.contact_name), email: nul(c.email), phone: nul(c.phone),
    address: nul(c.address), street: nul(c.street), city: nul(c.city), region: nul(c.region), postcode: nul(c.postcode),
    country: nul(c.country), country_code: nul(c.country_code.toUpperCase()), place_id: nul(c.place_id), lat: c.lat, lng: c.lng,
    notes: nul(c.notes ?? ''),
  }
}

export async function saveContact(c: Party & { id?: string; role: ContactRole; notes?: string }): Promise<Contact> {
  if (!c.company.trim()) throw new Error('Add the company name.')
  const q = c.id
    ? supabase.from('portal_contacts').update(row(c)).eq('id', c.id).select(COLS).single()
    : supabase.from('portal_contacts').insert(row(c)).select(COLS).single()
  const { data, error } = await q
  if (error || !data) throw new Error('Contact could not be saved.')
  return toContact(data as Record<string, unknown>)
}

export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase.from('portal_contacts').delete().eq('id', id)
  if (error) throw new Error('Contact could not be deleted.')
}

/** Apply a Google place to a party; fills the company too when the place is a business and none is set. */
export function withPlace(p: Party, g: PlaceValue): Party {
  return {
    ...p, address: g.address, street: g.street ?? '', city: g.city ?? '', region: g.region ?? '', postcode: g.postcode ?? '',
    country: g.country ?? '', country_code: g.country_code ?? '', place_id: g.place_id ?? '', lat: g.lat, lng: g.lng,
    company: p.company || g.name || '',
  }
}

export const fromContact = (c: Contact): Party => {
  const { id: _i, role: _r, notes: _n, updated_at: _u, ...party } = c
  return party
}

export const partyLine = (p: Party) => [p.contact_name, p.address || [p.city, p.country].filter(Boolean).join(', ')].filter(Boolean).join(' · ')

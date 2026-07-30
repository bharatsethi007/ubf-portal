import { supabase } from '../../supabase'

export type SavedParty = {
  id: string
  kind: 'shipper' | 'consignee'
  name: string
  contact: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  postcode: string | null
  country: string | null
  account_id: string | null
}

type SavedPartyRow = {
  id: string
  kind: string
  name: string
  contact: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  state: string | null
  postcode: string | null
  country: string | null
  account_id: string | null
}

const PARTY_COLUMNS = 'id, kind, name, contact, phone, email, address, city, state, postcode, country, account_id'

function mapParty(row: SavedPartyRow): SavedParty {
  return {
    id: String(row.id),
    kind: row.kind as SavedParty['kind'],
    name: String(row.name),
    contact: row.contact,
    phone: row.phone,
    email: row.email,
    address: row.address,
    city: row.city,
    state: row.state,
    postcode: row.postcode,
    country: row.country,
    account_id: row.account_id,
  }
}

export async function searchSavedParties(kind: 'shipper' | 'consignee', term: string): Promise<SavedParty[]> {
  const q = term.trim()
  if (q.length < 2) return []
  const { data, error } = await supabase
    .from('saved_parties')
    .select(PARTY_COLUMNS)
    .eq('kind', kind)
    .ilike('name', `%${q}%`)
    .limit(8)
  if (error) throw error
  return ((data ?? []) as SavedPartyRow[]).map(mapParty)
}

export async function createSavedParty(payload: Omit<SavedParty, 'id'>): Promise<SavedParty> {
  const { data, error } = await supabase
    .from('saved_parties')
    .insert({
      kind: payload.kind,
      name: payload.name,
      contact: payload.contact,
      phone: payload.phone,
      email: payload.email,
      address: payload.address,
      city: payload.city,
      state: payload.state,
      postcode: payload.postcode,
      country: payload.country,
      account_id: payload.account_id,
    })
    .select(PARTY_COLUMNS)
    .single()
  if (error) throw error
  return mapParty(data as SavedPartyRow)
}

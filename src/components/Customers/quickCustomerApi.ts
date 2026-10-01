import { supabase } from '../../supabase'
import type { CustomerPickerValue } from '../../hooks/useBookings'

export type NewCustomerInput = {
  name: string
  contact?: string
  email?: string
  phone?: string
  address1?: string
  city?: string
  postcode?: string
  country?: string
  isImporter?: boolean
  isExporter?: boolean
}

/** Creates a portal-only customer (source='portal', account_id P-00001...). Staff only. */
export async function createPortalCustomer(input: NewCustomerInput): Promise<CustomerPickerValue> {
  const { data, error } = await supabase.rpc('create_portal_customer', {
    p_name: input.name,
    p_contact: input.contact || null,
    p_email: input.email || null,
    p_phone: input.phone || null,
    p_address1: input.address1 || null,
    p_city: input.city || null,
    p_postcode: input.postcode || null,
    p_country: input.country || null,
    p_is_importer: !!input.isImporter,
    p_is_exporter: !!input.isExporter,
  })
  if (error) throw new Error(error.message)
  const r = data as Record<string, string | null>
  return {
    account_id: String(r.account_id),
    name: String(r.name ?? ''),
    address1: r.address1 ?? undefined,
    city: r.city ?? undefined,
    postcode: r.postcode ?? undefined,
    country: r.country ?? undefined,
    phone: r.phone ?? undefined,
    email: r.email ?? undefined,
    contact: r.contact ?? undefined,
    source: 'portal',
  }
}

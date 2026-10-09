// customerInfoApi.ts — data layer for the Info tab (contacts, meta, portal access).
import { supabase } from '../../supabase';

export interface Contact {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_prime: boolean | null;
  /** 'cf' = synced from CyberFreight, 'console' = added or edited here, not in CF. */
  source?: string | null;
}

export {
  activatePortalAccess as grantPortalAccess,
  fetchPortalUsersForAccount as fetchPortalUsers,
  regeneratePortalLink,
  revokePortalAccess,
  reactivatePortalAccess,
  setPortalRole,
  type PortalActivateResult,
  type PortalUserRecord as PortalUser,
} from '../../lib/portalActivationApi';

export interface CustomerMeta {
  account_id: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  country: string | null;
  account_owner: string | null;
  credit_terms: string | null;
  notes: string | null;
}

export interface CustomerSync {
  address1: string | null;
  address2: string | null;
  address3: string | null;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  contact: string | null;
}

export type ResolvedCustomerAddress = {
  line1: string;
  line2: string;
  city: string;
  region: string;
  postcode: string;
  country: string;
  phone: string;
  email: string;
  contact: string;
};

const CUSTOMER_SYNC_SELECT =
  'address1, address2, address3, city, state, postcode, country, phone, email, contact';

export function resolveCustomerAddress(
  meta: CustomerMeta | null | undefined,
  cust: CustomerSync | null | undefined,
): ResolvedCustomerAddress {
  return {
    line1: meta?.address_line1 || cust?.address1 || '',
    line2: meta?.address_line2 || [cust?.address2, cust?.address3].filter(Boolean).join(', ') || '',
    city: meta?.city || cust?.city || '',
    region: meta?.region || cust?.state || '',
    postcode: meta?.postcode || cust?.postcode || '',
    country: meta?.country || cust?.country || '',
    phone: cust?.phone || '',
    email: cust?.email || '',
    contact: cust?.contact || '',
  };
}

export function resolvedToMetaFields(resolved: ResolvedCustomerAddress): Pick<
  CustomerMeta,
  'address_line1' | 'address_line2' | 'city' | 'region' | 'postcode' | 'country'
> {
  return {
    address_line1: resolved.line1,
    address_line2: resolved.line2,
    city: resolved.city,
    region: resolved.region,
    postcode: resolved.postcode,
    country: resolved.country,
  };
}

export const EMPTY_META = (accountId: string): CustomerMeta => ({
  account_id: accountId,
  address_line1: '', address_line2: '', city: '', region: '',
  postcode: '', country: '', account_owner: '', credit_terms: '', notes: '',
});

export async function fetchContacts(accountId: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('id,first_name,last_name,email,phone,is_prime,source')
    .eq('account_id', accountId)
    .order('is_prime', { ascending: false })
    .order('last_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Contact[];
}

export async function fetchMeta(accountId: string): Promise<CustomerMeta> {
  const { data, error } = await supabase
    .from('customer_meta')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) throw error;
  return (data as CustomerMeta) ?? EMPTY_META(accountId);
}

export async function fetchCustomerSync(accountId: string): Promise<CustomerSync | null> {
  const { data, error } = await supabase
    .from('customers')
    .select(CUSTOMER_SYNC_SELECT)
    .eq('account_id', accountId)
    .maybeSingle();
  if (error) throw error;
  return (data as CustomerSync) ?? null;
}

export async function saveMeta(meta: CustomerMeta): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
  const { error } = await supabase.from('customer_meta').upsert({
    ...meta,
    updated_at: new Date().toISOString(),
    updated_by: uid,
  });
  if (error) throw error;
}

export type ContactDraft = { first_name: string; last_name: string; email: string; phone: string };

const clean = (d: ContactDraft) => ({
  first_name: d.first_name.trim() || null,
  last_name: d.last_name.trim() || null,
  email: d.email.trim().toLowerCase() || null,
  phone: d.phone.trim() || null,
});

export async function addContact(accountId: string, d: ContactDraft): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('contacts').insert({
    account_id: accountId, ...clean(d), is_prime: false, source: 'console',
    synced_at: null, created_by: u.user?.id ?? null, updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.code === '23505' ? 'That contact already exists' : error.message);
}

export async function updateContact(id: number, d: ContactDraft): Promise<void> {
  const c = clean(d);
  const { error } = await supabase.rpc('contact_edit', {
    p_id: id, p_first_name: c.first_name ?? '', p_last_name: c.last_name ?? '',
    p_email: c.email ?? '', p_phone: c.phone ?? '',
  });
  if (error) throw new Error(error.message);
}

/** Deletes any contact. CF rows are suppressed so the next sync does not bring them back. */
export async function deleteContact(id: number): Promise<void> {
  const { error } = await supabase.rpc('contact_delete', { p_id: id });
  if (error) throw new Error(error.message);
}

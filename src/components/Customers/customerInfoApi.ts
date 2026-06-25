// customerInfoApi.ts — data layer for the Info tab (contacts, meta, portal access).
import { supabase } from '../../supabase';

export interface Contact {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_prime: boolean | null;
}

export interface PortalUser {
  user_id: string;
  email: string | null;
  created_at: string | null;
}

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
    .select('id,first_name,last_name,email,phone,is_prime')
    .eq('account_id', accountId)
    .order('is_prime', { ascending: false })
    .order('last_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Contact[];
}

export async function fetchPortalUsers(accountId: string): Promise<PortalUser[]> {
  const { data, error } = await supabase
    .from('portal_users')
    .select('user_id,email,created_at')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PortalUser[];
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

// Invites (or reuses) an auth user and links them to the account. Staff-only fn.
export async function grantPortalAccess(accountId: string, email: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('invite-portal-user', {
    body: { account_id: accountId, email: email.trim().toLowerCase() },
  });
  if (error) throw new Error(error.message || 'Invite failed');
  // Edge function may return an application-level error in the payload.
  const payload = data as { error?: string } | null;
  if (payload?.error) throw new Error(payload.error);
}

export async function revokePortalAccess(userId: string): Promise<void> {
  const { error } = await supabase.from('portal_users').delete().eq('user_id', userId);
  if (error) throw error;
}

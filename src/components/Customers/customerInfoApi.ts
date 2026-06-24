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

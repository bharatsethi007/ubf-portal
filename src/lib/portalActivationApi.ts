import { supabase } from '../supabase'

export const MIN_PASSWORD_LENGTH = 8

export type PortalUserStatus = 'pending' | 'active' | 'revoked'

export type PortalUserRecord = {
  user_id: string
  email: string | null
  created_at: string | null
  status: PortalUserStatus
  activated_at: string | null
  last_login_at: string | null
  display_name: string | null
}

export type PortalActivateResult = {
  ok: true
  user_id: string
  link: string
  expires_at: string
  reused_auth_user?: boolean
}

type FnPayload = { error?: string; message?: string; link?: string; expires_at?: string; ok?: boolean }

function parseFnError(data: FnPayload | null, fallback: string): string {
  if (data?.message) return data.message
  if (data?.error === 'already_active') return 'User is already active. Regenerate link instead.'
  if (data?.error) return data.error
  return fallback
}

type InvokeError = Error & { context?: Response }

async function readFnErrorPayload(error: InvokeError | null): Promise<FnPayload | null> {
  if (!error?.context) return null
  try {
    return (await error.context.json()) as FnPayload
  } catch {
    return null
  }
}

async function invokePortalFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body })
  const payload = ((data as FnPayload | null) ?? (await readFnErrorPayload(error as InvokeError | null))) as FnPayload | null

  if (error || payload?.error) {
    throw new Error(parseFnError(payload, error?.message || `${name} failed`))
  }
  return data as T
}

export async function activatePortalAccess(
  accountId: string,
  email: string,
  displayName?: string,
): Promise<PortalActivateResult> {
  return invokePortalFn<PortalActivateResult>('portal-activate', {
    account_id: accountId,
    email: email.trim().toLowerCase(),
    display_name: displayName?.trim() || undefined,
  })
}

export async function regeneratePortalLink(userId: string): Promise<PortalActivateResult> {
  return invokePortalFn<PortalActivateResult>('portal-regenerate-link', { user_id: userId })
}

export async function revokePortalAccess(userId: string): Promise<void> {
  await invokePortalFn('portal-revoke-user', { user_id: userId, revoke: true })
}

export async function reactivatePortalAccess(userId: string): Promise<void> {
  await invokePortalFn('portal-revoke-user', { user_id: userId, revoke: false })
}

export async function redeemPortalToken(token: string, password: string): Promise<{ email: string }> {
  return invokePortalFn<{ ok: true; email: string }>('portal-redeem-token', { token, password })
}

export async function fetchPortalUsersForAccount(accountId: string): Promise<PortalUserRecord[]> {
  const { data, error } = await supabase
    .from('portal_users')
    .select('user_id, email, created_at, status, activated_at, last_login_at, display_name')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as PortalUserRecord[]
}

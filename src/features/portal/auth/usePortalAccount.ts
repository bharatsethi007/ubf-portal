import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../../supabase'

export type PortalAccount = {
  accountId: string
  email: string
  displayName: string
  initials: string
  status: 'pending' | 'active' | 'revoked'
}

export function usePortalAccount(session: Session | null) {
  const [account, setAccount] = useState<PortalAccount | null>(null)
  const [isPortalUser, setIsPortalUser] = useState(false)
  const [portalStatus, setPortalStatus] = useState<'pending' | 'active' | 'revoked' | null>(null)
  const [loading, setLoading] = useState(true)

  // Key on the user, not the session object: Supabase hands out a new session on every
  // token refresh and tab focus. Re-running on that flashed "Loading" and remounted the portal.
  const userId = session?.user?.id ?? null
  const userEmail = session?.user?.email ?? ''

  useEffect(() => {
    if (!userId) {
      setAccount(null)
      setIsPortalUser(false)
      setPortalStatus(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      const { data: pu } = await supabase
        .from('portal_users')
        .select('account_id, email, status, display_name')
        .eq('user_id', userId)
        .maybeSingle()

      if (cancelled) return

      if (!pu?.account_id) {
        setAccount(null)
        setIsPortalUser(false)
        setPortalStatus(null)
        setLoading(false)
        return
      }

      const status = (pu.status ?? 'pending') as PortalAccount['status']
      setPortalStatus(status)

      const { data: cust } = await supabase
        .from('portal_account')
        .select('name')
        .eq('account_id', pu.account_id)
        .maybeSingle()

      if (cancelled) return

      const email = pu.email ?? userEmail
      const displayName = pu.display_name?.trim() || cust?.name || email.split('@')[0] || 'Customer'
      const parts = displayName.split(/\s+/).filter(Boolean)
      const initials = parts.length >= 2
        ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
        : displayName.slice(0, 2).toUpperCase()

      setAccount({ accountId: pu.account_id, email, displayName, initials, status })
      setIsPortalUser(status === 'active')
      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [userId, userEmail])

  return { account, isPortalUser, portalStatus, loading }
}

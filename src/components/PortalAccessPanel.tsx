import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Contact } from '../types/customer'
import { contactName } from '../utils/customerQuery'
import PortalLinkCopy from './portalAccess/PortalLinkCopy'
import PortalStatusPill from './portalAccess/PortalStatusPill'
import {
  activatePortalAccess,
  fetchPortalUsersForAccount,
  regeneratePortalLink,
  revokePortalAccess,
  type PortalActivateResult,
  type PortalUserRecord,
} from '../lib/portalActivationApi'

type Props = {
  accountId: number | string
  onChanged?: () => void
}

export default function PortalAccessPanel({ accountId, onChanged }: Props) {
  const accountKey = String(accountId)
  const [portalUsers, setPortalUsers] = useState<PortalUserRecord[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [issuedLink, setIssuedLink] = useState<PortalActivateResult | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [users, contactsRes] = await Promise.all([
      fetchPortalUsersForAccount(accountKey),
      supabase
        .from('contacts')
        .select('account_id, first_name, last_name, email, phone, is_prime')
        .eq('account_id', accountKey)
        .not('email', 'is', null),
    ])
    setPortalUsers(users)
    setContacts((contactsRes.data as Contact[]) ?? [])
    setLoading(false)
  }, [accountKey])

  useEffect(() => { load() }, [load])

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setBusy(true)
    setError('')
    setMessage('')
    setIssuedLink(null)
    try {
      const result = await activatePortalAccess(accountKey, trimmed, displayName || undefined)
      setIssuedLink(result)
      setMessage('Portal access activated')
      setEmail('')
      setDisplayName('')
      await load()
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed')
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke(userId: string) {
    setError('')
    setMessage('')
    try {
      await revokePortalAccess(userId)
      setMessage('Portal access revoked')
      await load()
      onChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revoke failed')
    }
  }

  async function handleRegenerate(userId: string) {
    setBusy(true)
    setError('')
    try {
      const result = await regeneratePortalLink(userId)
      setIssuedLink(result)
      setMessage('New set-password link generated')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not regenerate link')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="muted">Loading portal access…</p>

  return (
    <div className="portal-access">
      <h4 className="portal-access__title">Portal access</h4>

      {portalUsers.length === 0 ? (
        <p className="muted portal-access__empty">No portal access yet. Activate to give this customer online tracking.</p>
      ) : (
        <ul className="portal-access__list">
          {portalUsers.map((u) => (
            <li key={u.user_id} className="portal-access__row">
              <div className="portal-access__user">
                <span className="mono">{u.email ?? u.user_id}</span>
                <PortalStatusPill status={u.status} />
              </div>
              <div className="portal-access__actions">
                {u.status === 'pending' && (
                  <button type="button" className="text-link" disabled={busy} onClick={() => handleRegenerate(u.user_id)}>
                    Copy link
                  </button>
                )}
                {u.status !== 'revoked' && (
                  <button type="button" className="text-link" onClick={() => handleRevoke(u.user_id)}>Revoke</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="portal-access__grant" onSubmit={handleActivate}>
        <label className="portal-access__label">
          Email
          <input
            className="input input--sm"
            list="portal-contact-emails"
            placeholder="Contact email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <datalist id="portal-contact-emails">
            {contacts.map((c) => c.email && <option key={c.email} value={c.email}>{contactName(c)}</option>)}
          </datalist>
        </label>
        <label className="portal-access__label">
          Display name (optional)
          <input className="input input--sm" placeholder="Contact name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </label>
        <button type="submit" className="btn portal-access__btn" disabled={busy || !email.trim()}>
          {busy ? 'Activating…' : 'Activate'}
        </button>
      </form>

      {issuedLink && (
        <PortalLinkCopy link={issuedLink.link} expiresAt={issuedLink.expires_at} onDismiss={() => setIssuedLink(null)} />
      )}

      {message && <p className="portal-access__success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

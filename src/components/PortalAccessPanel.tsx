import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { Contact, PortalUserRow } from '../types/customer'
import { contactName } from '../utils/customerQuery'

type Props = {
  accountId: number
  onChanged?: () => void
}

export default function PortalAccessPanel({ accountId, onChanged }: Props) {
  const [portalUsers, setPortalUsers] = useState<PortalUserRow[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [usersRes, contactsRes] = await Promise.all([
      supabase.from('portal_users').select('user_id, account_id, email').eq('account_id', accountId),
      supabase
        .from('contacts')
        .select('account_id, first_name, last_name, email, phone, is_prime')
        .eq('account_id', accountId)
        .not('email', 'is', null),
    ])
    setPortalUsers((usersRes.data as PortalUserRow[]) ?? [])
    setContacts((contactsRes.data as Contact[]) ?? [])
    setLoading(false)
  }, [accountId])

  useEffect(() => {
    load()
  }, [load])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setInviting(true)
    setError('')
    setMessage('')
    const { error: fnError } = await supabase.functions.invoke('invite-portal-user', {
      body: { account_id: accountId, email: trimmed },
    })
    setInviting(false)
    if (fnError) {
      setError(fnError.message)
      return
    }
    setMessage('Invite sent')
    setEmail('')
    await load()
    onChanged?.()
  }

  async function handleRevoke(userId: string) {
    setError('')
    setMessage('')
    const { error: delError } = await supabase.from('portal_users').delete().eq('user_id', userId)
    if (delError) {
      setError(delError.message)
      return
    }
    await load()
    onChanged?.()
  }

  if (loading) return <p className="muted">Loading portal access…</p>

  return (
    <div className="portal-access">
      <h4 className="portal-access__title">Portal access</h4>

      {portalUsers.length === 0 ? (
        <p className="muted portal-access__empty">No portal users linked to this account.</p>
      ) : (
        <ul className="portal-access__list">
          {portalUsers.map((u) => (
            <li key={u.user_id} className="portal-access__row">
              <span className="mono">{u.email ?? u.user_id}</span>
              <button type="button" className="text-link" onClick={() => handleRevoke(u.user_id)}>
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="portal-access__grant" onSubmit={handleInvite}>
        <label className="portal-access__label">
          Grant access
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
        <button type="submit" className="btn portal-access__btn" disabled={inviting || !email.trim()}>
          {inviting ? 'Sending…' : 'Send invite'}
        </button>
      </form>

      {message && <p className="portal-access__success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  )
}

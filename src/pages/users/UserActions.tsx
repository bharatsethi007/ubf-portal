import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { KeyRound, ShieldOff, Trash2, UserCheck, UserX } from 'lucide-react'
import { usePerm } from '../../access/PermissionsProvider'
import { deleteStaffUser, resetUserMfa, sendStaffReset } from './usersApi'
import { setStaffActive, type StaffProfile } from './staffProfileApi'

function IconBtn({ title, onClick, disabled, danger, children }:
  { title: string; onClick: () => void; disabled: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      style={{ display: 'inline-grid', placeItems: 'center', width: 34, height: 34, borderRadius: 8, background: '#fff',
        border: `1px solid ${danger ? '#fecaca' : 'var(--line)'}`, color: danger ? '#dc2626' : '#334155',
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  )
}

type Props = { profile: StaffProfile; isSelf: boolean; name: string; onChanged: () => void; onDeleted: () => void }

export default function UserActions({ profile, isSelf, name, onChanged, onDeleted }: Props) {
  const canEdit = usePerm('users', 'edit')
  const canDelete = usePerm('users', 'delete')
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    try { await fn() } catch (e) { toast.error(e instanceof Error ? e.message : 'Action failed') } finally { setBusy(false) }
  }

  const resetPassword = () => run(async () => {
    const res = await sendStaffReset(profile.user_id)
    if (res.email_sent) toast.success(`Reset link emailed to ${profile.email}`)
    else if (res.link) { await navigator.clipboard.writeText(res.link).catch(() => {}); toast.message('Email not sent. Reset link copied to clipboard.') }
    else toast.error('Could not send reset link')
  })
  const resetMfa = () => {
    if (!confirm(`Reset two-factor for ${name}? They set up their authenticator again at next login.`)) return
    void run(async () => {
      const res = await resetUserMfa(profile.user_id)
      toast.success(res.factors_removed ? 'Two-factor reset' : 'No two-factor set up yet')
    })
  }
  const toggleActive = () => {
    const disabling = profile.is_active
    if (disabling && !confirm(`Disable ${name}? They are signed out and cannot log in until re-enabled.`)) return
    void run(async () => {
      await setStaffActive(profile.user_id, !disabling)
      toast.success(disabling ? `${name} disabled` : `${name} re-enabled`)
      onChanged()
    })
  }
  const remove = () => {
    if (!confirm(`Delete ${name}? This removes their staff access and cannot be undone. Disable instead to keep history.`)) return
    void run(async () => {
      const res = await deleteStaffUser(profile.user_id)
      toast.success(res.kept_for_portal ? 'Staff access removed (customer portal login kept)' : 'User deleted')
      onDeleted()
    })
  }

  if (!canEdit && !canDelete) return null
  return (
    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
      {canEdit && profile.is_active && <IconBtn title="Send password reset link" onClick={resetPassword} disabled={busy}><KeyRound size={16} /></IconBtn>}
      {canEdit && profile.is_active && <IconBtn title="Reset two-factor" onClick={resetMfa} disabled={busy}><ShieldOff size={16} /></IconBtn>}
      {canEdit && !isSelf && (
        <IconBtn title={profile.is_active ? 'Disable account' : 'Re-enable account'} onClick={toggleActive} disabled={busy}>
          {profile.is_active ? <UserX size={16} /> : <UserCheck size={16} />}
        </IconBtn>
      )}
      {canDelete && !isSelf && !profile.is_admin && (
        <IconBtn title="Delete user" onClick={remove} disabled={busy} danger><Trash2 size={16} /></IconBtn>
      )}
    </div>
  )
}

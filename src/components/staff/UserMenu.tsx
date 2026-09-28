import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, UserRound } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../supabase'
import StaffAvatar from './StaffAvatar'
import MyProfileModal from './MyProfileModal'
import { displayName } from '../../pages/users/staffProfileApi'
import { useMyProfile } from './useMyProfile'

// Top-right user button: photo + name, dropdown with My profile and Sign out.
export default function UserMenu({ session }: { session: Session }) {
  const profile = useMyProfile()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const name = profile ? displayName(profile) : session.user.email?.split('@')[0] ?? 'Staff'
  const item = { display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 } as const

  return (
    <div className="user-menu" ref={ref}>
      <button type="button" className="user-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen((v) => !v)}>
        <StaffAvatar path={profile?.avatar_path ?? null} name={name} size={32} />
        <span className="user-name">{name}</span>
        <ChevronDown size={16} className={`user-chevron${open ? ' open' : ''}`} />
      </button>
      {open && (
        <div className="user-dropdown">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px 10px', borderBottom: '1px solid var(--line)', marginBottom: 6 }}>
            <StaffAvatar path={profile?.avatar_path ?? null} name={name} size={36} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
              <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.job_title || session.user.email}</div>
            </div>
          </div>
          <button type="button" className="dropdown-item" style={item} onClick={() => { setOpen(false); setEditing(true) }}>
            <UserRound size={15} /> My profile
          </button>
          <button type="button" className="dropdown-item" style={item} onClick={() => { setOpen(false); void supabase.auth.signOut({ scope: 'local' }) }}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
      {editing && profile && <MyProfileModal profile={profile} onClose={() => setEditing(false)} />}
    </div>
  )
}

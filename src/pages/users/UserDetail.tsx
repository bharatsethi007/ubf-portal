import { useEffect, useState } from 'react'
import { supabase } from '../../supabase'
import { usePerm } from '../../access/PermissionsProvider'
import StaffAvatar from '../../components/staff/StaffAvatar'
import StaffProfileForm from '../../components/staff/StaffProfileForm'
import UserAccessPanel from './UserAccessPanel'
import UserActions from './UserActions'
import UserHistory from './UserHistory'
import { displayName, type StaffProfile } from './staffProfileApi'

const pill = (bg: string, fg: string) => ({
  fontSize: 10, fontWeight: 600, letterSpacing: '.04em', color: fg, background: bg, padding: '2px 8px', borderRadius: 999,
}) as const

type Props = { profile: StaffProfile; staff: StaffProfile[]; allStaff: StaffProfile[]; onChanged: () => void; onDeleted: () => void }

export default function UserDetail({ profile, staff, allStaff, onChanged, onDeleted }: Props) {
  const canEdit = usePerm('users', 'edit')
  const [tab, setTab] = useState<'profile' | 'access' | 'history'>('profile')
  const [myId, setMyId] = useState<string | null>(null)
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null)) }, [])

  const isSelf = myId === profile.user_id
  const name = displayName(profile)
  const manager = staff.find((s) => s.user_id === profile.manager_id)

  return (
    <div style={{ minWidth: 0 }}>
      {/* Header: identity left, actions right, one row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 36 }}>
        <StaffAvatar path={profile.avatar_path} name={name} size={36} muted={!profile.is_active} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            {profile.is_admin && <span style={pill('#E8EEFD', '#2563EB')}>ADMIN</span>}
            {!profile.is_active && <span style={pill('#f1f5f9', '#64748b')}>DISABLED</span>}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {[profile.job_title, profile.branch, manager ? `Reports to ${displayName(manager)}` : null].filter(Boolean).join(' · ') || profile.email}
          </div>
        </div>
        <UserActions profile={profile} isSelf={isSelf} name={name} onChanged={onChanged} onDeleted={onDeleted} />
      </div>

      <div className="quotes-tabs" style={{ margin: '16px 0 20px' }}>
        <button type="button" className={`quotes-tabs__btn${tab === 'profile' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('profile')}>Profile</button>
        <button type="button" className={`quotes-tabs__btn${tab === 'access' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('access')}>Access</button>
        <button type="button" className={`quotes-tabs__btn${tab === 'history' ? ' quotes-tabs__btn--on' : ''}`} onClick={() => setTab('history')}>History</button>
      </div>

      {tab === 'profile' && <StaffProfileForm key={profile.user_id} profile={profile} staff={staff} canEdit={canEdit || isSelf} canEditOrg={canEdit} onSaved={onChanged} />}
      {tab === 'access' && <UserAccessPanel key={profile.user_id} userId={profile.user_id} onChanged={onChanged} />}
      {tab === 'history' && <UserHistory key={profile.user_id} userId={profile.user_id} staff={allStaff} />}
    </div>
  )
}

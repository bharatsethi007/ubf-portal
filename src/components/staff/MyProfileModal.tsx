import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import StaffProfileForm from './StaffProfileForm'
import { listActiveStaff, type StaffProfile } from '../../pages/users/staffProfileApi'

// Self-service profile: name, title, photo. Branch and manager are read-only here (set by admins).
export default function MyProfileModal({ profile, onClose }: { profile: StaffProfile; onClose: () => void }) {
  const [staff, setStaff] = useState<StaffProfile[]>([])
  useEffect(() => { void listActiveStaff().then(setStaff).catch(() => {}) }, [])
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,27,45,.35)', display: 'grid', placeItems: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="my-profile-title"
        style={{ width: 'min(640px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', padding: 24, background: '#fff', borderRadius: 12, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 id="my-profile-title" style={{ fontSize: 18, margin: 0 }}>My profile</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={18} /></button>
        </div>
        <StaffProfileForm profile={profile} staff={staff} canEdit canEditOrg={false} onSaved={() => {}} />
      </div>
    </div>
  )
}

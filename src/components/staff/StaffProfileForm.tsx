import { useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import StaffAvatar from './StaffAvatar'
import {
  BRANCHES, displayName, removeAvatarFile, updateStaffProfile, uploadAvatar, type StaffProfile,
} from '../../pages/users/staffProfileApi'

const BLUE = '#2563EB'
const label = { display: 'block', fontSize: 12, color: '#64748b', marginBottom: 6 } as const
const field = { width: '100%', height: 38, boxSizing: 'border-box' as const }
const linkBtn = { background: 'none', border: 'none', padding: 0, fontSize: 13, cursor: 'pointer' } as const

type Props = {
  profile: StaffProfile
  staff: StaffProfile[]          // active staff, for the manager picker
  canEdit: boolean               // may edit name/title/photo
  canEditOrg: boolean            // may edit branch/manager
  onSaved: () => void
}

export default function StaffProfileForm({ profile, staff, canEdit, canEditOrg, onSaved }: Props) {
  const init = {
    first_name: profile.first_name ?? '', last_name: profile.last_name ?? '', job_title: profile.job_title ?? '',
    branch: profile.branch ?? '', manager_id: profile.manager_id ?? '',
  }
  const [form, setForm] = useState(init)
  const [saved, setSaved] = useState(init)
  const [avatar, setAvatar] = useState(profile.avatar_path)
  const [busy, setBusy] = useState(false)
  const [photoBusy, setPhotoBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const managers = useMemo(() => staff.filter((s) => s.user_id !== profile.user_id && s.is_active), [staff, profile.user_id])
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save() {
    setBusy(true)
    try {
      await updateStaffProfile(profile.user_id, {
        first_name: form.first_name, last_name: form.last_name, job_title: form.job_title,
        branch: form.branch, manager_id: form.manager_id || null,
      }, canEditOrg)
      setSaved(form); toast.success('Profile saved'); onSaved()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Save failed') }
    finally { setBusy(false) }
  }

  // Photo changes save straight away, using the last saved field values.
  async function applyAvatar(next: string | null) {
    await updateStaffProfile(profile.user_id, { ...saved, manager_id: saved.manager_id || null, avatar_path: next ?? '' }, false)
    await removeAvatarFile(avatar)
    setAvatar(next); onSaved()
  }
  async function onPick(file: File | undefined) {
    if (!file) return
    setPhotoBusy(true)
    try { await applyAvatar(await uploadAvatar(profile.user_id, file)); toast.success('Photo updated') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Upload failed') }
    finally { setPhotoBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }
  async function onRemove() {
    setPhotoBusy(true)
    try { await applyAvatar(null); toast.success('Photo removed') }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Remove failed') }
    finally { setPhotoBusy(false) }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <StaffAvatar path={avatar} name={displayName({ ...profile, ...saved })} size={64} muted={!profile.is_active} />
        {canEdit && (
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <button type="button" style={{ ...linkBtn, color: BLUE, fontWeight: 500 }} disabled={photoBusy} onClick={() => fileRef.current?.click()}>
              {photoBusy ? 'Uploading…' : avatar ? 'Change photo' : 'Upload photo'}
            </button>
            {avatar && <button type="button" style={{ ...linkBtn, color: '#64748b' }} disabled={photoBusy} onClick={onRemove}>Remove</button>}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void onPick(e.target.files?.[0])} />
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px 20px' }}>
        <div><label style={label}>First name</label>
          <input className="input input--sm" style={field} value={form.first_name} onChange={set('first_name')} disabled={!canEdit} /></div>
        <div><label style={label}>Last name</label>
          <input className="input input--sm" style={field} value={form.last_name} onChange={set('last_name')} disabled={!canEdit} /></div>
        <div><label style={label}>Email</label>
          <input className="input input--sm" style={{ ...field, background: '#f8fafc', color: '#64748b' }} value={profile.email ?? ''} readOnly /></div>
        <div><label style={label}>Title</label>
          <input className="input input--sm" style={field} value={form.job_title} onChange={set('job_title')} disabled={!canEdit} placeholder="e.g. Operations Manager" /></div>
        <div><label style={label}>Branch</label>
          <select className="input input--sm" style={field} value={form.branch} onChange={set('branch')} disabled={!canEditOrg}>
            <option value="">Not set</option>
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
            {form.branch && !(BRANCHES as readonly string[]).includes(form.branch) && <option value={form.branch}>{form.branch}</option>}
          </select></div>
        <div><label style={label}>Manager</label>
          <select className="input input--sm" style={field} value={form.manager_id} onChange={set('manager_id')} disabled={!canEditOrg}>
            <option value="">No manager</option>
            {managers.map((m) => <option key={m.user_id} value={m.user_id}>{displayName(m)}</option>)}
          </select></div>
      </div>

      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          {dirty && <button type="button" onClick={() => setForm(saved)} disabled={busy}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--line)', background: '#fff', color: '#334155', fontSize: 13, cursor: 'pointer' }}>Discard</button>}
          <button type="button" onClick={save} disabled={!dirty || busy}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: BLUE, color: '#fff', fontSize: 13, fontWeight: 500,
              cursor: dirty && !busy ? 'pointer' : 'default', opacity: dirty && !busy ? 1 : 0.4 }}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  )
}

import { useState, type FormEvent } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { PROFILE_EVENT } from '../../auth/usePortalAccount'
import { updatePerson, type Member } from './teamApi'

type Props = { m: Member; onDone: (msg: string) => void; onCancel: () => void }

/** Edit one person's name and phone. Email is the login, so it stays fixed. */
export default function PersonEdit({ m, onDone, onCancel }: Props) {
  const [name, setName] = useState(m.name ?? '')
  const [phone, setPhone] = useState(m.phone ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setErr('Add a name.'); return }
    setBusy(true); setErr('')
    try {
      await updatePerson(m.user_id, name.trim(), phone.trim())
      if (m.is_me) window.dispatchEvent(new Event(PROFILE_EVENT))
      onDone(m.is_me ? 'Your details are saved.' : `${name.trim()}'s details are saved.`)
    } catch (x) { setErr(x instanceof Error ? x.message : 'Could not save'); setBusy(false) }
  }

  return (
    <li className="pv3-team__person pv3-team__edit">
      <form onSubmit={(e) => void save(e)}>
        <b className="pv3-team__edit-title">{m.is_me ? 'Your details' : `Edit ${m.name || m.email}`}</b>
        <div className="pv3-team__fields">
          <label><span>Name</span><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="First Last" maxLength={100} autoComplete="name" /></label>
          <label><span>Phone <i>(optional)</i></span><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+64 21 123 4567" maxLength={30} autoComplete="tel" /></label>
          <label><span>Email</span>
            <span className="pv3-team__locked" title="Email is the login. Ask UB Freight to change it."><Lock size={13} /> {m.email}</span>
          </label>
        </div>
        {err && <div className="pv3-team__err" role="alert">{err}</div>}
        <div className="pv3-team__row">
          <span className="pv3-muted">Email is the login. Ask us to change it.</span>
          <span style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="pv3-textbtn" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="submit" className="pv3-btn pv3-btn--primary" disabled={busy}>{busy && <Loader2 size={15} className="pv3-spin" />} Save</button>
          </span>
        </div>
      </form>
    </li>
  )
}

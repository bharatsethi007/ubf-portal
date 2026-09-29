import { useState, type FormEvent } from 'react'
import { Loader2, Send, X } from 'lucide-react'
import { invite, type Role } from './teamApi'

type Props = { onDone: (msg: string) => void; onClose: () => void }

/** Invite a colleague: email, optional name, role. They get an email to set their password. */
export default function InviteForm({ onDone, onClose }: Props) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('member')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const r = await invite(email.trim(), name.trim(), role)
      onDone(r.emailed === false ? `Invite created for ${email.trim()}, but the email didn't send. Use Resend.` : `Invite sent to ${email.trim()}.`)
    } catch (x) { setErr(x instanceof Error ? x.message : 'Could not invite') } finally { setBusy(false) }
  }

  return (
    <form className="pv3-card pv3-team__invite pv3-rise" onSubmit={(e) => void submit(e)}>
      <header>
        <b>Invite a colleague</b>
        <button type="button" className="pv3-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </header>
      <div className="pv3-team__fields">
        <label><span>Email</span><input type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></label>
        <label><span>Name <i>(optional)</i></span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="First Last" maxLength={100} /></label>
        <label><span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="member">Member: sees everything</option>
            <option value="admin">Admin: also manages the team</option>
          </select>
        </label>
      </div>
      {err && <div className="pv3-team__err" role="alert">{err}</div>}
      <div className="pv3-team__row">
        <span className="pv3-muted">They get an email to set a password. The link lasts 7 days.</span>
        <button type="submit" className="pv3-btn pv3-btn--primary" disabled={busy || !email.trim()}>
          {busy ? <Loader2 size={15} className="pv3-spin" /> : <Send size={15} />} Send invite
        </button>
      </div>
    </form>
  )
}

import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import PartyFields from './PartyFields'
import { EMPTY_PARTY, ROLE_LABEL, saveContact, type Contact, type ContactRole, type Party } from './contactsApi'
import './contacts.css'

type Props = { initial?: Contact | null; defaultRole?: ContactRole; onSaved: (c: Contact) => void; onClose: () => void }

/** Add or edit one shipper / consignee. */
export default function ContactModal({ initial, defaultRole = 'both', onSaved, onClose }: Props) {
  const [p, setP] = useState<Party>(initial ?? EMPTY_PARTY)
  const [role, setRole] = useState<ContactRole>(initial?.role ?? defaultRole)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function save() {
    setBusy(true); setErr('')
    try { onSaved(await saveContact({ ...p, id: initial?.id, role, notes })) }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not save'); setBusy(false) }
  }

  return (
    <div className="pv3-modal" role="dialog" aria-modal="true" aria-label={initial ? 'Edit contact' : 'New contact'}>
      <button type="button" className="pv3-modal__scrim" aria-label="Close" onClick={onClose} />
      <div className="pv3-modal__panel">
        <header className="pv3-modal__head">
          <div><h2>{initial ? 'Edit contact' : 'New contact'}</h2><p>Saved contacts fill in your bookings in one click.</p></div>
          <button type="button" className="pv3-iconbtn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="pv3-modal__body pv3-form">
          <div className="pv3-field"><label htmlFor="ct-role">Use as</label>
            <select id="ct-role" value={role} onChange={(e) => setRole(e.target.value as ContactRole)}>
              {(Object.keys(ROLE_LABEL) as ContactRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <PartyFields id="ct" value={p} onChange={setP} />
          <div className="pv3-field"><label htmlFor="ct-notes">Notes</label>
            <textarea id="ct-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opening hours, loading dock, tax ID" />
          </div>
        </div>
        <footer className="pv3-modal__foot">
          {err && <span className="pv3-form__err" role="alert">{err}</span>}
          <button type="button" className="pv3-textbtn" onClick={onClose}>Cancel</button>
          <button type="button" className="pv3-btn pv3-btn--primary" disabled={busy} onClick={() => void save()}>
            {busy && <Loader2 size={14} className="pv3-spin" />} Save contact
          </button>
        </footer>
      </div>
    </div>
  )
}

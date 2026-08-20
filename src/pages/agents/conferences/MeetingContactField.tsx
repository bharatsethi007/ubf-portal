import { useEffect, useState } from 'react'
import {
  addAgentContact,
  listAgentContactOptions,
  type MeetingContactOption,
} from './meetingsApi'

type Props = {
  agentId: string | null
  contactName: string
  contactEmail: string
  contactPhone: string
  onChange: (patch: { contactName: string; contactEmail: string; contactPhone: string }) => void
}

export default function MeetingContactField({
  agentId,
  contactName,
  contactEmail,
  contactPhone,
  onChange,
}: Props) {
  const [options, setOptions] = useState<MeetingContactOption[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!agentId) {
      setOptions([])
      return
    }
    listAgentContactOptions(agentId).then(setOptions).catch(() => setOptions([]))
  }, [agentId])

  function pickOption(idx: string) {
    if (idx === '') {
      onChange({ contactName: '', contactEmail: '', contactPhone: '' })
      return
    }
    const opt = options[Number(idx)]
    if (!opt) return
    onChange({ contactName: opt.name, contactEmail: opt.email ?? '', contactPhone: opt.phone ?? '' })
  }

  async function saveContact() {
    if (!agentId || !newName.trim()) return
    setBusy(true)
    try {
      await addAgentContact(agentId, {
        name: newName.trim(),
        role: newRole.trim() || null,
        email: newEmail.trim() || null,
        phone: newPhone.trim() || null,
      })
      const next = await listAgentContactOptions(agentId)
      setOptions(next)
      onChange({
        contactName: newName.trim(),
        contactEmail: newEmail.trim(),
        contactPhone: newPhone.trim(),
      })
      setShowAdd(false)
      setNewName('')
      setNewRole('')
      setNewEmail('')
      setNewPhone('')
    } finally {
      setBusy(false)
    }
  }

  if (!agentId) {
    return (
      <div className="conf-editor-fields">
        <label className="conf-settings-field">
          <span>Contact name</span>
          <input
            className="input"
            value={contactName}
            onChange={(e) => onChange({ contactName: e.target.value, contactEmail, contactPhone })}
          />
        </label>
        <label className="conf-settings-field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            value={contactEmail}
            onChange={(e) => onChange({ contactName, contactEmail: e.target.value, contactPhone })}
          />
        </label>
        <label className="conf-settings-field">
          <span>Phone</span>
          <input
            className="input"
            value={contactPhone}
            onChange={(e) => onChange({ contactName, contactEmail, contactPhone: e.target.value })}
          />
        </label>
      </div>
    )
  }

  const selectedIdx = options.findIndex(
    (o) => o.name === contactName && (o.email ?? '') === contactEmail,
  )

  return (
    <div className="conf-editor-fields">
      <label className="conf-settings-field">
        <span>Point of contact</span>
        <select
          className="input"
          value={selectedIdx >= 0 ? String(selectedIdx) : contactName ? 'custom' : ''}
          onChange={(e) => pickOption(e.target.value)}
        >
          <option value="">— Select contact —</option>
          {options.map((opt, i) => (
            <option key={`${opt.source}-${opt.name}-${i}`} value={String(i)}>
              {opt.name}
              {opt.role ? ` (${opt.role})` : ''}
              {opt.source === 'erp' ? ' · ERP' : ''}
            </option>
          ))}
          {contactName && selectedIdx < 0 && <option value="custom">{contactName}</option>}
        </select>
      </label>
      {!showAdd ? (
        <button type="button" className="text-link conf-add-contact-btn" onClick={() => setShowAdd(true)}>
          + Add contact
        </button>
      ) : (
        <div className="conf-add-contact">
          <input className="input" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className="input" placeholder="Role" value={newRole} onChange={(e) => setNewRole(e.target.value)} />
          <input className="input" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <input className="input" placeholder="Phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <div className="conf-add-contact__actions">
            <button type="button" className="btn btn--inline" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--inline quotes-page__new-btn" disabled={busy} onClick={() => void saveContact()}>
              Save contact
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

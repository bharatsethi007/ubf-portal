import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import MultiChipSelect from '../../components/MultiChipSelect'
import { createAgent, type AgentStatus, type FreightNetwork } from './agentsApi'

type Props = {
  networks: FreightNetwork[]
  onClose: () => void
  onCreated: (id: string) => void
}

export default function NewAgentModal({ networks, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [status, setStatus] = useState<AgentStatus>('prospect')
  const [codes, setCodes] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const netOptions = networks.map((n) => ({ value: n.code, label: `${n.code} — ${n.name}` }))

  async function save() {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const id = await createAgent({
        name: name.trim(),
        country: country.trim() || null,
        status,
        notes: notes.trim() || null,
        network_codes: codes,
      })
      toast.success('Agent created')
      onCreated(id)
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create agent')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="agent-modal-backdrop" onClick={onClose}>
      <div className="agent-modal" onClick={(e) => e.stopPropagation()}>
        <div className="agent-modal__head">
          <h2>New agent</h2>
          <button type="button" className="agent-modal__close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="text-muted-foreground agent-modal__hint">
          A hand-added agent is portal-only until it exists in the ERP — it'll show a "Not on CF" tag
          until an ERP account with a matching code syncs in.
        </p>

        <div className="agent-form">
          <label className="agent-form__field">
            <span>Name *</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="agent-form__field">
            <span>Country</span>
            <input
              className="input"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. Fiji, China, AU"
            />
          </label>
          <label className="agent-form__field">
            <span>Status</span>
            <select
              className="input"
              value={status}
              onChange={(e) => setStatus(e.target.value as AgentStatus)}
            >
              <option value="prospect">Prospect</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <div className="agent-form__field">
            <span>Networks</span>
            <MultiChipSelect
              options={netOptions}
              value={codes}
              onChange={setCodes}
              placeholder="Add networks…"
            />
          </div>
          <label className="agent-form__field">
            <span>Notes</span>
            <textarea
              className="input"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="agent-modal__actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn quotes-page__new-btn" onClick={save} disabled={saving}>
            {saving ? 'Creating…' : 'Create agent'}
          </button>
        </div>
      </div>
    </div>
  )
}

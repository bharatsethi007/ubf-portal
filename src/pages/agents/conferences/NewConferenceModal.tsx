import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import AddressAutocomplete from '../../../components/bookings/AddressAutocomplete'
import type { FreightNetwork } from '../agentsApi'
import { createConference } from './conferencesApi'

type Props = {
  networks: FreightNetwork[]
  onClose: () => void
  onCreated: (id: string) => void
}

const MEETING_LENGTHS = [15, 30, 45, 60]

export default function NewConferenceModal({ networks, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [networkId, setNetworkId] = useState('')
  const [locationName, setLocationName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [meetingMinutes, setMeetingMinutes] = useState(30)
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) {
      toast.error('Name is required')
      return
    }
    if (!startDate || !endDate) {
      toast.error('Start and end dates are required')
      return
    }
    if (endDate < startDate) {
      toast.error('End date must be on or after start date')
      return
    }

    setSaving(true)
    try {
      const id = await createConference({
        name: name.trim(),
        network_id: networkId || null,
        location_name: locationName.trim() || null,
        location_place_id: null,
        location_lat: null,
        location_lng: null,
        start_date: startDate,
        end_date: endDate,
        default_meeting_minutes: meetingMinutes,
      })
      toast.success('Conference created')
      onCreated(id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create conference')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="agent-modal-backdrop" onClick={onClose}>
      <div className="agent-modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="agent-modal__head">
          <h2>New conference</h2>
          <button type="button" className="agent-modal__close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="agent-form">
          <label className="agent-form__field agent-form__field--wide">
            <span>Name *</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. WCA Pattaya July 2026"
              autoFocus
            />
          </label>

          <label className="agent-form__field agent-form__field--wide">
            <span>Network</span>
            <select className="input" value={networkId} onChange={(e) => setNetworkId(e.target.value)}>
              <option value="">— None —</option>
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.code} — {n.name}
                </option>
              ))}
            </select>
          </label>

          <div className="agent-form__field agent-form__field--wide">
            <AddressAutocomplete
              label="Location"
              value={locationName}
              usePlaces
              onChange={(addr) => setLocationName(addr)}
            />
          </div>

          <label className="agent-form__field">
            <span>Start date *</span>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="agent-form__field">
            <span>End date *</span>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>

          <label className="agent-form__field agent-form__field--wide">
            <span>Default meeting length</span>
            <select
              className="input"
              value={meetingMinutes}
              onChange={(e) => setMeetingMinutes(Number(e.target.value))}
            >
              {MEETING_LENGTHS.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="agent-modal__actions">
          <button type="button" className="btn" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn quotes-page__new-btn" onClick={save} disabled={saving}>
            {saving ? 'Creating…' : 'Create conference'}
          </button>
        </div>
      </div>
    </div>
  )
}

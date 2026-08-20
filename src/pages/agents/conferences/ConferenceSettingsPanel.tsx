import { useRef } from 'react'
import { toast } from 'sonner'
import {
  updateConferenceSettings,
  uploadConferenceImage,
  type ConferenceDetail,
} from './conferencesApi'

const MEETING_LENGTHS = [15, 30, 45, 60]

type Props = {
  conference: ConferenceDetail
  onUpdated: (patch: Partial<ConferenceDetail>) => void
}

export default function ConferenceSettingsPanel({ conference, onUpdated }: Props) {
  const coverRef = useRef<HTMLInputElement>(null)
  const headerRef = useRef<HTMLInputElement>(null)

  async function saveMinutes(minutes: number) {
    try {
      await updateConferenceSettings(conference.id, { default_meeting_minutes: minutes })
      onUpdated({ default_meeting_minutes: minutes })
      toast.success('Default meeting length updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update settings')
    }
  }

  async function saveImage(kind: 'cover' | 'header', file: File) {
    try {
      const url = await uploadConferenceImage(conference.id, file, kind)
      const patch =
        kind === 'cover'
          ? { cover_image_url: url }
          : { header_image_url: url }
      await updateConferenceSettings(conference.id, patch)
      onUpdated(patch)
      toast.success(kind === 'cover' ? 'Cover image updated' : 'Header image updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to upload image')
    }
  }

  return (
    <div className="cp-card conf-settings-panel">
      <div className="cp-card-head">
        <h3 className="cp-card-title">Settings</h3>
      </div>
      <div className="conf-settings-panel__body">
        <label className="conf-settings-field">
          <span>Default meeting length</span>
          <select
            className="input input--sm"
            value={conference.default_meeting_minutes}
            onChange={(e) => void saveMinutes(Number(e.target.value))}
          >
            {MEETING_LENGTHS.map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </label>

        <div className="conf-settings-field">
          <span>Cover image</span>
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void saveImage('cover', file)
              e.target.value = ''
            }}
          />
          <button type="button" className="btn btn--inline" onClick={() => coverRef.current?.click()}>
            Set cover
          </button>
        </div>

        <div className="conf-settings-field">
          <span>Header image</span>
          <input
            ref={headerRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void saveImage('header', file)
              e.target.value = ''
            }}
          />
          <button type="button" className="btn btn--inline" onClick={() => headerRef.current?.click()}>
            Set header image
          </button>
        </div>
      </div>
    </div>
  )
}

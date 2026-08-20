import { forwardRef, useImperativeHandle, useRef, useState } from 'react'
import { ScanLine } from 'lucide-react'
import { toast } from 'sonner'
import {
  addMeetingCard,
  createAgentFromCard,
  scanBusinessCard,
  uploadCardImage,
  type ExtractedCard,
  type MeetingCard,
} from './meetingCardsApi'

export type CardScannerHandle = { open: () => void }

type Props = {
  meetingId: string
  agentId: string | null
  onCardAdded: (card: MeetingCard) => void
  onAgentCreated?: (agentId: string) => void
  hideTrigger?: boolean
}

const EMPTY: ExtractedCard = {
  person_name: null,
  title: null,
  company: null,
  email: null,
  phone: null,
  mobile: null,
  website: null,
  address: null,
  country: null,
}

function readFileBase64(file: File): Promise<{ media_type: string; data_base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(',')[1] ?? ''
      resolve({ media_type: file.type || 'image/jpeg', data_base64: base64 })
    }
    reader.onerror = () => reject(new Error('Failed to read image'))
    reader.readAsDataURL(file)
  })
}

type ReviewProps = {
  card: ExtractedCard
  onChange: (card: ExtractedCard) => void
}

function ScanReviewFields({ card, onChange }: ReviewProps) {
  const fields: { key: keyof ExtractedCard; label: string }[] = [
    { key: 'person_name', label: 'Name' },
    { key: 'title', label: 'Title' },
    { key: 'company', label: 'Company' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
  ]

  return (
    <div className="conf-scan-review">
      {fields.map(({ key, label }) => (
        <label key={key} className="conf-scan-field">
          <span className="conf-scan-field__label">{label}</span>
          <input
            className="input input--sm"
            value={card[key] ?? ''}
            onChange={(e) => onChange({ ...card, [key]: e.target.value || null })}
          />
        </label>
      ))}
    </div>
  )
}

const CardScanner = forwardRef<CardScannerHandle, Props>(function CardScanner(
  { meetingId, agentId, onCardAdded, onAgentCreated, hideTrigger }: Props,
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [edited, setEdited] = useState<ExtractedCard | null>(null)
  const [match, setMatch] = useState<{ id: string; name: string } | null>(null)
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null)

  useImperativeHandle(ref, () => ({ open: () => inputRef.current?.click() }), [])

  function reset() {
    setFile(null)
    setEdited(null)
    setMatch(null)
    setCreatedAgentId(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleFile(selected: File) {
    setBusy(true)
    try {
      const image = await readFileBase64(selected)
      const result = await scanBusinessCard(image)
      setFile(selected)
      setEdited({ ...EMPTY, ...result.card })
      setMatch(result.suggested_agent_match)
      setCreatedAgentId(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Scan failed')
      reset()
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateAgent() {
    if (!edited) return
    setBusy(true)
    try {
      const newId = await createAgentFromCard(edited)
      setCreatedAgentId(newId)
      toast.success('Agent profile created')
      onAgentCreated?.(newId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create agent')
    } finally {
      setBusy(false)
    }
  }

  function resolvedAgentId(): string | null {
    if (agentId) return agentId
    if (match?.id) return match.id
    if (createdAgentId) return createdAgentId
    return null
  }

  async function handleSave() {
    if (!file || !edited) return
    setBusy(true)
    try {
      const url = await uploadCardImage(meetingId, file)
      const row = await addMeetingCard(meetingId, resolvedAgentId(), url, edited)
      toast.success('Business card saved')
      onCardAdded(row)
      reset()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save card')
    } finally {
      setBusy(false)
    }
  }

  const showCreatePrompt =
    edited?.company && !match && !createdAgentId && !agentId

  return (
    <div className="conf-scan">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="conf-scan__input"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
        }}
      />
      {!hideTrigger && (
        <button
          type="button"
          className="conf-scan-btn"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          <ScanLine size={18} />
          {busy && !edited ? 'Scanning…' : 'Scan business card'}
        </button>
      )}
      {hideTrigger && busy && !edited && (
        <p className="text-xs text-muted-foreground">Scanning business card…</p>
      )}

      {edited && (
        <>
          <ScanReviewFields card={edited} onChange={setEdited} />

          {agentId ? (
            <p className="conf-scan-match conf-scan-match--linked">Linked to meeting agent</p>
          ) : match ? (
            <p className="conf-scan-match conf-scan-match--found">
              Matches existing agent: {match.name}
            </p>
          ) : null}

          {showCreatePrompt && (
            <div className="conf-scan-createbox">
              <p>No agent found for &ldquo;{edited.company}&rdquo;. Create agent profile?</p>
              <button type="button" className="btn btn--inline" disabled={busy} onClick={() => void handleCreateAgent()}>
                Create agent
              </button>
            </div>
          )}

          <div className="conf-scan__actions">
            <button type="button" className="btn btn--inline quotes-page__new-btn" disabled={busy} onClick={() => void handleSave()}>
              Save card
            </button>
            <button type="button" className="btn btn--inline" disabled={busy} onClick={reset}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
)

export default CardScanner

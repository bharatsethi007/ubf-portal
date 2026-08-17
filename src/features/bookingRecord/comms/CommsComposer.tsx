import { useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type {
  BookingComm, NewCommInput, CommActivityType, CommDirection, CommCategory,
  CommSentiment, ComplaintType, ComplaintSeverity, ComplaintStatus,
} from './commsTypes'
import {
  ACTIVITY_TYPES, DIRECTIONS, CATEGORIES, SENTIMENTS,
  COMPLAINT_TYPES, COMPLAINT_SEVERITIES, COMPLAINT_STATUSES,
} from './commsTypes'
import { ACTIVITY_ICON } from './commsFormat'
import type { MentionStaff } from './commsMentions'

type Props = {
  onSubmit: (input: NewCommInput) => Promise<BookingComm | null>
  mentionStaff: MentionStaff[]
}

const EMPTY = {
  activity_type: 'phone_call' as CommActivityType,
  direction: 'outgoing' as CommDirection,
  category: 'customer_enquiry' as CommCategory,
  sentiment: 'neutral' as CommSentiment,
  contact_name: '',
  subject: '',
  body: '',
  complaint_type: 'delay' as ComplaintType,
  complaint_severity: 'medium' as ComplaintSeverity,
  complaint_status: 'open' as ComplaintStatus,
}

export default function CommsComposer({ onSubmit, mentionStaff }: Props) {
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const isComplaint = f.category === 'complaint'
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((p) => ({ ...p, [k]: v }))

  const suggestions = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    return mentionStaff.filter((s) => s.handle.includes(q) || s.name.toLowerCase().includes(q)).slice(0, 6)
  }, [mentionQuery, mentionStaff])

  function onBodyChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    set('body', value)
    const caret = e.target.selectionStart ?? value.length
    const m = /@([a-zA-Z0-9._-]*)$/.exec(value.slice(0, caret))
    if (m) { setMentionQuery(m[1]); setActiveIdx(0) } else setMentionQuery(null)
  }

  function pickMention(s: MentionStaff) {
    const ta = taRef.current
    const value = f.body
    const caret = ta?.selectionStart ?? value.length
    const before = value.slice(0, caret).replace(/@([a-zA-Z0-9._-]*)$/, `@${s.handle} `)
    const next = before + value.slice(caret)
    set('body', next)
    setMentionQuery(null)
    requestAnimationFrame(() => {
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(before.length, before.length)
    })
  }

  function onBodyKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && suggestions.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => (i + 1) % suggestions.length); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => (i - 1 + suggestions.length) % suggestions.length); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pickMention(suggestions[activeIdx]); return }
      if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void submit() }
  }

  async function submit() {
    if (!f.body.trim() || busy) return
    setBusy(true)
    const input: NewCommInput = {
      activity_type: f.activity_type,
      direction: f.direction,
      category: f.category,
      sentiment: f.sentiment,
      contact_name: f.contact_name.trim() || null,
      subject: f.subject.trim() || null,
      body: f.body.trim(),
      complaint_type: isComplaint ? f.complaint_type : null,
      complaint_severity: isComplaint ? f.complaint_severity : null,
      complaint_status: isComplaint ? f.complaint_status : null,
    }
    const row = await onSubmit(input)
    setBusy(false)
    if (row) setF((p) => ({ ...EMPTY, activity_type: p.activity_type, direction: p.direction }))
  }

  return (
    <div className="comms-composer">
      <div className="comms-composer__label">Log activity</div>

      <div className="comms-seg">
        {ACTIVITY_TYPES.map((o) => {
          const Icon = ACTIVITY_ICON[o.value]
          return (
            <button key={o.value} type="button"
              className={`comms-seg__btn${f.activity_type === o.value ? ' on' : ''}`}
              onClick={() => set('activity_type', o.value)} title={o.label}>
              <Icon size={14} />
            </button>
          )
        })}
      </div>

      <div className="comms-seg comms-seg--dir">
        {DIRECTIONS.map((o) => (
          <button key={o.value} type="button"
            className={`comms-seg__btn${f.direction === o.value ? ' on' : ''}`}
            onClick={() => set('direction', o.value)}>{o.label}</button>
        ))}
      </div>

      <label className="comms-field">
        <span>Reason / category</span>
        <select className="input input--sm" value={f.category} onChange={(e) => set('category', e.target.value as CommCategory)}>
          {CATEGORIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>

      {isComplaint ? (
        <div className="comms-complaint-fields">
          <label className="comms-field">
            <span>Complaint type</span>
            <select className="input input--sm" value={f.complaint_type} onChange={(e) => set('complaint_type', e.target.value as ComplaintType)}>
              {COMPLAINT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="comms-field">
            <span>Severity</span>
            <select className="input input--sm" value={f.complaint_severity} onChange={(e) => set('complaint_severity', e.target.value as ComplaintSeverity)}>
              {COMPLAINT_SEVERITIES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
          <label className="comms-field">
            <span>Status</span>
            <select className="input input--sm" value={f.complaint_status} onChange={(e) => set('complaint_status', e.target.value as ComplaintStatus)}>
              {COMPLAINT_STATUSES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        </div>
      ) : null}

      <label className="comms-field">
        <span>Sentiment</span>
        <select className="input input--sm" value={f.sentiment} onChange={(e) => set('sentiment', e.target.value as CommSentiment)}>
          {SENTIMENTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>

      <label className="comms-field">
        <span>Contact (optional)</span>
        <input className="input input--sm" value={f.contact_name} onChange={(e) => set('contact_name', e.target.value)} placeholder="Who at the customer" />
      </label>

      <label className="comms-field">
        <span>Subject (optional)</span>
        <input className="input input--sm" value={f.subject} onChange={(e) => set('subject', e.target.value)} />
      </label>

      <label className="comms-field">
        <span>Details</span>
        <div className="comms-mention-wrap">
          <textarea ref={taRef} className="input comms-composer__textarea" rows={4} value={f.body}
            onChange={onBodyChange} onKeyDown={onBodyKeyDown}
            placeholder="What was discussed…  @mention a teammate · ⌘/Ctrl+Enter to log" />
          {mentionQuery !== null && suggestions.length ? (
            <ul className="comms-mention-menu">
              {suggestions.map((s, i) => (
                <li key={s.user_id}
                  className={`comms-mention-item${i === activeIdx ? ' on' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); pickMention(s) }}>
                  <span className="comms-mention-item__handle">@{s.handle}</span>
                  {s.name !== s.handle ? <span className="comms-mention-item__name">{s.name}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </label>

      <button type="button" className="btn comms-composer__submit" onClick={() => void submit()} disabled={busy || !f.body.trim()}>
        {busy ? 'Logging…' : 'Log activity'}
      </button>
    </div>
  )
}

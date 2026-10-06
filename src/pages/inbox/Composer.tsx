import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, Send } from 'lucide-react'
import { toast } from 'sonner'
import { addNote, replyEmail, replyPortal, replyWhatsApp, type InboxDetail } from './inboxApi'
import { windowLeft } from './inboxFormat'
import SuggestionBar from './SuggestionBar'

type Mode = 'reply' | 'note'
type Via = 'whatsapp' | 'portal' | 'email'

type Props = { detail: InboxDetail; who: string; me: string; onSent: () => void }

export default function Composer({ detail, who, me, onSent }: Props) {
  const conv = detail.conversation
  const box = useRef<HTMLTextAreaElement>(null)
  const [mode, setMode] = useState<Mode>('reply')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const waLeft = windowLeft(detail.contact?.window_ends_at ?? null)
  const options = useMemo(() => {
    const o: { key: Via; label: string }[] = []
    if (detail.contact) o.push({ key: 'whatsapp', label: waLeft ? 'WhatsApp' : 'WhatsApp (window closed)' })
    if (detail.email) o.push({ key: 'email', label: `Email (${detail.email.mailbox})` })
    if (detail.account) o.push({ key: 'portal', label: 'Portal' })
    return o
  }, [detail.contact, detail.account, detail.email, waLeft])

  const lastIn = [...detail.messages].reverse().find((m) => m.kind === 'message' && m.direction === 'in')
  const preferred: Via | null = lastIn?.channel === 'email' && detail.email ? 'email'
    : lastIn?.channel === 'whatsapp' && detail.contact && waLeft ? 'whatsapp'
    : detail.email ? 'email' : detail.account ? 'portal' : detail.contact ? 'whatsapp' : null
  const [via, setVia] = useState<Via | null>(preferred)

  useEffect(() => { setVia(preferred); setText(''); setMode('reply') }, [conv.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Per-email "Reply all" / "Add note" actions focus this composer.
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ mode?: Mode; via?: Via }>).detail ?? {}
      if (d.mode) setMode(d.mode)
      if (d.via && options.some((o) => o.key === d.via)) setVia(d.via)
      requestAnimationFrame(() => { box.current?.scrollIntoView({ block: 'nearest' }); box.current?.focus() })
    }
    window.addEventListener('ibx:compose', on)
    return () => window.removeEventListener('ibx:compose', on)
  }, [options])

  const name = who
  const canReply = mode === 'note' || (via === 'whatsapp' ? !!waLeft : via === 'portal' || via === 'email')

  async function send() {
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      if (mode === 'note') await addNote(conv.id, body)
      else if (via === 'whatsapp' && detail.contact) await replyWhatsApp(conv.id, detail.contact.id, body)
      else if (via === 'portal') await replyPortal(conv.id, body)
      else if (via === 'email') await replyEmail(conv.id, body)
      setText('')
      onSent()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
    {mode === 'reply' ? (
      <SuggestionBar detail={detail} who={who} me={me} onChanged={onSent}
        onPick={(t) => { setText(t); requestAnimationFrame(() => box.current?.focus()) }} />
    ) : null}
    <div className={`ibx-composer${mode === 'note' ? ' ibx-composer--note' : ''}`}>
      <div className="ibx-composer__bar">
        <div className="ibx-seg">
          <button type="button" className={mode === 'reply' ? 'on' : ''} onClick={() => setMode('reply')}>Reply</button>
          <button type="button" className={`note${mode === 'note' ? ' on' : ''}`} onClick={() => setMode('note')}>Internal note</button>
        </div>
        {mode === 'reply' && options.length > 0 ? (
          <select className="ibx-select" aria-label="Send via" value={via ?? ''} onChange={(e) => setVia(e.target.value as Via)}>
            {options.map((o) => <option key={o.key} value={o.key}>Send via {o.label}</option>)}
          </select>
        ) : null}
        {mode === 'reply' && via === 'whatsapp' ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, marginLeft: 'auto', color: waLeft ? '#067647' : '#B42318' }}>
            <Clock size={13} />{waLeft ? `Reply window open · ${waLeft} left` : 'Window closed. Reply via Portal or call.'}
          </span>
        ) : null}
        {mode === 'reply' && options.length === 0 ? (
          <span style={{ fontSize: 12, color: '#B42318', marginLeft: 'auto' }}>No reply channel. Link this contact first.</span>
        ) : null}
        {mode === 'note' ? <span style={{ fontSize: 12, color: '#7A4A00', marginLeft: 'auto' }}>Only staff see notes.</span> : null}
      </div>
      <label htmlFor="ibx-compose" style={{ position: 'absolute', left: -9999 }}>Message</label>
      <textarea ref={box} id="ibx-compose" rows={3} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={mode === 'note' ? 'Write a note for the team…' : `Reply to ${name}…`}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void send() } }} />
      <div className="ibx-composer__foot">
        <span style={{ fontSize: 11.5, color: '#64748B', paddingLeft: 8 }}>Ctrl + Enter to send</span>
        <button type="button" className="ibx-btn ibx-btn--primary" style={{ marginLeft: 'auto' }}
          disabled={busy || !text.trim() || !canReply} onClick={() => void send()}>
          {busy ? 'Sending…' : mode === 'note' ? 'Add note' : 'Send'}<Send size={15} />
        </button>
      </div>
    </div>
    </>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  listMessages, sendReply, signedMediaUrl,
  type WhatsAppConversation, type WhatsAppMessage,
} from './whatsappInboxApi'

type Props = {
  contactId: string | null
  conversation: WhatsAppConversation | null
  onSent: () => void
}

function isImageType(msg: WhatsAppMessage): boolean {
  const t = (msg.msg_type ?? '').toLowerCase()
  if (t.includes('image')) return true
  const p = (msg.media_path ?? '').toLowerCase()
  return /\.(jpe?g|png|gif|webp)$/.test(p)
}

function MediaBlock({ msg }: { msg: WhatsAppMessage }) {
  const [url, setUrl] = useState<string | null>(null)
  const [err, setErr] = useState(false)

  useEffect(() => {
    if (!msg.media_path) return
    let cancelled = false
    void signedMediaUrl(msg.media_path)
      .then((u) => { if (!cancelled) setUrl(u) })
      .catch(() => { if (!cancelled) setErr(true) })
    return () => { cancelled = true }
  }, [msg.media_path])

  if (!msg.media_path) return null
  if (err) return <span className="wa-msg__media-err">Media unavailable</span>
  if (!url) return <span className="wa-msg__media-loading">Loading media…</span>
  if (isImageType(msg)) {
    return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" className="wa-msg__thumb" /></a>
  }
  return <a href={url} target="_blank" rel="noreferrer" className="wa-msg__doc">Download document</a>
}

function MessageBubble({ msg }: { msg: WhatsAppMessage }) {
  const out = msg.direction === 'outbound'
  const showType = msg.msg_type && msg.msg_type !== 'text'
  return (
    <div className={`wa-msg${out ? ' wa-msg--out' : ' wa-msg--in'}`}>
      {showType ? <span className="wa-msg__type">{msg.msg_type}</span> : null}
      {msg.body ? <div className="wa-msg__body">{msg.body}</div> : null}
      <MediaBlock msg={msg} />
      {msg.related_booking_id ? (
        <Link to={`/bookings/${msg.related_booking_id}`} className="wa-msg__link">
          Linked: {msg.related_booking_id.slice(0, 8)}…
        </Link>
      ) : null}
    </div>
  )
}

export default function MessageThread({ contactId, conversation, onSent }: Props) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const reload = useCallback(async () => {
    if (!contactId) { setMessages([]); return }
    setLoading(true)
    try {
      setMessages(await listMessages(contactId))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not load messages')
    } finally {
      setLoading(false)
    }
  }, [contactId])

  useEffect(() => { void reload() }, [reload])

  async function handleSend() {
    const trimmed = text.trim()
    if (!contactId || !trimmed || sending) return
    setSending(true)
    try {
      await sendReply(contactId, trimmed)
      setText('')
      await reload()
      onSent()
    } catch (err) {
      const code = err instanceof Error ? err.message : 'send_failed'
      toast.error(code === 'send_failed' ? 'Message could not be sent.' : code)
    } finally {
      setSending(false)
    }
  }

  if (!contactId || !conversation) {
    return <div className="wa-inbox-thread__empty">Select a conversation</div>
  }

  const title = conversation.account_name ?? conversation.wa_id

  return (
    <div className="wa-inbox-thread">
      <header className="wa-inbox-thread__head">
        <div>
          <h2 className="wa-inbox-thread__title">{title}</h2>
          <div className="wa-inbox-thread__meta">{conversation.wa_id}</div>
        </div>
        <div className="wa-inbox-thread__chips">
          {conversation.verified ? <span className="wa-inbox-chip wa-inbox-chip--ok">Verified</span> : null}
          {conversation.opted_in ? <span className="wa-inbox-chip wa-inbox-chip--ok">Opted in</span> : null}
        </div>
      </header>

      <div className="wa-inbox-thread__body">
        {loading && !messages.length ? <p className="wa-inbox-thread__loading">Loading messages…</p> : null}
        {messages.map((m) => <MessageBubble key={m.id} msg={m} />)}
      </div>

      <footer className="wa-inbox-thread__foot">
        <textarea
          className="input wa-inbox-thread__input"
          rows={2}
          placeholder="Type a reply…"
          value={text}
          disabled={sending}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
          }}
        />
        <button type="button" className="btn wa-inbox-thread__send" disabled={sending || !text.trim()} onClick={() => void handleSend()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </footer>
    </div>
  )
}

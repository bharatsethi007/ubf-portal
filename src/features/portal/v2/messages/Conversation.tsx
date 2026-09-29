import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import { detailPath } from '../homeModel'
import { getThread, sendMessage, when, type ThreadDetail } from './messagesApi'

type Props = { threadId: string; onSent: () => void; onBack: () => void }
const POLL_MS = 20_000

/** One conversation: messages bottom-up and a reply box. Polls while open. */
export default function Conversation({ threadId, onSent, onBack }: Props) {
  const [t, setT] = useState<ThreadDetail | null>(null)
  const [err, setErr] = useState('')
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    const load = () => getThread(threadId).then((r) => { if (alive) { setT(r); setErr('') } }).catch((e) => { if (alive) setErr(e.message) })
    setT(null); void load()
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, POLL_MS)
    return () => { alive = false; window.clearInterval(id) }
  }, [threadId])

  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [t?.messages.length])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setBusy(true); setErr('')
    try {
      await sendMessage({ thread: threadId, body: text })
      setText('')
      setT(await getThread(threadId))
      onSent()
    } catch (x) { setErr(x instanceof Error ? x.message : 'Could not send') } finally { setBusy(false) }
  }

  return (
    <div className="pv3-msg__conv">
      <header className="pv3-msg__chead">
        <button type="button" className="pv3-iconbtn pv3-msg__back" onClick={onBack} aria-label="Back to conversations"><ArrowLeft size={16} /></button>
        <div>
          <b>{t?.subject ?? 'Loading…'}</b>
          {t?.job_unique != null && <Link to={detailPath({ job_unique: t.job_unique })} className="pv3-link">View shipment</Link>}
        </div>
        {t?.status === 'closed' && <span className="pv3-msg__closed">Closed. Reply to reopen.</span>}
      </header>
      <div className="pv3-msg__stream">
        {!t && !err && <div className="pv3-skel-list" style={{ padding: 16 }}>{[0, 1, 2].map((i) => <span key={i} className="pv3-skel" />)}</div>}
        {t?.messages.map((m) => (
          <div key={m.id} className={`pv3-msg__bubble pv3-msg__bubble--${m.kind === 'staff' ? 'them' : 'me'}`}>
            <span className="pv3-msg__who">{m.kind === 'staff' ? `${m.name ?? 'UB Freight'} · UB Freight` : m.mine ? 'You' : m.name}</span>
            <p>{m.body}</p>
            <time>{when(m.at)}</time>
          </div>
        ))}
        <div ref={end} />
      </div>
      {err && <div className="pv3-error" style={{ margin: '0 16px' }}>{err}</div>}
      <form className="pv3-msg__compose" onSubmit={(e) => void submit(e)}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a message" rows={2} maxLength={4000}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void submit(e) }} aria-label="Message" />
        <button type="submit" className="pv3-btn pv3-btn--primary" disabled={busy || !text.trim()}>
          {busy ? <Loader2 size={15} className="pv3-spin" /> : <Send size={15} />} Send
        </button>
      </form>
    </div>
  )
}

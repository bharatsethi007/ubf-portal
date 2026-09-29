import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { detailPath } from '../homeModel'
import Composer from './Composer'
import { getThread, sendMessage, type Message, type ThreadDetail } from './messagesApi'
import { groupMessages } from './messageGroups'

type Props = { threadId: string; onSent: () => void; onBack: () => void }
const POLL_MS = 15_000

/** One conversation, iMessage style: grouped bubbles, time breaks, pill composer. Polls while open. */
export default function Conversation({ threadId, onSent, onBack }: Props) {
  const [t, setT] = useState<ThreadDetail | null>(null)
  const [pending, setPending] = useState<Message[]>([])
  const [err, setErr] = useState('')
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    const load = () => getThread(threadId).then((r) => { if (alive) { setT(r); setErr('') } }).catch((e) => { if (alive) setErr(e.message) })
    setT(null); setPending([]); void load()
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, POLL_MS)
    return () => { alive = false; window.clearInterval(id) }
  }, [threadId])

  const all = [...(t?.messages ?? []), ...pending]
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [all.length])

  async function send(body: string) {
    const temp: Message = { id: -Date.now(), kind: 'customer', name: null, body, at: new Date().toISOString(), mine: true }
    setPending((p) => [...p, temp]); setErr('')
    try {
      await sendMessage({ thread: threadId, body })
      const fresh = await getThread(threadId)
      setT(fresh); setPending((p) => p.filter((m) => m.id !== temp.id))
      onSent()
    } catch (x) {
      setPending((p) => p.filter((m) => m.id !== temp.id))
      setErr(x instanceof Error ? x.message : 'Not delivered. Try again.')
      throw x
    }
  }

  const groups = groupMessages(all)
  const lastMine = [...all].reverse().find((m) => m.mine)

  return (
    <div className="im-conv">
      <header className="im-conv__head">
        <button type="button" className="im-back" onClick={onBack} aria-label="Back to conversations"><ChevronLeft size={22} /></button>
        <span className="im-avatar im-avatar--ubf" aria-hidden>UB</span>
        <div className="im-conv__title">
          <b>{t?.subject ?? ' '}</b>
          <span>
            UB Freight
            {t?.job_unique != null && <> · <Link to={detailPath({ job_unique: t.job_unique })}>View shipment</Link></>}
          </span>
        </div>
      </header>

      <div className="im-stream">
        {!t && !err && <div className="im-loading"><span /><span /><span /></div>}
        {t && !all.length && <p className="im-break">No messages yet</p>}
        {groups.map((g) => (
          <div key={g.key}>
            {g.breakLabel && <p className="im-break">{g.breakLabel}</p>}
            <div className={`im-group im-group--${g.mine ? 'me' : 'them'}`}>
              {!g.mine && g.name && <span className="im-name">{g.name}</span>}
              {g.items.map((m, i) => (
                <p key={m.id} title={new Date(m.at).toLocaleString('en-NZ')}
                  className={`im-bubble${i === g.items.length - 1 ? ' im-bubble--tail' : ''}${m.id < 0 ? ' im-bubble--sending' : ''}`}>
                  {m.body}
                </p>
              ))}
            </div>
          </div>
        ))}
        {lastMine && <p className="im-receipt">{lastMine.id < 0 ? 'Sending…' : 'Delivered'}</p>}
        {t?.status === 'closed' && <p className="im-break">Conversation closed. Send a message to reopen it.</p>}
        <div ref={end} />
      </div>

      {err && <p className="im-err">{err}</p>}
      <Composer onSend={send} autoFocus />
    </div>
  )
}

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, CheckCheck, Lock, Monitor, Paperclip } from 'lucide-react'
import { fileKey, signedUrl } from '../../lib/fileStore'
import type { InboxMessage } from './inboxApi'
import { avatarColors, CHANNEL_META, clock, dayLabel, initials } from './inboxFormat'
import { EmailBody, OutlookLink } from './EmailParts'

function ChannelTag({ m }: { m: InboxMessage }) {
  if (m.channel === 'portal') return <><Monitor size={12} strokeWidth={2} />Portal</>
  return <><span className="ibx-dot" style={{ background: CHANNEL_META[m.channel].color }} />{CHANNEL_META[m.channel].label}</>
}

function Ticks({ status }: { status: string | null }) {
  if (status === 'read') return <CheckCheck size={13} color="#2563EB" />
  if (status === 'delivered') return <CheckCheck size={13} />
  if (status === 'failed') return <span style={{ color: '#B42318', fontWeight: 500 }}>Failed</span>
  return <Check size={13} />
}

function Media({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const isImg = /\.(jpe?g|png|gif|webp)$/i.test(path)
  useEffect(() => {
    let live = true
    signedUrl(fileKey('whatsapp-media', path), { expires: 3600 }).then((u) => { if (live) setUrl(u) }).catch(() => {})
    return () => { live = false }
  }, [path])
  if (isImg && url) return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="Attachment" style={{ maxWidth: 240, borderRadius: 10, display: 'block', marginBottom: 6 }} /></a>
  return (
    <a href={url ?? undefined} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500, color: 'inherit' }}>
      <Paperclip size={14} />{path.split('/').pop()}
    </a>
  )
}

export default function MessageTimeline({ messages, who }: { messages: InboxMessage[]; who: string }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [messages.length])
  const av = avatarColors(who)
  let lastDay = ''
  let lastSubject = ''

  return (
    <div className="ibx-msgs">
      {messages.length === 0 ? <div className="ibx-empty">No messages yet.</div> : null}
      {messages.map((m, i) => {
        const day = dayLabel(m.created_at)
        const divider = day !== lastDay ? <div className="ibx-day">{day}</div> : null
        lastDay = day
        const prev = messages[i - 1]
        const grouped = prev && prev.kind === 'message' && prev.direction === m.direction && prev.sender_kind === m.sender_kind
          && Date.parse(m.created_at) - Date.parse(prev.created_at) < 5 * 60000 && !divider

        let node: ReactNode
        const subj = (m.email?.subject ?? '').replace(/^\s*((re|fw|fwd)\s*:\s*)+/i, '').trim()
        const showSubject = m.channel === 'email' && !!subj && subj !== lastSubject
        if (m.channel === 'email' && subj) lastSubject = subj
        if (m.kind === 'event') {
          node = <div className="ibx-event">{m.body} · {m.sender_name ? `${m.sender_name} · ` : ''}{clock(m.created_at)}</div>
        } else if (m.kind === 'note') {
          node = (
            <div className="ibx-note">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: '#7A4A00', marginBottom: 4 }}>
                <Lock size={12} />Internal note · {m.sender_name ?? 'Staff'} · {clock(m.created_at)}
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5, color: '#3D2A00', whiteSpace: 'pre-wrap' }}>{m.body}</div>
            </div>
          )
        } else if (m.direction === 'in') {
          node = (
            <div className="ibx-row">
              {grouped ? <span style={{ width: 28, flex: 'none' }} /> : <span className="ibx-av ibx-av--sm" style={av}>{initials(m.sender_name ?? who)}</span>}
              <div style={{ minWidth: 0 }}>
                <div className="ibx-bubble ibx-bubble--in">
                  {m.channel === 'email' ? <EmailBody m={m} showSubject={showSubject} /> : (
                    <>
                      {m.media_path ? <Media path={m.media_path} /> : null}
                      {m.body ?? (m.media_path ? null : `[${m.msg_type ?? 'message'}]`)}
                    </>
                  )}
                </div>
                <div className="ibx-meta">
                  {m.channel === 'email' && m.sender_name ? `${m.sender_name} · ` : ''}<ChannelTag m={m} /> · {clock(m.created_at)}
                  {m.channel === 'email' ? <> · <OutlookLink m={m} /></> : null}
                </div>
              </div>
            </div>
          )
        } else {
          const auto = m.sender_kind === 'system'
          node = (
            <div className="ibx-row ibx-row--out">
              <div className={`ibx-bubble ${auto ? 'ibx-bubble--auto' : 'ibx-bubble--out'}`}>
                {m.channel === 'email' ? <EmailBody m={m} showSubject={showSubject} /> : m.body}
              </div>
              <div className="ibx-meta">
                {auto ? 'Auto-reply' : m.sender_name ?? 'UB Freight'} · <ChannelTag m={m} /> · {clock(m.created_at)}
                {m.channel === 'whatsapp' ? <Ticks status={m.status} /> : null}
                {m.channel === 'email' ? <> · <OutlookLink m={m} /></> : null}
              </div>
            </div>
          )
        }
        return <div key={m.id} style={{ display: 'contents' }}>{divider}{node}</div>
      })}
      <div ref={end} />
    </div>
  )
}

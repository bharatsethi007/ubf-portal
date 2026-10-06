// Email-specific bits inside a timeline bubble: subject line, collapsible long body, attachments, Outlook link.
import { useState } from 'react'
import { ExternalLink, Paperclip } from 'lucide-react'
import { toast } from 'sonner'
import { fileKey, signedUrl } from '../../lib/fileStore'
import type { EmailAttachment, InboxMessage } from './inboxApi'

const LIMIT = 900

function kb(n: number | null): string {
  if (!n) return ''
  return n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
}

async function open(a: EmailAttachment) {
  try {
    const url = await signedUrl(fileKey('booking-emails', a.s3_key), { expires: 600 })
    if (url) window.open(url, '_blank', 'noopener')
  } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not open file') }
}

export function EmailBody({ m, showSubject }: { m: InboxMessage; showSubject: boolean }) {
  const [full, setFull] = useState(false)
  const body = (m.body ?? '').trim()
  const long = body.length > LIMIT
  const em = m.email
  return (
    <>
      {showSubject && em?.subject ? <div style={{ fontWeight: 500, marginBottom: 4 }}>{em.subject}</div> : null}
      <div>{long && !full ? `${body.slice(0, LIMIT)}…` : body || '(no text)'}</div>
      {long ? (
        <button type="button" onClick={() => setFull(!full)}
          style={{ marginTop: 4, border: 0, background: 'none', padding: 0, color: 'inherit', opacity: 0.75, font: 'inherit', fontSize: 12.5, textDecoration: 'underline', cursor: 'pointer' }}>
          {full ? 'Show less' : 'Show more'}
        </button>
      ) : null}
      {em?.attachments?.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {em.attachments.map((a) => (
            <button key={a.s3_key} type="button" className="ibx-att" onClick={() => void open(a)} title={a.name}>
              <Paperclip size={12} /><span className="ibx-ellip" style={{ maxWidth: 180 }}>{a.name}</span>
              <span style={{ opacity: 0.7 }}>{kb(a.size)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </>
  )
}

export function OutlookLink({ m }: { m: InboxMessage }) {
  if (!m.email?.web_link) return null
  return (
    <a href={m.email.web_link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: 'inherit' }}>
      Outlook<ExternalLink size={11} />
    </a>
  )
}

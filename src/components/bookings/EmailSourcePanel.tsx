import { ChevronDown, Mail } from 'lucide-react'
import { useState } from 'react'
import type { BookingSourceEmail } from './bookingSourceEmailApi'
import { attachmentFileName } from './bookingSourceEmailApi'
import './emailSourcePanel.css'

type Props = {
  source: BookingSourceEmail
  attachmentUrls: Record<string, string>
  attachmentErrors: Record<string, string>
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function EmailSourcePanel({ source, attachmentUrls = {}, attachmentErrors = {} }: Props) {
  const [open, setOpen] = useState(false)
  const paths = Array.isArray(source?.attachment_paths) ? source.attachment_paths : []

  return (
    <aside className="bf-email-panel">
      <button
        type="button"
        className="bf-email-panel__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="bf-email-panel__toggle-main">
          <Mail size={16} aria-hidden />
          <span>Source email</span>
        </span>
        <ChevronDown size={16} className={`bf-email-panel__chev${open ? ' bf-email-panel__chev--open' : ''}`} aria-hidden />
      </button>

      {open && (
        <div className="bf-email-panel__body">
          <dl className="bf-email-panel__meta">
            <div><dt>Subject</dt><dd>{source?.subject ?? '—'}</dd></div>
            <div><dt>From</dt><dd>{source?.from_address ?? '—'}</dd></div>
            <div><dt>Forwarded by</dt><dd>{source?.forwarded_by ?? '—'}</dd></div>
            <div><dt>Received</dt><dd>{formatWhen(source?.received_at ?? null)}</dd></div>
          </dl>

          {paths.length > 0 && (
            <div className="bf-email-panel__attachments">
              <p className="bf-email-panel__label">Attachments</p>
              <ul>
                {paths.map((path) => (
                  <li key={path}>
                    {attachmentUrls[path] ? (
                      <a href={attachmentUrls[path]} target="_blank" rel="noopener noreferrer">
                        {attachmentFileName(path)}
                      </a>
                    ) : (
                      <span className="muted">{attachmentFileName(path)}</span>
                    )}
                    {attachmentErrors[path] && (
                      <span className="bf-email-panel__att-err">{attachmentErrors[path]}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <pre className="bf-email-panel__body-text">{source?.raw_body?.trim() || 'No email body stored.'}</pre>
        </div>
      )}
    </aside>
  )
}

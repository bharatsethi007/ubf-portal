import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Reply, Mail, ChevronDown, Check } from 'lucide-react'
import { fetchQuoteThreads, mailboxShort, NEW_EMAIL, type QuoteThread, type SendAs } from './quoteRemindersApi'

type Props = { quoteId: string; email: string; value: SendAs; onChange: (v: SendAs) => void; disabled?: boolean }

function when(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short' }) : ''
}

/** "Send as" control: continue an email thread, or start a new email. */
export default function ThreadPicker({ quoteId, email, value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState<QuoteThread[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let live = true
    setThreads(null); setError(null)
    fetchQuoteThreads(quoteId, email.trim() || null)
      .then((t) => { if (live) setThreads(t) })
      .catch((e) => { if (live) setError(e instanceof Error ? e.message : 'Could not load threads') })
    const onDoc = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => { live = false; document.removeEventListener('mousedown', onDoc) }
  }, [open, quoteId, email])

  const isNew = value.id === 'new'
  const pick = (v: SendAs) => { onChange(v); setOpen(false) }

  return (
    <div ref={box} className="relative">
      <button
        type="button" disabled={disabled} onClick={() => setOpen((o) => !o)}
        className="inline-flex w-[210px] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-left text-xs text-slate-700 hover:border-slate-300"
        title={isNew ? 'New email from Sales Support' : `Reply in thread: ${value.label} (${value.mailbox})`}
      >
        {isNew ? <Mail size={13} className="shrink-0 text-slate-400" /> : <Reply size={13} className="shrink-0" style={{ color: '#0A2472' }} />}
        <span className="min-w-0 flex-1 truncate">{isNew ? 'New email' : value.label}</span>
        {!isNew && <span className="shrink-0 text-[10px] text-slate-400">{mailboxShort(value.mailbox)}</span>}
        <ChevronDown size={13} className="shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-[380px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          <Row active={isNew} onClick={() => pick(NEW_EMAIL)} icon={<Mail size={13} className="text-slate-400" />}
            title="New email" sub="Branded reminder from Sales Support, owner in CC" />
          <div className="my-1 border-t border-slate-100" />
          <div className="px-3 py-1 text-[10px] uppercase tracking-wide text-slate-400">Continue a thread (reply-all)</div>
          {error && <p className="px-3 py-2 text-xs text-red-700">{error}</p>}
          {!threads && !error && <p className="px-3 py-2 text-xs text-slate-500">Loading…</p>}
          {threads && !threads.length && <p className="px-3 py-2 text-xs text-slate-500">No email threads for this quote or contact.</p>}
          <div className="max-h-[260px] overflow-auto">
            {threads?.map((t) => (
              <Row
                key={t.conversation_id}
                active={value.id === t.conversation_id}
                onClick={() => pick({ id: t.conversation_id, label: t.subject || '(no subject)', mailbox: t.mailbox })}
                icon={<Reply size={13} style={{ color: '#0A2472' }} />}
                title={t.subject || '(no subject)'}
                sub={`${mailboxShort(t.mailbox)} · ${t.contact_email ?? 'no contact'} · ${when(t.last_message_at)}`}
                tag={t.linked ? 'This quote' : undefined}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ active, onClick, icon, title, sub, tag }: {
  active: boolean; onClick: () => void; icon: ReactNode; title: string; sub: string; tag?: string
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-start gap-2 px-3 py-1.5 text-left hover:bg-slate-50">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-xs text-slate-900">{title}</span>
          {tag && <span className="shrink-0 rounded bg-indigo-50 px-1 text-[10px]" style={{ color: '#0A2472' }}>{tag}</span>}
        </span>
        <span className="block truncate text-[11px] text-slate-500">{sub}</span>
      </span>
      {active && <Check size={13} className="mt-0.5 shrink-0" style={{ color: '#047857' }} />}
    </button>
  )
}

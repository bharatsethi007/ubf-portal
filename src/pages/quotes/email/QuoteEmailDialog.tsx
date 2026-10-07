import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { pdf } from '@react-pdf/renderer'
import { FileText, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../../supabase'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue'
import { usePorts } from '../../../hooks/usePorts'
import { resolvePortLabel } from '../../../features/portal/dashboard/portalPortDisplay'
import { registerQuoteFonts } from '../pdf/quotePdfFonts'
import QuotePdfDocument from '../pdf/QuotePdfDocument'
import { useQuotePdfData, type PdfResp } from '../pdf/useQuotePdfData'
import { fetchQuoteResponses } from '../quoteResponsesApi'
import EmailThreadList from './EmailThreadList'
import {
  blobToBase64, defaultMessage, fetchEmailFacts, fetchThreads, sendQuoteEmail, splitEmails,
  type EmailThread, type QuoteEmailFacts,
} from './quoteEmailApi'

registerQuoteFonts()

type Props = { quoteId: string; onClose: () => void; onSent?: () => void }
const NEW_FROM = 'salessupport.nz@ubfreight.com'

export default function QuoteEmailDialog({ quoteId, onClose, onSent }: Props) {
  const { ports } = usePorts()
  const [facts, setFacts] = useState<QuoteEmailFacts | null>(null)
  const [responses, setResponses] = useState<PdfResp[] | null>(null)
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [threadsLoading, setThreadsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [thread, setThread] = useState<EmailThread | null>(null)
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [attach, setAttach] = useState(true)
  const [actions, setActions] = useState(true)
  const [sending, setSending] = useState(false)
  const debounced = useDebouncedValue(search, 300)
  const { data: pdfData, loading: pdfLoading } = useQuotePdfData(quoteId, responses)

  useEffect(() => {
    if (!ports.size) return
    const portName = (c: string | null) => (c ? resolvePortLabel(c, null, ports) : '?')
    let alive = true
    ;(async () => {
      try {
        const [f, rs, { data: u }] = await Promise.all([
          fetchEmailFacts(quoteId, portName),
          fetchQuoteResponses(quoteId),
          supabase.auth.getUser(),
        ])
        const { data: me } = u.user ? await supabase.from('staff_users').select('full_name').eq('user_id', u.user.id).maybeSingle() : { data: null }
        if (!alive) return
        setFacts(f)
        setResponses(rs.map((r) => ({ id: r.id, response_no: r.response_no })))
        setTo(f.contactEmail ?? '')
        setSubject(`Quote ${f.quoteNo}: ${f.lane}`)
        setText(defaultMessage(f, me?.full_name ?? null))
      } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not load quote') }
    })()
    return () => { alive = false }
  }, [quoteId, ports.size]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true
    setThreadsLoading(true)
    fetchThreads(quoteId, debounced)
      .then((t) => {
        if (!alive) return
        setThreads(t)
        // First load only: preselect a thread that mentions this quote.
        if (!debounced) { const s = t.find((x) => x.suggested); if (s) pickThread(s) }
      })
      .catch(() => { if (alive) setThreads([]) })
      .finally(() => { if (alive) setThreadsLoading(false) })
    return () => { alive = false }
  }, [quoteId, debounced]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !sending) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, sending])

  function pickThread(t: EmailThread | null) {
    setThread(t)
    if (t) setTo((cur) => (t.contact_email ? t.contact_email : cur))
    else if (facts?.contactEmail) setTo(facts.contactEmail)
  }

  const toList = useMemo(() => splitEmails(to), [to])
  const pdfName = `${facts?.quoteNo || 'quotation'}.pdf`
  const pdfReady = !attach || (!!pdfData && !pdfLoading)
  const canSend = !!facts && toList.length > 0 && text.trim() && (thread || subject.trim()) && pdfReady && !sending

  async function send() {
    if (!facts || !canSend) return
    setSending(true)
    try {
      let b64: string | null = null
      if (attach && pdfData) b64 = await blobToBase64(await pdf(<QuotePdfDocument data={pdfData} />).toBlob())
      const res = await sendQuoteEmail({
        quote_id: quoteId, conversation_id: thread?.id ?? null, to: toList, cc: splitEmails(cc),
        subject: subject.trim(), text, pdf_base64: b64, pdf_name: b64 ? pdfName : null, include_actions: actions,
      })
      toast.success(res.mode === 'reply' ? `Replied in thread from ${res.from}` : `Sent from ${res.from}`)
      onSent?.()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed')
    } finally { setSending(false) }
  }

  const lbl = 'mb-1 block text-xs text-slate-500'
  return (
    <div style={overlay} onClick={() => !sending && onClose()}>
      <div style={sheet} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Email quote">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <div className="text-base text-slate-900">Email quote {facts?.quoteNo ?? ''}</div>
            <div className="text-xs text-slate-500">From {thread ? thread.mailbox : NEW_FROM}{thread ? ' · reply all, keeps everyone on the thread' : ''}</div>
          </div>
          <button type="button" className="icon-btn" title="Close" aria-label="Close" onClick={onClose} disabled={sending}><X size={17} /></button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0" style={{ gridTemplateColumns: 'minmax(0, 1fr) 340px' }}>
          <div className="flex min-h-0 flex-col gap-3 overflow-auto px-5 py-4">
            <label><span className={lbl}>{thread ? 'Also send to' : 'To'}</span>
              <input className="input input--sm" value={to} onChange={(e) => setTo(e.target.value)} placeholder="customer@email.com, second@email.com" />
            </label>
            <label><span className={lbl}>{thread ? 'Also CC' : 'CC'}</span>
              <input className="input input--sm" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="Optional" />
            </label>
            <label><span className={lbl}>Subject</span>
              {thread
                ? <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">RE: {thread.subject || '(no subject)'}</div>
                : <input className="input input--sm" value={subject} onChange={(e) => setSubject(e.target.value)} />}
            </label>
            <label className="flex min-h-0 flex-1 flex-col"><span className={lbl}>Message</span>
              <textarea className="input" style={{ minHeight: 240, flex: 1, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, padding: 10 }}
                value={text} onChange={(e) => setText(e.target.value)} />
            </label>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-700">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={attach} onChange={(e) => setAttach(e.target.checked)} />
                <FileText size={14} className="text-slate-500" /> {pdfName}
                {attach && <span className="text-xs text-slate-400">{pdfLoading || !pdfData ? (responses?.length === 0 ? 'no rates yet' : 'preparing…') : 'ready'}</span>}
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={actions} onChange={(e) => setActions(e.target.checked)} /> Accept / Decline buttons
              </label>
            </div>
          </div>
          <div className="min-h-0 border-l border-slate-200 bg-slate-50/60 px-4 py-4">
            <EmailThreadList threads={threads} loading={threadsLoading} selected={thread?.id ?? null} onSelect={pickThread} search={search} onSearch={setSearch} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
          <span className="text-xs text-slate-500">Sent through Outlook. Shows in the inbox thread and Sent Items.</span>
          <button type="button" className="btn btn--inline" disabled={!canSend} onClick={send}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 'auto', opacity: canSend ? 1 : 0.5 }}>
            <Send size={15} /> {sending ? 'Sending…' : thread ? 'Send reply' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}

const overlay: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
}
const sheet: CSSProperties = {
  background: '#fff', borderRadius: 12, width: 'min(1120px, 96vw)', height: 'min(760px, 90vh)',
  display: 'flex', flexDirection: 'column', boxShadow: '0 20px 50px rgba(15,23,42,0.25)', overflow: 'hidden',
}

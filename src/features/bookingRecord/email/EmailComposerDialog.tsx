import { useEffect, useState } from 'react'
import { Send, Loader2, Paperclip, X, Truck, Container, User, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import RecipientInput from './RecipientInput'
import ContactPicker from './ContactPicker'
import RichEditor from './RichEditor'
import AttachmentPanel, { MAX_ATTACH_BYTES, fmtSize } from './AttachmentPanel'
import { sendBookingEmail } from './emailApi'
import type { ComposerKind, ComposerPreset } from './composerPresets'
import type { BookingDocumentRow } from '../documents/documentTypes'

type Props = {
  open: boolean; onClose: () => void
  bookingId: string; bookingRef: string | null; accountId: string | null
  mailbox: string | null; kind: ComposerKind; preset: ComposerPreset | null; loading: boolean
  canCustomer: boolean
  onSwitch: (k: ComposerKind) => void; onSent?: () => void
}

const KINDS: { k: ComposerKind; label: string; icon: typeof Truck }[] = [
  { k: 'delivery', label: 'Delivery', icon: Truck },
  { k: 'empty', label: 'Empty pickup', icon: Container },
  { k: 'customer', label: 'Customer', icon: User },
  { k: 'blank', label: 'Blank', icon: PenLine },
]

/** Outlook-friendly HTML: empty paragraphs keep their height, one font for the whole mail. */
function finalHtml(html: string): string {
  const body = html.replace(/<p><\/p>/g, '<p>&nbsp;</p>').replace(/<p>/g, '<p style="margin:0">')
  return `<div style="font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1f2937">${body}</div>`
}

export default function EmailComposerDialog(p: Props) {
  const [to, setTo] = useState<string[]>([]), [cc, setCc] = useState<string[]>([]), [showCc, setShowCc] = useState(false)
  const [subject, setSubject] = useState(''), [html, setHtml] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [docs, setDocs] = useState<BookingDocumentRow[]>([])
  const [busy, setBusy] = useState(false)
  const [resetKey, setResetKey] = useState('')

  useEffect(() => {
    if (!p.preset) return
    setTo((cur) => (p.preset!.to.length ? p.preset!.to : cur))
    setSubject(p.preset.subject); setHtml(p.preset.html)
    setResetKey(`${p.kind}-${Date.now()}`)
  }, [p.preset, p.kind])

  useEffect(() => { if (!p.open) { setTo([]); setCc([]); setShowCc(false); setSelected(new Set()) } }, [p.open])

  const picked = docs.filter((d) => selected.has(d.id))
  const total = picked.reduce((s, d) => s + Number(d.size_bytes ?? 0), 0)
  const canSend = !busy && !p.loading && to.length > 0 && subject.trim().length > 0 && total <= MAX_ATTACH_BYTES

  async function send() {
    if (!canSend) return
    setBusy(true)
    try {
      const r = await sendBookingEmail({
        booking_id: p.bookingId, to, cc, subject: subject.trim(), html: finalHtml(html),
        document_ids: [...selected], purpose: p.preset?.purpose ?? 'general',
      })
      toast.success(`Sent from ${r.from}${r.attachments.length ? ` with ${r.attachments.length} attachment${r.attachments.length === 1 ? '' : 's'}` : ''}`)
      p.onSent?.(); p.onClose()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Send failed') } finally { setBusy(false) }
  }

  return (
    <Dialog open={p.open} onOpenChange={(v) => { if (!v && !busy) p.onClose() }}>
      <DialogContent
        className="flex h-[min(86vh,780px)] w-[min(1120px,96vw)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none"
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void send() } }}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div className="min-w-0">
            <DialogTitle className="text-[15px] font-semibold text-slate-900">New email <span className="mono font-normal text-slate-500">· {p.bookingRef}</span></DialogTitle>
            <div className="text-[12px] text-slate-500">From <span className="text-slate-700">{p.mailbox ?? 'mailbox not set'}</span> · logged in booking comms</div>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 mr-8">
            {KINDS.filter((k) => k.k !== 'customer' || p.canCustomer).map(({ k, label, icon: Icon }) => (
              <button key={k} type="button" onClick={() => p.onSwitch(k)} title={`${label} template`}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] ${p.kind === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col px-5 pb-4">
            <div className="relative">
              <RecipientInput label="To" value={to} onChange={setTo} kind={p.preset?.contactKind} autoFocus={!to.length} />
              {!showCc && (
                <button type="button" className="text-link absolute right-0 top-3 text-[12px]" onClick={() => setShowCc(true)}>Cc</button>
              )}
            </div>
            {showCc && <RecipientInput label="Cc" value={cc} onChange={setCc} kind={p.preset?.contactKind} />}
            {p.preset?.purpose === 'customer' && p.preset.suggestions && (
              <ContactPicker contacts={p.preset.suggestions} to={to} cc={cc} onTo={setTo} />
            )}
            <div className="flex items-center gap-3 border-b border-slate-100 py-2">
              <span className="w-10 shrink-0 text-[12px] font-medium text-slate-500">Subject</span>
              <input value={subject} onChange={(e) => setSubject(e.target.value)}
                className="flex-1 border-0 bg-transparent py-1 text-[14px] font-medium text-slate-900 outline-none" />
            </div>
            <div className="mt-3 flex min-h-0 flex-1 flex-col">
              {p.loading ? (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-slate-200 text-slate-400"><Loader2 className="animate-spin" size={18} /></div>
              ) : (
                <RichEditor html={html} resetKey={resetKey} onChange={setHtml} />
              )}
            </div>
            {picked.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {picked.map((d) => (
                  <span key={d.id} className="inline-flex max-w-[260px] items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] text-slate-700">
                    <Paperclip size={12} className="shrink-0 text-slate-400" />
                    <span className="truncate">{d.file_name}</span>
                    <span className="shrink-0 text-slate-400">{fmtSize(d.size_bytes)}</span>
                    <button type="button" title="Remove" aria-label={`Remove ${d.file_name}`} className="text-slate-400 hover:text-slate-700"
                      onClick={() => { const n = new Set(selected); n.delete(d.id); setSelected(n) }}><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <AttachmentPanel bookingId={p.bookingId} accountId={p.accountId} selected={selected} onSelected={setSelected} onDocs={setDocs} />
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 bg-white px-5 py-3">
          <span className="text-[12px] text-slate-500">Ctrl + Enter to send · copy lands in {p.mailbox ?? 'the mailbox'} Sent Items</span>
          <div className="flex items-center gap-3">
            <button type="button" className="text-link" onClick={p.onClose} disabled={busy}>Discard</button>
            <button type="button" onClick={() => void send()} disabled={!canSend}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0A2472] px-4 text-[13px] font-medium text-white hover:bg-[#0c2c8a] disabled:opacity-40">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} {busy ? 'Sending' : 'Send'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

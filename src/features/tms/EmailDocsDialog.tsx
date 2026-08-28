import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { sendPodDocEmail } from './sendPodEmail'
import { sendPickupDocsEmail } from './sendPickupDocs'
import type { TmsConsignmentDetail } from './tmsApi'

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

// Drop-offs send a POD to the receiver; everything else sends the Consignment Note + Labels to the sender.
export default function EmailDocsDialog({ consignment, open, onClose }: {
  consignment: TmsConsignmentDetail | null; open: boolean; onClose: () => void
}) {
  const isPod = consignment?.order_type === 'drop-off'
  const [to, setTo] = useState('')
  const [cc, setCc] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open || !consignment) return
    const x = consignment as { sender_email?: string | null; receiver_email?: string | null; sender_additional_emails?: string[]; receiver_additional_emails?: string[] }
    setTo(((isPod ? x.receiver_email : x.sender_email) ?? '').trim())
    const extra = isPod ? x.receiver_additional_emails : x.sender_additional_emails
    setCc(Array.isArray(extra) ? extra.filter(Boolean) : [])
    setDraft('')
  }, [open, consignment, isPod])

  const addCc = () => {
    const e = draft.trim()
    if (!e || cc.includes(e) || e === to.trim()) { setDraft(''); return }
    setCc([...cc, e]); setDraft('')
  }
  const removeCc = (e: string) => setCc(cc.filter((x) => x !== e))

  const valid = isEmail(to)
  function send() {
    if (!consignment || !valid || sending) return
    setSending(true)
    const rcpts = { to: to.trim(), cc }
    const job = isPod
      ? sendPodDocEmail(consignment, rcpts)
      : sendPickupDocsEmail(consignment, { labels: true, note: true }, rcpts)
    toast.promise(job.finally(() => setSending(false)), {
      loading: isPod ? 'Emailing proof of delivery…' : 'Emailing documentation…',
      success: () => { onClose(); return isPod ? 'Proof of delivery emailed' : 'Documentation emailed' },
      error: (e) => `Email failed: ${e instanceof Error ? e.message : 'unknown error'}`,
    })
  }

  const ref = consignment?.consignment_no ?? consignment?.id
  const heading = isPod ? 'Email proof of delivery' : 'Email documentation'
  const attachNote = isPod ? 'The Proof of Delivery PDF will be attached.' : 'The Consignment Note and A4 Labels will be attached.'
  const toDefault = isPod ? 'receiver@example.com' : 'sender@example.com'
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{heading}{ref ? ` — ${ref}` : ''}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500">To</span>
            <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder={toDefault} />
            {!valid && to.trim() !== '' && <span className="text-xs text-red-600">Enter a valid email address</span>}
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500">Cc (optional)</span>
            <div className="flex items-center gap-1.5">
              <input className="input input--sm flex-1" type="email" value={draft} placeholder="Add another email…"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCc() } }} />
              <button type="button" onClick={addCc} title="Add email" className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-300 text-neutral-500 hover:bg-neutral-50"><Plus size={15} /></button>
            </div>
            {cc.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {cc.map((e) => (
                  <span key={e} className="inline-flex items-center gap-1 rounded-full bg-[#0A2472]/10 px-2 py-0.5 text-xs text-[#0A2472]">
                    {e}<button type="button" onClick={() => removeCc(e)} className="text-[#0A2472]/70 hover:text-[#0A2472]"><X size={12} /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-neutral-500">{attachNote}</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={sending} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!valid || sending} className="!bg-ub-navy !text-white hover:!bg-ub-navy/90 !border-ub-navy" onClick={send}>
            {sending ? 'Sending…' : (isPod ? 'Send POD' : 'Send documents')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

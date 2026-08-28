import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { sendPodDocEmail } from './sendPodEmail'
import type { TmsConsignmentDetail } from './tmsApi'

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

export default function PodEmailDialog({ consignment, open, onClose }: {
  consignment: TmsConsignmentDetail | null; open: boolean; onClose: () => void
}) {
  const [to, setTo] = useState('')
  const [cc, setCc] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open || !consignment) return
    const x = consignment as { receiver_email?: string | null; receiver_additional_emails?: string[] }
    setTo((x.receiver_email ?? '').trim())
    setCc(Array.isArray(x.receiver_additional_emails) ? x.receiver_additional_emails.filter(Boolean) : [])
    setDraft('')
  }, [open, consignment])

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
    toast.promise(sendPodDocEmail(consignment, { to: to.trim(), cc }).finally(() => setSending(false)), {
      loading: 'Emailing proof of delivery…',
      success: () => { onClose(); return 'Proof of delivery emailed' },
      error: (e) => `POD email failed: ${e instanceof Error ? e.message : 'unknown error'}`,
    })
  }

  const ref = consignment?.consignment_no ?? consignment?.id
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Email proof of delivery{ref ? ` — ${ref}` : ''}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-1">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500">To</span>
            <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="receiver@example.com" />
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
          <p className="text-xs text-neutral-500">The Proof of Delivery PDF will be attached.</p>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={sending} onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!valid || sending} className="!bg-ub-navy !text-white hover:!bg-ub-navy/90 !border-ub-navy" onClick={send}>
            {sending ? 'Sending…' : 'Send POD'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

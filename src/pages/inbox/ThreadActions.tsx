// Thread "Actions" dropdown: jobs, contact, snooze, ignore. Everything that used to live in the side panel.
import { useEffect, useRef, useState } from 'react'
import {
  Clock, MoreHorizontal, EyeOff, FilePlus2, Link2, PackagePlus, Phone, RefreshCw, Truck, UserPlus, UserRound, UserX,
} from 'lucide-react'
import { toast } from 'sonner'
import { ignore, isSales, setStatus, type InboxDetail } from './inboxApi'
import { inboxAction, isInlineJunk } from './EmailParts'

export const SNOOZES: { label: string; at: () => Date }[] = [
  { label: '1 hour', at: () => new Date(Date.now() + 3600e3) },
  { label: '4 hours', at: () => new Date(Date.now() + 4 * 3600e3) },
  { label: 'Tomorrow 9am', at: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d } },
  { label: 'Next Monday 9am', at: () => { const d = new Date(); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); d.setHours(9, 0, 0, 0); return d } },
]

type Item = { icon: typeof Clock; label: string; run: () => void; hide?: boolean; danger?: boolean }

// hideTrigger: email threads use each email's "..." menu instead; this stays mounted for the ignore handler.
export default function ThreadActions({ detail, onChanged, hideTrigger = false }: { detail: InboxDetail; onChanged: () => void; hideTrigger?: boolean }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const c = detail.conversation
  const hasAtts = detail.messages.some((m) => (m.email?.attachments ?? []).some((a) => !isInlineJunk(a)))
  const email = detail.email?.contact_email ?? c.contact_email

  async function doIgnore(sender: boolean) {
    try {
      const r = await ignore(c.id, sender)
      toast.success(r.blocked ? `Ignored. Future emails from ${r.blocked} skipped.` : 'Ignored', {
        action: { label: 'Undo', onClick: () => void setStatus(c.id, 'open').then(onChanged) },
      })
      onChanged()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
  }

  useEffect(() => {
    const on = (e: Event) => void doIgnore(!!(e as CustomEvent<{ sender?: boolean }>).detail?.sender)
    window.addEventListener('ibx:ignore', on)
    return () => window.removeEventListener('ibx:ignore', on)
  }) // re-binds each render so the handler sees the current conversation
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const sales = isSales(detail)
  const groups: { title: string; items: Item[] }[] = [
    sales ? { title: 'Quote', items: [
      { icon: FilePlus2, label: 'Create quote', run: () => inboxAction('create-quote') },
      { icon: Link2, label: c.quote_id ? 'Change linked quote' : 'Link to quote', run: () => inboxAction('quote-link') },
    ] } : { title: 'Job', items: [
      { icon: PackagePlus, label: 'Create booking', run: () => inboxAction('create-booking') },
      { icon: RefreshCw, label: 'Update job from email', run: () => inboxAction('job', { mode: 'update' }) },
      { icon: FilePlus2, label: 'Save attachments to job', run: () => inboxAction('job', { mode: 'docs' }), hide: !hasAtts },
      { icon: Link2, label: c.booking_id ? 'Change linked job' : 'Link to job', run: () => inboxAction('job', { mode: 'link' }) },
    ] },
    { title: 'Contact', items: [
      { icon: UserRound, label: detail.account ? 'Change customer' : 'Existing customer', run: () => inboxAction('contact') },
      { icon: UserPlus, label: 'New lead', run: () => inboxAction('contact') },
      { icon: Truck, label: 'Carrier / shipper / agent', run: () => inboxAction('contact') },
      { icon: Phone, label: 'Call', run: () => { window.location.href = `tel:+${detail.contact?.wa_id}` }, hide: !detail.contact },
    ] },
    { title: 'Snooze', items: c.eff_status === 'open' ? SNOOZES.map((s) => ({
      icon: Clock, label: s.label,
      run: () => void setStatus(c.id, 'snoozed', s.at().toISOString()).then(() => { toast.success(`Snoozed until ${s.label.toLowerCase()}`); onChanged() })
        .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed')),
    })) : [] },
    { title: 'Ignore', items: [
      { icon: EyeOff, label: 'Ignore conversation', run: () => void doIgnore(false), hide: c.eff_status === 'ignored' },
      { icon: UserX, label: `Ignore sender${email ? ` (${email})` : ''}`, run: () => void doIgnore(true), hide: !email || /@ubfreight\.com$/i.test(email), danger: true },
    ] },
  ]

  return (
    <div ref={box} style={{ position: 'relative' }}>
      {hideTrigger ? null : (
        <button type="button" className="ibx-mail__icon" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="More actions" title="More actions">
          <MoreHorizontal size={18} />
        </button>
      )}
      {open ? (
        <div className="ibx-menu" role="menu" style={{ minWidth: 250, maxHeight: '70vh', overflow: 'auto' }}>
          {groups.map((g) => {
            const items = g.items.filter((i) => !i.hide)
            if (!items.length) return null
            return (
              <div key={g.title}>
                <div className="ibx-menu__sect">{g.title}</div>
                {items.map(({ icon: Icon, label, run, danger }) => (
                  <button key={label} type="button" role="menuitem" style={danger ? { color: '#B42318' } : undefined}
                    onClick={() => { setOpen(false); run() }}><Icon size={15} /><span className="ibx-ellip">{label}</span></button>
                ))}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

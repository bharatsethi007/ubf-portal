// "Create booking" from a conversation: pick module, then Quick draft (free) or AI fill (reads email + PDFs).
// Always lands as a DRAFT and opens the booking form for review.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PackagePlus, Sparkles, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { createBookingFromConversation, type InboxDetail } from './inboxApi'

const MODULES = [
  { code: 'IS', label: 'Import Sea' }, { code: 'IA', label: 'Import Air' },
  { code: 'ES', label: 'Export Sea' }, { code: 'EA', label: 'Export Air' },
] as const

// bare = no button of its own; opened from the Actions menu or an email's "..." menu.
export default function CreateBookingMenu({ detail, bare = false }: { detail: InboxDetail; bare?: boolean }) {
  const nav = useNavigate()
  const team = detail.conversation.team
  const [open, setOpen] = useState(false)
  const [mod, setMod] = useState<string>(MODULES.some((m) => m.code === team) ? team! : 'IS')
  const [busy, setBusy] = useState<'quick' | 'ai' | null>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => { setMod(MODULES.some((m) => m.code === team) ? team! : 'IS') }, [detail.conversation.id, team])
  useEffect(() => {
    const on = () => { setOpen(true); box.current?.scrollIntoView({ block: 'nearest' }) }
    window.addEventListener('ibx:create-booking', on)
    return () => window.removeEventListener('ibx:create-booking', on)
  }, [])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function go(mode: 'quick' | 'ai') {
    setBusy(mode)
    try {
      const r = await createBookingFromConversation(detail.conversation.id, mod, mode)
      const extras = [r.containers ? `${r.containers} container${r.containers > 1 ? 's' : ''}` : '', r.documents ? `${r.documents} doc${r.documents > 1 ? 's' : ''}` : '']
        .filter(Boolean).join(', ')
      toast.success(`Draft ${r.booking_ref} created${extras ? ` with ${extras}` : ''}`)
      if (r.low_confidence?.length) toast.message(`Check: ${r.low_confidence.slice(0, 6).join(', ')}`)
      setOpen(false)
      nav(`/bookings/${r.module}/${r.id}/edit`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create booking')
    } finally { setBusy(null) }
  }

  return (
    <div ref={box} style={bare ? undefined : { position: 'relative' }}>
      {bare ? null : (
        <button type="button" className="ibx-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
          <PackagePlus size={15} />Create booking
        </button>
      )}
      {open ? (
        <div className="ibx-pop" role="dialog" aria-label="Create booking">
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6 }}>Module</div>
          <div className="ibx-seg" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%' }}>
            {MODULES.map((m) => (
              <button key={m.code} type="button" className={mod === m.code ? 'on' : ''} onClick={() => setMod(m.code)}>{m.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            <button type="button" className="ibx-opt" disabled={!!busy} onClick={() => void go('quick')}>
              <span className="ibx-opt__icon" style={{ background: '#F1F5F9', color: '#334155' }}><Zap size={15} /></span>
              <span><span style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>{busy === 'quick' ? 'Creating…' : 'Quick draft'}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#64748B' }}>Customer, containers, attachments. Free.</span></span>
            </button>
            <button type="button" className="ibx-opt" disabled={!!busy} onClick={() => void go('ai')}>
              <span className="ibx-opt__icon" style={{ background: '#F3F6FF', color: '#1D4ED8' }}><Sparkles size={15} /></span>
              <span><span style={{ display: 'block', fontSize: 13, fontWeight: 500 }}>{busy === 'ai' ? 'Reading email…' : 'AI fill'}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#64748B' }}>Reads email + PDFs, fills the form. ~2c.</span></span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

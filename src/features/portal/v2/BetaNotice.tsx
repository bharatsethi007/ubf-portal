import { useEffect, useState } from 'react'
import { useMessageDock } from './messages/MessagesDock'
import { FlaskConical, Mail, MessageSquare, X } from 'lucide-react'

const KEY = 'ubf_portal_beta_ack_v1'
const EMAIL = 'info@ubfreight.com'

function seen(): boolean {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}
function markSeen() {
  try { localStorage.setItem(KEY, '1') } catch { /* private mode: show again next visit */ }
}

/** One-time beta notice for the customer portal. */
export default function BetaNotice() {
  const [open, setOpen] = useState(false)
  const { openMessages } = useMessageDock()

  useEffect(() => { if (!seen()) setOpen(true) }, [])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function close() { markSeen(); setOpen(false) }
  function message() { close(); openMessages({ subject: 'Portal feedback' }) }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="beta-title"
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="h-1 w-full bg-[#F7941D]" />
        <button type="button" onClick={close} aria-label="Close" className="absolute right-3 top-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
          <X size={18} />
        </button>
        <div className="px-6 pb-6 pt-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF4E5] text-[#F7941D]"><FlaskConical size={20} /></span>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#F7941D]">Beta</span>
              <h2 id="beta-title" className="text-lg font-semibold text-[#0B1A3A]">Welcome to the new UB Freight portal</h2>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            The portal is in beta. Some figures or screens may have errors while we finish it.
            If something looks wrong, tell us and we will fix it fast.
          </p>
          <a href={`mailto:${EMAIL}?subject=Customer%20portal%20feedback`} className="mt-4 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-[#0B1A3A] hover:border-slate-300">
            <Mail size={16} className="text-slate-400" /> {EMAIL}
          </a>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={message} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-[#0B1A3A] hover:border-slate-300">
              <MessageSquare size={15} /> Send us a message
            </button>
            <button type="button" onClick={close} className="rounded-lg bg-[#0B1A3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#13254F]">
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

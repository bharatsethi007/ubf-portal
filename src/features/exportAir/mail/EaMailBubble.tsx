import { useEffect, useState } from 'react'
import { Mail } from 'lucide-react'
import { fetchCounts } from '@/pages/inbox/inboxApi'
import EaMailPanel, { EA_MAILBOX } from './EaMailPanel'

type Props = { bookingId?: string; bookingRef?: string; onChanged?: () => void }

/** Floating export air mailbox on every EA screen. Sits left of the UBF Intelligence bubble. */
export default function EaMailBubble({ bookingId, bookingRef, onChanged }: Props) {
  const [open, setOpen] = useState(false)
  const [n, setN] = useState<number | null>(null)

  useEffect(() => {
    let live = true
    const load = () => void fetchCounts().then((c) => { if (live) setN(c?.mailboxes?.[EA_MAILBOX] ?? 0) }).catch(() => {})
    load()
    const t = window.setInterval(load, 60_000)
    return () => { live = false; window.clearInterval(t) }
  }, [open])

  return (
    <>
      {open ? null : (
        <button type="button" onClick={() => setOpen(true)} title={`Export air mailbox${n ? ` · ${n} open` : ''}`}
          aria-label={`Open export air mailbox${n ? `, ${n} open` : ''}`}
          className="fixed bottom-6 right-[96px] z-40 inline-flex h-11 w-auto items-center gap-2 rounded-full border-0 bg-[#0A2472] pl-3.5 pr-4 text-[12.5px] font-medium text-white shadow-[0_8px_24px_rgba(10,36,114,.28)] hover:bg-[#081C5A]">
          <Mail size={16} strokeWidth={2} />
          Export air mail
          {n ? <span className="bk-mono rounded-full bg-white px-1.5 text-[10.5px] font-semibold leading-[17px] text-[#0A2472]">{n > 99 ? '99+' : n}</span> : null}
        </button>
      )}
      {open ? <EaMailPanel bookingId={bookingId} bookingRef={bookingRef} onClose={() => setOpen(false)} onChanged={() => onChanged?.()} /> : null}
    </>
  )
}

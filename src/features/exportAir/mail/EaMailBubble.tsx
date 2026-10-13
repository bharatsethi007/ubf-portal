import { useEffect, useState } from 'react'
import { Mail, Sparkles } from 'lucide-react'
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
        <button type="button" onClick={() => setOpen(true)} title={`Export air mail${n ? ` · ${n} open` : ''}`}
          aria-label={`Open export air mailbox${n ? `, ${n} open` : ''}`}
          className="fixed bottom-6 right-[84px] z-40 grid h-12 w-12 place-items-center rounded-full border-0 bg-[#0A2472] p-0 text-white shadow-[0_8px_24px_rgba(10,36,114,.28)] transition-transform hover:scale-105 hover:bg-[#081C5A]">
          <Mail size={20} strokeWidth={1.8} />
          <span aria-hidden className="absolute -right-0.5 -top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,.25)]">
            <Sparkles size={11} strokeWidth={2.2} color="#F79009" fill="#FDB022" />
          </span>
          {n ? (
            <span aria-hidden className="bk-mono absolute -bottom-1 -left-1 rounded-full border-2 border-white bg-[#D92D20] px-1 text-[9.5px] font-semibold leading-[14px] text-white">
              {n > 99 ? '99+' : n}
            </span>
          ) : null}
        </button>
      )}
      {open ? <EaMailPanel bookingId={bookingId} bookingRef={bookingRef} onClose={() => setOpen(false)} onChanged={() => onChanged?.()} /> : null}
    </>
  )
}

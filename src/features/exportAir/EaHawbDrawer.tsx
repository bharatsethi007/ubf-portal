import { useEffect } from 'react'
import EaHawbShell from './master/EaHawbShell'

type Props = { bookingId: string | null; onClose: () => void; onChanged?: () => void }

/** HAWB opened from the consol: slides in over the consol, which stays loaded behind it. */
export default function EaHawbDrawer({ bookingId, onClose, onChanged }: Props) {
  useEffect(() => {
    if (!bookingId) return
    const k = (e: KeyboardEvent) => {
      // Esc closes the topmost layer only: a doc viewer or dialog inside the HAWB handles its own.
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-label^="Document"], [role="dialog"][data-state="open"]')) onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [bookingId, onClose])

  if (!bookingId) return null
  return (
    <div className="fixed inset-0 z-[45] bg-[rgba(15,23,42,.22)]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-label="House air waybill" aria-modal="true"
        className="absolute bottom-3 right-3 top-3 w-[min(1360px,calc(100vw-24px))] overflow-y-auto rounded-xl bg-white px-6 py-5 shadow-[0_24px_64px_rgba(15,23,42,.24)] duration-300 animate-in fade-in-0 slide-in-from-right-8 motion-reduce:animate-none">
        <EaHawbShell key={bookingId} bookingId={bookingId} embedded onClose={onClose} onChanged={onChanged} />
      </div>
    </div>
  )
}

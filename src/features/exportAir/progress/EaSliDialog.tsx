import { useEffect } from 'react'
import { X } from 'lucide-react'
import SliTab from '@/features/sli/staff/SliTab'

type Props = { bookingId: string; isConsolidation: boolean; onClose: () => void }

/** SLI for this booking: generate and send the link, copy it, and review the signed SLI once it is back. */
export default function EaSliDialog({ bookingId, isConsolidation, onClose }: Props) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(15,23,42,.22)] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-label="Shipper's letter of instruction"
        className="flex max-h-[88vh] w-full max-w-[760px] flex-col overflow-hidden rounded-xl bg-white text-[12.5px] shadow-[0_24px_48px_rgba(15,23,42,.18)] duration-200 animate-in fade-in-0 zoom-in-95">
        <header className="flex items-center justify-between border-b border-[#EEF0F3] px-5 py-3.5">
          <div>
            <h2 className="m-0 text-[14px] font-semibold">Shipper's letter of instruction</h2>
            <p className="m-0 mt-0.5 text-[11.5px] text-[#6B7280]">Send the link to the supplier. When they sign it, it shows here as received.</p>
          </div>
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7]"><X size={15} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#FAFBFC] px-5 py-4">
          <SliTab bookingId={bookingId} isConsolidation={isConsolidation} />
        </div>
      </div>
    </div>
  )
}

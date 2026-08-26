import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Search } from 'lucide-react'
import { searchBookings, searchShipments, type BookingHit, type ShipmentHit } from './tmsLinkApi'

type Props = {
  kind: 'booking' | 'shipment' | null
  onClose: () => void
  onPickBooking: (b: BookingHit) => void
  onPickShipment: (s: ShipmentHit) => void
}

export default function LinkDialog({ kind, onClose, onPickBooking, onPickShipment }: Props) {
  const open = kind !== null
  const [q, setQ] = useState('')
  const [bookings, setBookings] = useState<BookingHit[]>([])
  const [shipments, setShipments] = useState<ShipmentHit[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { setQ(''); setBookings([]); setShipments([]) }, [kind])

  useEffect(() => {
    if (!kind) return
    let cancelled = false
    setLoading(true)
    const t = setTimeout(() => {
      const run = kind === 'booking' ? searchBookings(q) : searchShipments(q)
      run.then((r: any) => { if (cancelled) return; if (kind === 'booking') setBookings(r); else setShipments(r) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 200)
    return () => { cancelled = true; clearTimeout(t) }
  }, [q, kind])

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Link {kind === 'booking' ? 'booking' : 'shipment'}</DialogTitle></DialogHeader>
        <label className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2">
          <Search size={15} className="text-neutral-400" />
          <input autoFocus className="w-full bg-transparent text-sm outline-none placeholder:text-neutral-400" placeholder={kind === 'booking' ? 'Search active bookings…' : 'Search active shipments (house bill / job #)…'} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <p className="-mt-1 text-[11px] text-neutral-400">{kind === 'booking' ? 'Active bookings' : 'Shipments from the last 120 days'} · fuzzy match</p>
        <div className="max-h-72 overflow-y-auto">
          {loading ? <p className="py-3 text-sm text-neutral-400">Searching…</p>
            : kind === 'booking' ? (
              bookings.length === 0 ? <p className="py-3 text-sm text-neutral-400">No matches.</p>
                : bookings.map((b) => (
                  <button key={b.id} type="button" onClick={() => onPickBooking(b)} className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-neutral-50">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium tabular-nums">{b.booking_ref ?? b.id.slice(0, 8)}</span>{b.consignee_name && <span className="block truncate text-xs text-neutral-500">{b.consignee_name}</span>}</span>
                    {b.module && <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-500">{b.module}</span>}
                  </button>
                ))
            ) : (
              shipments.length === 0 ? <p className="py-3 text-sm text-neutral-400">No matches.</p>
                : shipments.map((s) => (
                  <button key={s.job_unique} type="button" onClick={() => onPickShipment(s)} className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left hover:bg-neutral-50">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{s.house_bill ?? s.master_bill ?? `Job ${s.job_unique}`}</span>{s.consignee_name && <span className="block truncate text-xs text-neutral-500">{s.consignee_name}</span>}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-neutral-400">#{s.job_unique}</span>
                  </button>
                ))
            )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

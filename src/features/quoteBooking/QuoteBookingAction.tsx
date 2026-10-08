import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Ship, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { createBookingFromQuote, fetchBookingRef } from './quoteBookingApi'

type Props = {
  quoteId: string
  quoteNo: string | null
  status: string
  bookingId: string | null | undefined
  shipmentMode: string | null | undefined
  movementType: string | null | undefined
}

const iconBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px', gap: 6 }

export default function QuoteBookingAction({ quoteId, quoteNo, status, bookingId, shipmentMode, movementType }: Props) {
  const navigate = useNavigate()
  const [ref, setRef] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    if (bookingId) void fetchBookingRef(bookingId).then((r) => { if (alive) setRef(r) })
    return () => { alive = false }
  }, [bookingId])

  if (bookingId) {
    return (
      <Link to={`/bookings/${bookingId}?tab=finance`} className="nqd-btn" title="Open linked booking" style={{ ...iconBtn, textDecoration: 'none' }}>
        <Link2 size={14} /> {ref ?? 'Booking'}
      </Link>
    )
  }

  const isImportSea = shipmentMode === 'sea' && movementType === 'import'
  if (status !== 'won' || !isImportSea) return null

  async function create() {
    setBusy(true)
    try {
      const b = await createBookingFromQuote(quoteId)
      toast.success(`Booking ${b.booking_ref} created`)
      setOpen(false)
      navigate(`/bookings/${b.id}?tab=finance`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create booking')
    } finally { setBusy(false) }
  }

  return (
    <>
      <button className="nqd-btn" style={iconBtn} title="Create Import Sea booking" aria-label="Create Import Sea booking" onClick={() => setOpen(true)}>
        <Ship size={15} />
      </button>
      <Dialog open={open} onOpenChange={(v) => { if (!busy) setOpen(v) }}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader><DialogTitle>Create Import Sea booking</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            New booking from {quoteNo ?? 'this quote'}. Customer, ports, incoterm, load type, containers and parties copy across. Quote stays linked.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <button className="text-link" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
            <button className="btn btn--inline" onClick={() => void create()} disabled={busy}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, width: 'auto' }}>
              <Ship size={15} /> {busy ? 'Creating…' : 'Create booking'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

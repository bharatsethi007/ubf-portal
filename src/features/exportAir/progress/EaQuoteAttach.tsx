import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { toast } from 'sonner'
import { supabase } from '@/supabase'

type Hit = { id: string; quote_no: string; customer_name: string | null; shipment_mode: string | null; status: string | null; from_port_code: string | null; to_port_code: string | null; created_at: string; booking_id: string | null }
type Props = { bookingId: string; hint: string; onClose: () => void; onDone: () => void }

/** Link an existing quote to the booking (both ways), searching by quote number or customer. */
export default function EaQuoteAttach({ bookingId, hint, onClose, onDone }: Props) {
  const [q, setQ] = useState(hint.split(/\s+/)[0] ?? '')
  const [hits, setHits] = useState<Hit[]>([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(async () => {
      const term = q.trim().replace(/[,()%*]/g, ' ').trim()
      let req = supabase.from('quotes').select('id, quote_no, customer_name, shipment_mode, status, from_port_code, to_port_code, created_at, booking_id')
        .order('created_at', { ascending: false }).limit(12)
      if (term) req = req.or(`quote_no.ilike.%${term}%,customer_name.ilike.%${term}%,consignee.ilike.%${term}%,shipper.ilike.%${term}%`)
      const { data } = await req
      setHits((data ?? []) as Hit[])
    }, 250)
    return () => window.clearTimeout(t)
  }, [q])

  async function pick(h: Hit) {
    setBusy(true)
    const [a, b] = await Promise.all([
      supabase.from('bookings').update({ quote_id: h.id }).eq('id', bookingId),
      supabase.from('quotes').update({ booking_id: bookingId }).eq('id', h.id),
    ])
    setBusy(false)
    const err = a.error ?? b.error
    if (err) return toast.error(err.message)
    toast.success(`Quote ${h.quote_no} attached`)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[rgba(15,23,42,.22)] p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-label="Attach quote" className="flex max-h-[80vh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl bg-white text-[12.5px] shadow-[0_24px_48px_rgba(15,23,42,.18)] duration-200 animate-in fade-in-0 zoom-in-95">
        <header className="flex items-center justify-between border-b border-[#EEF0F3] px-5 py-3.5">
          <h2 className="m-0 text-[14px] font-semibold">Attach a quote</h2>
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7]"><X size={15} /></button>
        </header>
        <div className="border-b border-[#EEF0F3] px-5 py-3">
          <label className="relative block">
            <span className="sr-only">Search quotes</span>
            <Search size={14} className="absolute left-2.5 top-2 text-[#98A2B3]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Quote number, customer, shipper or consignee"
              className="h-[30px] w-full rounded-[7px] border border-[#E3E6EB] pl-[30px] pr-2.5 text-[12.5px] outline-none focus:border-[#0A2472]" />
          </label>
        </div>
        <ul className="m-0 min-h-0 flex-1 list-none overflow-y-auto p-0">
          {hits.length === 0 ? <li className="px-5 py-6 text-center text-[#6B7280]">No quotes found.</li> : null}
          {hits.map((h) => (
            <li key={h.id}>
              <button type="button" disabled={busy} onClick={() => void pick(h)}
                className="flex w-full items-center gap-3 border-0 border-b border-[#F6F7F9] bg-transparent px-5 py-2.5 text-left hover:bg-[#F8F9FB]">
                <span className="bk-mono text-[12px] font-medium text-[#0A2472]">{h.quote_no}</span>
                <span className="min-w-0 flex-1 truncate">{h.customer_name ?? '—'}</span>
                <span className="text-[11px] text-[#6B7280]">{[h.shipment_mode, h.from_port_code && h.to_port_code ? `${h.from_port_code}→${h.to_port_code}` : null].filter(Boolean).join(' · ')}</span>
                <span className="text-[11px] text-[#98A2B3]">{format(parseISO(h.created_at), 'd MMM')}</span>
                {h.booking_id && h.booking_id !== bookingId ? <span className="text-[10.5px] text-[#B54708]">on another job</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

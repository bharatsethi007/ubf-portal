import { useEffect, useRef, useState } from 'react'
import { Download, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import { uploadBookingFile } from '@/components/bookings/bookingDocumentsApi'
import { sendBookingEmail } from '@/features/bookingRecord/email/emailApi'
import type { AirConsol } from '../eaTypes'
import type { EaDetail } from '../useEaBooking'
import { renderBcPdf, type BcData } from './BookingConfirmationPdf'
import { bcRecipients, buildBcData } from './bcData'

type Props = { b: EaDetail; consol: AirConsol | undefined; onClose: () => void; onSent: () => void }

const inp = 'h-[30px] w-full rounded-[7px] border border-[#E3E6EB] bg-white px-2 text-[12.5px] outline-none focus:border-[#0A2472]'
const lbl = 'text-[10.5px] uppercase tracking-[.04em] text-[#6B7280]'
const splitEmails = (s: string) => s.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean)

/** Booking confirmation: live PDF on the left, recipients and editable notes on the right, sent from exportair@. */
export default function EaBcDialog({ b, consol, onClose, onSent }: Props) {
  const [data, setData] = useState<BcData | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [to, setTo] = useState(bcRecipients(b).join(', '))
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(`Booking Confirmation ${b.booking_ref}${b.customer_ref ? ` / ${b.customer_ref}` : ''}`)
  const [msg, setMsg] = useState(`Hi,\n\nPlease find attached the booking confirmation for ${b.booking_ref}${consol ? `, booked on ${consol.flight_no}` : ''}.\n\nKind regards,\nUB Freight Export Air`)
  const [busy, setBusy] = useState(false)
  const blobRef = useRef<Blob | null>(null)

  useEffect(() => { void buildBcData(b, consol).then(setData).catch((e) => toast.error((e as Error).message)) }, [b, consol])

  // Re-render the PDF shortly after edits stop.
  useEffect(() => {
    if (!data) return
    let live = true
    const t = window.setTimeout(async () => {
      const blob = await renderBcPdf(data)
      if (!live) return
      blobRef.current = blob
      setUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob) })
    }, 350)
    return () => { live = false; window.clearTimeout(t) }
  }, [data])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const fileName = `Booking Confirmation ${b.booking_ref}.pdf`
  const set = (k: keyof BcData) => (v: string) => setData((p) => (p ? { ...p, [k]: k === 'agent' ? v.split('\n') : v } : p))

  function download() {
    if (!url) return
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click()
  }

  async function send() {
    const toList = splitEmails(to)
    if (!toList.length) return toast.error('Add at least one recipient')
    if (!blobRef.current) return toast.error('PDF still rendering')
    setBusy(true)
    try {
      const file = new File([blobRef.current], fileName, { type: 'application/pdf' })
      const doc = await uploadBookingFile(file, b.id, b.account_id ?? b.shipper_account_id ?? 'staff')
      const html = msg.split('\n').map((l) => (l ? l.replace(/&/g, '&amp;').replace(/</g, '&lt;') : '&nbsp;')).join('<br>')
      await sendBookingEmail({ booking_id: b.id, to: toList, cc: splitEmails(cc), subject, html, document_ids: [doc.id], purpose: 'customer' })
      await supabase.from('bookings').update({ bc_sent_at: new Date().toISOString() }).eq('id', b.id)
      toast.success(`Booking confirmation sent to ${toList.join(', ')}`)
      onSent()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-[rgba(15,23,42,.22)] p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-label="Booking confirmation" className="mx-auto flex h-full max-w-[1400px] flex-col overflow-hidden rounded-xl bg-white text-[12.5px] shadow-[0_24px_64px_rgba(15,23,42,.24)] duration-200 animate-in fade-in-0 zoom-in-95">
        <header className="flex items-center gap-3 border-b border-[#E6E8EE] px-4 py-2.5">
          <h2 className="m-0 text-[14px] font-semibold">Booking confirmation <span className="bk-mono font-medium">{b.booking_ref}</span></h2>
          {b.bc_sent_at ? <span className="text-[11.5px] text-[#067647]">Last sent {new Date(b.bc_sent_at).toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' })}</span> : null}
          <span className="flex-1" />
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7]"><X size={16} /></button>
        </header>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 items-center justify-center border-r border-[#E6E8EE] bg-[#F3F2F1]">
            {url ? <iframe title="Booking confirmation PDF" src={`${url}#toolbar=0&view=FitH`} className="h-full w-full border-0" /> : <span className="text-[#6B7280]">Building PDF…</span>}
          </div>
          <div className="flex w-[420px] shrink-0 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3.5">
              <label className="flex flex-col gap-1"><span className={lbl}>To</span><input value={to} onChange={(e) => setTo(e.target.value)} placeholder="name@company.com, …" className={inp} /></label>
              <label className="flex flex-col gap-1"><span className={lbl}>Cc</span><input value={cc} onChange={(e) => setCc(e.target.value)} className={inp} /></label>
              <label className="flex flex-col gap-1"><span className={lbl}>Subject</span><input value={subject} onChange={(e) => setSubject(e.target.value)} className={inp} /></label>
              <label className="flex flex-col gap-1"><span className={lbl}>Message</span><textarea rows={6} value={msg} onChange={(e) => setMsg(e.target.value)} className={`${inp} h-auto py-1.5`} /></label>
              {data ? (
                <>
                  <div className="mt-1 border-t border-[#F1F2F5] pt-3 text-[11.5px] font-semibold text-[#14161A]">On the document</div>
                  <label className="flex flex-col gap-1"><span className={lbl}>Reference</span><input value={data.reference} onChange={(e) => set('reference')(e.target.value)} className={inp} /></label>
                  <label className="flex flex-col gap-1"><span className={lbl}>Notes</span><textarea rows={3} value={data.notes} onChange={(e) => set('notes')(e.target.value)} className={`${inp} h-auto py-1.5`} /></label>
                  <label className="flex flex-col gap-1"><span className={lbl}>Destination agent</span><textarea rows={4} value={data.agent.join('\n')} onChange={(e) => set('agent')(e.target.value)} className={`${inp} h-auto py-1.5`} /></label>
                  <p className="m-0 text-[11px] text-[#6B7280]">Flight, MAWB, weights and parties come from the booking and consol. Fix them there and reopen.</p>
                </>
              ) : null}
            </div>
            <footer className="flex items-center gap-2 border-t border-[#E6E8EE] px-4 py-2.5">
              <span className="min-w-0 flex-1 truncate text-[11px] text-[#6B7280]">From exportair.nz@ubfreight.com · PDF saved to the booking</span>
              <button type="button" onClick={download} disabled={!url} className="inline-flex h-[30px] w-auto items-center gap-1.5 rounded-[7px] border border-[#E3E6EB] bg-white px-3 text-[12px] font-medium hover:bg-[#F6F7F9] disabled:opacity-50"><Download size={13} /> Download</button>
              <button type="button" onClick={() => void send()} disabled={busy || !url} className="inline-flex h-[30px] w-auto items-center gap-1.5 rounded-[7px] border border-[#0A2472] bg-[#0A2472] px-3 text-[12px] font-medium text-white hover:bg-[#081C5A] disabled:opacity-50"><Send size={13} /> {busy ? 'Sending…' : 'Send'}</button>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}

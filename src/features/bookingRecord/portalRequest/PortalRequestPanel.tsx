import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Copy, Globe2, Link2, Loader2, Mail, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import ShipmentLinkModal from '../link/ShipmentLinkModal'
import PortalRequestParties from './PortalRequestParties'
import { bookingMatchCandidates, type MatchCandidate } from '../link/shipmentLinkApi'
import type { BookingRecord } from '../bookingRecordTypes'
import {
  DECLINE_REASONS, NOTICE_LABEL, fetchSentNotices, reviewPortalBooking, reviewState, type SentNotice,
} from './portalRequestApi'

type Props = {
  booking: BookingRecord
  onChanged: () => void | Promise<void>
}

const STATE_UI = {
  review: { label: 'Awaiting review', cls: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmed, key into CyberFreight', cls: 'bg-blue-100 text-blue-800' },
  declined: { label: 'Declined', cls: 'bg-red-100 text-red-700' },
  in_erp: { label: 'Linked to ERP shipment', cls: 'bg-emerald-100 text-emerald-800' },
} as const

function fmtStamp(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('en-NZ', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** Review strip for bookings customers requested on portal.ubfreight.com. */
export default function PortalRequestPanel({ booking, onChanged }: Props) {
  const linked = Boolean(booking.shipment_id)
  const state = reviewState(booking.status, linked)
  const [dup, setDup] = useState<MatchCandidate | null>(null)
  const [notices, setNotices] = useState<SentNotice[]>([])
  const [busy, setBusy] = useState<'confirm' | 'decline' | null>(null)
  const [declining, setDeclining] = useState(false)
  const [reason, setReason] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const refreshSide = useCallback(() => {
    void fetchSentNotices(booking.id).then(setNotices)
    if (!linked) {
      void bookingMatchCandidates(booking.id).then((list) => {
        const top = [...list].sort((a, b) => b.score - a.score)[0]
        setDup(top && top.score >= 60 ? top : null)
      })
    } else setDup(null)
  }, [booking.id, linked])

  useEffect(() => { refreshSide() }, [refreshSide, booking.status])

  async function act(action: 'confirm' | 'decline') {
    if (action === 'decline' && !reason.trim()) { toast.error('Give the customer a reason'); return }
    setBusy(action)
    try {
      await reviewPortalBooking(booking.id, action, action === 'decline' ? reason.trim() : undefined)
      toast.success(action === 'confirm' ? 'Confirmed. The customer has been emailed.' : 'Declined. The customer has been emailed.')
      setDeclining(false)
      setReason('')
      await onChanged()
      window.setTimeout(refreshSide, 2500)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the booking')
    } finally {
      setBusy(null)
    }
  }

  async function copyRef() {
    if (!booking.booking_ref) return
    try {
      await navigator.clipboard.writeText(booking.booking_ref)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch { /* ignore */ }
  }

  const ui = STATE_UI[state]
  const canConfirm = !linked && (state === 'review' || state === 'declined')
  const canDecline = !linked && (state === 'review' || state === 'confirmed')

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white shadow-sm" aria-label="Customer portal request">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#0A2472] text-white"><Globe2 size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Customer portal request</h2>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ui.cls}`}>{ui.label}</span>
          </div>
          <p className="text-xs text-slate-500">
            Requested {fmtStamp(booking.created_at)}
            {booking.customer_ref ? <> · Customer ref <span className="font-mono text-slate-700">{booking.customer_ref}</span></> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canDecline && !declining && (
            <Button variant="outline" size="sm" onClick={() => setDeclining(true)} disabled={busy !== null}>
              <X size={14} /> Decline
            </Button>
          )}
          {canConfirm && (
            <Button size="sm" onClick={() => void act('confirm')} disabled={busy !== null} className="bg-[#0A2472] text-white hover:bg-[#0A2472]/90">
              {busy === 'confirm' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Confirm booking
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 px-4 py-3 text-sm">
        {!linked && state !== 'declined' && (
          <div className="flex flex-wrap items-center gap-2 text-slate-700">
            <span>Key it into CyberFreight with booking ref</span>
            <button type="button" onClick={copyRef} title="Copy booking ref"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-[13px] font-semibold text-slate-900 hover:bg-slate-100">
              {booking.booking_ref ?? '—'} {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} className="text-slate-500" />}
            </button>
            <span className="text-slate-500">and the shipment links back here on the next sync.</span>
          </div>
        )}

        <PortalRequestParties bookingId={booking.id} />

        {booking.quoted_rate?.sell != null && booking.quoted_rate.product !== 'QUOTE' && (
          <div className="flex flex-wrap items-center gap-2 text-slate-700">
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">Booked at published rate</span>
            <span className="font-mono font-semibold">{booking.quoted_rate.currency} {Number(booking.quoted_rate.sell).toLocaleString('en-NZ')}</span>
            <span>
              {booking.quoted_rate.product === 'FCL' ? `per ${booking.quoted_rate.container_type ?? 'container'}` : booking.quoted_rate.product === 'LCL' ? 'per W/M' : 'per kg'}
              {' · '}{booking.quoted_rate.carrier ?? 'carrier'}
              {booking.quoted_rate.valid_to ? ` · valid to ${new Date(`${booking.quoted_rate.valid_to}T00:00:00`).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}` : ''}
            </span>
          </div>
        )}

        {dup && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
            <AlertTriangle size={16} className="shrink-0" />
            <span className="min-w-0 flex-1">
              Already in ERP? <b className="font-mono">{dup.consol_key ?? `#${dup.job_unique}`}</b> matches this request
              {dup.reasons.length ? ` (${dup.reasons.join(', ')})` : ''}. Link it instead of creating a second job.
            </span>
            <Button size="sm" variant="outline" onClick={() => setLinkOpen(true)}><Link2 size={14} /> Review and link</Button>
          </div>
        )}

        {linked && (
          <div className="flex items-center gap-2 text-emerald-800">
            <CheckCircle2 size={16} /> Linked to ERP job <span className="font-mono font-semibold">{booking.job_no ?? `#${booking.shipment_id}`}</span>. The customer now sees it as a live shipment.
          </div>
        )}

        {state === 'declined' && booking.decline_reason && (
          <p className="text-red-700">Declined: {booking.decline_reason}</p>
        )}

        {declining && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Reason the customer will see</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {DECLINE_REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)}
                  className={`rounded-full border px-2.5 py-1 text-xs ${reason === r ? 'border-[#0A2472] bg-[#0A2472] text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}>
                  {r}
                </button>
              ))}
            </div>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Or write your own" className="bg-white" />
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => { setDeclining(false); setReason('') }}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={() => void act('decline')} disabled={busy !== null || !reason.trim()}>
                {busy === 'decline' ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Decline and email customer
              </Button>
            </div>
          </div>
        )}

        {notices.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            {notices.map((n) => (
              <span key={n.event} className="inline-flex items-center gap-1" title={n.recipient ?? undefined}>
                <Mail size={12} /> {NOTICE_LABEL[n.event] ?? n.event} {fmtStamp(n.sent_at)}
              </span>
            ))}
          </div>
        )}
      </div>

      <ShipmentLinkModal
        open={linkOpen}
        onOpenChange={setLinkOpen}
        bookingId={booking.id}
        accountId={booking.account_id}
        consigneeName={booking.consignee_name}
        expectedContainers={[]}
        onLinked={() => { setLinkOpen(false); void onChanged() }}
      />
    </section>
  )
}

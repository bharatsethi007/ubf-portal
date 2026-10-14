import type { ReactElement } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Building2, CircleCheck, CircleDot, CircleX, PauseCircle, FileText, Handshake, Repeat, Send, Trophy } from 'lucide-react'
import CustomerSelect from '@/components/Customers/CustomerSelect'
import type { CustomerPickerValue } from '@/components/bookings/CustomerPicker'
import type { AutosaveState } from '@/hooks/useDebouncedAutosave'
import QuoteBookingAction from '@/features/quoteBooking/QuoteBookingAction'
import CopyQuoteButton from '../CopyQuoteButton'
import QuoteContactSelect from '../QuoteContactSelect'
import type { QuoteRecord } from '../quotesApi'
import { Seg, Tag, iconBtn } from './qdUi'
import { STATUS_TONE } from '../quoteTones'

const OUTCOMES: { key: QuoteOutcome; icon: ReactElement; title: string }[] = [
  { key: 'open', icon: <CircleDot size={13} />, title: 'Open, being worked' },
  { key: 'held', icon: <PauseCircle size={13} />, title: 'Customer paused. No expiry, no reminders' },
  { key: 'won', icon: <CircleCheck size={13} />, title: 'Customer accepted' },
  { key: 'lost', icon: <CircleX size={13} />, title: 'Customer declined (asks for a reason)' },
  { key: 'crosswin', icon: <Repeat size={13} />, title: 'Won through another quote or office' },
]
export type QuoteOutcome = 'open' | 'held' | 'won' | 'lost' | 'crosswin'

type Props = {
  quote: QuoteRecord
  status: string
  movementType: string | null
  stats: { thisMonth: number; converted: number }
  saveState: AutosaveState
  pending: boolean
  statusBusy: boolean
  onCustomer: (v: CustomerPickerValue | null) => void
  onContactSaved: (v: Partial<QuoteRecord>) => void
  onEmail: () => void
  onMark: (s: QuoteOutcome) => void
}

function SaveDot({ state, pending }: { state: AutosaveState; pending: boolean }) {
  const err = state === 'error'
  const busy = !err && (pending || state === 'saving')
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[11.5px]" style={{ color: err ? '#B42318' : '#6B7280' }}>
      <span className={`h-1.5 w-1.5 rounded-full ${busy ? 'animate-pulse' : ''}`} style={{ background: err ? '#D92D20' : busy ? '#F79009' : '#17B26A' }} />
      {err ? 'Save failed, edit to retry' : busy ? 'Saving' : 'Saved'}
    </span>
  )
}

/** Breadcrumb, customer or agent, contact, outcome buttons. Export Air record header layout. */
export default function QuoteHeader(p: Props) {
  const navigate = useNavigate()
  const q = p.quote
  const isAgent = !!(q as QuoteRecord & { agent_id?: string | null }).agent_id
  return (
    <div className="flex flex-col gap-2.5">
      <nav aria-label="Back" className="flex items-center gap-2 text-[12px] text-[#6B7280]">
        <button type="button" onClick={() => {
          const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
          if (idx > 0) navigate(-1); else navigate('/quotes')
        }} className="inline-flex h-[26px] w-auto items-center gap-1.5 rounded-md border border-[#E3E6EB] bg-white px-2 text-[12px] font-medium text-[#14161A] hover:bg-[#F6F7F9]">
          <ArrowLeft size={13} /> Back
        </button>
        <Link to="/quotes" className="text-[#6B7280] hover:underline">Quotes</Link>
        <span>/</span>
        <span className="bk-mono text-[#14161A]">{q.quote_no ?? 'New quote'}</span>
        <CopyQuoteButton quoteId={q.id} quoteNo={q.quote_no} />
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <CustomerSelect nameClassName="text-[19px] font-medium tracking-[-0.02em] text-[#14161A]"
              value={q.customer_account_id ? { account_id: q.customer_account_id, name: q.customer_name ?? '',
                source: q.customer_account_id.startsWith('P-') ? 'portal' : undefined } : null}
              onChange={p.onCustomer} />
            {isAgent
              ? <Tag tone="amber"><span className="inline-flex items-center gap-1"><Handshake size={12} />Agent</span></Tag>
              : <Tag tone="navy"><span className="inline-flex items-center gap-1"><Building2 size={12} />Customer</span></Tag>}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[12.5px] text-[#5B616E]">
            <QuoteContactSelect quoteId={q.id} accountId={q.customer_account_id}
              value={{ contact_name: q.contact_name ?? null, contact_email: q.contact_email ?? null, contact_phone: q.contact_phone ?? null }}
              onSaved={p.onContactSaved} />
            <span className="inline-flex items-center gap-1"><FileText size={12} /> {p.stats.thisMonth} quotes this month</span>
            <span className="inline-flex items-center gap-1"><Trophy size={12} /> {p.stats.converted} won</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SaveDot state={p.saveState} pending={p.pending} />
          <button type="button" className={iconBtn} title="Email quote" aria-label="Email quote" onClick={p.onEmail}><Send size={14} /></button>
          <QuoteBookingAction quoteId={q.id} quoteNo={q.quote_no} status={p.status}
            bookingId={(q as QuoteRecord & { booking_id?: string | null }).booking_id}
            shipmentMode={q.shipment_mode} movementType={p.movementType} />
          <Seg<QuoteOutcome> label="Quote status" value={OUTCOMES.some((o) => o.key === p.status) ? p.status as QuoteOutcome : null}
            disabled={p.statusBusy} onChange={p.onMark}
            options={OUTCOMES.map((o) => ({ value: o.key, label: STATUS_TONE[o.key].label, icon: o.icon, title: o.title, tone: STATUS_TONE[o.key] }))} />
        </div>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/supabase'
import { commitEa, type EaForm, type EaParty } from '@/pages/inbox/eaBookingApi'
import { isInlineJunk } from '@/pages/inbox/EmailParts'
import type { EmailAttachment, InboxDetail } from '@/pages/inbox/inboxApi'
import type { CustomerPickerValue } from '@/components/bookings/CustomerPicker'
import type { AirConsol } from '../eaTypes'
import { eaHref } from '../eaUi'
import EaIntakeSource from './EaIntakeSource'
import EaIntakeForm from './EaIntakeForm'
import { useIntake } from './useIntake'
import { bookingAccountId } from './customerAccount'

type Props = { detail: InboxDetail; who: string; onClose: () => void; onChanged: () => void }

const fromAccount = (p: EaParty, c: CustomerPickerValue | null): EaParty => (c ? {
  ...p, name: c.name,
  address: [c.address1, c.address2, c.address3].filter(Boolean).join(', ') || p.address || null,
  city: c.city ?? p.city ?? null, postcode: c.postcode ?? p.postcode ?? null, country: c.country ?? p.country ?? null,
  phone: p.phone || c.phone || null, contact: p.contact || c.contact || null,
} : p)

/** Email (or files) on the left, booking form on the right. Parties link to TradeWindow accounts. */
export default function EaIntakeDialog({ detail, who, onClose, onChanged }: Props) {
  const nav = useNavigate()
  const convId = detail.conversation.id
  const { form, setForm, accounts, setAccounts, matched, busy, error, load } = useIntake(detail)
  const atts = useMemo<EmailAttachment[]>(() => detail.messages.flatMap((m) => (m.email?.attachments ?? []).filter((a) => !isInlineJunk(a))), [detail.messages])
  const [tab, setTab] = useState<'email' | 'files'>('email')
  const [file, setFile] = useState(0)
  const [picked, setPicked] = useState<Set<number>>(() => new Set(atts.map((a) => a.id)))
  const [consols, setConsols] = useState<AirConsol[]>([])
  const [consolId, setConsolId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { void load(false) }, [load])

  // Clicking a file inside the email shows it on the left instead of a popup.
  useEffect(() => {
    document.body.dataset.eaIntake = '1'
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ items: EmailAttachment[]; index: number }>).detail
      const hit = atts.findIndex((a) => a.id === d?.items?.[d.index]?.id)
      setTab('files'); setFile(hit >= 0 ? hit : 0)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('ibx:preview', on)
    window.addEventListener('keydown', esc)
    return () => { delete document.body.dataset.eaIntake; window.removeEventListener('ibx:preview', on); window.removeEventListener('keydown', esc) }
  }, [atts, onClose])

  const dest = (form?.destination ?? '').toUpperCase()
  useEffect(() => {
    if (dest.length !== 3) { setConsols([]); return }
    void supabase.from('v_air_consols').select('*').eq('destination', dest).in('status', ['planned', 'confirmed'])
      .gte('flight_date', new Date().toISOString().slice(0, 10)).order('flight_date')
      .then(({ data }) => setConsols((data ?? []) as AirConsol[]))
  }, [dest])

  const missing = form ? [
    !dest && 'destination', !accounts.shipper && !form.shipper.name && 'shipper', !accounts.consignee && !form.consignee.name && 'consignee',
    !form.lines.some((l) => l.pieces || l.kg) && 'pieces or weight', form.pickup.needed == null && 'pickup or drop-off',
  ].filter(Boolean) as string[] : []
  const unlinked = [!accounts.shipper && 'shipper', !accounts.consignee && 'consignee', !accounts.billTo && 'bill-to'].filter(Boolean) as string[]

  async function create() {
    if (!form || missing.length) return
    setSaving(true)
    try {
      const f: EaForm = { ...form, shipper: fromAccount(form.shipper, accounts.shipper), consignee: fromAccount(form.consignee, accounts.consignee) }
      const accountId = await bookingAccountId([accounts.billTo?.account_id, accounts.consignee?.account_id, accounts.shipper?.account_id])
      const r = await commitEa(convId, f, accountId, [...picked])
      const { data: auth } = await supabase.auth.getUser()
      await supabase.from('bookings').update({
        shipper_account_id: accounts.shipper?.account_id ?? null,
        consignee_account_id: accounts.consignee?.account_id ?? null,
        bill_to_account_id: accounts.billTo?.account_id ?? null,
        account_id: accountId,
        collection_mode: f.pickup.needed ? 'pickup' : 'dropoff',
        consol_id: consolId || null,
        handled_by: auth.user?.id ?? null,
      }).eq('id', r.id)
      await supabase.from('booking_threads').upsert({ booking_id: r.id, conversation_id: convId }, { onConflict: 'booking_id,conversation_id' })
      toast.success(`${r.booking_ref} created${r.pickup_no ? `, pickup ${r.pickup_no}` : ''}${r.documents ? `, ${r.documents} files saved` : ''}`,
        { action: { label: 'Open', onClick: () => nav(eaHref(r.id)) } })
      if (r.pickup_error) toast.error(`Pickup not created: ${r.pickup_error}`)
      onChanged()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create booking')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="ibx-modal-back" style={{ padding: 12 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-label="New export air booking"
        className="flex h-full w-full max-w-[1720px] flex-col overflow-hidden rounded-xl bg-white text-[12.5px] text-[#14161A] shadow-[0_24px_64px_rgba(15,23,42,.24)]">
        <header className="flex shrink-0 items-center gap-3 border-b border-[#E6E8EE] px-4 py-2.5">
          <h3 className="m-0 text-[14px] font-semibold">New export air booking</h3>
          <span className="min-w-0 truncate text-[12px] text-[#6B7280]">{detail.conversation.subject}</span>
          <span className="flex-1" />
          <button type="button" disabled={!!busy} onClick={() => void load(true)} title="Read the email and PDFs with AI, about 2 cents"
            className="inline-flex h-[30px] w-auto items-center gap-1.5 rounded-[7px] border border-[#E3E6EB] bg-white px-3 text-[12px] font-medium hover:bg-[#F6F7F9] disabled:opacity-50">
            <Sparkles size={14} color="#F79009" />{busy === 'ai' ? 'Reading…' : 'AI fill'}
          </button>
          <button type="button" aria-label="Close" title="Close" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent text-[#5B616E] hover:bg-[#F2F4F7]"><X size={16} /></button>
        </header>

        <div className="flex min-h-0 flex-1">
          <EaIntakeSource detail={detail} who={who} atts={atts} tab={tab} file={file} onTab={setTab} onFile={setFile} />
          <div className="flex w-[640px] shrink-0 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
              {error ? <div className="mb-3 rounded-lg bg-[#FEF3F2] px-3 py-2 text-[12px] text-[#B42318]">{error}</div> : null}
              {!form ? <div className="py-16 text-center text-[#6B7280]">Reading the email…</div> : (
                <EaIntakeForm form={form} accounts={accounts} matched={matched} consols={consols} consolId={consolId} atts={atts} picked={picked}
                  onForm={(x) => setForm((cur) => (cur ? { ...cur, ...x } : cur))} onAccounts={(x) => setAccounts((cur) => ({ ...cur, ...x }))}
                  onConsol={setConsolId} onPicked={setPicked} onView={(i) => { setTab('files'); setFile(i) }} />
              )}
            </div>
            <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#E6E8EE] px-4 py-2.5">
              <span className="min-w-0 flex-1 text-[11.5px]">
                {missing.length ? <span className="text-[#B54708]">Needed: {missing.join(', ')}</span>
                  : unlinked.length ? <span className="text-[#B54708]">Not linked to TradeWindow: {unlinked.join(', ')}. Export will block until set.</span>
                    : <span className="text-[#067647]">All parties linked to TradeWindow</span>}
              </span>
              <button type="button" onClick={onClose} className="inline-flex h-[30px] w-auto items-center rounded-[7px] border border-[#E3E6EB] bg-white px-3 text-[12px] font-medium hover:bg-[#F6F7F9]">Cancel</button>
              <button type="button" disabled={!form || saving || missing.length > 0} onClick={() => void create()}
                className="inline-flex h-[30px] w-auto items-center rounded-[7px] border border-[#0A2472] bg-[#0A2472] px-3 text-[12px] font-medium text-white hover:bg-[#081C5A] disabled:opacity-50">
                {saving ? 'Creating…' : form?.pickup.needed ? 'Create booking + pickup' : 'Create booking'}
              </button>
            </footer>
          </div>
        </div>
      </div>
    </div>
  )
}

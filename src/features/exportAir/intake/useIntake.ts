import { useCallback, useRef, useState } from 'react'
import { supabase } from '@/supabase'
import type { CustomerPickerValue } from '@/components/bookings/CustomerPicker'
import { prefillEa, type BillTo, type EaForm, type EaParty } from '@/pages/inbox/eaBookingApi'
import type { InboxDetail } from '@/pages/inbox/inboxApi'
import { matchAccount, type Account } from './accountMatch'
import { companyNear, parseCargo, partiesFromText } from './intakeParse'

export type Accounts = { shipper: CustomerPickerValue | null; consignee: CustomerPickerValue | null; billTo: CustomerPickerValue | null }
export type Matched = { shipper: Account | null; consignee: Account | null }

const blank = (p: EaParty | undefined) => !p || !Object.values(p).some((v) => v != null && String(v).trim() !== '')

/**
 * Prefill = server pass (SLI read, optional AI) + a browser pass over the FULL email text
 * (forwards and quoted chains included) + TradeWindow account matching for both parties.
 */
export function useIntake(detail: InboxDetail) {
  const [form, setForm] = useState<EaForm | null>(null)
  const [accounts, setAccounts] = useState<Accounts>({ shipper: null, consignee: null, billTo: null })
  const [matched, setMatched] = useState<Matched>({ shipper: null, consignee: null })
  const [busy, setBusy] = useState<'load' | 'ai' | null>(null)
  const [error, setError] = useState('')
  const ref = useRef(detail)
  ref.current = detail

  // Keyed on the conversation only, so refreshes of the thread never wipe what staff typed.
  const load = useCallback(async (ai: boolean) => {
    const detail = ref.current
    setBusy(ai ? 'ai' : 'load')
    setError('')
    const convId = detail.conversation.id
    const msgIds = detail.messages.filter((m) => m.kind === 'message').map((m) => m.id)
    try {
      const [srv, metaRes] = await Promise.all([
        prefillEa(convId, ai).catch((e: unknown) => { if (ai) throw e; return null }),
        msgIds.length
          ? supabase.from('inbox_email_meta').select('message_id, full_text, from_address, from_name').in('message_id', msgIds)
          : Promise.resolve({ data: [] as { message_id: number; full_text: string | null; from_address: string | null; from_name: string | null }[] }),
      ])
      const metas = (metaRes.data ?? []) as { message_id: number; full_text: string | null; from_address: string | null; from_name: string | null }[]
      const textOf = (id: number) => metas.find((x) => x.message_id === id)?.full_text ?? detail.messages.find((m) => m.id === id)?.body ?? ''
      const lastIn = [...detail.messages].reverse().find((m) => m.kind === 'message' && m.direction === 'in')
      const latest = `${detail.conversation.subject ?? ''}\n${lastIn ? textOf(lastIn.id) : ''}`
      const all = `${detail.conversation.subject ?? ''}\n${msgIds.map(textOf).join('\n')}`
      const p = parseCargo(all, latest)

      let f: EaForm = srv?.form ?? {
        shipper: {}, consignee: {}, destination: null, incoterm: null, goods: null, po_refs: null, ready_date: null,
        is_dg: false, un_number: null, notes: detail.conversation.subject ? `From email: ${detail.conversation.subject}` : null, lines: [],
        pickup: { needed: null, address: null, contact: null, phone: null, ready_time: null },
      }
      // Browser pass fills only what the server left empty.
      const hasLines = f.lines.some((l) => l.pieces || l.kg || l.l)
      f = {
        ...f,
        destination: f.destination ?? p.destination,
        po_refs: f.po_refs ?? p.po_refs,
        lines: hasLines ? f.lines : p.lines,
        is_dg: f.is_dg || p.is_dg,
      }

      // Parties from the whole chain: NZ side = shipper, Pacific side = consignee.
      const people = partiesFromText(all, metas.map((m) => ({ name: m.from_name, email: m.from_address })))
      const nz = people.find((x) => x.side === 'nz')
      const pac = people.find((x) => x.side === 'pacific')
      const sameAsSender = (party: EaParty) => !party.name || /^[A-Z][a-z]+( [A-Z][a-z]+)?$/.test(party.name ?? '')
      if (nz && (blank(f.shipper) || sameAsSender(f.shipper))) {
        f.shipper = { ...f.shipper, name: companyNear(all, nz.email) ?? f.shipper.name ?? null, contact: f.shipper.contact ?? nz.name, email: nz.email, country: f.shipper.country ?? 'NZ' }
      }
      if (pac && blank(f.consignee)) f.consignee = { contact: pac.name, email: pac.email }

      const [ms, mc] = await Promise.all([
        matchAccount('shipper', { name: f.shipper.name, email: f.shipper.email, country: f.shipper.country ?? 'NZ' }).catch(() => null),
        matchAccount('consignee', { name: f.consignee.name, email: f.consignee.email, country: f.consignee.country }).catch(() => null),
      ])
      const bill: BillTo | null = srv?.bill_to ?? null
      let billAcc: CustomerPickerValue | null = bill ? { account_id: bill.account_id, name: bill.name } : null
      if (!billAcc && /^(NAN|SUV)$/i.test(f.destination ?? '')) billAcc = { account_id: 'UBNAN', name: 'UB FREIGHT (FIJI) PTE LIMITED' }

      setMatched({ shipper: ms, consignee: mc })
      setAccounts((a) => ({
        shipper: a.shipper ?? (ms ? toPick(ms) : null),
        consignee: a.consignee ?? (mc ? toPick(mc) : null),
        billTo: a.billTo ?? billAcc,
      }))
      setForm(f)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the email')
    } finally {
      setBusy(null)
    }
  }, [detail.conversation.id])

  return { form, setForm, accounts, setAccounts, matched, busy, error, load }
}

const toPick = (a: Account): CustomerPickerValue => ({
  account_id: a.account_id, name: a.name, address1: a.address1 ?? undefined, address2: a.address2 ?? undefined,
  address3: a.address3 ?? undefined, city: a.city ?? undefined, postcode: a.postcode ?? undefined,
  country: a.country ?? undefined, phone: a.phone ?? undefined, email: a.email ?? undefined, contact: a.contact ?? undefined,
})

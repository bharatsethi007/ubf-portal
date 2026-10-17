import { format, parseISO } from 'date-fns'
import { supabase } from '@/supabase'
import { cargoOf, fmtAwb, type AirConsol } from '../eaTypes'
import type { EaDetail } from '../useEaBooking'
import type { BcData } from './BookingConfirmationPdf'
import { addressLines, getBranding } from '@/features/company/branding'

const CITY: Record<string, string> = {
  AKL: 'Auckland', NAN: 'NADI', SUV: 'SUVA', APW: 'APIA', TBU: "NUKU'ALOFA", VLI: 'PORT VILA', HIR: 'HONIARA',
  RAR: 'RAROTONGA', POM: 'PORT MORESBY', NOU: 'NOUMEA', PPT: 'PAPEETE', TRW: 'TARAWA', FUN: 'FUNAFUTI',
}
const d = (iso: string | null | undefined) => (iso ? format(parseISO(iso), 'dd-MMM-yy') : '')
const up = (s: string | null | undefined) => (s ?? '').toUpperCase().trim()

type Acc = { account_id: string; name: string | null; address1: string | null; address2: string | null; address3: string | null; city: string | null; postcode: string | null; country: string | null; phone: string | null }

function partyLines(a: Acc | undefined, name: string | null, address: string | null, city: string | null, country: string | null, phone: string | null) {
  if (a) {
    return [a.name, a.address1, a.address2, a.address3, [a.city, a.postcode].filter(Boolean).join(' '), a.phone ? `PH: ${a.phone}` : null]
      .map(up).filter(Boolean)
  }
  return [name, address, [city, country].filter(Boolean).join('  '), phone ? `PH: ${phone}` : null].map(up).filter(Boolean)
}

/** Booking + consol + TradeWindow accounts -> the fields printed on the booking confirmation. */
export async function buildBcData(b: EaDetail, consol: AirConsol | undefined): Promise<BcData> {
  const ids = [b.shipper_account_id, b.consignee_account_id].filter(Boolean) as string[]
  const [{ data: accs }, { data: auth }] = await Promise.all([
    ids.length ? supabase.from('customers').select('account_id, name, address1, address2, address3, city, postcode, country, phone').in('account_id', ids) : Promise.resolve({ data: [] as Acc[] }),
    supabase.auth.getUser(),
  ])
  const byId = new Map(((accs ?? []) as Acc[]).map((a) => [a.account_id, a]))
  const bk = b as unknown as { company_id?: string | null; branch_id?: string | null }
  const brand = await getBranding(bk.company_id, bk.branch_id)
  const agentLines = [brand.legal_name, ...addressLines(brand), brand.customs_code, brand.phone ? `PH: ${brand.phone}` : '']
    .map(up).filter(Boolean)
  const { data: me } = auth.user ? await supabase.from('staff_users').select('full_name').eq('user_id', auth.user.id).maybeSingle() : { data: null }
  const c = cargoOf(b)
  const dest = up(b.destination || consol?.destination || '')
  const inco = up(b.incoterm)
  const fiji = /^(NAN|SUV)$/.test(dest)

  return {
    printedAt: format(new Date(), 'dd/MM/yy hh:mm:ss a'),
    printedBy: (me?.full_name as string | undefined) ?? 'UB Freight',
    jobNo: b.booking_ref,
    shipper: partyLines(byId.get(b.shipper_account_id ?? ''), b.shipper_name, b.shipper_address, b.shipper_city, null, null),
    consignee: partyLines(byId.get(b.consignee_account_id ?? ''), b.consignee_name, b.consignee_address, b.consignee_city, null, b.consignee_phone),
    houseBill: '',
    masterBill: consol?.mawb ? fmtAwb(consol.mawb).replace('-', '') : b.consol_mawb ?? '',
    flight: consol?.flight_no ?? b.consol_flight ?? '',
    etd: d(consol?.flight_date ?? b.consol_date),
    eta: d(consol?.eta_date ?? consol?.flight_date),
    origin: 'AKL - Auckland',
    receipt: 'Auckland',
    discharge: dest ? `${dest} - ${CITY[dest] ?? dest}` : '',
    dest: dest ? `${dest} - ${CITY[dest] ?? dest}` : '',
    freight: /^(EXW|FCA|FOB|FAS)$/.test(inco) ? 'COLLECT' : inco ? 'PREPAID' : 'COLLECT',
    bookingRef: b.customer_ref ?? '',
    weight: c.kg != null ? String(c.kg) : '',
    volume: c.cbm != null ? String(+Number(c.cbm).toFixed(3)) : '',
    packages: c.pcs != null ? String(c.pcs) : '',
    cartage: b.collection_mode === 'dropoff' ? 'Supplier delivers' : 'UB',
    cutoff: consol?.cutoff_at ? format(parseISO(consol.cutoff_at), 'dd-MMM-yy HH:mm') : '',
    reference: b.customer_ref ?? '',
    goods: up(b.goods_description ?? b.commodity ?? ''),
    notes: b.special_instructions ?? '',
    agent: fiji ? ['UB FREIGHT (FIJI) PTE LIMITED'] : agentLines,
    brand,
  }
}

/** Default recipients: shipper and consignee contacts on the booking, plus the original requester. */
export function bcRecipients(b: EaDetail) {
  const list = [b.shipper_email, b.consignee_email, b.owner_email].map((x) => (x ?? '').trim().toLowerCase())
  return [...new Set(list.filter((x) => /@/.test(x) && !/@ubfreight\.com$/.test(x)))]
}

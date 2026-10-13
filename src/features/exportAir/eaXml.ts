import { supabase } from '@/supabase'
import { cleanForTw } from './EaCargoCard'
import { cargoOf, type AirConsol, type EaRow } from './eaTypes'

/** TradeWindow Export Air consol import (Consolidation2). Matches the shape TW's own Extract XML produces. */

type Cust = { account_id: string; name: string | null; address1: string | null; address2: string | null; address3: string | null; city: string | null; state: string | null; postcode: string | null; country: string | null }
type House = EaRow & { goods_description?: string | null; commodity?: string | null; cargo_value?: number | null; cargo_value_currency?: string | null; incoterm?: string | null }

const esc = (v: unknown) =>
  cleanForTw(v == null ? '' : String(v)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const tag = (k: string, v: unknown, pad = '    ') => `${pad}<${k}>${esc(v)}</${k}>`
const iso = (d: string | null | undefined) => (d ? `${d.slice(0, 10)}T00:00:00Z` : '')
const num = (n: number | null | undefined, dp = 0) => (n == null ? '' : String(Number(Number(n).toFixed(dp))))

export type XmlIssue = { ref: string; problem: string }

/** Everything TW needs per house. Empty list = safe to export. */
export function xmlIssues(consol: AirConsol, houses: House[]): XmlIssue[] {
  const out: XmlIssue[] = []
  if (!houses.length) out.push({ ref: consol.flight_no, problem: 'No houses allocated' })
  for (const h of houses) {
    const c = cargoOf(h)
    if (!h.shipper_account_id) out.push({ ref: h.booking_ref, problem: 'Shipper code missing' })
    if (!h.consignee_account_id) out.push({ ref: h.booking_ref, problem: 'Consignee code missing' })
    if (!h.bill_to_account_id) out.push({ ref: h.booking_ref, problem: 'Bill-to missing' })
    if (!c.pcs) out.push({ ref: h.booking_ref, problem: 'Pieces missing' })
    if (!c.kg) out.push({ ref: h.booking_ref, problem: 'Weight missing' })
    if (!cleanForTw(h.goods_description ?? h.commodity)) out.push({ ref: h.booking_ref, problem: 'Goods description missing' })
  }
  return out
}

function party(prefix: 'CONS' | 'NOT' | 'SHIP', c: Cust | undefined) {
  return [
    tag(`${prefix}_CITY`, c?.city), tag(`${prefix}_COUNTRY`, c?.country),
    tag(`${prefix}_NAME1`, c?.name), tag(`${prefix}_NAME2`, ''),
    tag(`${prefix}_PCODE`, c?.postcode), tag(`${prefix}_STATE`, c?.state),
    tag(`${prefix}_STREET1`, c?.address1), tag(`${prefix}_STREET2`, c?.address2), tag(`${prefix}_STREET3`, c?.address3),
  ]
}

function job(h: House, cust: Map<string, Cust>, dest: string) {
  const c = cargoOf(h)
  const cons = cust.get(h.consignee_account_id ?? '')
  const ship = cust.get(h.shipper_account_id ?? '')
  const today = new Date().toISOString().slice(0, 10)
  return [
    '    <Job>',
    tag('JOB', ''), tag('BILL_TO', h.bill_to_account_id), tag('CHARGED_KG', num(c.chg)),
    tag('CONSIGNEE', h.consignee_account_id),
    ...party('CONS', cons),
    tag('GOODS', h.goods_description ?? h.commodity), tag('GOODS2', ''),
    tag('GOODS_CURR', h.cargo_value_currency ?? 'NZD'), tag('GOODS_VALUE', num(h.cargo_value, 2)),
    tag('HAWB_DATE', iso(today)), tag('HOUSEBILL', ''), tag('INCO_TERM', h.incoterm ?? ''),
    tag('KG_ACTUAL', num(c.kg, 1)), tag('M3_ACTUAL', num(c.cbm, 3)),
    ...party('NOT', cons),
    tag('PKGS_LANDED', num(c.pcs)), tag('PKGS_TOTAL', num(c.pcs)),
    tag('PORT_DESTINATION', dest), tag('PORT_ORIGIN', 'AKL'), tag('SERVICE', ''),
    tag('SHIPPER', h.shipper_account_id),
    ...party('SHIP', ship),
    '    </Job>',
  ].join('\n')
}

export async function buildConsolXml(consol: AirConsol, houses: House[]) {
  const codes = [...new Set(houses.flatMap((h) => [h.shipper_account_id, h.consignee_account_id]).filter(Boolean))] as string[]
  const { data, error } = await supabase.from('customers')
    .select('account_id, name, address1, address2, address3, city, state, postcode, country').in('account_id', codes)
  if (error) throw new Error(error.message)
  const cust = new Map(((data ?? []) as Cust[]).map((c) => [c.account_id, c]))
  const pkgs = houses.reduce((a, h) => a + Number(cargoOf(h).pcs ?? 0), 0)
  const dest = consol.destination.toUpperCase()
  const xml = [
    "<?xml version='1.0' encoding='UTF-8'?>",
    '<Consolidation2>',
    ' <Sender_Identifier>GST REG NO.: 79-129-984</Sender_Identifier>',
    ' <Sender_EDI_Account></Sender_EDI_Account>',
    ' <Sender_Name1>UB Freight Limited</Sender_Name1>',
    ' <Sender_Name2></Sender_Name2>',
    ' <Sender_Address1>173 MONTGOMERIE ROAD</Sender_Address1>',
    ' <Sender_Address2>AIRPORT OAKS</Sender_Address2>',
    ' <Sender_Address3>AUCKLAND, NEW ZEALAND</Sender_Address3>',
    ' <Sender_PAddress1>173 MONTGOMERIE ROAD, AIRPORT OAKS</Sender_PAddress1>',
    ' <Sender_PAddress2>AUCKLAND</Sender_PAddress2>',
    ' <Sender_PAddress3>NEW ZEALAND</Sender_PAddress3>',
    ' <Sender_Email></Sender_Email>',
    ' <Sender_Phone>64 9 966 3850</Sender_Phone>',
    ' <Sender_Fax>64 9 966 3859</Sender_Fax>',
    '  <Consignment>',
    tag('NATURE', 'AIR'), tag('AGENT', 'UB'), tag('AIRLINE_REF', ''), tag('ARRIVAL', ''),
    tag('EXPECTED', iso(consol.flight_date)), tag('FLIGHT', consol.flight_no),
    tag('MASTERBILL', (consol.mawb ?? '').replace(/\D/g, '')), tag('MASTERBILL_DATE', iso(consol.flight_date)),
    tag('PKGS_CONSOLIDATION', String(pkgs)), tag('PORT_DISCHARGE', dest), tag('PORT_LOADING', 'AKL'),
    ...houses.map((h) => job(h, cust, dest)),
    '  </Consignment>',
    '</Consolidation2>',
    '',
  ].join('\n')
  const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14)
  return { xml, fileName: `EXPORT_AIR_01AKL_${consol.flight_no}_${stamp}.xml` }
}

export function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/xml' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { supabase } from '@/supabase'

type Row = {
  shipper_name: string | null; shipper_contact: string | null; shipper_address: string | null; shipper_phone: string | null; shipper_email: string | null
  consignee_name: string | null; consignee_contact: string | null; consignee_address: string | null; consignee_phone: string | null; consignee_email: string | null
  pickup_address: string | null; delivery_address: string | null; needs_customs: boolean | null; needs_insurance: boolean | null
  cargo_value: number | null; cargo_value_currency: string | null; hs_code: string | null; incoterm: string | null
  quote_id: string | null; quoted_rate: { product?: string; sell?: number; currency?: string; response_no?: string } | null
  quote: { quote_no: string; status: string } | null
}

const COLS = `shipper_name, shipper_contact, shipper_address, shipper_phone, shipper_email,
  consignee_name, consignee_contact, consignee_address, consignee_phone, consignee_email,
  pickup_address, delivery_address, needs_customs, needs_insurance, cargo_value, cargo_value_currency, hs_code, incoterm,
  quote_id, quoted_rate, quote:quotes!bookings_quote_id_fkey(quote_no, status)`

function Party({ title, name, rest }: { title: string; name: string | null; rest: (string | null)[] }) {
  if (!name && !rest.some(Boolean)) return null
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <p className="font-medium text-slate-900">{name ?? '—'}</p>
      {rest.filter(Boolean).map((r, i) => <p key={i} className="truncate text-slate-600" title={r ?? ''}>{r}</p>)}
    </div>
  )
}

/** What the customer entered on the portal: parties, services and the quote this booking came from. */
export default function PortalRequestParties({ bookingId }: { bookingId: string }) {
  const [r, setR] = useState<Row | null>(null)
  useEffect(() => {
    void supabase.from('bookings').select(COLS).eq('id', bookingId).maybeSingle().then(({ data }) => setR((data as unknown as Row) ?? null))
  }, [bookingId])
  if (!r) return null

  const services = [
    r.incoterm ? `Incoterm ${r.incoterm}` : null,
    r.needs_customs ? 'Customs clearance by UBF' : r.needs_customs === false ? 'Customer clears customs' : null,
    r.needs_insurance ? `Insurance${r.cargo_value != null ? ` on ${r.cargo_value_currency ?? 'NZD'} ${Number(r.cargo_value).toLocaleString('en-NZ')}` : ''}` : null,
    r.hs_code ? `HS ${r.hs_code}` : null,
  ].filter(Boolean)
  const fromQuote = r.quoted_rate?.product === 'QUOTE'

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      {r.quote && (
        <div className="flex flex-wrap items-center gap-2 text-slate-700">
          <FileText size={14} className="text-slate-500" />
          {fromQuote
            ? <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">Booked from approved quote</span>
            : <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">No price agreed: quote request opened</span>}
          <Link to={`/quotes/${r.quote_id}`} className="font-mono font-semibold text-[#0A2472] hover:underline">{r.quote.quote_no}</Link>
          {fromQuote && r.quoted_rate?.sell != null && (
            <span className="font-mono">{r.quoted_rate.currency} {Number(r.quoted_rate.sell).toLocaleString('en-NZ', { minimumFractionDigits: 2 })} total{r.quoted_rate.response_no ? ` · ${r.quoted_rate.response_no}` : ''}</span>
          )}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Party title="Shipper" name={r.shipper_name} rest={[r.shipper_contact, r.shipper_address, [r.shipper_phone, r.shipper_email].filter(Boolean).join(' · ') || null]} />
        <Party title="Consignee" name={r.consignee_name} rest={[r.consignee_contact, r.consignee_address, [r.consignee_phone, r.consignee_email].filter(Boolean).join(' · ') || null]} />
        {r.pickup_address && <Party title="Pickup" name={null} rest={[r.pickup_address]} />}
        {r.delivery_address && <Party title="Delivery" name={null} rest={[r.delivery_address]} />}
      </div>
      {services.length > 0 && <p className="text-xs text-slate-600">{services.join(' · ')}</p>}
    </div>
  )
}

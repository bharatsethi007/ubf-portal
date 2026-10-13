import { useState } from 'react'
import { toast } from 'sonner'
import CustomerPicker, { type CustomerPickerValue } from '@/components/bookings/CustomerPicker'
import { Card, Code, lbl } from './eaUi'
import { patchBooking, type EaDetail } from './useEaBooking'

type Field = 'shipper_account_id' | 'consignee_account_id' | 'bill_to_account_id'

type Party = {
  field: Field
  label: string
  code: string | null
  codeName: string | null
  name: string | null
  lines: (string | null)[]
  quick?: { code: string; label: string }
}

/** Shipper, consignee, bill-to. Each must carry a TradeWindow account code for the XML. */
export default function EaPartiesCard({ b, onSaved }: { b: EaDetail; onSaved: () => void }) {
  const parties: Party[] = [
    {
      field: 'shipper_account_id', label: 'Shipper', code: b.shipper_account_id, codeName: b.shipper_code_name,
      name: b.shipper_name, lines: [b.shipper_address, b.shipper_city],
      quick: { code: 'VARIFJ', label: 'Use VARIFJ (various)' },
    },
    {
      field: 'consignee_account_id', label: 'Consignee', code: b.consignee_account_id, codeName: b.consignee_code_name,
      name: b.consignee_name, lines: [b.consignee_address, b.consignee_city, [b.consignee_contact, b.consignee_phone].filter(Boolean).join(' · ')],
    },
    {
      field: 'bill_to_account_id', label: 'Bill to', code: b.bill_to_account_id, codeName: b.bill_to_name,
      name: null, lines: [b.incoterm ? `${b.incoterm}` : null],
      quick: { code: 'UBNAN', label: 'Bill UBF Fiji (UBNAN)' },
    },
  ]
  const matched = parties.filter((p) => p.code).length

  return (
    <Card
      title="Parties"
      aside={<span className="text-[11px]" style={{ color: matched === 3 ? '#067647' : '#B54708' }}>
        {matched === 3 ? 'All 3 matched to TradeWindow accounts' : `${3 - matched} without a TradeWindow code`}
      </span>}
    >
      <div className="grid grid-cols-1 md:grid-cols-3">
        {parties.map((p, i) => <PartyCol key={p.field} p={p} id={b.id} last={i === 2} onSaved={onSaved} />)}
      </div>
    </Card>
  )
}

function PartyCol({ p, id, last, onSaved }: { p: Party; id: string; last: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)

  async function set(code: string | null) {
    try {
      await patchBooking(id, { [p.field]: code })
      setEditing(false)
      onSaved()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const lines = p.lines.filter((l): l is string => !!l && l.trim().length > 0)
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 px-4 py-3.5 ${last ? '' : 'md:border-r md:border-[#F1F2F5]'}`}>
      <div className="flex items-center gap-1.5">
        <span className={lbl}>{p.label}</span>
        {p.code ? <Code>{p.code}</Code> : <Code missing>No code</Code>}
        <button type="button" onClick={() => setEditing((e) => !e)} className="ml-auto w-auto border-0 bg-transparent p-0 text-[11px] font-medium text-[#0A2472] hover:underline">
          {editing ? 'Cancel' : p.code ? 'Change' : 'Match'}
        </button>
      </div>
      {editing ? (
        <div className="flex flex-col gap-1.5">
          <CustomerPicker compact value={null} onChange={(v: CustomerPickerValue | null) => { if (v) void set(v.account_id) }} />
          {p.quick ? (
            <button type="button" onClick={() => void set(p.quick!.code)} className="w-auto self-start border-0 bg-transparent p-0 text-[11.5px] text-[#0A2472] hover:underline">
              {p.quick.label}
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="font-medium text-[#14161A]">{p.codeName ?? p.name ?? '—'}</div>
          {p.codeName && p.name && p.name.toUpperCase() !== p.codeName.toUpperCase()
            ? <div className="text-[11px] text-[#6B7280]">On booking as {p.name}</div> : null}
          {lines.length ? <div className="whitespace-pre-line leading-normal text-[#5B616E]">{lines.join('\n')}</div> : null}
          {!p.code && p.quick ? (
            <button type="button" onClick={() => void set(p.quick!.code)} className="w-auto self-start border-0 bg-transparent p-0 text-[11.5px] font-medium text-[#0A2472] hover:underline">
              {p.quick.label}
            </button>
          ) : null}
        </>
      )}
    </div>
  )
}

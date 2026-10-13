import CustomerPicker, { type CustomerPickerValue } from '@/components/bookings/CustomerPicker'
import { Code, lbl } from './eaUi'

type Slot = 'shipper' | 'consignee' | 'billTo'

type Props = {
  shipper: CustomerPickerValue | null
  consignee: CustomerPickerValue | null
  billTo: CustomerPickerValue | null
  defaults: Record<string, CustomerPickerValue>
  onChange: (slot: Slot, v: CustomerPickerValue | null) => void
}

const quick = 'w-auto self-start border-0 bg-transparent p-0 text-[11.5px] font-medium text-[#0A2472] hover:underline'

/** Three TradeWindow accounts. Codes go straight into the consol XML, so pick, don't type. */
export default function EaNewParties({ shipper, consignee, billTo, defaults, onChange }: Props) {
  const col = (slot: Slot, label: string, v: CustomerPickerValue | null, q?: { code: string; text: string }) => (
    <div className="flex min-w-0 flex-col gap-1.5 px-4 py-3.5">
      <div className="flex items-center gap-1.5">
        <span className={lbl}>{label}</span>
        {v ? <Code>{v.account_id}</Code> : null}
        {v ? <button type="button" className={`${quick} ml-auto`} onClick={() => onChange(slot, null)}>Change</button> : null}
      </div>
      {v ? (
        <>
          <div className="font-medium text-[#14161A]">{v.name}</div>
          <div className="leading-normal text-[#5B616E]">
            {[v.address1, v.address2, v.address3, v.city].filter(Boolean).join(', ') || <span className="text-[#98A2B3]">No address on account</span>}
          </div>
        </>
      ) : (
        <>
          <CustomerPicker compact value={null} onChange={(x) => onChange(slot, x)} />
          {q && defaults[q.code] ? <button type="button" className={quick} onClick={() => onChange(slot, defaults[q.code])}>{q.text}</button> : null}
        </>
      )}
    </div>
  )

  return (
    <div className="grid grid-cols-1 divide-y divide-[#F1F2F5] md:grid-cols-3 md:divide-x md:divide-y-0">
      {col('shipper', 'Shipper', shipper, { code: 'VARIFJ', text: 'Various known shipper (VARIFJ)' })}
      {col('consignee', 'Consignee', consignee)}
      {col('billTo', 'Bill to', billTo, { code: 'UBNAN', text: 'UBF Fiji (UBNAN)' })}
    </div>
  )
}

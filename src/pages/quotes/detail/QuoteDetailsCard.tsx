import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from 'lucide-react'
import IncotermSelect from '@/components/bookings/IncotermSelect'
import type { CustomerPickerValue } from '@/components/bookings/CustomerPicker'
import { serviceTypeForIncoterm } from '../../rates/incotermLegs'
import PartyPicker from '../PartyPicker'
import QuoteAddressField from '../QuoteAddressField'
import { Card, Field, Seg, inp, lbl } from './qdUi'
import { CargoSection } from './QuoteCargoCard'
import { DIR_TONE } from '../quoteTones'
import type { Cargo, Fields } from './useQuoteDetail'

const SERVICES = ['Door to Door', 'Port to Port', 'Door to Port', 'Port to Door']

type Props = {
  fields: Fields
  isAir: boolean
  isAgent?: boolean
  staff: { user_id: string; name: string }[]
  customerPick: CustomerPickerValue | null
  patch: (p: Partial<Fields>) => void
  cargo: Cargo
  patchCargo: (p: Partial<Cargo>) => void
  onDirection: (v: string) => void
}

/** Direction (import / export / cross trade), terms, owners, parties, then cargo value and handling. */
export default function QuoteDetailsCard({ fields: f, isAir, isAgent = false, staff, customerPick, patch, cargo, patchCargo, onDirection }: Props) {
  const staffOpts = staff.map((s) => <option key={s.user_id} value={s.user_id}>{s.name}</option>)
  return (
    <Card
      title="Shipment"
      aside={
        <Seg<string> label="Direction" value={f.movement_type} onChange={onDirection} options={[
          { value: 'import', label: 'Import', icon: <ArrowDownLeft size={13} />, tone: DIR_TONE.import },
          { value: 'export', label: 'Export', icon: <ArrowUpRight size={13} />, tone: DIR_TONE.export },
          { value: 'crosstrade', label: 'Cross trade', icon: <ArrowLeftRight size={13} />, title: 'Cargo moves between ports where UBF has no office', tone: DIR_TONE.crosstrade },
        ]} />
      }
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 px-4 py-3.5 md:grid-cols-3 xl:grid-cols-5">
        <Field label="Incoterm">
          <IncotermSelect className={inp} value={f.incoterms ?? ''} airOnly={isAir}
            onChange={(v) => patch({ incoterms: v || null, service_type: serviceTypeForIncoterm(v) ?? f.service_type })} />
        </Field>
        <Field label="Service">
          <select className={inp} value={f.service_type ?? ''} onChange={(e) => patch({ service_type: e.target.value || null })}>
            <option value="">—</option>{SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Customer ref">
          <input className={`${inp} bk-mono`} value={f.customer_po ?? ''} onChange={(e) => patch({ customer_po: e.target.value || null })} />
        </Field>
        <Field label="Sales">
          {isAgent ? (
            <input className={`${inp} cursor-not-allowed bg-[#F6F7F9] text-[#6B7280]`} value="Agent quote" disabled
              title="Agent quotes have no sales owner" />
          ) : (
            <select className={inp} value={f.sales_executive_id ?? ''} onChange={(e) => patch({ sales_executive_id: e.target.value || null })}>
              <option value="">—</option>{staffOpts}
            </select>
          )}
        </Field>
        <Field label="Pricing">
          <select className={inp} value={f.pricing_executive_id ?? ''} onChange={(e) => patch({ pricing_executive_id: e.target.value || null })}>
            <option value="">—</option>{staffOpts}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 border-t border-[#F1F2F5] md:grid-cols-2">
        {(['shipper', 'consignee'] as const).map((k, i) => {
          const isDefault = (k === 'shipper' && f.movement_type === 'export') || (k === 'consignee' && f.movement_type === 'import')
          const addrKey = k === 'shipper' ? 'shipper_address' : 'consignee_address'
          return (
            <div key={k} className={`flex min-w-0 flex-col gap-2.5 px-4 py-3.5 ${i === 0 ? 'md:border-r md:border-[#F1F2F5]' : 'border-t border-[#F1F2F5] md:border-t-0'}`}>
              <span className={lbl}>{k === 'shipper' ? 'Shipper' : 'Consignee'}
                {isDefault ? <span className="ml-1 normal-case tracking-normal text-[#98A2B3]">· defaults to customer</span> : null}
              </span>
              <PartyPicker kind={k} name={f[k] ?? ''} address={f[addrKey] ?? ''}
                onNameChange={(v) => patch({ [k]: v || null })}
                onPick={(v) => patch({ [k]: v.name || null, [addrKey]: v.address || null })} />
              <QuoteAddressField label="Address" value={f[addrKey] ?? ''} partyName={f[k]} customer={customerPick}
                onChange={(v) => patch({ [addrKey]: v || null })} />
            </div>
          )
        })}
      </div>
      <CargoSection cargo={cargo} patch={patchCargo} />
    </Card>
  )
}

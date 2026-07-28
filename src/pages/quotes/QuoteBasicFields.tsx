import CustomerPicker, { type CustomerPickerValue } from '../../components/bookings/CustomerPicker'
import type { StaffOption } from '../../hooks/useStaffList'
import type { QuoteDraft } from './quotesApi'

const SHIPMENT_MODES = [
  'Air Cargo',
  'LCL - Less than container load',
  'FCL - Full Container Load',
  'Sea LCL',
  'Sea FCL',
] as const

const INCOTERMS = [
  'EX WORKS',
  'FOB',
  'CIF',
  'COST & FREIGHT',
  'DELIVERY AT PLACE',
  'DDP',
  'DDU',
] as const

type Props = {
  draft: QuoteDraft
  customer: CustomerPickerValue | null
  staff: StaffOption[]
  staffLoading: boolean
  onPatch: (patch: Partial<QuoteDraft>) => void
  onCustomerChange: (customer: CustomerPickerValue | null) => void
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select…',
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
  options: readonly string[]
  placeholder?: string
}) {
  return (
    <label className="filter-field booking-form-field">
      <span className="filter-field__label">{label}</span>
      <select
        className="input input--sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </label>
  )
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
}) {
  return (
    <label className="filter-field booking-form-field">
      <span className="filter-field__label">{label}</span>
      <input
        type="text"
        className="input input--sm"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </label>
  )
}

export default function QuoteBasicFields({
  draft,
  customer,
  staff,
  staffLoading,
  onPatch,
  onCustomerChange,
}: Props) {
  return (
    <div className="quote-form__grid">
      <SelectField
        label="Shipment Mode *"
        value={draft.shipment_mode}
        onChange={(v) => onPatch({ shipment_mode: v })}
        options={SHIPMENT_MODES}
      />
      <TextField label="Shipment Type" value={draft.shipment_type} onChange={(v) => onPatch({ shipment_type: v })} />
      <SelectField label="Incoterms" value={draft.incoterms} onChange={(v) => onPatch({ incoterms: v })} options={INCOTERMS} />
      <TextField label="Incoterm Place" value={draft.incoterm_place} onChange={(v) => onPatch({ incoterm_place: v })} />
      <div className="quote-form__field--span2">
        <CustomerPicker
          label="Customer Name"
          required
          value={customer}
          onChange={onCustomerChange}
        />
      </div>
      <TextField label="Customer PO#" value={draft.customer_po} onChange={(v) => onPatch({ customer_po: v })} />
      <TextField label="Shipper" value={draft.shipper} onChange={(v) => onPatch({ shipper: v })} />
      <TextField label="Consignee" value={draft.consignee} onChange={(v) => onPatch({ consignee: v })} />
      <SelectField
        label="Movement Type"
        value={draft.movement_type}
        onChange={(v) => onPatch({ movement_type: v })}
        options={['import', 'export']}
      />
      <label className="filter-field booking-form-field">
        <span className="filter-field__label">Sales Executive</span>
        <select
          className="input input--sm"
          value={draft.sales_executive_id ?? ''}
          disabled={staffLoading}
          onChange={(e) => onPatch({ sales_executive_id: e.target.value || null })}
        >
          <option value="">Select…</option>
          {staff.map((s) => (
            <option key={s.user_id} value={s.user_id}>{s.name}</option>
          ))}
        </select>
      </label>
      <label className="filter-field booking-form-field">
        <span className="filter-field__label">Pricing Executive</span>
        <select
          className="input input--sm"
          value={draft.pricing_executive_id ?? ''}
          disabled={staffLoading}
          onChange={(e) => onPatch({ pricing_executive_id: e.target.value || null })}
        >
          <option value="">Select…</option>
          {staff.map((s) => (
            <option key={s.user_id} value={s.user_id}>{s.name}</option>
          ))}
        </select>
      </label>
      <TextField
        label="Request Received From"
        value={draft.request_received_from}
        onChange={(v) => onPatch({ request_received_from: v })}
      />
      <TextField label="Product Type" value={draft.product_type} onChange={(v) => onPatch({ product_type: v })} />
      <TextField label="Project" value={draft.project} onChange={(v) => onPatch({ project: v })} />
    </div>
  )
}

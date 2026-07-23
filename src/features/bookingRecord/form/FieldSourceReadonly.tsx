import ManualOverridePill from '../portConnect/ManualOverridePill'
import PortConnectSourcePill from '../portConnect/PortConnectSourcePill'
import { usePortConnectDetail } from '../portConnect/PortConnectDetailProvider'
import type { PortConnectFieldKey } from '../portConnect/portConnectProvenance'
import BookingFieldShell from './BookingFieldShell'

type Props = {
  label: string
  value: string
  source: 'portconnect' | 'erp'
  fieldKey?: PortConnectFieldKey
  lastSync?: string | null
  overridden?: boolean
  flash?: boolean
  onOverride?: () => void
  onRevert?: () => void
}

export default function FieldSourceReadonly({
  label,
  value,
  source,
  fieldKey,
  lastSync,
  overridden,
  flash,
  onOverride,
  onRevert,
}: Props) {
  const { openDetail } = usePortConnectDetail()

  const provenance = overridden ? (
    onRevert ? <ManualOverridePill onRevert={onRevert} /> : null
  ) : source === 'portconnect' ? (
    <PortConnectSourcePill
      lastSync={lastSync}
      onClick={fieldKey ? () => openDetail(fieldKey) : undefined}
    />
  ) : null

  return (
    <BookingFieldShell label={label} provenance={provenance} flash={flash}>
      <div className="booking-erp-readonly">
        <span className="mono">{value}</span>
        {source === 'erp' ? (
          <span className="booking-field-source-meta">
            <span className="booking-erp-tag">from ERP</span>
          </span>
        ) : null}
        {onOverride ? (
          <button type="button" className="text-link booking-field-override-link" onClick={onOverride}>
            Override
          </button>
        ) : null}
      </div>
    </BookingFieldShell>
  )
}

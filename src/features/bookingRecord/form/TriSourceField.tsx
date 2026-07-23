import type { OverrideField } from '../bookingFieldOverrides'
import { withFieldOverride, withoutFieldOverride } from '../bookingFieldOverrides'
import ManualOverridePill from '../portConnect/ManualOverridePill'
import PortConnectSourcePill from '../portConnect/PortConnectSourcePill'
import { usePortConnectDetail } from '../portConnect/PortConnectDetailProvider'
import type { PortConnectFieldKey } from '../portConnect/portConnectProvenance'
import type { BookingRecordPatch } from '../bookingRecordTypes'
import BookingFieldShell from './BookingFieldShell'
import FieldSourceReadonly from './FieldSourceReadonly'

type Props = {
  label: string
  portConnectValue: string | null
  erpValue: string | null
  manualValue: string | null
  overrideField: OverrideField
  fieldOverrides: Record<string, boolean> | null | undefined
  lastSync?: string | null
  flash?: boolean
  onManualBlur: (patch: BookingRecordPatch) => void
}

export default function TriSourceField({
  label,
  portConnectValue,
  erpValue,
  manualValue,
  overrideField,
  fieldOverrides,
  lastSync,
  flash,
  onManualBlur,
}: Props) {
  const { openDetail } = usePortConnectDetail()
  const overridden = Boolean(fieldOverrides?.[overrideField])
  const fieldKey = overrideField as PortConnectFieldKey

  if (portConnectValue && !overridden) {
    return (
      <FieldSourceReadonly
        label={label}
        value={portConnectValue}
        source="portconnect"
        fieldKey={fieldKey}
        lastSync={lastSync}
        flash={flash}
        onOverride={() =>
          onManualBlur(withFieldOverride({}, overrideField, fieldOverrides))
        }
      />
    )
  }

  if (erpValue && !overridden) {
    return (
      <FieldSourceReadonly label={label} value={erpValue} source="erp" flash={flash} />
    )
  }

  const provenance = overridden && portConnectValue ? (
    <ManualOverridePill
      onRevert={() =>
        onManualBlur({ field_overrides: withoutFieldOverride(overrideField, fieldOverrides) })
      }
    />
  ) : portConnectValue && !manualValue ? (
    <PortConnectSourcePill
      lastSync={lastSync}
      onClick={() => openDetail(fieldKey)}
    />
  ) : null

  return (
    <BookingFieldShell label={label} provenance={provenance} flash={flash}>
      <input
        type="text"
        className="input input--sm"
        defaultValue={manualValue ?? ''}
        onBlur={(e) => {
          const next = e.target.value.trim() || null
          const prev = manualValue?.trim() || null
          if (next === prev) return
          const key = overrideField as keyof BookingRecordPatch
          onManualBlur(
            withFieldOverride({ [key]: next } as BookingRecordPatch, overrideField, fieldOverrides),
          )
        }}
      />
    </BookingFieldShell>
  )
}

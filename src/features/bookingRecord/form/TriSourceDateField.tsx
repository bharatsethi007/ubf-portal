import ImportSeaDateField from '@/features/importSea/ImportSeaDateField'
import type { OverrideField } from '../bookingFieldOverrides'
import { withFieldOverride, withoutFieldOverride } from '../bookingFieldOverrides'
import ManualOverridePill from '../portConnect/ManualOverridePill'
import PortConnectSourcePill from '../portConnect/PortConnectSourcePill'
import { usePortConnectDetail } from '../portConnect/PortConnectDetailProvider'
import type { PortConnectFieldKey } from '../portConnect/portConnectProvenance'
import type { BookingRecordPatch } from '../bookingRecordTypes'
import BookingFieldShell from './BookingFieldShell'
import FieldSourceReadonly from './FieldSourceReadonly'
import { fmtShort } from '@/utils/format'

type Props = {
  label: string
  portConnectValue: string | null
  manualValue: string | null
  overrideField: OverrideField
  fieldOverrides: Record<string, boolean> | null | undefined
  lastSync?: string | null
  flash?: boolean
  onPatch: (patch: BookingRecordPatch) => void
}

export default function TriSourceDateField({
  label,
  portConnectValue,
  manualValue,
  overrideField,
  fieldOverrides,
  lastSync,
  flash,
  onPatch,
}: Props) {
  const { openDetail } = usePortConnectDetail()
  const overridden = Boolean(fieldOverrides?.[overrideField])
  const fieldKey = overrideField as PortConnectFieldKey

  if (portConnectValue && !overridden) {
    return (
      <FieldSourceReadonly
        label={label}
        value={fmtShort(portConnectValue)}
        source="portconnect"
        fieldKey={fieldKey}
        lastSync={lastSync}
        flash={flash}
        onOverride={() =>
          onPatch(withFieldOverride({}, overrideField, fieldOverrides))
        }
      />
    )
  }

  const provenance = overridden && portConnectValue ? (
    <ManualOverridePill
      onRevert={() =>
        onPatch({ field_overrides: withoutFieldOverride(overrideField, fieldOverrides) })
      }
    />
  ) : null

  const bookingKey = overrideField as keyof BookingRecordPatch

  return (
    <BookingFieldShell label={label} provenance={provenance} flash={flash}>
      <ImportSeaDateField
        label=""
        embedded
        value={manualValue}
        onChange={(iso) =>
          onPatch(
            withFieldOverride(
              { [bookingKey]: iso } as BookingRecordPatch,
              overrideField,
              fieldOverrides,
            ),
          )
        }
      />
    </BookingFieldShell>
  )
}

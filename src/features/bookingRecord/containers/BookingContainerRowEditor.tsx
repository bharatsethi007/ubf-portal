import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  portConnectContainerSeal,
  portConnectContainerType,
} from '../portConnect/bookingPortConnectCoalesce'
import ContainerHazardChip from './ContainerHazardChip'
import BookingContainerConflictActions from './BookingContainerConflictActions'
import {
  CONTAINER_TYPE_OPTIONS,
  type BookingContainerSource,
} from './bookingContainerTypes'
import ManualOverridePill from '../portConnect/ManualOverridePill'
import PortConnectSourcePill from '../portConnect/PortConnectSourcePill'
import { usePortConnectDetail } from '../portConnect/PortConnectDetailProvider'
import ContainerSourceDot from './ContainerSourceDot'
import {
  containerConflictMessage,
  isUnresolvedContainerConflict,
} from './containerConflictUtils'
import {
  containerNoValidationMessage,
  normalizeContainerNo,
} from './containerIso6346'
import {
  containerTypeLabel,
  containerTypePillClass,
} from '@/features/importSea/containerTypeUtils'
import type { ContainerListItem } from './useBookingContainers'
import { isDraftContainer } from './useBookingContainers'
import type { ContainerTrackingRow } from '../tracking/trackingTypes'
import type { ContainerConflictResolution } from './bookingContainerTypes'

type Props = {
  row: ContainerListItem
  tracking?: ContainerTrackingRow
  onSave: (payload: {
    container_no: string
    container_type: string | null
    seal_no: string | null
  }) => void
  onRemove: () => void
  onResolve?: (resolution: ContainerConflictResolution) => void
  onOverride?: () => void
  onRevert?: () => void
  overridden?: boolean
  lastSync?: string | null
  flashType?: boolean
  flashSeal?: boolean
  resolveBusy?: boolean
}

function rowSource(row: ContainerListItem): BookingContainerSource {
  if (isDraftContainer(row)) return 'manual'
  return row.source
}

export default function BookingContainerRowEditor({
  row,
  tracking,
  onSave,
  onRemove,
  onResolve,
  onOverride,
  onRevert,
  overridden,
  lastSync,
  flashType,
  flashSeal,
  resolveBusy,
}: Props) {
  const { openDetail } = usePortConnectDetail()
  const readOnly = !isDraftContainer(row) && row.source !== 'manual'
  const isPortConnect = !isDraftContainer(row) && row.source === 'portconnect'
  const [containerNo, setContainerNo] = useState(row.container_no)
  const [containerType, setContainerType] = useState(row.container_type ?? '')
  const [sealNo, setSealNo] = useState(row.seal_no ?? '')
  const [warning, setWarning] = useState<string | null>(null)

  const hasConflict = !isDraftContainer(row) && isUnresolvedContainerConflict(row)
  const conflictMessage = !isDraftContainer(row) ? containerConflictMessage(row) : null

  useEffect(() => {
    setContainerNo(row.container_no)
    setContainerType(row.container_type ?? '')
    setSealNo(row.seal_no ?? '')
  }, [row.id, row.container_no, row.container_type, row.seal_no])

  function handleNoChange(raw: string) {
    const next = normalizeContainerNo(raw)
    setContainerNo(next)
    setWarning(containerNoValidationMessage(next))
  }

  function commit() {
    if (readOnly) return
    const normalized = normalizeContainerNo(containerNo)
    setWarning(containerNoValidationMessage(normalized))
    onSave({
      container_no: normalized,
      container_type: containerType || null,
      seal_no: sealNo.trim() || null,
    })
  }

  if (readOnly) {
    const typeLabel = isPortConnect && tracking
      ? portConnectContainerType(tracking)
      : containerTypeLabel(
          row.iso_type ?? row.tracking_container_type ?? row.container_type,
          row.iso_desc,
        )
    const seal = isPortConnect && tracking
      ? portConnectContainerSeal(tracking) ?? row.seal_no
      : row.seal_no
    return (
      <div className={`booking-container-row booking-container-row--readonly${hasConflict ? ' booking-container-row--conflict' : ''}`}>
        {rowSource(row) !== 'portconnect' ? <ContainerSourceDot source={rowSource(row)} /> : <span />}
        <span className="mono booking-container-row__no">
          {row.container_no}
          {!isDraftContainer(row) && (row.hazard_count ?? 0) > 0 ? (
            <ContainerHazardChip
              hazards={row.hazards}
              hazardCount={row.hazard_count}
              className="booking-container-row__hazard"
            />
          ) : null}
        </span>
        <span className={`booking-container-row__type${flashType ? ' booking-field--flash' : ''}`}>
          {isPortConnect ? (
            <PortConnectSourcePill
              lastSync={lastSync}
              onClick={() => openDetail('container_type', row.container_no)}
            />
          ) : null}
          {typeLabel ? (
            <span className={containerTypePillClass(typeLabel)}>{typeLabel}</span>
          ) : (
            row.container_type ?? '—'
          )}
        </span>
        <span className={`booking-container-row__seal${flashSeal ? ' booking-field--flash' : ''}`}>
          {isPortConnect ? (
            <PortConnectSourcePill
              lastSync={lastSync}
              onClick={() => openDetail('seal', row.container_no)}
            />
          ) : null}
          {seal ?? '—'}
        </span>
        {isPortConnect && onOverride ? (
          <button type="button" className="text-link booking-field-override-link" onClick={onOverride}>
            Override
          </button>
        ) : overridden && onRevert ? (
          <ManualOverridePill onRevert={onRevert} />
        ) : null}
        {hasConflict && conflictMessage ? (
          <div className="booking-container-conflict">
            <p className="booking-container-conflict__msg">{conflictMessage}</p>
            {onResolve ? (
              <BookingContainerConflictActions
                row={row}
                busy={resolveBusy}
                onResolve={onResolve}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={`booking-container-row${hasConflict ? ' booking-container-row--conflict' : ''}`}>
      {overridden && onRevert ? (
        <span className="booking-container-row__override">
          <ManualOverridePill onRevert={onRevert} />
        </span>
      ) : (
        <ContainerSourceDot source="manual" />
      )}
      <div className="booking-container-row__no-wrap">
        <Input
          className="input--xs mono booking-container-row__no-input"
          value={containerNo}
          placeholder="ABCD1234567"
          onChange={(e) => handleNoChange(e.target.value)}
          onBlur={commit}
        />
        {warning ? <p className="booking-container-row__warn">{warning}</p> : null}
      </div>
      <select
        className="input input--xs booking-container-row__type-select"
        value={containerType}
        onChange={(e) => setContainerType(e.target.value)}
        onBlur={commit}
      >
        <option value="">Type…</option>
        {CONTAINER_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <Input
        className="input--xs booking-container-row__seal-input"
        value={sealNo}
        placeholder="Seal"
        onChange={(e) => setSealNo(e.target.value)}
        onBlur={commit}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="booking-container-row__remove"
        onClick={onRemove}
        aria-label="Remove container"
      >
        <Trash2 size={14} />
      </Button>
      {hasConflict && conflictMessage ? (
        <div className="booking-container-conflict">
          <p className="booking-container-conflict__msg">{conflictMessage}</p>
          {onResolve ? (
            <BookingContainerConflictActions
              row={row}
              busy={resolveBusy}
              onResolve={onResolve}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  portConnectContainerType,
  portConnectContainerWeight,
} from '../portConnect/bookingPortConnectCoalesce'
import { HazardBang, ROW_GRID, WeightCell } from './ContainerRowBits'
import BookingContainerConflictActions from './BookingContainerConflictActions'
import {
  CONTAINER_TYPE_OPTIONS,
  type BookingContainerSource,
} from './bookingContainerTypes'
import ManualOverridePill from '../portConnect/ManualOverridePill'
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
  }) => void
  onRemove: () => void
  onResolve?: (resolution: ContainerConflictResolution) => void
  onOverride?: () => void
  onRevert?: () => void
  overridden?: boolean
  lastSync?: string | null
  flashType?: boolean
  resolveBusy?: boolean
  acknowledged?: boolean
  onToggleAck?: () => void
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
  resolveBusy,
  acknowledged,
  onToggleAck,
}: Props) {
  const { openDetail } = usePortConnectDetail()
  const readOnly = !isDraftContainer(row) && row.source !== 'manual'
  const isPortConnect = !isDraftContainer(row) && row.source === 'portconnect'
  const [containerNo, setContainerNo] = useState(row.container_no)
  const [containerType, setContainerType] = useState(row.container_type ?? '')
  const [warning, setWarning] = useState<string | null>(null)

  const hasConflict = !isDraftContainer(row) && isUnresolvedContainerConflict(row)
  const conflictMessage = !isDraftContainer(row) ? containerConflictMessage(row) : null

  useEffect(() => {
    setContainerNo(row.container_no)
    setContainerType(row.container_type ?? '')
  }, [row.id, row.container_no, row.container_type])

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
    })
  }

  if (readOnly) {
    const typeLabel = isPortConnect && tracking
      ? portConnectContainerType(tracking)
      : containerTypeLabel(
          row.iso_type ?? row.tracking_container_type ?? row.container_type,
          row.iso_desc,
        )
    const weightKg = tracking ? portConnectContainerWeight(tracking) : null
    return (
      <div
        className={`booking-container-row booking-container-row--readonly${hasConflict ? ' booking-container-row--conflict' : ''}`}
        style={{ ...ROW_GRID, gridTemplateColumns: '10px minmax(0, 1fr) 66px 86px auto' }}
      >
        <ContainerSourceDot source={rowSource(row)} />
        <span className="mono booking-container-row__no" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.container_no}</span>
          <HazardBang hazards={tracking?.hazards ?? row.hazards} hazardCount={tracking?.hazard_count ?? row.hazard_count} />
        </span>
        <span
          className={flashType ? 'booking-field--flash' : undefined}
          onClick={isPortConnect ? () => openDetail('container_type', row.container_no) : undefined}
          style={{ cursor: isPortConnect ? 'pointer' : undefined, minWidth: 0 }}
          title={isPortConnect ? 'From PortConnect, click for detail' : undefined}
        >
          {typeLabel ? <span className={containerTypePillClass(typeLabel)}>{typeLabel}</span> : (row.container_type ?? '—')}
        </span>
        <WeightCell kg={weightKg} acknowledged={acknowledged} onToggleAck={onToggleAck} />
        {isPortConnect && onOverride ? (
          <button type="button" className="text-link booking-field-override-link" onClick={onOverride}>Override</button>
        ) : overridden && onRevert ? (
          <ManualOverridePill onRevert={onRevert} />
        ) : <span />}
        {hasConflict && conflictMessage ? (
          <div className="booking-container-conflict">
            <p className="booking-container-conflict__msg">{conflictMessage}</p>
            {onResolve ? <BookingContainerConflictActions row={row} busy={resolveBusy} onResolve={onResolve} /> : null}
          </div>
        ) : null}
      </div>
    )
  }

  const wkg = tracking ? portConnectContainerWeight(tracking) : null

  return (
    <div className={`booking-container-row${hasConflict ? ' booking-container-row--conflict' : ''}`} style={ROW_GRID}>
      {overridden && onRevert ? (
        <span className="booking-container-row__override">
          <ManualOverridePill onRevert={onRevert} />
        </span>
      ) : (
        <ContainerSourceDot source="manual" />
      )}
      <div className="booking-container-row__no-wrap" style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Input
            className="input--xs mono booking-container-row__no-input"
            value={containerNo}
            placeholder="ABCD1234567"
            onChange={(e) => handleNoChange(e.target.value)}
            onBlur={commit}
            style={{ minWidth: 0, flex: 1 }}
          />
          {!isDraftContainer(row) ? (
            <HazardBang hazards={tracking?.hazards ?? row.hazards} hazardCount={tracking?.hazard_count ?? row.hazard_count} />
          ) : null}
        </div>
        {warning ? <p className="booking-container-row__warn">{warning}</p> : null}
      </div>
      <select
        className="input input--xs booking-container-row__type-select"
        value={containerType}
        onChange={(e) => setContainerType(e.target.value)}
        onBlur={commit}
        style={{ minWidth: 0, paddingRight: 2 }}
      >
        <option value="">Type…</option>
        {CONTAINER_TYPE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <WeightCell kg={wkg} acknowledged={acknowledged} onToggleAck={onToggleAck} />
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="booking-container-row__remove"
        onClick={onRemove}
        aria-label="Remove container"
        title="Remove container"
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BookingModule } from '../../types/booking'
import type { CargoLineRow } from '../../types/bookingCargoLine'
import type { BookingFormState } from '../../pages/bookings/bookingFormState'
import IntelligenceBubbleBoundary from './intelligence/IntelligenceBubbleBoundary'
import IntelligencePanel from './intelligence/IntelligencePanel'
import { buildIntelligenceBookingSnapshot } from './intelligence/intelligenceBookingSnapshot'
import type { IntelligenceBookingMeta } from './intelligence/types'
import { useIntelligence } from './intelligence/useIntelligence'
import './intelligence/intelligenceBubble.css'

type Props = {
  supplierAccountId?: string
  consigneeAccountId?: string
  supplierName: string
  consigneeName: string
  formState: BookingFormState
  cargoLines: CargoLineRow[]
  intelligenceMeta: IntelligenceBookingMeta
  module?: BookingModule
}

function UBFIntelligenceBubbleInner({
  supplierAccountId,
  consigneeAccountId,
  supplierName,
  consigneeName,
  formState,
  cargoLines,
  intelligenceMeta,
  module,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState(false)
  const autoKeyRef = useRef<string | null>(null)

  const partyKey = `${supplierAccountId ?? ''}|${consigneeAccountId ?? ''}`

  const booking = useMemo(
    () => buildIntelligenceBookingSnapshot(formState, cargoLines, intelligenceMeta, supplierAccountId),
    [formState, cargoLines, intelligenceMeta, supplierAccountId],
  )

  const { loading, data, contentKey, getDraftContext } = useIntelligence({
    supplierAccountId,
    consigneeAccountId,
    supplierName,
    consigneeName,
    booking,
    module,
    enabled: open && Boolean(module),
  })

  useEffect(() => {
    if (autoKeyRef.current === partyKey) return
    autoKeyRef.current = partyKey
    const timer = window.setTimeout(() => {
      setCollapsed(false)
      setOpen(true)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [partyKey])

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
  }, [])

  if (collapsed) {
    return (
      <button
        type="button"
        className="intel-bubble__tab"
        onClick={() => {
          setCollapsed(false)
          setOpen(true)
        }}
      >
        AI
      </button>
    )
  }

  return (
    <div className="intel-bubble-root">
      {open ? (
        <IntelligenceBubbleBoundary>
          <IntelligencePanel
            data={data}
            loading={loading}
            contentKey={contentKey}
            getDraftContext={getDraftContext}
            onClose={handleClose}
          />
        </IntelligenceBubbleBoundary>
      ) : null}
      <div className="intel-bubble-wrap">
        <button
          type="button"
          className="intel-bubble__dismiss"
          onClick={() => {
            setCollapsed(true)
            setOpen(false)
          }}
          aria-label="Dismiss assistant"
        >
          ×
        </button>
        <button
          type="button"
          className="intel-bubble-btn ai-glow"
          onClick={toggleOpen}
          aria-label="UBF Intelligence"
        >
          <span className="intel-bubble-btn__inner">✦</span>
        </button>
      </div>
    </div>
  )
}

export default function UBFIntelligenceBubble(props: Props) {
  return (
    <IntelligenceBubbleBoundary>
      <UBFIntelligenceBubbleInner {...props} />
    </IntelligenceBubbleBoundary>
  )
}

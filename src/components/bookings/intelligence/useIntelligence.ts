import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BookingModule } from '../../../types/booking'
import { fetchBookingMeta } from './bookingMetaApi'
import { buildIntelligenceNotes } from './confirmationMail'
import { fetchPartyIntelligence } from './partyIntelligenceApi'
import type {
  BookingMeta,
  ConfirmationDraftContext,
  IntelligenceBookingSnapshot,
  IntelligencePanelData,
  PartyIntelDisplay,
} from './types'

type Args = {
  supplierAccountId?: string
  consigneeAccountId?: string
  supplierName: string
  consigneeName: string
  booking: IntelligenceBookingSnapshot
  module?: BookingModule
  enabled: boolean
}

function toDisplay(
  row: Awaited<ReturnType<typeof fetchPartyIntelligence>>,
  fallbackName: string,
): PartyIntelDisplay | null {
  if (!row) return null
  return {
    ...row,
    name: row.name?.trim() || fallbackName,
  }
}

function buildFetchKey(
  enabled: boolean,
  module: BookingModule | undefined,
  supplierAccountId?: string,
  consigneeAccountId?: string,
): string {
  if (!enabled) return ''
  return `${module ?? ''}|${supplierAccountId ?? ''}|${consigneeAccountId ?? ''}`
}

export function useIntelligence({
  supplierAccountId,
  consigneeAccountId,
  supplierName,
  consigneeName,
  booking,
  module,
  enabled,
}: Args) {
  const [supplierParty, setSupplierParty] = useState<PartyIntelDisplay | null>(null)
  const [consigneeParty, setConsigneeParty] = useState<PartyIntelDisplay | null>(null)
  const [bookingMeta, setBookingMeta] = useState<BookingMeta | null>(null)
  const [settledKey, setSettledKey] = useState('')

  const bookingRef = useRef(booking)
  bookingRef.current = booking

  const fetchKey = buildFetchKey(enabled, module, supplierAccountId, consigneeAccountId)
  const loading = Boolean(fetchKey) && settledKey !== fetchKey

  useEffect(() => {
    if (!enabled) {
      setSupplierParty(null)
      setConsigneeParty(null)
      setBookingMeta(null)
      return
    }

    const supplierId = trimId(supplierAccountId)
    const consigneeId = trimId(consigneeAccountId)
    let cancelled = false

    const jobs: Promise<void>[] = []

    if (module) {
      jobs.push(
        fetchBookingMeta(module)
          .then((meta) => {
            if (!cancelled) setBookingMeta(meta)
          })
          .catch(() => {
            if (!cancelled) setBookingMeta(null)
          })
          .then(() => undefined),
      )
    } else {
      setBookingMeta(null)
    }

    if (supplierId || consigneeId) {
      jobs.push(
        (async () => {
          const [supplierRow, consigneeRow] = await Promise.all([
            supplierId ? fetchPartyIntelligence(supplierId) : Promise.resolve(null),
            consigneeId ? fetchPartyIntelligence(consigneeId) : Promise.resolve(null),
          ])
          if (cancelled) return
          setSupplierParty(toDisplay(supplierRow, supplierName))
          setConsigneeParty(toDisplay(consigneeRow, consigneeName))
        })().catch(() => {
          if (cancelled) return
          setSupplierParty(null)
          setConsigneeParty(null)
        }),
      )
    } else {
      setSupplierParty(null)
      setConsigneeParty(null)
    }

    Promise.all(jobs).finally(() => {
      if (!cancelled) setSettledKey(fetchKey)
    })

    return () => {
      cancelled = true
    }
  }, [enabled, fetchKey, module, supplierAccountId, consigneeAccountId, supplierName, consigneeName])

  const notes = useMemo(() => buildIntelligenceNotes(bookingMeta), [bookingMeta])

  const data = useMemo(
    (): IntelligencePanelData => ({
      supplier: supplierParty,
      consignee: consigneeParty,
      notes,
    }),
    [supplierParty, consigneeParty, notes],
  )

  const contentKey = useMemo(
    () =>
      [
        settledKey,
        supplierParty?.name ?? '',
        consigneeParty?.name ?? '',
        notes.length,
        bookingMeta?.ops_mailbox ?? '',
      ].join('|'),
    [settledKey, supplierParty?.name, consigneeParty?.name, notes.length, bookingMeta?.ops_mailbox],
  )

  const getDraftContext = useCallback((): ConfirmationDraftContext | null => {
    const meta = bookingMeta
    if (!meta?.ops_mailbox?.trim()) return null
    return {
      meta,
      booking: bookingRef.current,
      supplier: supplierParty,
      consignee: consigneeParty,
    }
  }, [bookingMeta, supplierParty, consigneeParty])

  return { loading, data, contentKey, getDraftContext }
}

function trimId(value?: string): string | undefined {
  const id = value?.trim()
  return id || undefined
}

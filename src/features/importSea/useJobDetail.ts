import { useEffect, useState } from 'react'
import type { BookingDocument } from '../../types/bookingDocument'
import type { Container } from '../../types/container'
import type { Invoice } from '../../types/invoice'
import {
  fetchJobBooking,
  fetchJobContainers,
  fetchJobDocuments,
  fetchJobInvoices,
  fetchJobShipment,
  fetchJobTracking,
  type JobDetailBooking,
  type JobDetailShipment,
  type TrackingEvent,
} from './jobDetailApi'

export function useJobDetail(bookingId: string | null) {
  const [booking, setBooking] = useState<JobDetailBooking | null>(null)
  const [shipment, setShipment] = useState<JobDetailShipment | null>(null)
  const [tracking, setTracking] = useState<TrackingEvent[]>([])
  const [containers, setContainers] = useState<Container[]>([])
  const [documents, setDocuments] = useState<BookingDocument[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!bookingId) {
      setBooking(null)
      setShipment(null)
      setTracking([])
      setContainers([])
      setDocuments([])
      setInvoices([])
      return
    }

    let cancelled = false
    setLoading(true)

    ;(async () => {
      const bk = await fetchJobBooking(bookingId)
      if (cancelled) return
      setBooking(bk)

      const ju = bk?.shipment_id ?? null
      const ship = ju != null ? await fetchJobShipment(ju) : null
      if (cancelled) return
      setShipment(ship)

      const [tr, docs, inv, ctr] = await Promise.all([
        fetchJobTracking(ju),
        fetchJobDocuments(bookingId),
        fetchJobInvoices(ju),
        fetchJobContainers(ship?.consol_key ?? null),
      ])
      if (cancelled) return
      setTracking(tr)
      setDocuments(docs)
      setInvoices(inv)
      setContainers(ctr)
      setLoading(false)
    })()

    return () => { cancelled = true }
  }, [bookingId])

  return { booking, shipment, tracking, containers, documents, invoices, loading }
}

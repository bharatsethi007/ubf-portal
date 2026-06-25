import { useCallback, useEffect, useState } from 'react'
import { loadCargoLines, saveCargoLines } from '../components/bookings/bookingCargoApi'
import { loadBookingDocuments } from '../components/bookings/bookingDocumentsApi'
import { supabase } from '../supabase'
import type { Booking, BookingModule, BookingStatus, BookingSupplier } from '../types/booking'
import type { BookingCargoLine } from '../types/bookingCargoLine'
import type { BookingDocument } from '../types/bookingDocument'

const BOOKING_SELECT =
  'id, booking_ref, module, source, status, account_id, is_consolidation, ' +
  'importer_name, importer_account_id, consignee_account_id, origin, destination, incoterm, commodity, ' +
  'pieces, weight_kg, volume_m3, chargeable_weight_kg, container_type, container_count, ' +
  'vessel_flight, etd, eta, special_instructions, source_payload, job_unique, ' +
  'created_at, updated_at, booking_suppliers(supplier_account_id, ord)'

type SupplierJoin = { supplier_account_id: string | null; ord: number }
type BookingListRow = Booking & { booking_suppliers?: SupplierJoin[] | null }

function mapBookingListRow(row: BookingListRow): Booking {
  const suppliers = row.booking_suppliers ?? []
  const sorted = [...suppliers].sort((a, b) => a.ord - b.ord)
  const shipper_account_id =
    sorted.find((s) => s.supplier_account_id)?.supplier_account_id ?? null
  const { booking_suppliers: _s, ...booking } = row
  return { ...booking, shipper_account_id }
}

export type CustomerPickerValue = {
  account_id: string
  name: string
  address1?: string
  address2?: string
  address3?: string
  city?: string
  state?: string
  postcode?: string
  country?: string
  phone?: string
  email?: string
  contact?: string
}

/** @deprecated Use CustomerPickerValue */
export type CustomerSearchHit = CustomerPickerValue

const CUSTOMER_SELECT =
  'account_id, name, address1, address2, address3, city, state, postcode, country, phone, email, contact'

function optStr(v: unknown): string | undefined {
  if (v == null || v === '') return undefined
  return String(v)
}

function mapCustomer(row: Record<string, unknown>): CustomerPickerValue {
  return {
    account_id: String(row.account_id),
    name: (row.name as string | null) ?? String(row.account_id),
    address1: optStr(row.address1),
    address2: optStr(row.address2),
    address3: optStr(row.address3),
    city: optStr(row.city),
    state: optStr(row.state),
    postcode: optStr(row.postcode),
    country: optStr(row.country),
    phone: optStr(row.phone),
    email: optStr(row.email),
    contact: optStr(row.contact),
  }
}

export function useBookings(module: BookingModule) {
  const [data, setData] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  const refetch = useCallback(() => setVersion((v) => v + 1), [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    ;(async () => {
      const { data: rows, error: err } = await supabase
        .from('bookings')
        .select(BOOKING_SELECT)
        .eq('module', module)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (err) {
        setError(err.message)
        setData([])
      } else {
        setData(((rows as BookingListRow[]) ?? []).map(mapBookingListRow))
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [module, version])

  return { data, loading, error, refetch }
}

function bookingWritePayload(payload: Partial<Booking>) {
  const { id: _id, booking_ref: _ref, created_at: _ca, updated_at: _ua, ...rest } = payload
  return rest
}

function supplierInsertRows(bookingId: string, suppliers: Partial<BookingSupplier>[]) {
  return suppliers.map((s, index) => {
    const { id: _id, booking_id: _bid, ord: _ord, ...fields } = s
    return { ...fields, booking_id: bookingId, ord: index }
  })
}

export async function saveBooking(
  payload: Partial<Booking>,
  suppliers: Partial<BookingSupplier>[] = [],
  cargoLines: Partial<BookingCargoLine>[] = [],
): Promise<Booking> {
  if (payload.id) {
    const id = payload.id
    const { data: booking, error: bookingErr } = await supabase
      .from('bookings')
      .update(bookingWritePayload(payload))
      .eq('id', id)
      .select('*')
      .single()

    if (bookingErr || !booking) {
      throw new Error(bookingErr?.message ?? 'Failed to update booking')
    }

    const { error: deleteErr } = await supabase.from('booking_suppliers').delete().eq('booking_id', id)
    if (deleteErr) throw new Error(deleteErr.message)

    if (suppliers.length > 0) {
      const { error: supplierErr } = await supabase
        .from('booking_suppliers')
        .insert(supplierInsertRows(id, suppliers))
      if (supplierErr) throw new Error(supplierErr.message)
    }

    await saveCargoLines(id, cargoLines)
    return booking as Booking
  }

  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .insert(bookingWritePayload(payload))
    .select('*')
    .single()

  if (bookingErr || !booking) {
    throw new Error(bookingErr?.message ?? 'Failed to create booking')
  }

  const bookingId = (booking as Booking).id

  if (suppliers.length > 0) {
    const { error: supplierErr } = await supabase
      .from('booking_suppliers')
      .insert(supplierInsertRows(bookingId, suppliers))
    if (supplierErr) throw new Error(supplierErr.message)
  }

  await saveCargoLines(bookingId, cargoLines)
  return booking as Booking
}

export async function getBooking(
  id: string,
): Promise<{ booking: Booking; suppliers: BookingSupplier[]; cargoLines: BookingCargoLine[]; documents: BookingDocument[] }> {
  const { data: booking, error: bookingErr } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single()

  if (bookingErr || !booking) {
    throw new Error(bookingErr?.message ?? 'Booking not found')
  }

  const { data: suppliers, error: supplierErr } = await supabase
    .from('booking_suppliers')
    .select('*')
    .eq('booking_id', id)
    .order('ord', { ascending: true })

  if (supplierErr) throw new Error(supplierErr.message)

  const cargoLines = await loadCargoLines(id)
  const documents = await loadBookingDocuments(id)

  return { booking: booking as Booking, suppliers: (suppliers as BookingSupplier[]) ?? [], cargoLines, documents }
}

export async function createBooking(
  payload: Partial<Booking>,
  exporters: Partial<BookingSupplier>[],
): Promise<Booking> {
  return saveBooking(payload, exporters)
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<void> {
  const { error } = await supabase.from('bookings').update({ status }).eq('id', id)
  if (error) throw new Error(error.message)
}

export function useCustomerSearch(term: string) {
  const [data, setData] = useState<CustomerPickerValue[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = term.trim()
    if (q.length < 2) {
      setData([])
      setLoading(false)
      setError('')
      return
    }

    let cancelled = false
    setLoading(true)
    setError('')

    ;(async () => {
      const { data: rows, error: err } = await supabase
        .from('customers')
        .select(CUSTOMER_SELECT)
        .eq('closed', false)
        .ilike('name', `%${q}%`)
        .limit(8)

      if (cancelled) return

      if (err) {
        setError(err.message)
        setData([])
      } else {
        setData((rows ?? []).map((row) => mapCustomer(row as Record<string, unknown>)))
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [term])

  return { data, loading, error }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { BookingDocumentsHandle } from '../../components/bookings/BookingDocuments'
import ShipmentInfo from '../../components/bookings/ShipmentInfo'
import SuggestionBubble from '../../components/bookings/SuggestionBubble'
import TopProgressBar from '../../components/bookings/TopProgressBar'
import type { ReferenceJob } from '../../components/bookings/jobsReferenceApi'
import { validateSubmit, type FieldErrors } from '../../components/bookings/bookingFormValidation'
import { getBooking, saveBooking } from '../../hooks/useBookings'
import type { CargoLineRow } from '../../types/bookingCargoLine'
import type { BookingDocument } from '../../types/bookingDocument'
import {
  cargoLinesFromBookingHeader,
  cargoLinesFromDb,
  newCargoLine,
} from '../../components/bookings/cargoLineUtils'
import {
  MODULE_CONFIG,
  STATUS_LABEL,
  type BookingModule,
  type BookingStatus,
} from '../../types/booking'
import {
  emptyFormState,
  formFromBooking,
  formToSavePayload,
  type BookingFormState,
  type SupplierRowState,
} from './bookingFormState'
import CargoSection from './sections/CargoSection'
import ConsigneeSection from './sections/ConsigneeSection'
import DocumentsSection from './sections/DocumentsSection'
import NotesSection from './sections/NotesSection'
import ShipperSection from './sections/ShipperSection'
import './bookingFormPage.css'
import '../../components/bookings/bookingForm.css'

const MODULES: BookingModule[] = ['EA', 'ES', 'IA', 'IS']

export default function BookingFormPage() {
  const { module, id } = useParams()
  const navigate = useNavigate()
  const isEdit = Boolean(id)
  const bookingId = id
  const mod = module && MODULES.includes(module as BookingModule) ? (module as BookingModule) : null

  const [state, setState] = useState<BookingFormState>(emptyFormState)
  const [cargoLines, setCargoLines] = useState<CargoLineRow[]>([newCargoLine()])
  const [documents, setDocuments] = useState<BookingDocument[]>([])
  const [status, setStatus] = useState<BookingStatus>('draft')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const documentsRef = useRef<BookingDocumentsHandle>(null)

  const patch = useCallback((p: Partial<BookingFormState>) => {
    setState((s) => ({ ...s, ...p }))
  }, [])

  const setSuppliers = useCallback((rows: SupplierRowState[]) => {
    setState((s) => ({ ...s, suppliers: rows }))
  }, [])

  const shipperAccountId = state.isConsolidation
    ? state.suppliers.find((s) => s.customer?.account_id)?.customer?.account_id
    : state.shipperCustomer?.account_id
  const consigneeAccountId = state.consigneeCustomer?.account_id
  const docAccountId = consigneeAccountId ?? shipperAccountId

  useEffect(() => {
    console.log('[SuggestionBubble] inputs', {
      shipperAccountId: shipperAccountId ?? null,
      consigneeAccountId: consigneeAccountId ?? null,
      origin: state.origin.trim() || null,
      destination: state.destination.trim() || null,
      module: mod,
    })
  }, [shipperAccountId, consigneeAccountId, state.origin, state.destination, mod])

  useEffect(() => {
    if (!bookingId) return
    let cancelled = false
    setLoading(true)
    setError('')
    getBooking(bookingId)
      .then(({ booking, suppliers, cargoLines: dbLines, documents: docs }) => {
        if (cancelled) return
        setState(formFromBooking(booking, suppliers))
        setCargoLines(dbLines.length ? cargoLinesFromDb(dbLines) : cargoLinesFromBookingHeader(booking))
        setDocuments(docs)
        setStatus(booking.status)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load booking')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [bookingId])

  const copyCargoFromJob = useCallback((job: ReferenceJob) => {
    setCargoLines((lines) => {
      const next = lines.length ? [...lines] : [newCargoLine()]
      const row = { ...next[0] }
      if (job.goods_desc) row.goodsDesc = job.goods_desc
      if (job.pack_qty != null) row.pieces = String(job.pack_qty)
      if (job.weight_kg != null) {
        row.weight = String(job.weight_kg)
        row.weightUnit = 'KG'
      }
      next[0] = row
      return next
    })
  }, [])

  async function handleSave(nextStatus: BookingStatus) {
    setError('')
    if (nextStatus === 'submitted') {
      setSubmitAttempted(true)
      const errors = validateSubmit(state)
      setFieldErrors(errors)
      if (Object.keys(errors).length > 0) {
        const first = Object.keys(errors)[0]
        if (first === 'shipperCustomer') document.getElementById('shipper')?.scrollIntoView({ behavior: 'smooth' })
        else if (first === 'consigneeCustomer') document.getElementById('consignee')?.scrollIntoView({ behavior: 'smooth' })
        else document.getElementById('shipment')?.scrollIntoView({ behavior: 'smooth' })
        return
      }
    } else {
      setSubmitAttempted(false)
      setFieldErrors({})
    }

    setSaving(true)
    try {
      const { payload, suppliers, cargoLines: cargoPayload } = formToSavePayload(state, mod!, nextStatus, cargoLines, bookingId)
      const saved = await saveBooking(payload, suppliers, cargoPayload)
      await documentsRef.current?.flushPending(saved.id)
      navigate(`/bookings/${mod}/${saved.id}/edit`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!mod) return <Navigate to="/bookings/ES" replace />

  const cfg = MODULE_CONFIG[mod]
  const title = `${isEdit ? 'Edit' : 'New'} ${cfg.label} Booking`
  const sectionProps = { state, set: patch, errors: fieldErrors, showErrors: submitAttempted }

  if (loading) return <div className="muted pad">Loading booking…</div>

  return (
    <div className="bf-page">
      <div className="bf-sticky-head">
        <header className="bf-topbar">
          <div className="bf-topbar__left">
            <button type="button" className="bf-topbar__back" onClick={() => navigate(`/bookings/${mod}`)}>
              ← Back to bookings
            </button>
            <div className="bf-topbar__title-row">
              <h1 className="bf-topbar__title">{title}</h1>
              {isEdit && <span className="pill">{STATUS_LABEL[status] ?? status}</span>}
            </div>
          </div>
          <div className="bf-topbar__actions">
            <button type="button" className="bf-btn bf-btn--secondary" disabled={saving} onClick={() => handleSave('draft')}>
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button type="button" className="bf-btn bf-btn--primary" disabled={saving} onClick={() => handleSave('submitted')}>
              Submit Booking
            </button>
          </div>
        </header>
        <TopProgressBar state={state} />
      </div>

      {error && <div className="bf-alert error card pad-inline">{error}</div>}

      <div className="bf-layout">
        <div className="bf-main">
          <ShipmentInfo {...sectionProps} useIata={cfg.portKind === 'IATA'} />
          <div className={`bf-parties-grid${state.isConsolidation ? ' bf-parties-grid--wide-shipper' : ''}`}>
            <ShipperSection {...sectionProps} setSuppliers={setSuppliers} />
            <ConsigneeSection {...sectionProps} />
          </div>
          <CargoSection {...sectionProps} cargoLines={cargoLines} onCargoLinesChange={setCargoLines} />
          <div className="bf-footer-grid">
            <NotesSection {...sectionProps} />
            <DocumentsSection
              bookingId={bookingId}
              accountId={docAccountId}
              documents={documents}
              documentsRef={documentsRef}
            />
          </div>
        </div>
      </div>

      <SuggestionBubble
        shipperAccountId={shipperAccountId}
        consigneeAccountId={consigneeAccountId}
        origin={state.origin}
        destination={state.destination}
        module={mod}
        onCopyCargo={copyCargoFromJob}
      />
    </div>
  )
}

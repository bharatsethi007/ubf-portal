import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import type { BookingDocumentsHandle } from '../../components/bookings/BookingDocuments'
import ShipmentInfo from '../../components/bookings/ShipmentInfo'
import UBFIntelligenceBubble from '../../components/bookings/UBFIntelligenceBubble'
import {
  resolveIntelligencePartyIds,
  type IntelligenceBookingMeta,
} from '../../components/bookings/intelligence/resolveIntelligencePartyIds'
import TopProgressBar from '../../components/bookings/TopProgressBar'
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
  type Booking,
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
import SliErrorBoundary from '../../features/sli/staff/SliErrorBoundary'
import SliTab from '../../features/sli/staff/SliTab'
import EmailSourcePanel from '../../components/bookings/EmailSourcePanel'
import EmailSourceErrorBoundary from '../../components/bookings/EmailSourceErrorBoundary'
import { useBookingSourceEmail } from './useBookingSourceEmail'
import { SectionCard } from './formUi'
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
  const [bookingSource, setBookingSource] = useState<Booking['source']>('manual')
  const [cargoLines, setCargoLines] = useState<CargoLineRow[]>([newCargoLine()])
  const [documents, setDocuments] = useState<BookingDocument[]>([])
  const [status, setStatus] = useState<BookingStatus>('draft')
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [intelligenceMeta, setIntelligenceMeta] = useState<IntelligenceBookingMeta>({})
  const documentsRef = useRef<BookingDocumentsHandle>(null)

  const patch = useCallback((p: Partial<BookingFormState>) => {
    setState((s) => ({ ...s, ...p }))
  }, [])

  const setSuppliers = useCallback((rows: SupplierRowState[]) => {
    setState((s) => ({ ...s, suppliers: rows }))
  }, [])

  const { supplierAccountId, consigneeAccountId } = resolveIntelligencePartyIds(state, intelligenceMeta)
  const docAccountId = consigneeAccountId ?? supplierAccountId
  const supplierName = state.isConsolidation
    ? (state.suppliers.find((s) => s.customer?.account_id === supplierAccountId)?.companyName
      || state.suppliers.find((s) => s.customer?.account_id)?.customer?.name
      || 'Supplier')
    : (state.shipperCompany.trim() || state.shipperCustomer?.name || 'Supplier')
  const consigneeName = state.consigneeCompany.trim() || state.consigneeCustomer?.name || 'Consignee'

  const { source: emailSource, attachmentUrls, attachmentErrors } = useBookingSourceEmail(
    bookingId,
    bookingSource === 'email_import',
  )

  useEffect(() => {
    if (!bookingId) return
    let cancelled = false
    setLoading(true)
    setError('')
    getBooking(bookingId)
      .then(({ booking, suppliers, cargoLines: dbLines, documents: docs }) => {
        if (cancelled) return
        setState(formFromBooking(booking, suppliers))
        setBookingSource(booking.source)
        setIntelligenceMeta({
          accountId: booking.account_id,
          consigneeAccountId: booking.consignee_account_id,
          firstSupplierAccountId: suppliers[0]?.supplier_account_id,
          bookingRef: booking.booking_ref,
          vessel: booking.vessel ?? null,
          voyage: booking.voyage ?? null,
        })
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
      const { payload, suppliers, cargoLines: cargoPayload } = formToSavePayload(
        state, mod!, nextStatus, cargoLines, bookingId, bookingSource,
      )
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

  const showEmailPanel = bookingSource === 'email_import' && Boolean(emailSource)

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

      <div className={`bf-layout${showEmailPanel ? ' bf-layout--with-email' : ''}`}>
        <div className="bf-main">
          <ShipmentInfo {...sectionProps} useIata={cfg.portKind === 'IATA'} isAir={cfg.mode === 'air'} />
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
          <SectionCard id="sli" title="SLI">
            {bookingId ? (
              <SliErrorBoundary>
                <SliTab bookingId={bookingId} isConsolidation={state.isConsolidation} />
              </SliErrorBoundary>
            ) : (
              <p className="muted">Save the booking to manage SLIs.</p>
            )}
          </SectionCard>
        </div>
        {showEmailPanel && emailSource && (
          <EmailSourceErrorBoundary>
            <EmailSourcePanel
              source={emailSource}
              attachmentUrls={attachmentUrls ?? {}}
              attachmentErrors={attachmentErrors ?? {}}
            />
          </EmailSourceErrorBoundary>
        )}
      </div>

      {!loading && (
        <UBFIntelligenceBubble
          supplierAccountId={supplierAccountId}
          consigneeAccountId={consigneeAccountId}
          supplierName={supplierName}
          consigneeName={consigneeName}
          formState={state}
          cargoLines={cargoLines}
          intelligenceMeta={intelligenceMeta}
          module={mod}
        />
      )}
    </div>
  )
}

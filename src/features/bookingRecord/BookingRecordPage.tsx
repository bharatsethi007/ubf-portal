import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { importSeaBackHref } from '@/features/importSea/importSeaFilterUrl'
import BookingTrackingTab from './tracking/BookingTrackingTab'
import { buildPortConnectRouteContext } from './tracking/portConnectRouteContext'
import { containerNumbersFromBooking } from './tracking/portconnectUtils'
import { useBookingTracking } from './tracking/useBookingTracking'
import { useBookingContainers, isDraftContainer } from './containers/useBookingContainers'
import type { BookingContainerRow } from './containers/bookingContainerTypes'
import BookingDocumentsTab from './documents/BookingDocumentsTab'
import BookingDetailsTab from './BookingDetailsTab'
import BookingHistoryTab from './tabs/BookingHistoryTab'
import BookingRecordHeader from './BookingRecordHeader'
import BookingRecordSkeleton from './BookingRecordSkeleton'
import BookingRecordErrorBoundary from './BookingRecordErrorBoundary'
import { useBookingRecord } from './useBookingRecord'

const EMPTY_CONTAINERS: BookingContainerRow[] = []

function BookingRecordPageContent() {
  const { bookingId, module } = useParams()
  const id = bookingId ?? module
  const [searchParams] = useSearchParams()
  const { bundle, loading, error, patchBooking, historyTick, bumpHistory } = useBookingRecord(id)

  const backHref = importSeaBackHref(searchParams)
  const initialContainers = bundle?.containers ?? EMPTY_CONTAINERS
  const {
    rows: containerRows,
    addDraft: onAddContainer,
    saveRow: onSaveContainer,
    removeRow: onRemoveContainer,
    resolveConflict: onResolveContainer,
    resolveBusy: containerResolveBusy,
  } = useBookingContainers(id ?? '', initialContainers, bumpHistory)

  const containerNumbers = containerNumbersFromBooking(
    containerRows.filter((r) => !isDraftContainer(r)),
  )
  const tracking = useBookingTracking(id, containerNumbers)
  const portConnectRoute = useMemo(
    () => buildPortConnectRouteContext(tracking.containers),
    [tracking.containers],
  )

  if (loading) {
    return <BookingRecordSkeleton searchParams={searchParams} busy />
  }

  if (error) {
    return (
      <div className="detail-page booking-record-page">
        <Link to={backHref} className="detail-back booking-record-back">
          ← Back to Import Sea board
        </Link>
        <div className="empty card booking-record-error">
          <h2>Failed to load booking</h2>
          <p className="booking-record-error__message">{error.message}</p>
          {error.code ? <p className="mono muted booking-record-error__code">{error.code}</p> : null}
        </div>
      </div>
    )
  }

  if (!bundle) {
    return (
      <div className="detail-page booking-record-page">
        <Link to={backHref} className="detail-back booking-record-back">
          ← Back to Import Sea board
        </Link>
        <div className="empty card">
          Booking not found. <Link to={backHref}>Back to board</Link>
        </div>
      </div>
    )
  }

  const { booking, shipment } = bundle
  const matched = Boolean(booking.shipment_id)
  const eta = shipment?.eta ?? booking.m_eta

  return (
    <div className="detail-page booking-record-page">
      <Link to={backHref} className="detail-back booking-record-back">
        ← Back to Import Sea board
      </Link>

      <BookingRecordHeader
        booking={booking}
        matched={matched}
        eta={eta}
        portConnectRoute={portConnectRoute}
      />

      <Tabs defaultValue="details" className="booking-record-tabs">
        <TabsList variant="line" className="booking-record-tabs__list">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="tracking">Tracking</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <BookingDetailsTab
            bookingId={booking.id}
            booking={booking}
            shipment={shipment}
            containerRows={containerRows}
            onAddContainer={onAddContainer}
            onSaveContainer={onSaveContainer}
            onRemoveContainer={onRemoveContainer}
            onResolveContainer={onResolveContainer}
            containerResolveBusy={containerResolveBusy}
            onPatch={patchBooking}
          />
        </TabsContent>
        <TabsContent value="tracking">
          <BookingTrackingTab containerNumbers={containerNumbers} tracking={tracking} />
        </TabsContent>
        <TabsContent value="documents">
          <BookingDocumentsTab bookingId={booking.id} accountId={booking.account_id} />
        </TabsContent>
        <TabsContent value="history">
          <BookingHistoryTab bookingId={booking.id} refreshKey={historyTick} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function BookingRecordPage() {
  const [searchParams] = useSearchParams()
  const backHref = importSeaBackHref(searchParams)

  return (
    <BookingRecordErrorBoundary backHref={backHref}>
      <BookingRecordPageContent />
    </BookingRecordErrorBoundary>
  )
}

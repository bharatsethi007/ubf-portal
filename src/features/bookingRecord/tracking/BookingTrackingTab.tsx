import { TooltipProvider } from '@/components/ui/tooltip'
import TrackingEnablementPanel from './TrackingEnablementPanel'
import TrackingTabSkeleton from './TrackingTabSkeleton'
import TrackingRouteHeader from './TrackingRouteHeader'
import CarrierEventsList from './CarrierEventsList'
import BookingVesselMap from './BookingVesselMap'
import type { useBookingTracking } from './useBookingTracking'

type TrackingState = ReturnType<typeof useBookingTracking>

type Props = {
  bookingId: string
  containerNumbers: string[]
  tracking: TrackingState
  onPortConnectRefresh?: () => void | Promise<void>
}

export default function BookingTrackingTab({
  bookingId,
  containerNumbers,
  tracking,
  onPortConnectRefresh,
}: Props) {
  const {
    settings,
    containers,
    events,
    loading,
    portConnectBusy,
    refreshBusy,
    carrierBusy,
    lastRefreshedAt,
    patchSettings,
    subscribePortConnect,
    unsubscribePortConnect,
    refreshPortConnect,
    refreshCarrier,
  } = tracking

  const isInitialLoad = loading && !settings
  if (isInitialLoad) return <TrackingTabSkeleton busy />
  if (!settings) {
    return <div className="empty card pad-inline">Unable to load tracking settings.</div>
  }

  const handleRefresh = () => Promise.resolve(
    (onPortConnectRefresh ?? (() => refreshPortConnect()))(),
  )

  return (
    <TooltipProvider delay={300}>
      <div className="booking-tracking-tab flex flex-col gap-4">
        <TrackingEnablementPanel
          settings={settings}
          containerNumbers={containerNumbers}
          containers={containers}
          events={events}
          containersTracked={containers.length}
          portConnectBusy={portConnectBusy}
          refreshBusy={refreshBusy}
          carrierBusy={carrierBusy}
          lastRefreshedAt={lastRefreshedAt}
          onPortConnectSubscribe={subscribePortConnect}
          onPortConnectUnsubscribe={unsubscribePortConnect}
          onPortConnectRefresh={handleRefresh}
          onCarrierRefresh={refreshCarrier}
          onPatch={patchSettings}
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-3">
            <TrackingRouteHeader events={events} />
            <CarrierEventsList events={events} />
          </div>
          <div className="lg:sticky lg:top-4">
            <BookingVesselMap bookingId={bookingId} />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

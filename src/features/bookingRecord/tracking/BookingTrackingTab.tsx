import { TooltipProvider } from '@/components/ui/tooltip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import TrackingEnablementPanel from './TrackingEnablementPanel'
import TrackingTabSkeleton from './TrackingTabSkeleton'
import BookingLocationPanel from './BookingLocationPanel'
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

  if (isInitialLoad) {
    return <TrackingTabSkeleton busy />
  }

  if (!settings) {
    return (
      <div className="empty card pad-inline">
        Unable to load tracking settings.
      </div>
    )
  }

  const handleRefresh = () => Promise.resolve(
    (onPortConnectRefresh ?? (() => refreshPortConnect()))(),
  )

  return (
    <TooltipProvider delay={300}>
      <div className="booking-tracking-tab">
        <Tabs defaultValue="events" className="booking-tracking-subtabs">
          <TabsList variant="line" className="mb-3">
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
          </TabsList>
          <TabsContent value="events">
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
          </TabsContent>
          <TabsContent value="location">
            <BookingLocationPanel bookingId={bookingId} />
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}

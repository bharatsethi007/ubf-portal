import { TooltipProvider } from '@/components/ui/tooltip'
import TrackingEnablementPanel from './TrackingEnablementPanel'
import TrackingTabSkeleton from './TrackingTabSkeleton'
import type { useBookingTracking } from './useBookingTracking'

type TrackingState = ReturnType<typeof useBookingTracking>

type Props = {
  containerNumbers: string[]
  tracking: TrackingState
}

export default function BookingTrackingTab({ containerNumbers, tracking }: Props) {
  const {
    settings,
    containers,
    events,
    loading,
    portConnectBusy,
    refreshBusy,
    lastRefreshedAt,
    patchSettings,
    subscribePortConnect,
    unsubscribePortConnect,
    refreshPortConnect,
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

  return (
    <TooltipProvider delay={300}>
      <div className="booking-tracking-tab">
        <TrackingEnablementPanel
          settings={settings}
          containerNumbers={containerNumbers}
          containers={containers}
          events={events}
          containersTracked={containers.length}
          portConnectBusy={portConnectBusy}
          refreshBusy={refreshBusy}
          lastRefreshedAt={lastRefreshedAt}
          onPortConnectSubscribe={subscribePortConnect}
          onPortConnectUnsubscribe={unsubscribePortConnect}
          onPortConnectRefresh={refreshPortConnect}
          onPatch={patchSettings}
        />
      </div>
    </TooltipProvider>
  )
}

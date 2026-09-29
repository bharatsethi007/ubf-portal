import { Navigate, Route } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import PortalLoginPage from '../features/portal/auth/PortalLoginPage'
import SetPasswordPage from '../features/portal/auth/SetPasswordPage'
import PortalShellV2 from '../features/portal/v2/PortalShellV2'
import PortalHomePage from '../features/portal/v2/PortalHomePage'
import PortalShipmentDetailV3 from '../features/portal/v2/detail/PortalShipmentDetailV3'
import PortalBookingsPage from '../features/portal/v2/bookings/PortalBookingsPage'
import BookingRequestPage from '../features/portal/v2/bookings/BookingRequestPage'
import PortalRatesPage from '../features/portal/v2/rates/PortalRatesPage'
import PortalAnalyticsPage from '../features/portal/v2/analytics/PortalAnalyticsPage'
import PortalProductsPage from '../features/portal/v2/products/PortalProductsPage'
import PortalBillingPage from '../features/portal/v2/billing/PortalBillingPage'
import NotificationSettingsPage from '../features/portal/v2/notifications/NotificationSettingsPage'
import TeamPage from '../features/portal/v2/team/TeamPage'
import PortalShipmentsV3 from '../features/portal/v2/shipments/PortalShipmentsV3'
import WhatsAppSettingsPage from '../features/portal/pages/WhatsAppSettingsPage'
import PortalAuthGate from '../features/portal/auth/PortalAuthGate'

type Props = {
  session: Session | null
  authReady: boolean
  isStaff: boolean
  staffReady: boolean
}

/**
 * Portal route tree. Public routes MUST stay as siblings before PortalAuthGate
 * so /portal/set-password and /portal/login resolve without a session.
 */
export function portalRoutes({ session, authReady, isStaff, staffReady }: Props) {
  return (
    <Route path="/portal">
      <Route path="set-password" element={<SetPasswordPage />} />
      <Route path="login" element={<PortalLoginPage session={session} authReady={authReady} />} />

      <Route element={<PortalAuthGate session={session} isStaff={isStaff} staffReady={staffReady} />}>
        <Route element={<PortalShellV2 session={session!} />}>
          <Route index element={<PortalHomePage />} />
          <Route path="shipments/:jobNo" element={<PortalShipmentDetailV3 />} />
          <Route path="shipments" element={<PortalShipmentsV3 />} />
          <Route path="bookings" element={<PortalBookingsPage />} />
          <Route path="bookings/new" element={<BookingRequestPage />} />
          <Route path="rates" element={<PortalRatesPage />} />
          <Route path="analytics" element={<PortalAnalyticsPage />} />
          <Route path="products" element={<PortalProductsPage />} />
          <Route path="quotes" element={<Navigate to="/portal/rates" replace />} />
          <Route path="billing" element={<PortalBillingPage />} />
          <Route path="settings/whatsapp" element={<WhatsAppSettingsPage />} />
          <Route path="settings/notifications" element={<NotificationSettingsPage />} />
          <Route path="settings/team" element={<TeamPage />} />
        </Route>
      </Route>
    </Route>
  )
}

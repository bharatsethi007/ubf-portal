import { Route } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import PortalLoginPage from '../features/portal/auth/PortalLoginPage'
import SetPasswordPage from '../features/portal/auth/SetPasswordPage'
import PortalShell from '../features/portal/layout/PortalShell'
import PortalDashboardPage from '../features/portal/dashboard/PortalDashboardPage'
import PortalShipmentDetailPage from '../features/portal/shipment/PortalShipmentDetailPage'
import PortalShipmentsPage from '../features/portal/pages/PortalShipmentsPage'
import PortalStubPage from '../features/portal/stubs/PortalStubPage'
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
        <Route element={<PortalShell session={session!} />}>
          <Route index element={<PortalDashboardPage />} />
          <Route path="shipments/:jobNo" element={<PortalShipmentDetailPage />} />
          <Route path="shipments" element={<PortalShipmentsPage />} />
          <Route path="bookings" element={<PortalStubPage title="Bookings" />} />
          <Route path="quotes" element={<PortalStubPage title="Quotes" />} />
          <Route path="billing" element={<PortalStubPage title="Billing" />} />
        </Route>
      </Route>
    </Route>
  )
}

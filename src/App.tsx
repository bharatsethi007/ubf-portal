import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import AppShell from './layouts/AppShell'
import { PermissionsProvider } from './access/PermissionsProvider'
import Login from './Login'
import StaffSetPasswordPage from './StaffSetPasswordPage'
import ForgotPasswordPage from './ForgotPasswordPage'
import { portalRoutes } from './routes/portalRoutes'
import { EstimatesPage, NewBookingPage, SchedulesPage } from './pages/stubs/StubPages'
import UsersArea from './pages/users/UsersArea'
import ReportsPage from './pages/reports/ReportsPage'
import CustomersPage from './pages/CustomersPage'
import AgentsArea from './pages/agents/AgentsArea'
import ConferenceRecordPage from './pages/agents/conferences/ConferenceRecordPage'
import AgentRecordPage from './pages/agents/AgentRecordPage'
import ReviewQueuePage from './pages/agents/review/ReviewQueuePage'
import QuotesPage from './pages/quotes/QuotesPage'
import MyTasksPage from './features/tasks/MyTasksPage'
import NewQuoteSearch from './pages/quotes/NewQuoteSearch'
import QuoteDetailPage from './pages/quotes/QuoteDetailPage'
import QuoteResponsePage from './pages/quotes/QuoteResponsePage'
import CustomerProfile from './pages/CustomerProfile'
import Shipments from './pages/Shipments'
import TmsPage from './features/tms/TmsPage'
import ConsignmentForm from './features/tms/ConsignmentForm'
import Dashboard from './pages/DashboardPage'
import ShipmentDetail from './pages/ShipmentDetail'
import { BookingRecordRoute } from './pages/BookingsRoute'
import BookingFormPage from './pages/bookings/BookingFormPage'
import StaffRoute from './components/StaffRoute'
import StaffMfaGate from './components/StaffMfaGate'
import SliPage from './features/sli/SliPage'
import PublicTrackPage from './features/publicTrack/PublicTrackPage'
import RatePage from './pages/public/RatePage'
import BookingsWorkspacePage from './features/bookingsWorkspace/BookingsWorkspacePage'
import CourierBookingsList from './pages/courier/CourierBookingsList'
import CourierBookingDetail from './pages/courier/CourierBookingDetail'
import SetupPage from './pages/setup/SetupPage'
import RatesPage from './pages/rates/RatesPage'
import MarginRulesPage from './pages/rates/margins/MarginRulesPage'
import CartageSetupPage from './pages/cartage/CartageSetupPage'
import RateModulePage from './pages/rates/RateModulePage'
import RateRulesPage from './pages/rates/RateRulesPage'
import FclRateCardsList from './pages/rates/fcl/FclRateCardsList'
import FclRateCardForm from './pages/rates/fcl/FclRateCardForm'
import FclRateCardDetail from './pages/rates/fcl/FclRateCardDetail'
import CartageRateCardsList from './pages/rates/cartage/CartageRateCardsList'
import CartageRateCardForm from './pages/rates/cartage/CartageRateCardForm'
import CartageRateCardDetail from './pages/rates/cartage/CartageRateCardDetail'
import FclLocalChargesList from './pages/rates/fcl-local/FclLocalChargesList'
import FclLocalChargeSheetForm from './pages/rates/fcl-local/FclLocalChargeSheetForm'
import FclLocalChargeSheetDetail from './pages/rates/fcl-local/FclLocalChargeSheetDetail'
import LclRateCardsList from './pages/rates/lcl/LclRateCardsList'
import LclRateCardForm from './pages/rates/lcl/LclRateCardForm'
import LclRateCardDetail from './pages/rates/lcl/LclRateCardDetail'
import AirRateCardsList from './pages/rates/air/AirRateCardsList'
import AirRateCardForm from './pages/rates/air/AirRateCardForm'
import AirRateCardDetail from './pages/rates/air/AirRateCardDetail'
import AirLocalChargesList from './pages/rates/air-local/AirLocalChargesList'
import AirLocalChargeSheetForm from './pages/rates/air-local/AirLocalChargeSheetForm'
import AirLocalChargeSheetDetail from './pages/rates/air-local/AirLocalChargeSheetDetail'
import ChargeCodesPage from './pages/setup/ChargeCodesPage'
import CarriersPage from './pages/setup/CarriersPage'
import PortsPage from './pages/setup/PortsPage'
import ChargeTemplatesPage from './pages/setup/ChargeTemplatesPage'
import ExchangeRatesPage from './pages/setup/ExchangeRatesPage'
import EmailSignatureCsat from './pages/setup/EmailSignatureCsat'
import SystemHealthPage from './pages/setup/health/SystemHealthPage'
import WhatsAppInboxPage from './pages/whatsapp/WhatsAppInboxPage'
import PortalMessagesInbox from './pages/messages/PortalMessagesInbox'
import { Toaster } from './components/ui/sonner'

function StaffDenied() {
  return (
    <div className="center">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark">UB</span> Freight</div>
        <h1>Staff access only</h1>
        <p className="muted">Your account is not registered as UB Freight staff. Contact your administrator if you need access.</p>
        <button className="btn" type="button" onClick={() => supabase.auth.signOut({ scope: 'local' })}>Sign out</button>
      </div>
    </div>
  )
}

function AuthGate({
  session, isStaff, isPortalUser, staffReady,
}: {
  session: Session | null
  isStaff: boolean
  isPortalUser: boolean
  staffReady: boolean
}) {
  if (!session) return <Login />
  if (!staffReady) return <div className="center muted">Loading…</div>
  if (!isStaff && isPortalUser) {
    const portalUrl = (import.meta.env.VITE_PORTAL_URL || (window.location.hostname.endsWith('ubfreight.com') ? 'https://portal.ubfreight.com' : '')).replace(/\/+$/, '')
    if (portalUrl) {
      window.location.replace(`${portalUrl}/portal`)
      return <div className="center muted">Loading…</div>
    }
    return <Navigate to="/portal" replace />
  }
  if (!isStaff) return <StaffDenied />
  return <StaffMfaGate><Outlet /></StaffMfaGate>
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const [isPortalUser, setIsPortalUser] = useState(false)
  const [staffReady, setStaffReady] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) {
      setIsStaff(false)
      setIsPortalUser(false)
      setStaffReady(true)
      return
    }
    setStaffReady(false)
    ;(async () => {
      const [{ data: staff }, { data: portal }] = await Promise.all([
        supabase.from('staff_users').select('user_id, is_active').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('portal_users').select('account_id, status').eq('user_id', session.user.id).maybeSingle(),
      ])

      // Disabled staff are treated as non-staff (RLS already blocks them via is_staff()).
      setIsStaff(!!staff && staff.is_active !== false)
      setIsPortalUser(!!portal?.account_id && portal.status === 'active')
      setStaffReady(true)
    })()
  }, [session?.user?.id])

  if (!ready) return <div className="center muted">Loading…</div>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sli/:token" element={<SliPage />} />
        <Route path="/t/:token" element={<PublicTrackPage />} />
        <Route path="/rate" element={<RatePage />} />
        <Route path="/set-password" element={<StaffSetPasswordPage />} />
        <Route path="/forgot-password" element={session ? <Navigate to="/" replace /> : <ForgotPasswordPage />} />

        {portalRoutes({ session, authReady: ready, isStaff, staffReady })}

        <Route element={<AuthGate session={session} isStaff={isStaff} isPortalUser={isPortalUser} staffReady={staffReady} />}>
          <Route
            element={
              <PermissionsProvider>
                <AppShell session={session!} search={search} onSearch={setSearch} />
              </PermissionsProvider>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/shipments/:id" element={<ShipmentDetail />} />
            <Route path="/shipments" element={<Shipments globalSearch={search} />} />
            <Route path="/tms" element={<StaffRoute><TmsPage /></StaffRoute>} />
            <Route path="/tms/new" element={<StaffRoute><ConsignmentForm /></StaffRoute>} />
            <Route path="/tms/:id/edit" element={<StaffRoute><ConsignmentForm /></StaffRoute>} />
            <Route path="/new-booking" element={<NewBookingPage />} />
            <Route path="/estimates" element={<EstimatesPage />} />
            <Route path="/quotes" element={<StaffRoute><QuotesPage /></StaffRoute>} />
            <Route path="/tasks" element={<StaffRoute><MyTasksPage /></StaffRoute>} />
            <Route path="/whatsapp" element={<StaffRoute><WhatsAppInboxPage /></StaffRoute>} />
            <Route path="/messages" element={<StaffRoute><PortalMessagesInbox /></StaffRoute>} />
            <Route path="/quotes/new" element={<StaffRoute><NewQuoteSearch /></StaffRoute>} />
            <Route path="/quotes/:id/responses/:responseId" element={<StaffRoute><QuoteResponsePage /></StaffRoute>} />
            <Route path="/quotes/:id" element={<StaffRoute><QuoteDetailPage /></StaffRoute>} />
            <Route path="/bookings" element={<StaffRoute><BookingsWorkspacePage /></StaffRoute>} />
            <Route path="/bookings/import-sea" element={<StaffRoute><BookingsWorkspacePage slug="import-sea" /></StaffRoute>} />
            <Route path="/bookings/import-air" element={<StaffRoute><BookingsWorkspacePage slug="import-air" /></StaffRoute>} />
            <Route path="/bookings/export-sea" element={<StaffRoute><BookingsWorkspacePage slug="export-sea" /></StaffRoute>} />
            <Route path="/bookings/export-air" element={<StaffRoute><BookingsWorkspacePage slug="export-air" /></StaffRoute>} />
            <Route
              path="/bookings/courier"
              element={<StaffRoute><CourierBookingsList /></StaffRoute>}
            />
            <Route
              path="/bookings/courier/:id"
              element={<StaffRoute><CourierBookingDetail /></StaffRoute>}
            />
            <Route
              path="/bookings/:module/new"
              element={<StaffRoute><BookingFormPage /></StaffRoute>}
            />
            <Route
              path="/bookings/:module/:id/edit"
              element={<StaffRoute><BookingFormPage /></StaffRoute>}
            />
            <Route path="/bookings/EA" element={<Navigate to="/bookings/export-air" replace />} />
            <Route path="/bookings/ES" element={<Navigate to="/bookings/export-sea" replace />} />
            <Route path="/bookings/IA" element={<Navigate to="/bookings/import-air" replace />} />
            <Route path="/bookings/IS" element={<Navigate to="/bookings/import-sea" replace />} />
            <Route
              path="/bookings/:bookingId"
              element={<StaffRoute><BookingRecordRoute /></StaffRoute>}
            />
            <Route
              path="/customers/:accountId"
              element={<StaffRoute><CustomerProfile /></StaffRoute>}
            />
            <Route
              path="/customers"
              element={<StaffRoute><CustomersPage /></StaffRoute>}
            />
            <Route path="/agents" element={<StaffRoute><AgentsArea /></StaffRoute>} />
            <Route path="/agents/review" element={<StaffRoute><ReviewQueuePage /></StaffRoute>} />
            <Route
              path="/agents/conferences/:id"
              element={<StaffRoute><ConferenceRecordPage /></StaffRoute>}
            />
            <Route path="/agents/:id" element={<StaffRoute><AgentRecordPage /></StaffRoute>} />
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/users" element={<UsersArea />} />
            <Route path="/setup/rates" element={<StaffRoute><RatesPage /></StaffRoute>} />
            <Route path="/setup/rates/margins" element={<StaffRoute><MarginRulesPage /></StaffRoute>} />
            <Route path="/setup/cartage" element={<StaffRoute><CartageSetupPage /></StaffRoute>} />
            <Route path="/setup/rates/fcl" element={<StaffRoute><FclRateCardsList /></StaffRoute>} />
            <Route path="/setup/rates/fcl/new" element={<StaffRoute><FclRateCardForm /></StaffRoute>} />
            <Route path="/setup/rates/fcl/:id" element={<StaffRoute><FclRateCardDetail /></StaffRoute>} />
            <Route path="/setup/rates/lcl" element={<StaffRoute><LclRateCardsList /></StaffRoute>} />
            <Route path="/setup/rates/lcl/new" element={<StaffRoute><LclRateCardForm /></StaffRoute>} />
            <Route path="/setup/rates/lcl/:id" element={<StaffRoute><LclRateCardDetail /></StaffRoute>} />
            <Route path="/setup/rates/air" element={<StaffRoute><AirRateCardsList /></StaffRoute>} />
            <Route path="/setup/rates/courier" element={<StaffRoute><RateModulePage title="Courier" /></StaffRoute>} />
            <Route path="/setup/rates/air/new" element={<StaffRoute><AirRateCardForm /></StaffRoute>} />
            <Route path="/setup/rates/air/:id" element={<StaffRoute><AirRateCardDetail /></StaffRoute>} />
            <Route path="/setup/rates/fcl-local" element={<StaffRoute><FclLocalChargesList /></StaffRoute>} />
            <Route path="/setup/rates/fcl-local/new" element={<StaffRoute><FclLocalChargeSheetForm /></StaffRoute>} />
            <Route path="/setup/rates/fcl-local/:id" element={<StaffRoute><FclLocalChargeSheetDetail /></StaffRoute>} />
            <Route path="/setup/rates/cartage" element={<StaffRoute><CartageRateCardsList /></StaffRoute>} />
            <Route path="/setup/rates/cartage/new" element={<StaffRoute><CartageRateCardForm /></StaffRoute>} />
            <Route path="/setup/rates/cartage/:id" element={<StaffRoute><CartageRateCardDetail /></StaffRoute>} />
            <Route path="/setup/rates/lcl-local" element={<StaffRoute><FclLocalChargesList mode="lcl" /></StaffRoute>} />
            <Route path="/setup/rates/lcl-local/new" element={<StaffRoute><FclLocalChargeSheetForm mode="lcl" /></StaffRoute>} />
            <Route path="/setup/rates/lcl-local/:id" element={<StaffRoute><FclLocalChargeSheetDetail mode="lcl" /></StaffRoute>} />
            <Route path="/setup/rates/air-local" element={<StaffRoute><AirLocalChargesList /></StaffRoute>} />
            <Route path="/setup/rates/air-local/new" element={<StaffRoute><AirLocalChargeSheetForm /></StaffRoute>} />
            <Route path="/setup/rates/air-local/:id" element={<StaffRoute><AirLocalChargeSheetDetail /></StaffRoute>} />
            <Route path="/setup/rates/rules" element={<StaffRoute><RateRulesPage /></StaffRoute>} />
            <Route path="/setup/rates/ports" element={<StaffRoute><RateModulePage title="Ports & Groups" /></StaffRoute>} />
            <Route path="/setup" element={<StaffRoute><SetupPage /></StaffRoute>} />
            <Route path="/setup/charge-codes" element={<StaffRoute><ChargeCodesPage /></StaffRoute>} />
            <Route path="/setup/carriers" element={<StaffRoute><CarriersPage /></StaffRoute>} />
            <Route path="/setup/ports" element={<StaffRoute><PortsPage /></StaffRoute>} />
            <Route path="/setup/charge-templates" element={<StaffRoute><ChargeTemplatesPage /></StaffRoute>} />
            <Route path="/setup/exchange-rates" element={<StaffRoute><ExchangeRatesPage /></StaffRoute>} />
            <Route path="/setup/email-signature-csat" element={<StaffRoute><EmailSignatureCsat /></StaffRoute>} />
            <Route path="/setup/system-health" element={<StaffRoute><SystemHealthPage /></StaffRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
      <Toaster richColors closeButton />
    </BrowserRouter>
  )
}

import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import AppShell from './layouts/AppShell'
import Login from './Login'
import { portalRoutes } from './routes/portalRoutes'
import {
  EstimatesPage,
  NewBookingPage,
  ReportsPage,
  SchedulesPage,
  UsersPage,
} from './pages/stubs/StubPages'
import CustomersPage from './pages/CustomersPage'
import CustomerProfile from './pages/CustomerProfile'
import Shipments from './pages/Shipments'
import Dashboard from './pages/DashboardPage'
import ShipmentDetail from './pages/ShipmentDetail'
import BookingsPage from './pages/BookingsPage'
import { BookingRecordRoute } from './pages/BookingsRoute'
import BookingFormPage from './pages/bookings/BookingFormPage'
import StaffRoute from './components/StaffRoute'
import SliPage from './features/sli/SliPage'
import ImportSeaBoardPage from './features/importSea/ImportSeaBoardPage'
import { Toaster } from './components/ui/sonner'

function StaffDenied() {
  return (
    <div className="center">
      <div className="auth-card">
        <div className="brand"><span className="brand-mark">UB</span> Freight</div>
        <h1>Staff access only</h1>
        <p className="muted">Your account is not registered as UB Freight staff. Contact your administrator if you need access.</p>
        <button className="btn" type="button" onClick={() => supabase.auth.signOut()}>Sign out</button>
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
  if (!isStaff && isPortalUser) return <Navigate to="/portal" replace />
  if (!isStaff) return <StaffDenied />
  return <Outlet />
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const [isPortalUser, setIsPortalUser] = useState(false)
  const [staffReady, setStaffReady] = useState(false)
  const [staffName, setStaffName] = useState('')
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
      setStaffName('')
      setStaffReady(true)
      return
    }
    setStaffReady(false)
    ;(async () => {
      const [{ data: staff }, { data: portal }] = await Promise.all([
        supabase.from('staff_users').select('user_id').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('portal_users').select('account_id, status').eq('user_id', session.user.id).maybeSingle(),
      ])

      setIsStaff(!!staff)
      setIsPortalUser(!!portal?.account_id && portal.status === 'active')

      const { data: contact } = await supabase
        .from('contacts')
        .select('first_name, last_name')
        .eq('email', session.user.email ?? '')
        .maybeSingle()

      if (contact?.first_name) {
        setStaffName([contact.first_name, contact.last_name].filter(Boolean).join(' '))
      } else {
        setStaffName(session.user.email?.split('@')[0] ?? 'Staff')
      }
      setStaffReady(true)
    })()
  }, [session])

  if (!ready) return <div className="center muted">Loading…</div>

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/sli/:token" element={<SliPage />} />

        {portalRoutes({ session, authReady: ready, isStaff, staffReady })}

        <Route element={<AuthGate session={session} isStaff={isStaff} isPortalUser={isPortalUser} staffReady={staffReady} />}>
          <Route
            element={
              <AppShell session={session!} staffName={staffName} search={search} onSearch={setSearch} />
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/shipments/:id" element={<ShipmentDetail />} />
            <Route path="/shipments" element={<Shipments globalSearch={search} />} />
            <Route path="/new-booking" element={<NewBookingPage />} />
            <Route path="/estimates" element={<EstimatesPage />} />
            <Route
              path="/bookings/import-sea"
              element={<StaffRoute><ImportSeaBoardPage /></StaffRoute>}
            />
            <Route
              path="/bookings/:module/new"
              element={<StaffRoute><BookingFormPage /></StaffRoute>}
            />
            <Route
              path="/bookings/:module/:id/edit"
              element={<StaffRoute><BookingFormPage /></StaffRoute>}
            />
            <Route path="/bookings/EA" element={<StaffRoute><BookingsPage module="EA" /></StaffRoute>} />
            <Route path="/bookings/ES" element={<StaffRoute><BookingsPage module="ES" /></StaffRoute>} />
            <Route path="/bookings/IA" element={<StaffRoute><BookingsPage module="IA" /></StaffRoute>} />
            <Route path="/bookings/IS" element={<StaffRoute><BookingsPage module="IS" /></StaffRoute>} />
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
            <Route path="/schedules" element={<SchedulesPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
      </Routes>
      <Toaster richColors closeButton />
    </BrowserRouter>
  )
}

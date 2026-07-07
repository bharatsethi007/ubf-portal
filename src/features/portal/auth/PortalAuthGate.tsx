import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../../supabase'
import { usePortalAccount } from './usePortalAccount'
import '../layout/portalTheme.css'

type Props = {
  session: Session | null
  isStaff: boolean
  staffReady: boolean
}

function PortalDenied() {
  return (
    <div className="portal-root portal-denied">
      <div className="portal-card portal-denied__card">
        <h1 className="portal-heading" style={{ fontSize: 22 }}>Customer portal access only</h1>
        <p style={{ color: 'var(--portal-muted)', marginTop: 12 }}>
          Your account is not linked to a customer portal profile. Contact UB Freight if you need access.
        </p>
        <button type="button" className="portal-btn-primary" style={{ marginTop: 20 }}
          onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>
    </div>
  )
}

export default function PortalAuthGate({ session, isStaff, staffReady }: Props) {
  const location = useLocation()
  const { isPortalUser, portalStatus, loading } = usePortalAccount(session)

  if (!session) return <Navigate to="/portal/login" state={{ from: location.pathname }} replace />
  if (!staffReady || loading) return <div className="portal-root portal-empty" style={{ minHeight: '100vh' }}>Loading…</div>
  if (isStaff) return <Navigate to="/" replace />
  if (portalStatus === 'revoked') {
    return (
      <div className="portal-root portal-denied">
        <div className="portal-card portal-denied__card">
          <h1 className="portal-heading" style={{ fontSize: 22 }}>Portal access revoked</h1>
          <p style={{ color: 'var(--portal-muted)', marginTop: 12 }}>
            Your portal access has been revoked. Contact UB Freight if you need access restored.
          </p>
          <button type="button" className="portal-btn-primary" style={{ marginTop: 20 }}
            onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </div>
    )
  }
  if (!isPortalUser) return <PortalDenied />
  return <Outlet />
}

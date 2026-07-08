import { Outlet } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import PortalNav from '../components/PortalNav'
import { usePortalAccount } from '../auth/usePortalAccount'
import './portalTheme.css'

type Props = { session: Session }

export default function PortalShell({ session }: Props) {
  const { account } = usePortalAccount(session)

  return (
    <div className="portal-root">
      <PortalNav
        displayName={account?.displayName ?? 'Customer portal'}
        userEmail={account?.email ?? session.user.email ?? ''}
        initials={account?.initials ?? 'CU'}
      />
      <main className="portal-main">
        <Outlet />
      </main>
    </div>
  )
}

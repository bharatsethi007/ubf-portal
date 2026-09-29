import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { usePortalAccount, type PortalAccount } from '../auth/usePortalAccount'
import PortalTopBar from './PortalTopBar'
import CommandPalette from './CommandPalette'
import '../layout/portalTheme.css'
import './portalV2.css'

export type PortalOutletContext = { account: PortalAccount | null; openSearch: () => void }

type Props = { session: Session }

export default function PortalShellV2({ session }: Props) {
  const { account } = usePortalAccount(session)
  const [searchOpen, setSearchOpen] = useState(false)
  const { pathname } = useLocation()
  const flush = pathname === '/portal' || pathname === '/portal/' || pathname.startsWith('/portal/shipments') || pathname.startsWith('/portal/bookings') || pathname.startsWith('/portal/rates') || pathname.startsWith('/portal/analytics') || pathname.startsWith('/portal/products') || pathname.startsWith('/portal/billing')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => { setSearchOpen(false) }, [pathname])

  const ctx: PortalOutletContext = { account, openSearch: () => setSearchOpen(true) }

  return (
    <div className="portal-root pv2-root">
      <PortalTopBar
        displayName={account?.displayName ?? 'Customer portal'}
        userEmail={account?.email ?? session.user.email ?? ''}
        initials={account?.initials ?? 'CU'}
        onSearch={() => setSearchOpen(true)}
      />
      <main className={flush ? 'pv2-main pv2-main--flush' : 'pv2-main portal-main'}>
        <Outlet context={ctx} />
      </main>
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}

import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { portalRoutes } from './routes/portalRoutes'

const CONSOLE_URL = (import.meta.env.VITE_CONSOLE_URL || 'https://console.ubfreight.com').replace(/\/+$/, '')

/** Staff who land on the customer portal get sent to the staff console. */
function RootRedirect({ isStaff, staffReady }: { isStaff: boolean; staffReady: boolean }) {
  useEffect(() => {
    if (staffReady && isStaff) window.location.replace(CONSOLE_URL)
  }, [isStaff, staffReady])
  if (!staffReady || isStaff) return <div className="center muted">Loading…</div>
  return <Navigate to="/portal" replace />
}

export default function PortalApp() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [isStaff, setIsStaff] = useState(false)
  const [staffReady, setStaffReady] = useState(false)

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
      setStaffReady(true)
      return
    }
    setStaffReady(false)
    ;(async () => {
      const { data: staff } = await supabase
        .from('staff_users')
        .select('user_id, is_active')
        .eq('user_id', session.user.id)
        .maybeSingle()
      setIsStaff(!!staff && staff.is_active !== false)
      setStaffReady(true)
    })()
  }, [session?.user?.id])

  if (!ready) return <div className="center muted">Loading…</div>

  return (
    <BrowserRouter>
      <Routes>
        {portalRoutes({ session, authReady: ready, isStaff, staffReady })}
        <Route path="*" element={<RootRedirect isStaff={isStaff} staffReady={staffReady} />} />
      </Routes>
    </BrowserRouter>
  )
}

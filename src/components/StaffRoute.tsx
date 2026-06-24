import { useEffect, useState, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../supabase'

type Props = { children: ReactNode }

export default function StaffRoute({ children }: Props) {
  const [state, setState] = useState<'loading' | 'allowed' | 'denied'>('loading')

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (cancelled) return
      if (!user) {
        setState('denied')
        return
      }
      const { data } = await supabase
        .from('staff_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (cancelled) return
      setState(data ? 'allowed' : 'denied')
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') return <div className="muted pad">Loading…</div>
  if (state === 'denied') return <Navigate to="/" replace />
  return <>{children}</>
}

import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export function useStaff() {
  const [isStaff, setIsStaff] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (cancelled) return

      const user = auth.user
      if (!user) {
        setIsStaff(false)
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('staff_users')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (cancelled) return
      setIsStaff(!!data)
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return { isStaff, loading }
}
